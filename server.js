require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager, FileState } = require('@google/generative-ai/server');
const { getDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'))
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung. Harap upload gambar atau video.'));
    }
  }
});

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

function buildSystemPrompt(platform = 'general') {
  if (platform === 'flow' || platform === 'google-flow' || platform === 'veo') {
    return `Anda adalah AI Prompt Engineer spesialis Video AI nomor 1 dunia untuk GOOGLE FLOW / GOOGLE VEO (Google Labs VideoFX / Veo Studio).
Tugas Anda: Analisis file media (gambar atau video) ini secara mendalam, lalu buatkan skenario berantai "Sequential Image-to-Video Chaining" untuk menghasilkan video viral 32 detik berkualitas tinggi (4 klip berdurasi masing-masing 8 detik).

SISTEM RANTAI FRAME (FRAME CONTINUITY):
Batas maksimal generasi Google Veo di Google Flow adalah 8 detik per klip generasi. Untuk membuat video 32 detik (standar FB Reels / YouTube Shorts / TikTok), kita menghubungkan 4 klip secara berantai:
- Klip 1 (0-8s): Menggunakan Base Reference Image (gambar awal hasil generate FLUX/Midjourney).
- Klip 2 (8-16s): Menggunakan screenshot frame detik ke-8 dari Klip 1 sebagai gambar input.
- Klip 3 (16-24s): Menggunakan screenshot frame detik ke-16 dari Klip 2 sebagai gambar input.
- Klip 4 (24-32s): Menggunakan screenshot frame detik ke-24 dari Klip 3 sebagai gambar input.
- Gabung di CapCut: Satukan ke-4 klip (total 32 detik) dengan transisi mulus.

PANDUAN EFEK TIMELAPSE HALUS & ANTI-MORPHING:
1. Kamera WAJIB terkunci (Fixed tripod camera angle, static perspective, locked shot) pada Part 1, Part 2, dan Part 3 agar bentuk objek bertransformasi mulus secara fisik dan tidak mengalami kecacatan geometri / morphing / mencair.
2. Gerakan kamera sinematik dinamis (slow orbit / smooth tracking / drone pull-back) HANYA digunakan pada Part 4 (Grand Outro Reveal).
3. Pertahankan konsistensi elemen latar belakang (misal: meja kerja kayu, pencahayaan alami studio, perkakas lingkungan yang sama).

FORMAT OUTPUT WAJIB (Gunakan penanda teks tag persis seperti ini agar sistem parser antarmuka web dapat memisahkannya menjadi kartu terpisah):

===BASE_IMAGE_PROMPT===
[Tuliskan prompt bahasa Inggris photorealistic kualitas 8k untuk generate GAMBAR REFERENSI AWAL (Starting Frame 00:00) di FLUX.1 atau Midjourney v6. Deskripsikan wujud awal subjek/bahan mentah sebelum diproses, pencahayaan alami/studio, dan sudut pandang kamera yang stabil.]

===PART_1===
Title: Part 1 (00:00 - 00:08) - Opening & Material Setup
Input_Image: Upload Base Reference Image (Starting Frame)
Camera: Fixed tripod angle, locked camera perspective, static shot, zero shake
Prompt: [Tuliskan prompt bahasa Inggris sinematik padat untuk Google Flow. Aksi permulaan proses, tangan atau alat mulai bekerja pada bahan mentah, serpihan berhamburan, steady natural lighting, 8k photorealistic.]
Indonesian: [Penjelasan visual & aksi scene 1 dalam Bahasa Indonesia]

===PART_2===
Title: Part 2 (00:08 - 00:16) - Progressive Timelapse Sculpting / Crafting
Input_Image: Upload screenshot frame terakhir Video Part 1 (detik 07.9 / 08.0)
Camera: Static fixed tripod view, continuous locked perspective
Prompt: [Tuliskan prompt bahasa Inggris untuk Google Flow. Tekankan fast-motion timelapse transformation, wujud utama mulai terbentuk jelas secara cepat dan konsisten, serpihan/material terakumulasi rapi, pencahayaan stabil.]
Indonesian: [Penjelasan visual & aksi scene 2 dalam Bahasa Indonesia]

===PART_3===
Title: Part 3 (00:16 - 00:24) - Detailing, Sanding & Finishing
Input_Image: Upload screenshot frame terakhir Video Part 2 (detik 15.9 / 16.0)
Camera: Locked macro perspective, steady camera shot
Prompt: [Tuliskan prompt bahasa Inggris untuk Google Flow. Proses penghalusan tekstur, detailing mikro, finishing atau pemberian cat/oil/varnish, partikel halus melayang di cahaya, tekstur permukaan yang semakin sempurna.]
Indonesian: [Penjelasan visual & aksi scene 3 dalam Bahasa Indonesia]

===PART_4===
Title: Part 4 (00:24 - 00:32) - Grand Hero Reveal & Epic Outro
Input_Image: Upload screenshot frame terakhir Video Part 3 (detik 23.9 / 24.0)
Camera: Cinematic slow orbit shot or smooth pull-back reveal
Prompt: [Tuliskan prompt bahasa Inggris untuk Google Flow. Kamera mulai bergerak sinematik memamerkan hasil akhir karya yang megah, pencahayaan spotlight studio dramatis atau golden hour, shallow depth of field, 8k masterpiece.]
Indonesian: [Penjelasan visual & aksi scene 4 dalam Bahasa Indonesia]

===TIMELAPSE_GUIDE===
Camera_Rules: Part 1-3 kamera WAJIB fixed tripod (statis) untuk mencegah AI morphing/melting. Part 4 baru bergerak sinematik memamerkan hasil.
Key_Modifiers: hyper-realistic timelapse footage, progressive craft process, fast-motion woodworking/construction, locked static camera, zero flicker, 8k resolution.
Negative_Prompt: morphing, melting geometry, warping, jitter, flickering, sudden object shifts, camera shake, blurry, bad anatomy, deformed hands, low quality, watermark, text.
CapCut_Workflow: Susun klip Part 1 sampai 4 berurutan di CapCut (total 32s). Berikan potongan trim mikro di sambungan agar transisi tidak terasa loncat. Tambahkan sound effect ASMR alat/pahat dan musik latar viral.
===END_FLOW===`;
  }

  let platformNote = '';
  if (platform === 'midjourney') {
    platformNote = 'Fokuskan pada prompt Midjourney v6 / FLUX. Sertakan parameter teknis seperti --ar, --style raw, --v 6.1, --stylize.';
  } else if (platform === 'video') {
    platformNote = 'Fokuskan pada AI Video generator seperti OpenAI Sora, Runway Gen-3, Luma Dream Machine, Kling AI, Pika. Uraikan detail pergerakan kamera (pan, zoom, orbit, tracking), kecepatan transisi, fisika visual, dan lighting shifts.';
  } else if (platform === 'sd') {
    platformNote = 'Fokuskan pada Stable Diffusion / SDXL / ComfyUI. Pisahkan Positive Prompt (comma-separated tags + descriptive text) dan Negative Prompt berkualitas tinggi.';
  } else if (platform === 'anime') {
    platformNote = 'Fokuskan pada gaya anime/manga modern (Makoto Shinkai, Studio Ghibli, ufotable, atau digital anime illustration).';
  } else if (platform === 'photorealistic') {
    platformNote = 'Fokuskan pada hyper-realistic photography, spesifikasi kamera (lens, aperture, shutter speed, ISO), lighting studio / natural, dan tekstur photorealistic.';
  }

  return `Anda adalah AI Prompt Engineer ahli untuk generator visual kelas dunia (Midjourney v6, FLUX.1, Stable Diffusion XL, OpenAI Sora, Runway Gen-3, Kling AI, Pika).
Tugas Anda: Analisis file media (gambar/video) ini secara mendalam dan buat panduan prompt generator paling lengkap & presisi agar pengguna dapat mereplikasi atau membuat variasi visual serupa.
${platformNote ? `Instruksi Khusus: ${platformNote}` : ''}

Format Output Wajib:
### 1. English Prompt (Ready to Copy)
[Tuliskan prompt utama dalam bahasa Inggris yang padat, kaya deskripsi sensorik visual, sinematografi, estetika, dan siap langsung di-copy paste ke AI generator]

### 2. Indonesian Description & Visual Breakdown
[Uraian terjemahan & rincian elemen visual dalam Bahasa Indonesia: subjek utama, komposisi, mood/suasana, palet warna, dan tata cahaya]

### 3. Motion & Camera Directions (Khusus Video / AI Video)
[Detail gerakan kamera (misal: smooth drone tracking, slow pan, orbital shot), kecepatan frame, dinamika pergerakan objek, dan transisi]

### 4. Negative Prompt
[Daftar aspek yang harus dihindari, cacat render, distorsi, atau elemen yang tidak diinginkan]

### 5. Technical Parameters & AI Recommendations
[Rekomendasi model terbaik (Midjourney, Sora, Runway, dll), rasio aspek yang disarankan (--ar 16:9, --ar 9:16, dll), serta tag parameter pelengkap]`;
}

