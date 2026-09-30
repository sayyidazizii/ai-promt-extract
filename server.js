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
  let platformNote = '';
  if (platform === 'flow' || platform === 'google-flow' || platform === 'veo') {
    platformNote = `Fokuskan KHUSUS untuk GOOGLE FLOW / GOOGLE VEO (AI Video Studio).
PANDUAN DURASI 30 DETIK:
Model Google Veo di Google Flow memiliki batas maksimal 8 detik per generasi klip tunggal. Untuk membuat video 30 detik (standar FB Reels / YouTube Shorts), alur video harus dipecah menjadi 4 klip adegan (masing-masing 7-8 detik) yang kemudian digabung di CapCut.
Oleh karena itu, buatkan:
1. 'Single Clip Prompt (8s)': Prompt narasi sinematik 1 klip cepat untuk Google Flow.
2. '30-Second Storyboard (4 Klip Siap Digabung di CapCut)':
   - Scene 1 (00:00 - 00:08) - Opening & Setup: [Prompt Google Flow]
   - Scene 2 (00:08 - 00:16) - The Process & Construction: [Prompt Google Flow]
   - Scene 3 (00:16 - 00:24) - Close-up & Interior Atmosphere: [Prompt Google Flow]
   - Scene 4 (00:24 - 00:30) - Epic Hero Outro Reveal: [Prompt Google Flow]
Semua prompt dalam Bahasa Inggris sinematik padat gerak kamera (drone tracking, slow pan, orbital shot), pencahayaan alami, dan photorealistic tanpa tag kode Midjourney (--ar).`;
  } else if (platform === 'midjourney') {
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
