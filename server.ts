import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { MsEdgeTTS, OUTPUT_FORMAT } from "edge-tts-node";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "1mb" }));

// Helper to sanitize Gemini response text
function parseGeminiJson(text: string) {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Gemini sometimes prefixes/suffixes the JSON with stray commentary.
    // Retry by extracting the outermost [...] or {...} block before giving up.
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    const candidate = arrayMatch?.[0] || objectMatch?.[0];

    if (candidate) {
      try {
        return JSON.parse(candidate);
      } catch (e2) {
        console.error("Failed to parse Gemini JSON output (after extraction retry):", e2, "Raw:", text);
        return null;
      }
    }

    console.error("Failed to parse Gemini JSON output:", e, "Raw:", text);
    return null;
  }
}

// Fallback high quality video URLs for common visual queries when Pexels API key is omitted or limit reached.
// NOTE: All fallback hosts must (a) serve HTTP range requests and (b) send `access-control-allow-origin: *`
// so the video can be drawn to a canvas with crossOrigin='anonymous' during MP4 export.
const FALLBACK_VIDEOS: Record<string, string> = {
  space: "https://videos.pexels.com/video-files/1093662/1093662-hd_1920_1080_30fps.mp4",
  nature: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  ocean: "https://videos.pexels.com/video-files/3129671/3129671-hd_1920_1080_30fps.mp4",
  tech: "https://videos.pexels.com/video-files/856975/856975-hd_1280_720_25fps.mp4",
  default: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
};

// Centralized list of Gemini text-generation models tried in priority order.
// Used by /api/generate-script and /api/test-keys so the fallback chain stays in sync.
const TEXT_GEN_MODELS_TO_TRY = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash"];

// In-memory model request and token usage tracker
interface ModelUsageTracker {
  requestsThisMinute: number;
  requestsToday: number;
  tokensThisMinute: number;
  tokensToday: number;
  lastMinuteWindow: number;
  lastDayWindow: string;
}

const modelUsageTrackerMap: Record<string, ModelUsageTracker> = {};

function trackGeminiUsage(modelId: string, estimatedTokens: number = 300) {
  const now = new Date();
  const currentMinuteWindow = Math.floor(now.getTime() / 60000);
  const currentDayWindow = now.toISOString().split("T")[0];

  if (!modelUsageTrackerMap[modelId]) {
    modelUsageTrackerMap[modelId] = {
      requestsThisMinute: 0,
      requestsToday: 0,
      tokensThisMinute: 0,
      tokensToday: 0,
      lastMinuteWindow: currentMinuteWindow,
      lastDayWindow: currentDayWindow,
    };
  }

  const tracker = modelUsageTrackerMap[modelId];

  // Reset minute window if 60 seconds have passed
  if (tracker.lastMinuteWindow !== currentMinuteWindow) {
    tracker.requestsThisMinute = 0;
    tracker.tokensThisMinute = 0;
    tracker.lastMinuteWindow = currentMinuteWindow;
  }

  // Reset day window if new day
  if (tracker.lastDayWindow !== currentDayWindow) {
    tracker.requestsToday = 0;
    tracker.tokensToday = 0;
    tracker.lastDayWindow = currentDayWindow;
  }

  tracker.requestsThisMinute += 1;
  tracker.requestsToday += 1;
  tracker.tokensThisMinute += estimatedTokens;
  tracker.tokensToday += estimatedTokens;
}