function fileToGenerativePart(filePath, mimeType) {
  return {
    inlineData: {
      data: fs.readFileSync(filePath).toString('base64'),
      mimeType
    }
  };
}

async function callModelWithRetry(modelName, parts, maxRetries = 2) {
  const model = genAI.getGenerativeModel({ model: modelName });
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(parts);
      return result.response.text();
    } catch (err) {
      const is503 = err.status === 503 || (err.message && err.message.includes('503'));
      if (is503 && attempt < maxRetries) {
        console.warn(`[Gemini] ${modelName} 503 (percobaan ${attempt}/${maxRetries}), mencoba ulang dalam 1.2s...`);
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      throw err;
    }
  }
}

async function generateWithFallback(parts) {
  // Susun daftar model cadangan dengan prioritas model yang stabil
  const candidateModels = [
    process.env.GEMINI_MODEL,
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.7-flash'
  ].filter(Boolean).filter((m, i, arr) => arr.indexOf(m) === i);

  let lastError = null;
  for (const modelName of candidateModels) {
    try {
      console.log(`[Gemini] Mencoba model: ${modelName}...`);
      const text = await callModelWithRetry(modelName, parts, 2);
      console.log(`[Gemini] Berhasil dengan model: ${modelName}`);
      return { text, modelUsed: modelName };
    } catch (err) {
      console.warn(`[Gemini] Model ${modelName} gagal: ${err.message}. Mencoba model cadangan berikutnya...`);
      lastError = err;
    }
  }
  throw lastError;
}

