---
name: versionist
description: Kod değişikliklerine göre README.md ve yt_shorts.md dokümanlarını günceller, package.json versiyon numarasını artırır ve yapılan değişiklikleri otomatik olarak git commit yapıp uzaktaki repoya pushlar.
---

# versionist

Bu skill; projede yapılan **kod değişikliklerini** analiz eder, buna göre dokümantasyonu
(`README.md` ve `yt_shorts.md`) güncel tutar, paket versiyonunu artırır ve yapılan tüm değişiklikleri git commit atıp uzaktaki git deposuna (origin/branch) pushlar.

## Amaç

Her kod değişikliği sonrası:

1. Değişen dosyaların ve içeriğin özetini çıkar.
2. `README.md`'yi yeni/çıkarılan/değişen özellik, model, endpoint, kurulum ve teknik stack bilgilerine göre güncelle.
3. `yt_shorts.md`'yi (detaylı teknik plan) değişen mimari, model zinciri, TTS akışı, endpoint ve sürüm geçmişine göre güncelle.
4. `package.json` versiyon numarasını artır.
5. Tüm değişiklikleri `git add .`, `git commit` ve `git push` adımlarıyla uzaktaki depoya (origin) gönder.
6. İşlemi doğrula.

## Ne Zaman Kullanılır

- Kaynak kodda (`src/**/*.tsx`, `src/**/*.ts`, `server.ts`, `vite.config.ts`, `tsconfig.json`, `package.json` bağımlılıkları vb.) değişiklik yapıldığında.
- Yeni özellik, düzeltme veya refactor tamamlandığında ve kararlı hale geldiğinde.
- Otomatik sürüm (release) hazırlanıp repoya gönderilmek istendiğinde.

## Adımlar

### 1. Değişiklikleri Tespit Et

```bash
git status --short
git diff --stat
git diff -- src/ server.ts package.json
```

- Hangi dosyaların değiştiğini, hangilerinin **kod** (src/, server.ts, yapılandırma) olduğunu belirle.
- Yalnızca doküman değişikliği varsa (kod yoksa) versiyon artırmaya **gerek yoktur**.

### 2. Değişen Kodu Analiz Et

Değişen dosyaları oku ve şunları çıkar:

- **Yeni/değişen özellikler** — eklenti, bileşen, işlev, UI davranışı
- **Yeni/değişen API endpoint'leri** — `/api/*` değişiklikleri
- **AI model değişiklikleri** — fallback zincirleri, TTS modelleri, motorlar
- **Kaldırılan/eskimiş öğeler** — dokümanlardan çıkarılması gerekenler
- **Bağımlılık / yapılandırma değişiklikleri** — package.json deps, script'ler, env değişkenleri

### 3. README.md'yi Güncelle

Yansıtması gereken bölümler:

- **Versiyon rozeti** (üstteki `> **vX.Y.Z**` satırı)
- **Overview / Features** — yeni özellikleri ekle, kaldırılanları sil
- **API Endpoints** tablosu — yeni/silinmiş endpoint'leri güncelle
- **AI Models** tablosu — fallback zincirlerini güncelle
- **Development / Build / Environment / Scripts** — komut ve env değişiklikleri
- **Version History** — en üste yeni sürüm girdisi ekle

### 4. yt_shorts.md'yi Güncelle

Yansıtması gereken bölümler:

- **Sürüm** ve **Son Güncelleme** başlıkları
- **Teknik Stack** / **Mimari Genel Bakış**
- **AI Motor Yapılandırması** (metin & TTS fallback zincirleri)
- **API Endpoint'leri** tablosu
- **TTS Akışı**, **Video Render Motoru**, **Video Proxy**, **API Anahtar Yönetimi**, **Hata Yönetimi**
- **Sürüm Geçmişi** — en üste yeni sürüm girdisi ekle

> Dokümanlardaki bilgileri **kodla doğrula**; varsayımlarda bulunma. Gerçek model adlarını, endpoint'leri ve davranışı `server.ts`, `src/` içindeki ilgili dosyalardan teyit et.

### 5. Versiyon Artır, Commit At ve Push Yap

Otomatik yardımcısı betiği çalıştırarak versiyonu artırın, commit oluşturun ve repoya pushlayın:

```bash
# Otomatik: Versiyon artırır + git add . + git commit + git push
node versionist/bump-version.mjs --push --m="Özet değişiklik mesajı"

# veya minor/major artırım ile push:
node versionist/bump-version.mjs --bump=minor --push --m="Yeni modül eklendi"
```

Alternatif olarak elle adımlar:

```bash
node versionist/bump-version.mjs --bump=patch
git add .
git commit -m "chore(release): v0.0.10 - Özet değişiklik"
git push origin main
```

### 6. Doğrula

```bash
git status
git log -1 --oneline
```

- Değişikliklerin ve yeni versiyonun başarıyla repoya pushlandığını teyit et.

## Önemli Notlar

- Versiyon artışı ve push **her kod değişikliği için bir kez** olmalı; aynı sürümü tekrar artırma.
- Kod değişikliği yoksa versiyonu artırma; yalnızca doküman güncelle.
- Commit mesajları anlaşılır olmalı (`chore(release): vX.Y.Z - <özet>`).
- Değişikliklerin README.md ve yt_shorts.md'de tutarlı olduğundan emin ol.