// API: Test individual Gemini models status, quotas and remaining usages
app.post("/api/model-status", async (req, res) => {
  const { apiKey } = req.body || {};
  const effectiveGeminiKey = apiKey || process.env.GEMINI_API_KEY;

  const defaultModelsList = [
    {
      id: "gemini-3.5-flash-lite",
      name: "Gemini 3.5 Flash Lite",
      role: "Birincil Senaryo Motoru (En Hızlı & Yüksek Performans)",
      quota: { rpm: 15, tpm: 1000000, tpmText: "1.000.000", rpd: 1500 }
    },
    {
      id: "gemini-3.1-flash-lite",
      name: "Gemini 3.1 Flash Lite",
      role: "İkincil Yedek Senaryo Motoru",
      quota: { rpm: 15, tpm: 1000000, tpmText: "1.000.000", rpd: 1500 }
    },
    {
      id: "gemini-3.1-flash-tts-preview",
      name: "Gemini 3.1 Flash TTS",
      role: "Yapay Zeka Seslendirme Motoru (3.1 Flash TTS)",
      quota: { rpm: 15, tpm: 1000000, tpmText: "1.000.000", rpd: 1500 }
    },
    {
      id: "gemini-2.5-pro-preview-tts",
      name: "Gemini 2.5 Pro TTS",
      role: "Yapay Zeka Yüksek Kalite Seslendirme Motoru (2.5 Pro TTS)",
      quota: { rpm: 2, tpm: 32000, tpmText: "32.000", rpd: 50 }
    },
    {
      id: "gemini-2.5-pro",
      name: "Gemini 2.5 Pro",
      role: "Derin Mantık & Karmaşık Senaryo Motoru",
      quota: { rpm: 2, tpm: 32000, tpmText: "32.000", rpd: 50 }
    }
  ];

  if (!effectiveGeminiKey) {
    return res.json({
      configured: false,
      models: defaultModelsList.map(m => ({
        ...m,
        status: "missing",
        working: false,
        latencyMs: 0,
        message: "API Key bulunamadı",
        usage: {
          usedRPM: 0,
          remainingRPM: m.quota.rpm,
          usedRPD: 0,
          remainingRPD: m.quota.rpd,
          usedTPM: 0,
          remainingTPM: m.quota.tpm,
        },
        googleSpecs: {
          inputTokenLimit: 1048576,
          outputTokenLimit: 8192,
        }
      }))
    });
  }

  // Query Google Models API to fetch real API specs
  let googleModelsMap: Record<string, any> = {};
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${effectiveGeminiKey}`);
    if (listRes.ok) {
      const listData: any = await listRes.json();
      if (listData && Array.isArray(listData.models)) {
        listData.models.forEach((gm: any) => {
          const cleanName = gm.name?.replace("models/", "");
          if (cleanName) {
            googleModelsMap[cleanName] = gm;
          }
        });
      }
    }
  } catch (gErr) {
    console.warn("Could not query Google Models API metadata:", gErr);
  }

  const ai = new GoogleGenAI({
    apiKey: effectiveGeminiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });

  const modelResults = [];

  for (const m of defaultModelsList) {
    const startTime = Date.now();
    let isSuccess = false;
    let statusMsg = "Hazır ve Bağlı (200 OK)";
    let latencyMs = 0;

    // Retrieve active usage stats
    const now = new Date();
    const currentMinuteWindow = Math.floor(now.getTime() / 60000);
    const currentDayWindow = now.toISOString().split("T")[0];

    const tracker = modelUsageTrackerMap[m.id] || {
      requestsThisMinute: 0,
      requestsToday: 0,
      tokensThisMinute: 0,
      tokensToday: 0,
      lastMinuteWindow: currentMinuteWindow,
      lastDayWindow: currentDayWindow,
    };

    // Ensure minute/day resets
    const usedRPM = tracker.lastMinuteWindow === currentMinuteWindow ? tracker.requestsThisMinute : 0;
    const usedRPD = tracker.lastDayWindow === currentDayWindow ? tracker.requestsToday : 0;
    const usedTPM = tracker.lastMinuteWindow === currentMinuteWindow ? tracker.tokensThisMinute : 0;

    const remainingRPM = Math.max(0, m.quota.rpm - usedRPM);
    const remainingRPD = Math.max(0, m.quota.rpd - usedRPD);
    const remainingTPM = Math.max(0, m.quota.tpm - usedTPM);

    try {
      const response = await ai.models.generateContent({
        model: m.id,
        contents: "Ping",
      });
      latencyMs = Date.now() - startTime;
      trackGeminiUsage(m.id, 10);

      if (response && response.text) {
        isSuccess = true;
      } else {
        statusMsg = "Boş Yanıt Döndü";
      }
    } catch (err: any) {
      latencyMs = Date.now() - startTime;
      const errMsg = err?.message || String(err);
      if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
        statusMsg = "Kota Sınırı Aşımı (429 Rate Limit - Bekleme Modunda)";
      } else if (errMsg.includes("404") || errMsg.includes("NOT_FOUND")) {
        statusMsg = "Model Adı veya Bölgesel Erişim Desteklenmiyor";
      } else if (errMsg.includes("401") || errMsg.includes("invalid")) {
        statusMsg = "Geçersiz API Anahtarı (401 Unauthorized)";
      } else {
        statusMsg = `API Yanıtı: ${errMsg.substring(0, 100)}`;
      }
    }

    const gSpec = googleModelsMap[m.id] || {};

    modelResults.push({
      ...m,
      status: isSuccess ? "ok" : "warning",
      working: isSuccess,
      latencyMs,
      message: statusMsg,
      usage: {
        usedRPM: usedRPM + (isSuccess ? 1 : 0),
        remainingRPM: Math.max(0, remainingRPM - (isSuccess ? 1 : 0)),
        usedRPD: usedRPD + (isSuccess ? 1 : 0),
        remainingRPD: Math.max(0, remainingRPD - (isSuccess ? 1 : 0)),
        usedTPM: usedTPM + 10,
        remainingTPM: Math.max(0, remainingTPM - 10),
      },
      googleSpecs: {
        displayName: gSpec.displayName || m.name,
        inputTokenLimit: gSpec.inputTokenLimit || 1048576,
        outputTokenLimit: gSpec.outputTokenLimit || 8192,
        version: gSpec.version || "1.0",
      }
    });
  }

  return res.json({
    configured: true,
    models: modelResults,
    keyType: apiKey ? "Özel Kullanıcı Key'i" : "Sunucu Varsayılan Key'i",
  });
});

// API: Check system status
app.get("/api/status", (req, res) => {
  res.json({
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    pexelsConfigured: Boolean(process.env.PEXELS_API_KEY),
  });
});

// API: Test Gemini and Pexels API keys
app.post("/api/test-keys", async (req, res) => {
  const { geminiKey, pexelsKey } = req.body || {};
  const effectiveGeminiKey = (geminiKey || process.env.GEMINI_API_KEY || "").trim();
  const effectivePexelsKey = (pexelsKey || process.env.PEXELS_API_KEY || "").trim();

  const result = {
    gemini: {
      configured: Boolean(effectiveGeminiKey),
      working: false,
      status: "missing",
      message: "Gemini API Key tanımlı değil.",
    },
    pexels: {
      configured: Boolean(effectivePexelsKey),
      working: false,
      status: "missing",
      message: "Pexels API Key tanımlı değil (Varsayılan HD stok videolar kullanılıyor).",
    },
  };

  // 1. Test Gemini Key
  if (effectiveGeminiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey: effectiveGeminiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      let testSuccess = false;
      let lastErrMessage = "";

      for (const modelName of TEXT_GEN_MODELS_TO_TRY) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: "Test connection. Respond with OK.",
          });

          if (response && response.text) {
            result.gemini.working = true;
            result.gemini.status = "ok";
            result.gemini.message = `Gemini API Key aktif (${modelName} kullanılıyor).`;
            testSuccess = true;
            break;
          }
        } catch (mErr: any) {
          lastErrMessage = mErr?.message || String(mErr);
        }
      }

      if (!testSuccess) {
        result.gemini.working = false;
        result.gemini.status = "error";
        if (lastErrMessage.includes("429") || lastErrMessage.includes("quota") || lastErrMessage.includes("RESOURCE_EXHAUSTED")) {
          result.gemini.message = "Gemini API Kota/İstek Limiti Aşımı (429 Rate Limit).";
        } else if (lastErrMessage.includes("401") || lastErrMessage.includes("API_KEY_INVALID") || lastErrMessage.includes("invalid")) {
          result.gemini.message = "Geçersiz Gemini API Key (401 Unauthorized / Invalid Key).";
        } else {
          result.gemini.message = `Gemini API Hatası: ${lastErrMessage.substring(0, 120)}`;
        }
      }
    } catch (err: any) {
      result.gemini.working = false;
      result.gemini.status = "error";
      result.gemini.message = `Gemini Bağlantı Hatası: ${err?.message || err}`;
    }
  }

  // 2. Test Pexels Key
  if (effectivePexelsKey) {
    try {
      const url = "https://api.pexels.com/videos/search?query=nature&per_page=1";
      const pexRes = await fetch(url, {
        headers: { Authorization: effectivePexelsKey },
      });

      if (pexRes.ok) {
        result.pexels.working = true;
        result.pexels.status = "ok";
        result.pexels.message = "Pexels Video API Key aktif ve çalışıyor.";
      } else if (pexRes.status === 401 || pexRes.status === 403) {
        result.pexels.working = false;
        result.pexels.status = "error";
        result.pexels.message = "Geçersiz Pexels API Key (401/403 Unauthorized).";
      } else if (pexRes.status === 429) {
        result.pexels.working = false;
        result.pexels.status = "error";
        result.pexels.message = "Pexels API İstek Limiti Doldu (429 Rate Limit).";
      } else {
        result.pexels.working = false;
        result.pexels.status = "error";
        result.pexels.message = `Pexels API Yanıt Hatası (${pexRes.status}).`;
      }
    } catch (err: any) {
      result.pexels.working = false;
      result.pexels.status = "error";
      result.pexels.message = `Pexels Bağlantı Hatası: ${err?.message || err}`;
    }
  }

  return res.json(result);
});

// API: Generate YouTube Shorts Script using Gemini
app.post("/api/generate-script", async (req, res) => {
  const { topic, language = "tr", apiKey } = req.body;

  if (!topic || typeof topic !== "string") {
    return res.status(400).json({ error: "Topic is required" });
  }

  const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;

  if (!effectiveApiKey) {
    console.warn("GEMINI_API_KEY is missing.");
    return res.status(400).json({
      error: "Gemini API Key bulunamadı. Lütfen üst kısımdaki Key butonundan geçerli bir Gemini API Key girin.",
      scenes: [],
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: effectiveApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const langInstruction =
      language === "tr"
        ? "Türkçe dilinde"
        : language === "es"
        ? "En español"
        : language === "de"
        ? "Auf Deutsch"
        : language === "fr"
        ? "En français"
        : "In English";

    const prompt = `You are a world-class YouTube Shorts documentary scriptwriter.
Topic: "${topic}".
Language requirement: Generate narration script text strictly ${langInstruction}.

Task: Create a highly engaging, 100% factual, 4 to 6 scene YouTube Short script.

STRICT CONTENT & NO-FLUFF RULES:
1. DIRECT FACTS ONLY: Every single scene MUST state a specific, concrete, detailed scientific, historical, or real-world fact directly about "${topic}".
2. ZERO LAZY FLUFF & NO BEATING AROUND THE BUSH:
   - DO NOT write filler sentences like "Yapılan araştırmalar şaşırtıcı sonuçlar verdi", "Bu konu hakkında bilinen çok şey var", "İşte bilinmeyen gerçekler", "Gelin birlikte inceleyelim", or "X konusu oldukça merak uyandıran bir alandır".
   - Jump STRAIGHT into real facts, numbers, names, locations, dates, or physical mechanisms in every single line!
   - Example BAD: "Kara delikler hakkında şaşırtıcı bilgiler var."
   - Example GOOD: "Samanyolu'nun merkezindeki Sagittarius A* kara deliğinin kütlesi Güneş'in tam 4 milyon katıdır."
3. NO CALLS TO ACTION: DO NOT ask viewers to like, comment, subscribe, share, or ask questions like "Sen ne düşünüyorsun?", "Yorumlarda belirtin", "Kanala abone olun", "What do you think?", or "Leave a comment below".
4. FINAL SCENE: A punchy, memorable concluding fact or summary directly about "${topic}". No meta social media call-outs!

JSON Format required:
[
  {
    "scene": 1,
    "text": "Direct, punchy concrete fact specifically about ${topic} in ${langInstruction}",
    "visual_query": "English 2-4 keywords description for stock video search (e.g. 'cinematic black hole galaxy', 'ancient pyramid sunset')"
  },
  ...
]

Return ONLY raw valid JSON list. Do not wrap in markdown code blocks if possible.`;

    let responseText = "";
    let lastError: any = null;

    for (const modelName of TEXT_GEN_MODELS_TO_TRY) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
        });
        responseText = response.text || "";
        if (responseText) {
          console.log(`Successfully generated story script using ${modelName}`);
          break;
        }
      } catch (modelErr: any) {
        lastError = modelErr;
        const errStr = String(modelErr?.message || modelErr);
        console.warn(`[Script Gen] Gemini model ${modelName} attempt failed:`, errStr.substring(0, 120));
      }
    }

    if (!responseText) {
      const lastErrMsg = lastError?.message || String(lastError || "bilinmeyen hata");
      console.log("Gemini API quota exceeded or models unavailable. Refusing to generate dummy content per user instructions. Last error:", lastErrMsg);
      return res.status(429).json({
        error: `Gemini API kota sınırı (429) veya bağlantı hatası nedeniyle yanıt alınamadı. Herhangi bir senaryo üretilmedi. Detay: ${lastErrMsg.substring(0, 150)}`,
        quotaExceeded: true,
        scenes: [],
      });
    }

    const parsedScenes = parseGeminiJson(responseText);

    if (Array.isArray(parsedScenes) && parsedScenes.length > 0) {
      return res.json({
        topic,
        language,
        scenes: parsedScenes.map((s, idx) => ({
          scene: s.scene || idx + 1,
          text: s.text || "",
          visual_query: s.visual_query || topic,
        })),
        fallback: false,
      });
    } else {
      return res.status(500).json({
        error: "Gemini API çıktı üretti ancak geçerli senaryo JSON formatına dönüştürülemedi. Herhangi bir üretim yapılmadı.",
        scenes: [],
      });
    }
  } catch (error: any) {
    console.log("Script generation error:", error?.message || error);
    const errMsg = error?.message || "Sunucu bağlantı hatası";
    const isKeyError = errMsg.includes("401") || errMsg.includes("API key") || errMsg.includes("Unauthorized") || errMsg.includes("API_KEY_INVALID");
    const isQuotaError = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED");

    return res.status(500).json({
      error: `Gemini API Hatası: ${errMsg}. Herhangi bir senaryo üretilmedi.`,
      keyError: isKeyError,
      quotaError: isQuotaError,
      scenes: [],
    });
  }
});

// API: Search & Fetch Pexels stock video
app.post("/api/fetch-pexels-video", async (req, res) => {
  try {
    const { query, pexelsApiKey, apiKey } = req.body || {};
    const effectiveKey = String(pexelsApiKey || apiKey || process.env.PEXELS_API_KEY || "").trim();

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    if (!effectiveKey) {
      // Return fallback high quality stock video
      const qLower = String(query).toLowerCase();
      let selectedUrl = FALLBACK_VIDEOS.default;
      if (qLower.includes("space") || qLower.includes("hole") || qLower.includes("galaxy") || qLower.includes("star")) {
        selectedUrl = FALLBACK_VIDEOS.space;
      } else if (qLower.includes("nature") || qLower.includes("forest") || qLower.includes("mountain")) {
        selectedUrl = FALLBACK_VIDEOS.nature;
      } else if (qLower.includes("ocean") || qLower.includes("sea") || qLower.includes("water")) {
        selectedUrl = FALLBACK_VIDEOS.ocean;
      } else if (qLower.includes("tech") || qLower.includes("cyber") || qLower.includes("ai")) {
        selectedUrl = FALLBACK_VIDEOS.tech;
      }

      return res.json({
        video_url: selectedUrl,
        thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
        fallback: true,
      });
    }

    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=3`;
    const response = await fetch(url, {
      headers: {
        Authorization: effectiveKey,
      },
    });

    if (!response.ok) {
      const is401 = response.status === 401 || response.status === 403;
      return res.json({
        video_url: FALLBACK_VIDEOS.default,
        thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
        fallback: true,
        keyError: is401,
        status: response.status,
        error: is401
          ? `Geçersiz Pexels API Key (401 Unauthorized). Lütfen API Key'inizi kontrol edin.`
          : `Pexels API Hatası (${response.status}). Varsayılan video kullanılıyor.`,
      });
    }

    const data = await response.json();
    if (data.videos && data.videos.length > 0) {
      const topVideo = data.videos[0];
      // Pick best HD file
      const videoFile =
        topVideo.video_files.find((f: any) => f.quality === "hd" && f.height > f.width) ||
        topVideo.video_files[0];

      return res.json({
        video_url: videoFile.link,
        thumbnail: topVideo.image,
        duration: topVideo.duration,
        fallback: false,
      });
    } else {
      // Fallback if no search results match query
      return res.json({
        video_url: FALLBACK_VIDEOS.default,
        thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
        fallback: true,
      });
    }
  } catch (error: any) {
    console.error("Pexels fetch error:", error?.message || error);
    res.json({
      video_url: FALLBACK_VIDEOS.default,
      thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
      fallback: true,
      error: error?.message,
    });
  }
});