async function downloadFromUrl(url) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Protokol URL harus http atau https.');
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Gagal mengunduh file dari URL (HTTP ${response.status}: ${response.statusText})`);
  }

  const contentType = response.headers.get('content-type') || '';
  let mimeType = '';
  let ext = '';

  if (contentType.includes('image/')) {
    mimeType = contentType.split(';')[0].trim();
    if (mimeType.includes('png')) ext = '.png';
    else if (mimeType.includes('webp')) ext = '.webp';
    else if (mimeType.includes('gif')) ext = '.gif';
    else ext = '.jpg';
  } else if (contentType.includes('video/')) {
    mimeType = contentType.split(';')[0].trim();
    if (mimeType.includes('webm')) ext = '.webm';
    else if (mimeType.includes('quicktime')) ext = '.mov';
    else ext = '.mp4';
  } else {
    const urlPath = parsed.pathname;
    const match = urlPath.match(/\.(jpg|jpeg|png|webp|gif|mp4|webm|mov)$/i);
    if (match) {
      ext = '.' + match[1].toLowerCase();
      mimeType = (ext === '.mp4' || ext === '.webm' || ext === '.mov')
        ? 'video/' + (ext === '.mov' ? 'quicktime' : ext.replace('.', ''))
        : 'image/' + (ext === '.jpg' ? 'jpeg' : ext.replace('.', ''));
    } else {
      throw new Error('URL tidak mengarah ke file gambar atau video yang valid.');
    }
  }

  const filename = `${Date.now()}-link${ext}`;
  const filePath = path.join(uploadDir, filename);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  return { filePath, filename, mimeType };
}

async function processMediaAndGenerate(filePath, mimeType, originalName, platform = 'general') {
  const isVideo = mimeType.startsWith('video/');
  const type = isVideo ? 'video' : 'image';
  let uploadedGoogleFile = null;
  let mediaPart;

  try {
    if (isVideo) {
      console.log(`[Gemini] Mengunggah video via File API: ${filePath}`);
      const uploadResult = await fileManager.uploadFile(filePath, {
        mimeType,
        displayName: originalName || path.basename(filePath),
      });
      uploadedGoogleFile = uploadResult.file;

      let file = await fileManager.getFile(uploadResult.file.name);
      let attempts = 0;
      while (file.state === FileState.PROCESSING && attempts < 35) {
        console.log(`[Gemini] Status video: PROCESSING... menunggu 2s`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        file = await fileManager.getFile(uploadResult.file.name);
        attempts++;
      }

      if (file.state === FileState.FAILED) {
        throw new Error('Gagal memproses video di Google Gemini API.');
      }

      console.log(`[Gemini] Video siap (ACTIVE)! Memulai pembuatan prompt.`);
      mediaPart = {
        fileData: {
          fileUri: uploadResult.file.uri,
          mimeType: uploadResult.file.mimeType,
        },
      };
    } else {
      mediaPart = fileToGenerativePart(filePath, mimeType);
    }

    const systemPrompt = buildSystemPrompt(platform);
    const { text: prompt, modelUsed } = await generateWithFallback([systemPrompt, mediaPart]);

    return { type, prompt, modelUsed };
  } finally {
    if (uploadedGoogleFile) {
      try {
        await fileManager.deleteFile(uploadedGoogleFile.name);
        console.log(`[Gemini] File temporary di Google dihapus.`);
      } catch (delErr) {
        console.warn('Gagal menghapus file temporary Google:', delErr.message);
      }
    }
  }
}

// Endpoint 1: Upload File Langsung (Gambar / Video)
app.post('/api/generate', upload.single('file'), async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY belum diset di file .env' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'File wajib diunggah' });
    }

    const platform = req.body.platform || 'general';
    const { type, prompt, modelUsed } = await processMediaAndGenerate(
      req.file.path,
      req.file.mimetype,
      req.file.originalname,
      platform
    );

    const db = await getDb();
    const r = await db.run(
      'INSERT INTO prompts (type, filename, prompt) VALUES (?, ?, ?)',
      [type, req.file.filename, prompt]
    );

    res.json({
      id: r.lastID,
      type,
      filename: req.file.filename,
      previewUrl: '/uploads/' + req.file.filename,
      prompt,
      modelUsed
    });
  } catch (e) {
    console.error('[API Error]:', e);
    res.status(500).json({ error: e.message });
  }
});

// Endpoint 2: Generate dari Paste Link (URL)
app.post('/api/generate-url', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY belum diset di file .env' });
    }
    const { url, platform = 'general' } = req.body;
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'URL link wajib diisi' });
    }

    console.log(`[Link] Mengunduh media dari link: ${url.trim()}`);
    const { filePath, filename, mimeType } = await downloadFromUrl(url.trim());

    const { type, prompt, modelUsed } = await processMediaAndGenerate(
      filePath,
      mimeType,
      filename,
      platform
    );

    const db = await getDb();
    const r = await db.run(
      'INSERT INTO prompts (type, filename, prompt) VALUES (?, ?, ?)',
      [type, filename, prompt]
    );

    res.json({
      id: r.lastID,
      type,
      filename,
      previewUrl: '/uploads/' + filename,
      prompt,
      modelUsed
    });
  } catch (e) {
    console.error('[API URL Error]:', e);
    res.status(500).json({ error: e.message });
  }
});

// Endpoint 3: History & Riwayat
app.get('/api/history', async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all('SELECT * FROM prompts ORDER BY id DESC LIMIT 30');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Endpoint 4: Hapus Satuan Riwayat
app.delete('/api/history/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.run('DELETE FROM prompts WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Endpoint 5: Hapus Semua Riwayat
app.delete('/api/history', async (req, res) => {
  try {
    const db = await getDb();
    await db.run('DELETE FROM prompts');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Prompt Generator Server berjalan di http://localhost:${PORT}`));
