import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper to sanitize Gemini response text
function parseGeminiJson(text: string) {
  try {
    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse Gemini JSON output:", e, "Raw:", text);
    return null;
  }
}

// Fallback high quality video URLs for common visual queries when Pexels API key is omitted or limit reached
const FALLBACK_VIDEOS: Record<string, string> = {
  space: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  nature: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  ocean: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  tech: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
  default: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
};

// API: Check system status
app.get("/api/status", (req, res) => {
  res.json({
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    pexelsConfigured: Boolean(process.env.PEXELS_API_KEY),
  });
});

function getFallbackScenes(topic: string, language: string) {
  const isTr = language === 'tr' || /[çğışöüÇĞİŞÖÜ]/.test(topic);

  if (isTr) {
    return [
      {
        scene: 1,
        text: `Hoş geldiniz! İşte ${topic} hakkında muhtemelen daha önce duymadığınız büyüleyici gerçekler.`,
        visual_query: `${topic} mysterious epic cinematic portrait`,
      },
      {
        scene: 2,
        text: `Birincisi: Bilim insanları ve uzmanlar bu konuda son derece şaşırtıcı keşifler yaptı.`,
        visual_query: `${topic} research technology motion`,
      },
      {
        scene: 3,
        text: `İkincisi: Bu süreç, doğanın ve teknolojinin sınırlarını zorlayan inanılmaz bir dengeye sahip.`,
        visual_query: `abstract cosmic particle light motion`,
      },
      {
        scene: 4,
        text: `Üçüncüsü: Görsel efektler ve yeni nesil araştırmalar bu konudaki tüm ezberleri bozuyor.`,
        visual_query: `futuristic digital neon technology portrait`,
      },
      {
        scene: 5,
        text: `Siz bu konuda ne düşünüyorsunuz? Kanala abone olmayı ve yorum yapmayı unutmayın!`,
        visual_query: `neon subscribe digital motion particle`,
      },
    ];
  }

  return [
    {
      scene: 1,
      text: `Welcome! Here are fascinating facts about: ${topic} that you probably didn't know.`,
      visual_query: `${topic} mysterious epic background`,
    },
    {
      scene: 2,
      text: "Fact 1: Researchers have uncovered mind-blowing anomalies that challenge traditional theories.",
      visual_query: `${topic} research technology motion`,
    },
    {
      scene: 3,
      text: "Fact 2: The sheer force and mechanics involved can distort our standard understanding of physics.",
      visual_query: "abstract geometric laser technology light motion",
    },
    {
      scene: 4,
      text: "Fact 3: High definition captures show details never before witnessed in full clarity.",
      visual_query: "futuristic digital technology 4k portrait",
    },
    {
      scene: 5,
      text: "Subscribe and comment below: What topic should we explore next?",
      visual_query: "futuristic digital neon glow particle motion",
    },
  ];
}

// API: Generate YouTube Shorts Script using Gemini
app.post("/api/generate-script", async (req, res) => {
  const { topic, language = "tr", apiKey } = req.body;

  if (!topic || typeof topic !== "string") {
    return res.status(400).json({ error: "Topic is required" });
  }

  const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;

  if (!effectiveApiKey) {
    console.warn("GEMINI_API_KEY is missing. Returning fallback storyboard script.");
    return res.json({
      topic,
      language,
      scenes: getFallbackScenes(topic, language),
      fallback: true,
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

    const prompt = `You are a viral YouTube Shorts script writer and creative director.
Topic: "${topic}".
Language requirement: Generate narration script text strictly ${langInstruction}.

Task: Create a highly engaging 4 to 6 scene YouTube Short storyboard.
Each scene must be punchy, attention-grabbing, and formatted as a JSON array of objects.

JSON Format required:
[
  {
    "scene": 1,
    "text": "Hook line to grab viewers in the first 3 seconds in ${langInstruction}",
    "visual_query": "English 2-4 keywords description for stock video search (e.g. 'cinematic black hole galaxy', 'ancient pyramid sunset')"
  },
  ...
]

Return ONLY raw valid JSON list. Do not wrap in markdown code blocks if possible.`;

    let responseText = "";
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
      });
      responseText = response.text || "";
    } catch (modelErr: any) {
      console.log("gemini-3.6-flash notice:", modelErr?.status || modelErr?.message || "Using smart storyboard fallback");
      return res.json({
        topic,
        language,
        scenes: getFallbackScenes(topic, language),
        fallback: true,
        notice: "Gemini API kotası veya yanıt süresi nedeniyle akıllı senaryo motoru kullanıldı.",
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
      throw new Error("Invalid output format from Gemini");
    }
  } catch (error: any) {
    console.log("Script generation fallback notice:", error?.message || error);
    // Graceful recovery for rate limits (429), quota limits or missing API permissions
    return res.json({
      topic,
      language,
      scenes: getFallbackScenes(topic, language),
      fallback: true,
      notice: "Gemini API kotası veya hatası nedeniyle otomatik akıllı senaryo şablonu kullanıldı.",
    });
  }
});

// API: Search & Fetch Pexels stock video
app.post("/api/fetch-pexels-video", async (req, res) => {
  try {
    const { query, pexelsApiKey } = req.body;
    const effectiveKey = pexelsApiKey || process.env.PEXELS_API_KEY;

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
      throw new Error(`Pexels API responded with status ${response.status}`);
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

// API: High Quality TTS Voiceover Audio proxy
app.get("/api/tts", async (req, res) => {
  try {
    const text = String(req.query.text || "").trim();
    const lang = String(req.query.lang || "tr").trim();

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const safeText = text.substring(0, 200);
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(safeText)}&tl=${encodeURIComponent(lang)}&client=tw-ob`;

    const response = await fetch(ttsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`TTS service status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error("TTS endpoint error:", err?.message || err);
    res.status(500).json({ error: "TTS generation failed" });
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