// API: Proxy a remote stock video file through the same-origin server.
// The browser loads the video from OUR origin (no cross-origin CORS negotiation),
// so it can always be drawn into a canvas for MP4/WebM export without tainting it.
// This fixes exports that previously produced a black background because the
// cross-origin videos.pexels.com request was blocked/mishandled by the browser,
// which made the canvas drawing fail (empty frames).
// Supports HTTP Range requests so video elements can seek/replay properly.
app.get("/api/video-proxy", async (req, res) => {
  const raw = String(req.query.url || "");
  // Only allow http(s) remote URLs (prevents local-file / open-redirect abuse).
  if (!/^https?:\/\/.+/i.test(raw)) {
    return res.status(400).json({ error: "Invalid video URL" });
  }

  const upstreamHeaders: Record<string, string> = {
    // A real browser UA avoids Cloudflare bot-challenges that block raw node fetch on some files.
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  if (req.headers.range) {
    upstreamHeaders["Range"] = String(req.headers.range);
  }

  try {
    const upstreamRes = await fetch(raw, { headers: upstreamHeaders });
    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return res.status(upstreamRes.status).json({ error: `Upstream video error (${upstreamRes.status})` });
    }

    res.status(upstreamRes.status);
    res.set("Content-Type", upstreamRes.headers.get("content-type") || "video/mp4");
    res.set("Accept-Ranges", upstreamRes.headers.get("accept-ranges") || "bytes");
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Cache-Control", "public, max-age=3600");

    const contentRange = upstreamRes.headers.get("content-range");
    if (contentRange) res.set("Content-Range", contentRange);
    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) res.set("Content-Length", contentLength);

    if (upstreamRes.body) {
      const reader = upstreamRes.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        res.end();
      } catch (streamErr: any) {
        // Client aborted (e.g. navigated away) - stop silently.
        if (!res.headersSent) res.status(502);
        try {
          await reader.cancel();
        } catch (_) {}
        res.end();
      }
    } else {
      res.end();
    }
  } catch (err: any) {
    console.error("Video proxy error:", err?.message || err);
    if (!res.headersSent) return res.status(502).json({ error: "Video proxy failed" });
    res.end();
  }
});

