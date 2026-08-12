# YT Shorts AI Generator — Detaylı Teknik Plan

> **Proje Adı:** YT Shorts AI Generator
> **Amac:** Google Gemini ve Pexels API'lerini kullanarak otomatik YouTube Shorts senaryosu, seslendirme ve 9:16 dikey video önizleme/üretim sistemi.
> **Sürüm:** v0.0.10
> **Son Güncelleme:** Ağustos 2026

---

## Proje Özeti

**YT Shorts AI Generator**, tek bir konu başlığı girerek tam teşekküllü bir YouTube Shorts videosu üreten uçtan uca bir AI stüdyosudur. Uygulama:

- Konuyu analiz eder ve sahnelere bölünmüş bir senaryo yazar (Gemini fallback zinciri)
- Her sahne için uygun dikey (portrait) stok videoları bulur (Pexels API)
- Çok motorlu bir boru hattıyla profesyonel seslendirme oluşturur (Gemini TTS → Edge TTS → Google GTX → tw-ob → tarayıcı Web Speech)
- 9:16 dikey videoda gerçek zamanlı önizleme sunar (karaoke altyazı senkronlu)
- Sonucu tam HD (720p/1080p) MP4/WebM video, JSON veya Markdown olarak dışa aktarır

---

## Teknik Stack

### Frontend
- **React 18.3.1** — Ana UI framework
- **Vite 5.4.11** — Geliştirme sunucusu ve build tool
- **Tailwind CSS 4.0.0** — Utility-first stil sistemi
- **Motion 12.4.7** — Animasyon kütüphanesi
- **Lucide React** — SVG ikon seti
- **TypeScript 5.6.3** — Tip güvenliği

### Backend
- **Express.js 4.21.2** — REST API sunucusu
- **TSX 4.19.2** — TypeScript çalıştırıcısı (hot-reload)
- **esbuild 0.24.2** — Server-side bundle

### AI / ML Entegrasyonları
- **@google/genai** — Unified Gemini API client (2026)
- **edge-tts-node 1.5.7** — Microsoft Edge Read Aloud (TTS yedeği)
- **Pexels API** — HD dikey stok video arama
- **Tarayıcı Web Speech API** — Son çare istemci tarafı TTS

---

## Mimari Genel Bakış

**Frontend (React + Vite + Tailwind):** App, Header, StoryboardEditor, ShortsPlayer, ModelStatusPage, ExportModal, VideoExporter

