const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const AdmZip = require('adm-zip');
const CONFIG = require('./config');
const {
  uploadZipToRelease,
  triggerWorkflow,
  getRunStatus,
  getArtifacts,
  downloadArtifactZip,
  deleteRelease,
  getFailedStepLog,
  sleep
} = require('./github');

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

const USER_DB_PATH = path.join(__dirname, 'data', 'user.json');
const DOWNLOADS_DIR = path.join(__dirname, 'public', 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/downloads', express.static(DOWNLOADS_DIR));
app.use(session({
  secret: 'sarkomer-secret-key-12345',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 3600000 }
}));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname) !== '.zip') {
      return cb(new Error('Hanya file berformat .zip yang diizinkan bray!'));
    }
    cb(null, true);
  }
});

function checkAuth(req, res, next) {
  if (req.session.isOwner) {
    next();
  } else {
    res.redirect('/login');
  }
}

app.get('/', checkAuth, (req, res) => {
  res.redirect('/dashboard');
});

app.get('/login', (req, res) => {
  if (req.session.isOwner) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const cleanUsername = username.trim().toLowerCase();

  if (!fs.existsSync(USER_DB_PATH)) {
    return res.send("<script>alert('Database user kosong bray! Buat dulu lewat bot Telegram.'); window.location='/login';</script>");
  }

  try {
    const users = JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf-8'));
    const matchedUser = users.find(u => u.username === cleanUsername && u.password === password);

    if (matchedUser) {
      req.session.isOwner = true; 
      req.session.username = matchedUser.username;
      req.session.role = matchedUser.role;
      res.redirect('/dashboard');
    } else {
      res.send("<script>alert('Username atau Password salah bray!'); window.location='/login';</script>");
    }
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

app.get('/dashboard', checkAuth, (req, res) => {
  try {
    let html = fs.readFileSync(path.join(__dirname, 'views', 'dashboard.html'), 'utf8');
    html = html.replace('{{USERNAME}}', req.session.username.toUpperCase());
    html = html.replace('{{ROLE}}', req.session.role.toUpperCase());

    if (req.session.role !== 'admin') {
      html = html.replace('id="web2apk-section"', 'id="web2apk-section" style="display:none;"');
    }

    res.send(html);
  } catch (err) {
    res.status(500).send("Error loading dashboard");
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

if (!global.buildStatus) global.buildStatus = {};

app.post('/api/build-zip', checkAuth, upload.single('projectZip'), async (req, res) => {
  const username = req.session.username;

  try {
    if (!req.file) return res.status(400).json({ success: false, message: "File ZIP wajib diupload bray!" });

    const buildMode = req.body.buildMode || 'release';
    const tag = `build-${username}-${Date.now()}`;

    global.buildStatus[username] = {
      status: "processing",
      message: "Mengunggah berkas project ke GitHub Release...",
      downloadUrl: null
    };

    const { releaseId, browserUrl } = await uploadZipToRelease(req.file.path, req.file.originalname, tag);
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    global.buildStatus[username] = {
      status: "processing",
      message: "Memicu workflow kompilasi di GitHub Actions...",
      downloadUrl: null
    };

    const runId = await triggerWorkflow(browserUrl, tag, buildMode);

    global.buildStatus[username] = {
      status: "building",
      message: "Build masuk antrean, menunggu runner GitHub Actions siap...",
      downloadUrl: null
    };

    res.json({ success: true, message: "Proses kompilasi berhasil dipicu bray!" });

    // Jalankan polling di background, tidak di-await supaya response tidak ngegantung
    pollWebBuild(username, runId, releaseId, tag).catch((err) => {
      global.buildStatus[username] = {
        status: "failed",
        message: `Polling error: ${err.message}`,
        downloadUrl: null
      };
    });
  } catch (err) {
    global.buildStatus[username] = {
      status: "failed",
      message: `Gagal memicu build: ${err.message}`,
      downloadUrl: null
    };
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
});

// ─── BACKGROUND POLLING UNTUK BUILD VIA WEBSITE ─────────────────────────────
async function pollWebBuild(username, runId, releaseId, tag) {
  const startTime = Date.now();
  let retryCount = 0;

  while (true) {
    if (Date.now() - startTime > CONFIG.BUILD_TIMEOUT_MS) {
      if (releaseId) await deleteRelease(releaseId).catch(() => {});
      global.buildStatus[username] = {
        status: "failed",
        message: `Build timeout setelah ${Math.round(CONFIG.BUILD_TIMEOUT_MS / 60000)} menit. Proses dibatalkan otomatis bray.`,
        downloadUrl: null
      };
      return;
    }

    let run;
    try {
      run = await getRunStatus(runId);
      retryCount = 0; // Reset retry jika sukses
    } catch (err) {
      retryCount++;
      console.error(`[POLL] Gagal get status (attempt ${retryCount}):`, err.message);
      
      if (retryCount >= 5) {
        if (releaseId) await deleteRelease(releaseId).catch(() => {});
        global.buildStatus[username] = {
          status: "failed",
          message: `Gagal mengambil status run dari GitHub setelah ${retryCount} percobaan: ${err.message}`,
          downloadUrl: null
        };
        return;
      }
      
      await sleep(5000);
      continue;
    }

    if (run.status === "queued") {
      global.buildStatus[username] = {
        status: "building",
        message: "Runner GitHub Actions sedang disiapkan, build masih dalam antrean...",
        downloadUrl: null
      };
    } else if (run.status === "in_progress") {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      global.buildStatus[username] = {
        status: "building",
        message: `Kompilasi Flutter sedang berjalan... (${elapsed}s)`,
        downloadUrl: null
      };
    } else if (run.status === "completed") {
      if (run.conclusion === "success") {
        await handleBuildSuccess(username, runId, releaseId, tag);
      } else {
        await handleBuildFailure(username, runId, releaseId, run);
      }
      return;
    }

    await sleep(CONFIG.POLL_INTERVAL_MS);
  }
}

async function handleBuildSuccess(username, runId, releaseId, tag) {
  try {
    const artifacts = await getArtifacts(runId);
    const apkArtifact =
      artifacts.find((a) =>
        a.name.toLowerCase().includes("apk") || a.name.toLowerCase().includes("build")
      ) || artifacts[0];

    if (!apkArtifact) {
      global.buildStatus[username] = {
        status: "failed",
        message: "Build sukses, tapi artifact APK tidak ditemukan di hasil run. Cek konfigurasi path output di workflow.",
        downloadUrl: null
      };
      return;
    }

    const tmpDir = path.join(__dirname, 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpZip = path.join(tmpDir, `${tag}.zip`);

    await downloadArtifactZip(apkArtifact.id, tmpZip);

    const zip = new AdmZip(tmpZip);
    const apkEntry = zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith('.apk'));

    if (!apkEntry) {
      fs.unlinkSync(tmpZip);
      global.buildStatus[username] = {
        status: "failed",
        message: "Build sukses, tapi tidak ada file .apk di dalam artifact yang dihasilkan.",
        downloadUrl: null
      };
      return;
    }

    const apkFileName = `${tag}.apk`;
    fs.writeFileSync(path.join(DOWNLOADS_DIR, apkFileName), apkEntry.getData());
    fs.unlinkSync(tmpZip);

    global.buildStatus[username] = {
      status: "success",
      message: "Kompilasi selesai bray! Berkas APK lu udah siap diunduh.",
      downloadUrl: `/downloads/${apkFileName}`
    };
  } catch (err) {
    global.buildStatus[username] = {
      status: "failed",
      message: `Build sukses tapi gagal mengambil hasil APK: ${err.message}`,
      downloadUrl: null
    };
  } finally {
    if (releaseId) await deleteRelease(releaseId).catch(() => {});
  }
}

async function handleBuildFailure(username, runId, releaseId, run) {
  if (releaseId) await deleteRelease(releaseId).catch(() => {});

  // Tambahkan delay untuk memastikan log sudah siap
  await sleep(5000);

  const errDetail = await Promise.race([
    getFailedStepLog(runId).catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), 30000))
  ]);

  let message;
  if (errDetail && errDetail.errorLines?.length) {
    const snippet = errDetail.errorLines.join('\n').slice(0, 1500);
    message = `Build gagal pada tahap "${errDetail.stepName}":\n\n${snippet}`;
  } else {
    message = `Kompilasi gagal bray! (conclusion: ${run.conclusion || "unknown"}). Gagal mengambil rincian log error otomatis dari GitHub.`;
  }

  global.buildStatus[username] = {
    status: "failed",
    message,
    downloadUrl: null
  };
}

app.get('/api/build-status', checkAuth, (req, res) => {
  const username = req.session.username;
  const currentStatus = global.buildStatus[username] || { status: "idle", message: "Siap menerima berkas project bray.", downloadUrl: null };
  res.json(currentStatus);
});

app.post('/api/webhook-github', (req, res) => {
  const { status, username, downloadUrl, errorMessage } = req.body;
  if (!username) return res.status(400).json({ success: false });

  if (status === "success") {
    global.buildStatus[username] = {
      status: "success",
      message: "Kompilasi selesai bray! Berkas APK lu udah siap diunduh.",
      downloadUrl: downloadUrl
    };
  } else if (status === "failed") {
    global.buildStatus[username] = {
      status: "failed",
      message: `Kompilasi Gagal bray! Detail Eror: ${errorMessage || "Unknown Error di runner GitHub."}`,
      downloadUrl: null
    };
  }
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});