let geminiTtsCooldownUntil = 0;

// Helper: Edge TTS audio generation using Microsoft Edge Read Aloud API
async function generateEdgeTts(text: string, lang: string): Promise<Buffer | null> {
  try {
    const tts = new MsEdgeTTS({});
    let voice = "tr-TR-AhmetNeural";
    if (lang === "tr") {
      voice = "tr-TR-AhmetNeural";
    } else if (lang === "es") {
      voice = "es-ES-AlvaroNeural";
    } else if (lang === "de") {
      voice = "de-DE-ConradNeural";
    } else if (lang === "fr") {
      voice = "fr-FR-HenriNeural";
    } else {
      voice = "en-US-ChristopherNeural";
    }

    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const readable = tts.toStream(text);

    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      let finished = false;

      const timeout = setTimeout(() => {
        if (!finished) {
          finished = true;
          try { tts.close(); } catch (_) {}
          resolve(chunks.length > 0 ? Buffer.concat(chunks) : null);
        }
      }, 5000);

      readable.on("data", (chunk: any) => {
        chunks.push(Buffer.from(chunk));
      });

      readable.on("end", () => {
        if (!finished) {
          finished = true;
          clearTimeout(timeout);
          try { tts.close(); } catch (_) {}
          resolve(Buffer.concat(chunks));
        }
      });

      readable.on("error", (_err: any) => {
        if (!finished) {
          finished = true;
          clearTimeout(timeout);
          try { tts.close(); } catch (_) {}
          resolve(chunks.length > 0 ? Buffer.concat(chunks) : null);
        }
      });
    });
  } catch (_err: any) {
    return null;
  }
}

