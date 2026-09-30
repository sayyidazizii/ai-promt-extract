# 🎬 AI Prompt Extractor & Generator

Aplikasi web modern untuk mengekstrak dan mereplikasi visual dari **foto/video** menjadi **prompt generator AI** siap pakai untuk **Google Flow (Google Veo)**, **Midjourney v6**, **FLUX.1**, **Sora**, **Runway Gen-3**, **Kling AI**, dan **Stable Diffusion**.

---

## ✨ Fitur Utama

- **🎥 Video & Image to Prompt:** Unggah file foto/video (hingga 100MB) atau paste link (URL) media.
- **✨ Preset Khusus Google Flow (Veo):**
  - **Single Clip Prompt (8s)** untuk generate klip cepat.
  - **30-Second Multi-Scene Storyboard (4 Klip Berurutan):** AI otomatis membagi video menjadi 4 scene (0-8s, 8-16s, 16-24s, 24-30s) untuk siap digabung di CapCut menjadi video viral 30 detik (FB Reels / Shorts).
- **📋 1-Click Copy:** Salin prompt bahasa Inggris siap pakai langsung ke clipboard.
- **🔄 Auto Retry & Multi-Model Fallback:** Tahan lonjakan beban Google API (mencegah error 404 & 503 dengan auto-fallback bertingkat: `gemini-3.5-flash` → `gemini-3.5-flash-lite` → `gemini-3.8-flash`).
- **📁 File Management:** Mendukung drag & drop, file explorer, paste dari clipboard (`Ctrl + V`), dan download langsung dari tautan URL publik.
- **💾 SQLite Local Database:** Riwayat analisis prompt otomatis tersimpan secara lokal dan dapat dibuka kembali kapan saja.

---

## 🚀 Panduan Instalasi & Menjalankan

### 1. Clone Repository
```bash
git clone https://github.com/sayyidazizii/ai-promt-extract.git
cd ai-promt-extract
```

### 2. Instal Dependensi
```bash
npm install
```

### 3. Konfigurasi Environment (`.env`)
Salin file template `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Isi API Key Google Gemini Anda di dalam file `.env`:
```env
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-3.5-flash
PORT=3000
```
> 💡 *Dapatkan API Key gratis di [Google AI Studio](https://aistudio.google.com/app/apikeys).*

### 4. Jalankan Aplikasi
```bash
npm start
```
Buka browser dan akses: **`http://localhost:3000`**

---

## 🛠️ Tech Stack

- **Runtime & Backend:** Node.js, Express.js
- **File Upload & Storage:** Multer (multipart) & Google AI File Manager
- **AI Engine:** Google Gemini API (`@google/generative-ai`)
- **Database:** SQLite3 (`sqlite` & `sqlite3`)
- **Frontend:** Vanilla JavaScript, Tailwind CSS, Lucide Icons

---

## 📄 Lisensi
ISC License
