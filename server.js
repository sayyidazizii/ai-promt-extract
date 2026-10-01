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

function buildSystemPrompt(platform = 'general', includeArtisan = true) {
  if (platform === 'flow' || platform === 'google-flow' || platform === 'veo') {
    return `Anda adalah AI Prompt Engineer spesialis Video AI nomor 1 dunia untuk GOOGLE FLOW / GOOGLE VEO (Google Labs VideoFX / Veo Studio).
Tugas Anda: Analisis file media (gambar atau video) ini secara mendalam, lalu buatkan skenario "5 FOTO PROSES & 5 KLIP VIDEO GOOGLE FLOW" (masing-masing 8 detik = Total 40 detik video viral Facebook Reels / YouTube Shorts / TikTok).

PRINSIP WAJIB: ANTI-BENDA BERGERAK SENDIRI & KONSISTENSI KARAKTER (CRITICAL REALISM):
1. JANGAN PERNAH membuat objek terpahat/terbentuk sendiri tanpa tenaga manusia, dan JANGAN ada perkakas melayang di udara (no floating tools, no autonomous carving, no magic self-transformation).
2. IDENTITAS PENGRAJIN KONSISTEN (ARTISAN PROFILE):
   - Jika terdapat manusia (pengrajin/artisan/tangan) atau ini adalah proses kerajinan/pembuatan karya (woodworking, sculpting, painting, crafting, cooking, dll):
   - Tentukan PROFIL PENGRAJIN SPESIFIK & TETAP (misal: "A 45-year-old skilled Asian master woodworker with short dark hair, wearing a rugged dark-brown leather work apron over a rolled-up denim shirt, strong weathered artisan hands").
   - Deskripsi profil karakter yang SAMA PERSIS ini WAJIB disematkan ke dalam SEMUA PROMPT FOTO 1 sampai FOTO 5 agar model orang dan pakaian yang dihasilkan di Midjourney v6 / FLUX.1 konsisten 100% dari awal hingga akhir!
3. AKSI TANGAN & TENAGA FISIK NYATA DI SETIAP KLIP VIDEO (Google Flow):
   - Klip 1: Tangan pengrajin aktif memegang alat (pahat & palu kayu), memahat dengan tenaga nyata, serpihan berhamburan.
   - Klip 2: Kedua tangan pengrajin secara aktif mengukir lekukan bentuk utama dalam gerakan timelapse dinamis yang alami.
   - Klip 3: Tangan pengrajin mengamplas detail mikro dan mengikir permukaan bolak-balik dengan tekanan fisik nyata.
   - Klip 4: Tangan pengrajin mengoleskan minyak poles/wax dengan kain katun, mengusap debu hingga permukaan berkilau mewah.
   - Klip 5: Pengrajin berdiri bangga tersenyum di samping mahakaryanya yang selesai 100% di atas meja kerja studio.

SISTEM 5 PROMPT FOTO PROSES (FOTO 1 SAMPAI FOTO 5):
Pengguna akan membuat/menggunakan 5 foto proses di Midjourney / FLUX.1 terlebih dahulu agar alur transformasi terkontrol 100% konsisten:
- Foto 1 (Titik 00:00): Kondisi awal / Bahan mentah belum diolah (Raw Material / Starting State) bersama sang pengrajin berprofil konsisten sedang memeriksa bahan dengan alat ukur.
- Foto 2 (Titik 00:08): Pembentukan awal / pola kasar terbentuk 25% (Rough Outline), pengrajin yang sama sedang memegang pahat & palu memotong pola awal.
- Foto 3 (Titik 00:16): Wujud utama mulai jelas & proporsional 50% (Mid-Stage Structure), pengrajin yang sama fokus memahat lekukan utama.
- Foto 4 (Titik 00:24): Tahap detailing halus, amplas, dan finishing poles 75% (Fine Detailing & Sanding), pengrajin yang sama mengamplas dan membersihkan serpihan.
- Foto 5 (Titik 00:32): Mahakarya hasil akhir 100% selesai (The Finished Masterpiece Hero State), pengrajin yang sama berdiri bangga di samping karya jadi di atas meja kerja studio.

SISTEM 5 KLIP VIDEO GOOGLE FLOW (8 DETIK PER KLIP - START & END FRAME):
- Klip 1 (00:00 - 00:08): Frame Awal: Foto 1 -> Aksi: Tangan pengrajin memahat bahan mentah dengan tenaga fisik nyata, serpihan beterbangan -> Frame Akhir: Foto 2.
- Klip 2 (00:08 - 00:16): Frame Awal: Foto 2 -> Aksi: Gerakan tangan pengrajin secara cepat dalam timelapse mengukir pola siluet utama -> Frame Akhir: Foto 3.
- Klip 3 (00:16 - 00:24): Frame Awal: Foto 3 -> Aksi: Tangan pengrajin mengamplas detail mikro dan mengikir permukaan dengan tenaga nyata -> Frame Akhir: Foto 4.
- Klip 4 (00:24 - 00:32): Frame Awal: Foto 4 -> Aksi: Tangan pengrajin mengoleskan minyak poles/varnish dengan kain lap, kilau permukaan memancar -> Frame Akhir: Foto 5.
- Klip 5 (00:32 - 00:40): Frame Awal: Foto 5 -> Aksi: Kamera sinematik dinamis (slow orbit 360 / pull-back reveal) menampilkan pengrajin tersenyum bangga di samping mahakarya megahnya.

PANDUAN EFEK TIMELAPSE HALUS & ANTI-MORPHING:
1. Kamera WAJIB terkunci (Fixed tripod camera angle, static perspective, locked shot) pada Klip 1, Klip 2, dan Klip 3 agar bentuk objek dan tangan bertransformasi mulus secara fisik dan tidak mengalami kecacatan geometri / morphing / mencair.
2. Klip 4 kamera stabil dengan sedikit gerak halus.
3. Klip 5 kamera bergerak sinematik dinamis (slow orbit 360 / smooth tracking / drone pull-back) untuk grand hero reveal.
4. Pertahankan konsistensi elemen latar belakang (misal: meja kerja kayu jati yang sama, pencahayaan alami studio, perkakas lingkungan yang sama).

FORMAT OUTPUT WAJIB (Gunakan penanda teks tag persis seperti ini agar sistem parser antarmuka web dapat memisahkannya menjadi kartu terpisah):

===ARTISAN_PROFILE===
Profile: [Deskripsi identitas pengrajin yang konsisten: Usia, etnisitas, model rambut/wajah, pakaian kerja/apron spesifik, ciri tangan, dan perkakas yang digunakan. Formula ini disematkan di semua prompt foto dan video agar karakter identik.]

===IMAGE_1===
Title: Foto 1 (Detik 0s) - Raw Material / Bahan Mentah Awal
Prompt: [Tuliskan prompt bahasa Inggris photorealistic kualitas 8k untuk generate FOTO 1 di FLUX.1 / Midjourney. Deskripsikan bahan mentah utuh di atas meja kerja bersama pengrajin berprofil konsisten sedang memeriksa bahan dengan tangan memegang alat ukur/penggaris, pencahayaan alami studio, fixed camera shot.]

===IMAGE_2===
Title: Foto 2 (Detik 8s) - Rough Carving / Pola Kasar Terbentuk (25%)
Prompt: [Tuliskan prompt bahasa Inggris photorealistic untuk generate FOTO 2 di FLUX.1 / Midjourney. Pengrajin yang SAMA dengan pakaian yang SAMA sedang memegang pahat dan palu mengukir potongan kasar pertama, serpihan bahan menumpuk rapi di meja, latar belakang meja kerja tetap sama persis.]

===IMAGE_3===
Title: Foto 3 (Detik 16s) - Mid-Stage / Wujud Utama Mulai Jelas (50%)
Prompt: [Tuliskan prompt bahasa Inggris photorealistic untuk generate FOTO 3 di FLUX.1 / Midjourney. Pengrajin yang SAMA sedang mengukir detail bentuk utama, siluet karya sudah proporsional, pencahayaan dan meja kerja tetap konsisten.]

===IMAGE_4===
Title: Foto 4 (Detik 24s) - Fine Detailing & Sanding Polish (75%)
Prompt: [Tuliskan prompt bahasa Inggris photorealistic untuk generate FOTO 4 di FLUX.1 / Midjourney. Pengrajin yang SAMA dengan kedua tangan sedang memegang amplas halus menggosok permukaan karya, serbuk halus berhamburan, kilau awal mulai tampak.]

===IMAGE_5===
Title: Foto 5 (Detik 32s) - The Finished Masterpiece / Hasil Jadi (100%)
Prompt: [Tuliskan prompt bahasa Inggris photorealistic untuk generate FOTO 5 di FLUX.1 / Midjourney. Pengrajin yang SAMA berdiri bangga di samping mahakarya hasil akhir 100% selesai bersih dari debu, disinari lampu spotlight studio atau golden hour yang dramatis, 8k masterpiece.]

===PART_1===
Title: Klip 1 (00:00 - 00:08) - Opening & Material Setup
Frame_Awal: Foto 1 (0s)
Frame_Akhir: Foto 2 (8s)
Camera: Fixed tripod angle, locked camera perspective, static shot, zero shake
Prompt: [Tuliskan prompt bahasa Inggris sinematik padat untuk Google Flow. Tekankan aksi fisik nyata: tangan pengrajin aktif memahat bahan mentah dengan gerakan bertenaga nyata, serpihan berhamburan, steady natural lighting, no floating tools, authentic human motion, 8k photorealistic.]
Indonesian: [Penjelasan visual & aksi scene 1 dalam Bahasa Indonesia]

===PART_2===
Title: Klip 2 (00:08 - 00:16) - Progressive Timelapse Sculpting
Frame_Awal: Foto 2 (8s)
Frame_Akhir: Foto 3 (16s)
Camera: Static fixed tripod view, continuous locked perspective
Prompt: [Tuliskan prompt bahasa Inggris untuk Google Flow. Fast-motion timelapse: kedua tangan pengrajin secara aktif dan dinamis memahat membentuk lekukan tubuh utama karya, serpihan terkumpul rapi di meja kerja, gerakan tangan alami, no floating tools, pencahayaan stabil.]
Indonesian: [Penjelasan visual & aksi scene 2 dalam Bahasa Indonesia]

===PART_3===
Title: Klip 3 (00:16 - 00:24) - Detailing, Sanding & Finishing
Frame_Awal: Foto 3 (16s)
Frame_Akhir: Foto 4 (24s)
Camera: Locked macro perspective, steady camera shot
Prompt: [Tuliskan prompt bahasa Inggris untuk Google Flow. Tangan pengrajin mengamplas dengan grit halus bolak-balik dengan tekanan nyata, meniup serbuk halus, detail tekstur semakin sempurna di bawah cahaya studio.]
Indonesian: [Penjelasan visual & aksi scene 3 dalam Bahasa Indonesia]

===PART_4===
Title: Klip 4 (00:24 - 00:32) - Final Polishing & Perfection
Frame_Awal: Foto 4 (24s)
Frame_Akhir: Foto 5 (32s)
Camera: Steady camera, slow smooth glide, focused lighting
Prompt: [Tuliskan prompt bahasa Inggris untuk Google Flow. Tangan pengrajin mengoleskan minyak poles alami dengan kain lap katun, menggosok hingga memancarkan kilau mewah, membersihkan debu terakhir.]
Indonesian: [Penjelasan visual & aksi scene 4 dalam Bahasa Indonesia]

===PART_5===
Title: Klip 5 (00:32 - 00:40) - Grand Hero Reveal & Cinematic Outro
Frame_Awal: Foto 5 (32s)
Frame_Akhir: Cinematic 360 Showcase / Epic Reveal
Camera: Cinematic slow orbit shot, orbital 360 rotation or smooth pull-back reveal
Prompt: [Tuliskan prompt bahasa Inggris untuk Google Flow. Kamera sinematik bergerak mengorbit 360 derajat menampilkan sang pengrajin tersenyum bangga di samping mahakaryanya yang berkilau megah, pencahayaan spotlight studio dramatis atau golden hour, shallow depth of field, 8k masterpiece.]
Indonesian: [Penjelasan visual & aksi scene 5 dalam Bahasa Indonesia]

===TIMELAPSE_GUIDE===
Camera_Rules: Klip 1-3 kamera WAJIB fixed tripod (statis) untuk mencegah AI morphing/melting. Klip 4 kamera stabil. Klip 5 bergerak sinematik memamerkan hasil.
Key_Modifiers: hyper-realistic timelapse footage, progressive craft process, fast-motion woodworking/construction, locked static camera, authentic human craftsmanship, skilled artisan hands, zero flicker, 8k resolution.
Negative_Prompt: floating tools, autonomous carving, self-carving, tools moving by themselves, ghost hands, disembodied hands, levitating objects, extra arms, deformed fingers, morphing, melting geometry, warping, jitter, flickering, sudden object shifts, camera shake, blurry, bad anatomy, deformed hands, low quality, watermark, text.
CapCut_Workflow: Susun klip Klip 1 sampai 5 berurutan di CapCut (total 40s). Berikan potongan trim mikro di sambungan agar transisi tidak terasa loncat. Tambahkan sound effect ASMR alat/pahat dan musik latar viral.
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

async function processMediaAndGenerate(filePath, mimeType, originalName, platform = 'general', includeArtisan = true) {
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

    const systemPrompt = buildSystemPrompt(platform, includeArtisan);
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
    const includeArtisan = req.body.includeArtisan !== 'false' && req.body.includeArtisan !== false;
    const { type, prompt, modelUsed } = await processMediaAndGenerate(
      req.file.path,
      req.file.mimetype,
      req.file.originalname,
      platform,
      includeArtisan
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
    const { url, platform = 'general', includeArtisan = true } = req.body;
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'URL link wajib diisi' });
    }

    console.log(`[Link] Mengunduh media dari link: ${url.trim()}`);
    const { filePath, filename, mimeType } = await downloadFromUrl(url.trim());

    const { type, prompt, modelUsed } = await processMediaAndGenerate(
      filePath,
      mimeType,
      filename,
      platform,
      includeArtisan !== false && includeArtisan !== 'false'
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