// API: High Quality Gemini TTS (Primary) & Edge TTS (Fallback) Voiceover Audio proxy
app.get("/api/tts", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const text = String(req.query.text || "").trim();
    const lang = String(req.query.lang || "tr").trim();
    const customKey = req.query.apiKey ? String(req.query.apiKey) : "";
    const effectiveApiKey = customKey || process.env.GEMINI_API_KEY;

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const safeText = text.substring(0, 300);

    // 1. Primary: Try Gemini Audio Generation if API key is provided and not in rate-limit cooldown
    if (effectiveApiKey && Date.now() > geminiTtsCooldownUntil) {
      const ttsModelsToTry = [
        "gemini-3.1-flash-tts-preview",
        "gemini-2.5-pro-preview-tts"
      ];
      for (const modelName of ttsModelsToTry) {
        try {
          const ai = new GoogleGenAI({
            apiKey: effectiveApiKey,
            httpOptions: { headers: { "User-Agent": "aistudio-build" } },
          });

          const prompt = `Say the following narration text clearly in ${lang === "tr" ? "Turkish" : "English"} with a professional studio voiceover style: "${safeText}"`;

          const geminiRes = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Puck" },
                },
              },
            },
          });

          const audioPart = geminiRes.candidates?.[0]?.content?.parts?.find(
            (p: any) => p.inlineData && p.inlineData.mimeType?.startsWith("audio/")
          );

          if (audioPart && audioPart.inlineData?.data) {
            const buffer = Buffer.from(audioPart.inlineData.data, "base64");
            res.set("Content-Type", audioPart.inlineData.mimeType || "audio/wav");
            return res.send(buffer);
          }
        } catch (geminiAudioErr: any) {
          const errMsg = geminiAudioErr?.message || String(geminiAudioErr);
          if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
            geminiTtsCooldownUntil = Date.now() + 90000;
            console.log("[TTS Info] Gemini Audio API rate limit (429) hit. Activated 90s cooldown. Switching to Edge TTS engine.");
            break;
          } else {
            console.log(`[TTS Info] Gemini Audio (${modelName}) unavailable: switching to Edge TTS engine.`);
            break;
          }
        }
      }
    }

    // 2. Fallback: Try Edge TTS (Microsoft Edge Read Aloud API)
    try {
      console.log("[TTS Info] Attempting Edge TTS engine...");
      const edgeAudioBuffer = await generateEdgeTts(safeText, lang);
      if (edgeAudioBuffer && edgeAudioBuffer.length > 0) {
        res.set("Content-Type", "audio/mpeg");
        return res.send(edgeAudioBuffer);
      }
    } catch (edgeErr: any) {
      console.warn("[TTS Info] Edge TTS fallback failed/unavailable, proceeding to Google TTS backup.");
    }

    // 3. Fallback: High-Speed Google Translate TTS (GTX)
    try {
      const gtxUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(safeText)}`;
      const gtxRes = await fetch(gtxUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (gtxRes.ok) {
        const arrayBuffer = await gtxRes.arrayBuffer();
        if (arrayBuffer.byteLength > 0) {
          res.set("Content-Type", "audio/mpeg");
          return res.send(Buffer.from(arrayBuffer));
        }
      }
    } catch (gtxErr) {
      console.warn("[TTS Info] Google Translate GTX TTS failed.");
    }

    // 4. Fallback: Google Translate TW-OB
    try {
      const twUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(safeText)}&tl=${encodeURIComponent(lang)}&client=tw-ob`;
      const twRes = await fetch(twUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (twRes.ok) {
        const arrayBuffer = await twRes.arrayBuffer();
        if (arrayBuffer.byteLength > 0) {
          res.set("Content-Type", "audio/mpeg");
          return res.send(Buffer.from(arrayBuffer));
        }
      }
    } catch (twErr) {
      console.warn("[TTS Info] Google Translate TW-OB TTS failed.");
    }

    // Gracefully report client to use browser WebSpeech synthesis without throwing 500 error
    return res.status(404).json({ error: "Server TTS audio unavailable, using client Web Speech API fallback", fallback: true });
  } catch (err: any) {
    console.error("TTS endpoint handled error:", err?.message || err);
    res.status(404).json({ error: "TTS generation unavailable, client fallback activated", fallback: true });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`YT Shorts AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
