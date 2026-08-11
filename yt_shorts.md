# YT Shorts AI Generator - Detayli Teknik Plan

> **Proje Adi:** YT Shorts AI Generator
> **Amac:** Google Gemini ve Pexels API'lerini kullanarak otomatik YouTube Shorts senaryosu, seslendirme ve 9:16 dikey video onizleme/uretim sistemi.
> **Son Guncelleme:** Agustos 2026

---

## Proje Ozeti

**YT Shorts AI Generator**, tek bir konu basligi girerek otomatik olarak tam tesekkullu bir YouTube Shorts videosu ureten uctan uca bir AI studyosudur. Uygulama:

- Konuyu analiz eder ve sahnelere bolunmus bir senaryo yazar (Gemini)
- Her sahne icin uygun stok videolari bulur (Pexels API)
- Profesyonel seslendirme olusturur (Gemini TTS + Edge TTS fallback)
- 9:16 dikey videoda gercek zamanli onizleme sunar
- Son sonucu video (MP4/WebM), JSON veya Markdown olarak disa aktarir

---

## Teknik Stack

### Frontend
- **React 18.3.1** - Ana UI framework
- **Vite 5.4.11** - Gelistirme sunucusu ve build tool
- **Tailwind CSS 4.0.0** - Utility-first stil sistemi
- **Motion 12.4.7** - Animasyon kutuphanesi
- **Lucide React** - SVG ikon seti
- **TypeScript 5.6.3** - Tip guvenligi

### Backend
- **Express.js 4.21.2** - REST API sunucusu
- **TSX 4.19.2** - TypeScript calistiricisi (hot-reload)
- **esbuild 0.24.2** - Server-side bundle

### AI / ML Entegrasyonlari
- **@google/genai** - Unified Gemini API client (2026)
- **edge-tts-node 1.5.7** - Microsoft Edge TTS yedek motoru
- **Pexels API** - HD stok video arama

---

## Mimari Genel Bakis

**Frontend (React + Vite):** Header, StoryboardEditor, ShortsPlayer, ModelStatusPage, ExportModal

**Backend (Express + TSX):** API Endpoint Controller, Gemini Client, Pexels Client, TTS Engines

**Entegrasyonlar:** Google Gemini (@google/genai), Pexels API, Edge TTS (fallback), LocalStorage (API Keys)

---

## Temel Ozellikler

1. **Akilli Senaryo Uretimi** - Gemini ile sahnelere bolunmus JSON
2. **Storyboard Editoru** - Sahne siralama, ekleme, silme
3. **9:16 Dikey Video Oynatici** - Gercek zamanli onizleme, vignette overlay
4. **Cift Motorlu Seslendirme** - Gemini TTS + Edge TTS fallback
5. **API Anahtar Yonetimi** - localStorage'da saklanir
6. **Model Durumu Izleme** - Quota takibi (RPM, TPM, RPD)
7. **Hazir Konu Sablonlari** - TR/EN dil destegi
8. **Export Sistemi** - Video/JSON/Markdown

---

## AI Motor Yapilandirmasi

### Metin Uretimi (Fallback Chain)
- gemini-3.5-flash-lite (En yeni, en hizli)
- gemini-3.1-flash-lite (Yedek 1)
- gemini-2.5-flash (Yedek 2, stabil)

### TTS Motorlari
| Motor | Model | Ozellikler |
|-------|-------|------------|
| Gemini TTS | gemini-2.5-pro-preview-tts | Cok dilli, dogal prosodi |
| Edge TTS | Puck, Charon, Kore, Fenrir, Aoede | 5 ses karakteri |

---

## API Endpoint'leri

| Endpoint | Method | Aciklama |
|----------|--------|----------|
| /api/generate-script | POST | Senaryo uretimi |
| /api/fetch-pexels-video | POST | Stok video arama |
| /api/test-keys | POST | API key dogrulama |
| /api/model-status | POST | Model durumu |
| /api/generate-tts | POST | Gemini TTS |
| /api/generate-edge-tts | POST | Edge TTS fallback |

---

## Export Sistemi

- **Video Export:** Canvas Recording (9:16, MP4/WebM)
- **JSON Export:** Tam senaryo ve metadata
- **Markdown Export:** Okunabilir format

---

## Hata Yonetimi

- Gemini JSON parse hatasi: 3 adimli retry
- Quota limiti: Fallback model gecisi
- Video bulunamadi: FALLBACK_VIDEOS map
- TTS basarisizligi: Edge TTS devreye girer
- API key hatasi: Modal ile uyari

---

## Kurulum

1. Repoyu klonla: git clone https://github.com/mstf10/yt_shorts_googleai.git
2. Dizine gir: cd yt_shorts_googleai
3. Bagimliliklari yukle: npm install
4. Gelistirme sunucusunu baslat: npm run dev

---

## Gelecek Gelismeler

- [ ] Arka plan muzigi
- [ ] Sahne gecis efektleri
- [ ] Batch mode
- [ ] YouTube upload
- [ ] Veo 2 entegrasyonu
- [ ] Firebase Auth

---

## Lisans

**MIT License** | Gelistirici: @mstf10 | Repo: github.com/mstf10/yt_shorts_googleai