- **StoryboardEditor** — Sahne metni/görsel sorgusu düzenleme, sıralama, ekleme/silme, klip yenileme
- **ShortsPlayer** — 9:16 önizleme, karaoke altyazı, ses/video senkronizasyonu, mute, sahne geçişi
- **ModelStatusPage** — Model ve kota (RPM/TPM/RPD) canlı takibi
- **ExportModal / VideoExporter** — Video render arayüzü, JSON/Markdown dışa aktarma
- **lib/videoRenderer** — Modül seviyesinde singleton arka plan render motoru (DOM'dan bağımsız çalışır)

**Backend (Express + TSX):** API Endpoint Controller, Gemini Client, Pexels Client, video-proxy, TTS Motorları

**Entegrasyonlar:** Google Gemini (@google/genai), Pexels API, Edge TTS (fallback), Google GTX / tw-ob TTS (fallback), LocalStorage (API Keys)

---

## Temel Özellikler

1. **Akıllı Senaryo Üretimi** — Gemini ile sahnelere bölünmüş JSON (fallback zinciriyle)
2. **Storyboard Editörü** — Sahne sıralama, ekleme, silme, metin & görsel sorgu düzenleme, klip yenileme
3. **9:16 Dikey Video Oynatıcı** — Gerçek zamanlı önizleme, karaoke altyazı, vignette overlay
4. **Çok Motorlu Seslendirme** — Gemini TTS → Edge TTS → Google GTX → tw-ob → Web Speech
5. **API Anahtar Yönetimi** — localStorage'da saklanır, doğrulama/test desteği
6. **Model Durumu İzleme** — RPM, TPM, RPD kota takibi (gerçek Google model metadata'sı ile)
7. **Tam HD Render Stüdyosu** — 720p/1080p 9:16 MP4/WebM render (MediaRecorder + canvas captureStream)
8. **Hazır Konu Şablonları** — TR/EN dil desteği
9. **Export Sistemi** — Video / JSON / Markdown

---

## AI Motor Yapılandırması

### Metin Üretimi (Fallback Chain)
- `gemini-3.5-flash-lite` — Birincil (en yeni, en hızlı)
- `gemini-3.1-flash-lite` — Yedek 1
- `gemini-2.5-flash` — Yedek 2 (stabil)

Model listesi `server.ts` içindeki `TEXT_GEN_MODELS_TO_TRY` ile tek noktadan yönetilir; `/api/generate-script` ve `/api/test-keys` aynı zinciri kullanır.

### TTS Motorları
| Motor | Model / Motor | Özellikler |
|-------|---------------|------------|
| Gemini TTS (birincil) | `gemini-3.1-flash-tts-preview` → `gemini-2.5-pro-preview-tts` | Çok dilli, doğal prosodi, voiceConfig (Puck vb.) |
| Edge TTS (yedek) | Microsoft Edge Read Aloud (`edge-tts-node`) | Dilde göre neural sesler (tr-TR-AhmetNeural vb.) |
| Google GTX (yedek) | `translate.googleapis.com/translate_tts` | Yüksek hızlı ücretsiz TTS |
| Google tw-ob (yedek) | `translate.google.com/translate_tts` | Son sunucu tarafı yedek |
| Web Speech (son çare) | Tarayıcı `speechSynthesis` | İstemci tarafı fallback (404 halinde) |

> Not: `Puck`, `Charon`, `Kore`, `Fenrir`, `Aoede` ses karakterleri Gemini TTS için `prebuiltVoiceConfig.voiceName` olarak kullanılır; Edge TTS katmanı ise dil bazlı neural sesler kullanır.

---

## API Endpoint'leri

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/api/generate-script` | POST | Sahnelere bölünmüş senaryo üretimi (Gemini fallback zinciri) |
| `/api/fetch-pexels-video` | POST | Dikey stok video arama (key yoksa `FALLBACK_VIDEOS` map) |
| `/api/test-keys` | POST | Gemini & Pexels API anahtarı doğrulama |
| `/api/model-status` | POST | Model durumu, kota (RPM/TPM/RPD) ve kalan kullanım |
| `/api/status` | GET | Sunucu durumu |
| `/api/video-proxy` | GET | Aynı kaynak proxy (`Range` + CORS başlıkları, canvas export için) |
| `/api/tts` | GET | Çok motorlu seslendirme (`?text=&lang=&apiKey=`) |

---

## TTS Akışı (/api/tts)

1. **Gemini TTS** — `gemini-3.1-flash-tts-preview` → `gemini-2.5-pro-preview-tts`. 429 (rate limit) halinde 90 saniyelik cooldown başlatılır ve Edge TTS'ye geçilir.
2. **Edge TTS** — Microsoft Edge Read Aloud motoru (dil bazlı neural ses).
3. **Google GTX** — `translate.googleapis.com/translate_tts?client=gtx`.
4. **Google tw-ob** — `translate.google.com/translate_tts?client=tw-ob`.
5. **404 dönüşü** — Tüm sunucu motorları başarısız olursa istemci tarayıcı **Web Speech API**'sini kullanır (500 hatası dönülmez).

`ShortsPlayer` ve `VideoExporter` aynı `/api/tts` uç noktasını kullanır; ses dosyaları render öncesinde tüm sahneler için önceden indirilir (pre-load).

---

## Video Render Motoru (lib/videoRenderer)

- **Modül seviyesi singleton** — React bileşenlerinin dışında çalışır; ExportModal kapatılsa bile arka planda render sürer.
- **useSyncExternalStore** tabanlı durum yayını (progress, currentScene, statusText, resultUrl).
- **Kanal:** `canvas.captureStream(30)` (video) + Web Audio `createMediaStreamDestination` (seslendirme) birleştirilir; `MediaRecorder` ile MP4/WebM kaydedilir.
- **Kalite:** 720p (720×1280) veya 1080p (1080×1920) seçimi; isteğe bağlı alt yazı (karaoke kelime vurgulu).
- **Akış:** (1) TTS seslerinin önceden indirilmesi → (2) stok videoların önceden yüklenmesi → (3) sahne sahne render döngüsü → (4) MP4/WebM dosyası oluşturma.
- **Camera:** `drawVideoCover` ile landscape stok klipler 9:16 tuval içine object-fit:cover mantığıyla yerleştirilir (bozulma önlenir).
- **İptal:** `cancelRender()` ile ara verilir; kısmi kayıt atılır ve `idle` duruma dönülür.

---

## Video Proxy (CORS Güvenliği)

`/api/video-proxy` endpoint'i uzak stok video URL'lerini aynı kaynaktan akıtır:

- Dış kaynak videolar, tarayıcı bunları `crossOrigin='anonymous'` ile canvas'a çizebilsin diye proxy üzerinden geçer (tainted canvas / siyah arka plan sorununu çözer).
- `Range` isteğe bağlı iletir ve `Access-Control-Allow-Origin: *` gönderir.
- Yalnızca `http(s)` uzak URL'lere izin verir (açık yönlendirme / yerel dosya istismarını engeller).
- `buildProxiedVideoUrl()` yardımcısı render sırasında URL'leri otomatik olarak proxy'ye yönlendirir.

---

## API Anahtar Yönetimi

- Kullanıcı UI üzerinden girdiği anahtarlar `localStorage`'da saklanır: `yt_shorts_gemini_key`, `yt_shorts_pexels_key`.
- Sunucu ortamında `process.env.GEMINI_API_KEY` ve `process.env.PEXELS_API_KEY` (`.env`) desteklenir; UI anahtarı önceliklidir.
- `/api/test-keys` ile her iki anahtar bağımsız doğrulanabilir; Header'daki "API Anahtarları" menüsünden yönetilir.
- Pexels anahtarı 401 dönerse varsayılan HD fallback videolar kullanılır ve kullanıcıya uyarı modalı gösterilir.

---

## Export Sistemi

- **Video Export:** Canvas Recording (9:16, 720p/1080p, MP4/WebM) — `VideoExporter` arayüzünden.
- **JSON Export:** Tam senaryo, dil ve kullanılan modeller (Şema formatında).
- **Markdown Export:** Okunabilir senaryo formatı.

---

## Hata Yönetimi

- **Gemini JSON parse hatası:** Sanitize + en dış `[...]`/`{...}` çıkarımı ile 2 aşamalı kurtarma.
- **Quota limiti (429):** Senaryoda fallback modele geçiş; TTS'te 90 saniyelik cooldown + Edge TTS'ye geçiş.
- **Video bulunamadı:** `FALLBACK_VIDEOS` map (space/nature/ocean/tech/default) devreye girer.
- **TTS başarısızlığı:** Edge TTS → GTX → tw-ob → tarayıcı Web Speech zinciri.
- **API anahtar hatası:** Modal ile kullanıcı uyarılır, Pexels'ta fallback videolara düşülür.
- **Render iptali / canvas hatası:** State üzerinden `idle`/`error` durumuna dönülür, hata mesajı gösterilir.

---

## Kurulum

1. Repoyu klonla: `git clone https://github.com/mstf10/yt_shorts_googleai.git`
2. Dizine gir: `cd yt_shorts_googleai`
3. Bağımlılıkları yükle: `npm install`
4. Ortam değişkenlerini oluştur (opsiyonel): `cp .env.example .env`
5. Geliştirme sunucusunu başlat: `npm run dev` → http://localhost:3000

## Ortam Değişkenleri

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `GEMINI_API_KEY` | Hayır (UI/localStorage fallback) | Google AI Studio / Gemini API anahtarı |
| `PEXELS_API_KEY` | Hayır (gerçek stok aramayı etkinleştirir) | Pexels API anahtarı |

## Script'ler

| Script | Komut | Açıklama |
|--------|-------|----------|
| `dev` | `tsx server.ts` | Vite hot-reload'lu geliştirme sunucusu |
| `build` | `vite build && esbuild server.ts ...` | Frontend + sunucuyu `dist/`'e derler |
| `start` | `tsx server.ts` | Üretim sunucusunu çalıştırır |

> Üretim sunucusu `NODE_ENV=production` ve derlenmiş `dist/` klasörünü bekler. `NODE_ENV` production değilse Express, Vite geliştirme middleware'ini otomatik bağlar.

## Sürüm Geçmişi

- **0.0.10** — Duyarlı (responsive) anasayfa kaydırma düzeni (sabit panel kaldırıldı, sticky header), API anahtarları paneli mobil dikey/yatay sığma düzeltmeleri.
- **0.0.9** — Çok motorlu TTS (Gemini → Edge → GTX → tw-ob), arka plan render motoru, model & kota paneli, video proxy, storyboard editörü, export stüdyosu.
- **0.0.8** — Sahne sıralama, video klip yenileme, kota ilerleme çubuğu güvenlik düzeltmeleri.
- **0.0.7** — Storyboard editörü iyileştirmeleri, model bilgisi ve export verisi güncellemeleri.
- **0.0.6** — Video export ön yükleme (pre-load) optimizasyonları.
- **0.0.5** — ElevenLabs yerine Edge TTS'ye geçiş; Pexels fetch'te `apiKey` parametresi desteği.

---

## Gelecek Gelişmeler

- [ ] Arka plan müziği
- [ ] Sahne geçiş efektleri
- [ ] Batch mode
- [ ] YouTube upload
- [ ] Veo 2 entegrasyonu
- [ ] Firebase Auth

---

## Lisans

**MIT License** | Geliştirici: @mstf10 | Repo: [github.com/mstf10/yt_shorts_googleai](https://github.com/mstf10/yt_shorts_googleai)
