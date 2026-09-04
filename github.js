// github.js - GitHub API helper + Auto-Setup System

const https = require("https");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const FLUTTER = require("./flutter");
const readline = require("readline");
const sodium = require("libsodium-wrappers");

function getGitHubToken() { 
  return FLUTTER.GITHUB_TOKEN; 
}

function githubRequest(method, path, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path,
      method,
      headers: {
        Authorization: `Bearer ${getGitHubToken()}`, 
        Accept: "application/vnd.github+json",
        "User-Agent": "FlutterBuildBot/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
        ...extraHeaders,
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString();
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: raw ? JSON.parse(raw) : {} });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: raw });
        }
      });
      res.on("error", reject);
    });

    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error("githubRequest timeout"));
    });

    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

// ─── UPLOAD ASSET ─────────────────────────────────────────────────────────────
function uploadAsset(uploadUrl, filePath, fileName, contentType = "application/zip") {
  return new Promise((resolve, reject) => {
    const cleanUrl = uploadUrl.replace("{?name,label}", "");
    const url = new URL(`${cleanUrl}?name=${encodeURIComponent(fileName)}`);

    const fileData = fs.readFileSync(filePath);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        Authorization: `Bearer ${getGitHubToken()}`,
        "Content-Type": contentType,
        "Content-Length": fileData.length,
        "User-Agent": "FlutterBuildBot/1.0",
        Accept: "application/vnd.github+json",
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString());
          resolve({ status: res.statusCode, body });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(fileData);
    req.end();
  });
}

async function uploadAssetFile(uploadUrl, filePath, fileName, contentType = "image/png") {
  const upload = await uploadAsset(uploadUrl, filePath, fileName, contentType);
  if (upload.status !== 201) {
    throw new Error(`Gagal upload asset file: ${JSON.stringify(upload.body)}`);
  }
  return {
    id: upload.body.id,
    url: upload.body.url,
    browserUrl: upload.body.browser_download_url
  };
}

// ─── RELEASE FUNCTIONS ────────────────────────────────────────────────────────
async function createRelease(tagName, isDraft = true) {
  const res = await githubRequest(
    "POST",
    `/repos/${FLUTTER.GITHUB_OWNER}/${FLUTTER.GITHUB_REPO}/releases`, 
    {
      tag_name: tagName,
      name: `Build ${tagName}`,
      draft: isDraft,
      prerelease: true,
      generate_release_notes: false,
    }
  );

  if (res.status !== 201) {
    throw new Error(`Gagal buat release: ${JSON.stringify(res.body)}`);
  }

  return {
    releaseId: res.body.id,
    uploadUrl: res.body.upload_url,
    htmlUrl: res.body.html_url,
  };
}

async function createReleaseOnly(tagName) {
  try {
    return await createRelease(tagName, true);
  } catch (err) {
    const existing = await githubRequest(
      "GET",
      `/repos/${FLUTTER.GITHUB_OWNER}/${FLUTTER.GITHUB_REPO}/releases/tags/${tagName}`
    );
    if (existing.status === 200) {
      await deleteRelease(existing.body.id);
    }
    return await createRelease(tagName, true);
  }
}

async function publishRelease(releaseId) {
  const check = await githubRequest(
    "GET",
    `/repos/${FLUTTER.GITHUB_OWNER}/${FLUTTER.GITHUB_REPO}/releases/${releaseId}`
  );

  if (check.status === 404) {
    throw new Error(`Release ID ${releaseId} tidak ditemukan (sudah terhapus atau tidak valid)`);
  }

  if (check.status === 200 && !check.body.draft) {
    const asset = check.body.assets?.[0];
    return asset ? asset.browser_download_url : null;
  }

  const res = await githubRequest(
    "PATCH",
    `/repos/${FLUTTER.GITHUB_OWNER}/${FLUTTER.GITHUB_REPO}/releases/${releaseId}`,
    { draft: false }
  );

  if (res.status !== 200) {
    throw new Error(`Gagal publish release: HTTP ${res.status} - ${JSON.stringify(res.body)}`);
  }

  const asset = res.body.assets?.[0];
  return asset ? asset.browser_download_url : null;
}

async function uploadZipToRelease(filePath, fileName, tagName) {
  const release = await createRelease(tagName, true);
  const upload = await uploadAsset(release.uploadUrl, filePath, fileName, "application/zip");

  if (upload.status !== 201) {
    throw new Error(`Gagal upload asset: ${JSON.stringify(upload.body)}`);
  }

  return {
    releaseId: release.releaseId,
    assetId: upload.body.id,
    assetUrl: upload.body.url,
    browserUrl: upload.body.url, 
  };
}

async function deleteRelease(releaseId) {
  await githubRequest(
    "DELETE",
    `/repos/${FLUTTER.GITHUB_OWNER}/${FLUTTER.GITHUB_REPO}/releases/${releaseId}`
  );
}

// ─── WORKFLOW FUNCTIONS ───────────────────────────────────────────────────────
async function triggerWorkflow(assetUrl, tagName, buildType = "release") {
  const beforeTrigger = new Date().toISOString();

  const res = await githubRequest(
    "POST",
    `/repos/${FLUTTER.GITHUB_OWNER}/${FLUTTER.GITHUB_REPO}/actions/workflows/build.yml/dispatches`,
    {
      ref: "main",
      inputs: {
        zip_url: assetUrl,
        tag: tagName,
        build_type: buildType
      },
    }
  );

  if (res.status !== 204) {
    throw new Error(`Gagal trigger workflow: ${JSON.stringify(res.body)}`);
  }

  return await waitForNewRunId(beforeTrigger, 30000);
}

async function triggerWeb2ApkWorkflow(webUrl, appName, iconUrl) {
  const beforeTrigger = new Date().toISOString();

  const res = await githubRequest(
    "POST",
    `/repos/${FLUTTER.GITHUB_OWNER}/${FLUTTER.GITHUB_REPO}/actions/workflows/web2apk.yml/dispatches`,
    {
      ref: "main",
      inputs: {
        web_url: webUrl,
        app_name: appName,
        icon_url: iconUrl
      },
    }
  );

  if (res.status !== 204) {
    throw new Error(`Gagal trigger Web2Apk workflow: ${JSON.stringify(res.body)}`);
  }

  return await waitForNewRunId(beforeTrigger, 30000);
}

async function waitForNewRunId(since, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let lastCheckedRunId = null;

  try {
    const initialRes = await githubRequest(
      "GET",
      `/repos/${FLUTTER.GITHUB_OWNER}/${FLUTTER.GITHUB_REPO}/actions/runs?per_page=1&event=workflow_dispatch`
    );
    const initialRuns = initialRes.body.workflow_runs || [];
    if (initialRuns.length > 0) {
      lastCheckedRunId = initialRuns[0].id;
    }
  } catch (_) {}

  while (Date.now() < deadline) {
    await sleep(4000);

    const res = await githubRequest(
      "GET",
      `/repos/${FLUTTER.GITHUB_OWNER}/${FLUTTER.GITHUB_REPO}/actions/runs?per_page=3&event=workflow_dispatch`
    );

    const runs = res.body.workflow_runs || [];
    if (runs.length > 0) {
      const latestRun = runs[0];
      
      if (latestRun.id !== lastCheckedRunId) {
        return latestRun.id;
      }
      
      const timeDiff = Math.abs(new Date(latestRun.created_at) - new Date(since));
      if (timeDiff < 120000) {
        return latestRun.id;
      }
    }
  }

  throw new Error("Workflow run tidak muncul. Antrean server sedang padat, silakan coba lagi.");
}

// ─── RUN STATUS ───────────────────────────────────────────────────────────────
async function getRunStatus(runId) {
  const res = await githubRequest(
    "GET",
    `/repos/${FLUTTER.GITHUB_OWNER}/${FLUTTER.GITHUB_REPO}/actions/runs/${runId}`
  );
  const r = res.body;
  return {
    status: r.status,
    conclusion: r.conclusion,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    durationSec:
      r.created_at && r.updated_at
        ? Math.round((new Date(r.updated_at) - new Date(r.created_at)) / 1000)
        : 0,
  };
}

// ─── ARTIFACTS ────────────────────────────────────────────────────────────────
async function getArtifacts(runId) {
  const res = await githubRequest(
    "GET",
    `/repos/${FLUTTER.GITHUB_OWNER}/${FLUTTER.GITHUB_REPO}/actions/runs/${runId}/artifacts`
  );
  return res.body.artifacts || [];
}

function downloadArtifactZip(artifactId, destPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: `/repos/${FLUTTER.GITHUB_OWNER}/${FLUTTER.GITHUB_REPO}/actions/artifacts/${artifactId}/zip`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${getGitHubToken()}`, 
        Accept: "application/vnd.github+json",
        "User-Agent": "FlutterBuildBot/1.0",
      },
    };

    function get(opts, useHttps = true) {
      const mod = useHttps ? https : http;
      const req = mod.request(opts, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          const loc = res.headers.location;
          if (!loc) return reject(new Error("Redirect tanpa Location header"));
          res.resume();
          const u = new URL(loc);
          get(
            {
              hostname: u.hostname,
              path: u.pathname + u.search,
              method: "GET",
              headers: { "User-Agent": "FlutterBuildBot/1.0" },
            },
            u.protocol === "https:"
          );
          return;
        }

        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Download artifact gagal: HTTP ${res.statusCode}`));
        }

        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
        file.on("error", reject);
        res.on("error", reject);
      });

      req.on("error", reject);
      req.end();
    }

    get(options);
  });
}

// ─── FAILED STEP LOG ──────────────────────────────────────────────────────────
async function getFailedStepLog(runId) {
  try {
    console.log(`[DEBUG] Mencoba mengambil log error untuk runId: ${runId}`);
    
    // Tambahkan delay sebelum mengambil log
    await sleep(3000);
    
    const result = await Promise.race([
      _getFailedStepLog(runId),
      new Promise((resolve) => setTimeout(() => resolve(null), 20000)),
    ]);
    return result;
  } catch (err) {
    console.error("getFailedStepLog error:", err.message);
    return null;
  }
}

// ====================================================================
// 1. FUNGSI AMBIL LOG DENGAN PROTEKSI TIMEOUT & RAM (ANTI NGESTUCK)
// ====================================================================
function fetchLogWithRedirect(apiPath) {
  return new Promise((resolve) => {
    const globalTimeout = setTimeout(() => {
      console.error("❌ [FETCH LOG] Global timeout 10 detik abis, potong bray!");
      resolve(null);
    }, 10000);

    function get(hostname, path, useAuth) {
      const headers = { "User-Agent": "FlutterBuildBot/1.0" };
      if (useAuth) {
        headers["Authorization"] = `Bearer ${getGitHubToken()}`;
        headers["Accept"] = "application/vnd.github+json";
      }

      const req = https.request({ hostname, path, method: "GET", headers }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          const loc = res.headers.location;
          res.resume();
          if (!loc) { clearTimeout(globalTimeout); return resolve(null); }
          
          const u = new URL(loc);
          return get(u.hostname, u.pathname + u.search, false);
        }

        if (res.statusCode !== 200) {
          res.resume();
          return resolve(null);
        }

        let totalLength = 0;
        const chunks = [];

        res.on("data", (c) => {
          chunks.push(c);
          totalLength += c.length;

          if (totalLength > 3 * 1024 * 1024) {
            req.destroy();
            console.warn("⚠️ [FETCH LOG] Log kegedean bray, dipotong demi keamanan RAM!");
            clearTimeout(globalTimeout);
            resolve(Buffer.concat(chunks).toString());
          }
        });

        res.on("end", () => {
          clearTimeout(globalTimeout);
          resolve(Buffer.concat(chunks).toString());
        });

        res.on("error", () => { clearTimeout(globalTimeout); resolve(null); });
      });

      req.on("error", () => { clearTimeout(globalTimeout); resolve(null); });
      
      req.setTimeout(8000, () => { 
        req.destroy(); 
        clearTimeout(globalTimeout); 
        resolve(null); 
      });
      
      req.end();
    }

    get("api.github.com", apiPath, true);
  });
}

async function _getFailedStepLog(runId) {
  try {
    const jobsRes = await githubRequest(
      "GET",
      `/repos/${FLUTTER.GITHUB_OWNER}/${FLUTTER.GITHUB_REPO}/actions/runs/${runId}/jobs`
    );

    const jobs = jobsRes.body?.jobs || [];
    const failedJob = jobs.find((j) => j.conclusion === "failure");
    if (!failedJob) return null;

    const failedStep = failedJob.steps?.find((s) => s.conclusion === "failure");
    const stepName = failedStep?.name || failedJob.name;

    const logText = await fetchLogWithRedirect(
      `/repos/${FLUTTER.GITHUB_OWNER}/${FLUTTER.GITHUB_REPO}/actions/jobs/${failedJob.id}/logs`
    );

    if (!logText) return { stepName, hasDetails: false, errorLines: [] };

    const allLines = logText
      .split("\n")
      .map((line) => {
        let clean = line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*/, "");
        clean = clean.replace(/^##\[[a-zA-Z]+\]\s*/, "");
        clean = clean.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
        clean = clean.replace(/`/g, "'");
        clean = clean.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return clean.trim();
      });

    const errorLines = allLines.filter((line) => {
      if (!line) return false;

      const lower = line.toLowerCase();

      if (lower.includes("install") || lower.includes("sdk") || lower.includes("platform") || lower.includes("revision")) return false;
      if (lower.includes("force_javascript") || lower.includes("shell:") || lower.includes("bash") || lower.includes("gradle task")) return false;
      if (lower.includes("cleanup") || lower.includes("orphan") || lower.includes("terminate") || lower.includes("hostedtoolcache")) return false;
      if (lower.includes("help.gradle.org") || lower.includes("stacktrace") || lower.includes("info or --debug") || lower.includes("--scan")) return false;

      return true;
    });

    const finalLines = errorLines.slice(-15);

    return { stepName, hasDetails: finalLines.length > 0, errorLines: finalLines };

  } catch (error) {
    console.error("❌ [ERROR LOG FETCH] Gagal ngambil log dari GitHub bray:", error.message);
    return { stepName: "Unknown Step (Fetch Error)", hasDetails: false, errorLines: [error.message] };
  }
}

// ─── TEMPLATE WORKFLOW CONTENT ────────────────────────────────────────────────

const buildYmlContent = `name: Build Flutter APK

on:
  workflow_dispatch:
    inputs:
      zip_url:
        description: "URL download ZIP project Flutter"
        required: true
      tag:
        description: "Tag build"
        required: true
      build_type:
        description: "debug / release"
        required: true
        default: "release"
      only_analyze:
        description: "Hanya jalankan analyze (true/false)"
        required: false
        default: "false"

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"
    
    steps:
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "24"

      - name: Download ZIP project
        run: |
          echo "=== Downloading ZIP ==="
          echo "URL: \${{ github.event.inputs.zip_url }}"

          curl -L \\
            -H "Authorization: Bearer \${{ secrets.GH_TOKEN }}" \\
            -H "Accept: application/octet-stream" \\
            "\${{ github.event.inputs.zip_url }}" \\
            -o project.zip \\
            -w "\\n=== HTTP Status: %{http_code} ===\\n=== Final URL: %{url_effective} ===\\n"

          echo ""
          echo "=== File Info ==="
          ls -lh project.zip
          echo ""
          echo "=== File Type ==="
          file project.zip
          echo ""
          echo "=== First Bytes ==="
          xxd project.zip | head -2

      - name: Extract ZIP
        run: |
          echo "=== Validating ZIP ==="
          if ! unzip -t project.zip > /dev/null 2>&1; then
            echo "❌ File bukan ZIP valid!"
            echo ""
            echo "=== Isi file ==="
            cat project.zip
            exit 1
          fi
          echo "✅ ZIP valid"

          echo ""
          echo "=== Extracting ZIP ==="
          unzip -q project.zip -d project_raw

          echo ""
          echo "=== Mengunci Project Dir ==="
          SUB_DIR_COUNT=\$(find project_raw -maxdepth 1 -mindepth 1 -type d | wc -l)
          FILE_COUNT=\$(find project_raw -maxdepth 1 -mindepth 1 -type f | wc -l)
          
          if [ "\$SUB_DIR_COUNT" -eq 1 ] && [ "\$FILE_COUNT" -eq 0 ]; then
            PROJECT_DIR=\$(find project_raw -maxdepth 1 -mindepth 1 -type d | head -n 1)
          else
            PROJECT_DIR="project_raw"
          fi
          echo "PROJECT_DIR=\$PROJECT_DIR" >> \$GITHUB_ENV

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: "temurin"
          java-version: "17"

      - name: Setup Flutter
        uses: subosito/flutter-action@main
        with:
          flutter-version: "3.41.9"
          channel: "stable"
          cache: true

      - name: Analyze Project Code
        working-directory: \${{ env.PROJECT_DIR }}
        run: |
          if [ -f "pubspec.yaml" ]; then
            flutter analyze > analyze_report.txt 2>&1 || true
            echo "[RESULT_ANALYZE]"
            cat analyze_report.txt
            echo "[END_RESULT_ANALYZE]"
            rm -f analyze_report.txt
          else
            echo "[RESULT_ANALYZE]"
            echo "❌ pubspec.yaml tidak ditemukan."
            echo "[END_RESULT_ANALYZE]"
          fi

      - name: Stop if Analyze Only
        if: \${{ github.event.inputs.only_analyze == 'true' }}
        run: exit 1

      - name: Get dependencies
        working-directory: \${{ env.PROJECT_DIR }}
        run: |
          if [ -f "pubspec.yaml" ]; then
            timeout 120s flutter pub get || echo "⚠️ Lanjut..."
          fi

      - name: Build APK
        working-directory: \${{ env.PROJECT_DIR }}
        run: |
          if [ -f "pubspec.yaml" ]; then
            flutter build apk --\${{ github.event.inputs.build_type }}
          else
            GRADLE_PATH=\$(find . -name "gradlew" | head -n 1)
            GRADLE_DIR=\$(dirname "\$GRADLE_PATH")
            cd "\$GRADLE_DIR" && chmod +x gradlew
            if [ "\${{ github.event.inputs.build_type }}" = "debug" ]; then
              ./gradlew assembleDebug
            else
              ./gradlew assembleRelease
            fi
          fi

      - name: Check APK Output
        run: |
          APK_FOUND=\$(find \$GITHUB_WORKSPACE -name "*.apk" | head -n 1)
          APK_PATH=\$(echo "\$APK_FOUND" | sed "s|\$GITHUB_WORKSPACE/||")
          echo "PROJECT_DIR=\$GITHUB_WORKSPACE" >> \$GITHUB_ENV
          echo "APK_PATH=\$APK_PATH" >> \$GITHUB_ENV

      - name: Upload APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: flutter-\${{ github.event.inputs.build_type }}-\${{ github.event.inputs.tag }}
          path: \${{ env.PROJECT_DIR }}/\${{ env.APK_PATH }}
          retention-days: 1
          if-no-files-found: error`;

const web2apkYmlContent = `name: Web2APK

on:
  workflow_dispatch:
    inputs:
      web_url:
        description: 'URL Website'
        required: true
      app_name:
        description: 'Nama Aplikasi'
        required: true
      icon_url:
        description: 'Icon Url'
        required: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - name: Setup Flutter
        uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.44.0'
          channel: stable
          cache: true

      - name: Create Flutter Project
        run: |
          APP_NAME="\${{ github.event.inputs.app_name }}"
          PKG=\$(echo "\$APP_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '_' | tr -cd '[:alnum:]_')
          flutter create --org com.webapk --project-name "\$PKG" myapp

      - name: Add Assets and Dependencies
        run: |
          cd myapp
          flutter pub add webview_flutter
          flutter pub add flutter_launcher_icons
          flutter pub add connectivity_plus
          echo "  assets:" >> pubspec.yaml
          echo "    - assets/icon/" >> pubspec.yaml

      - name: Write main.dart
        run: |
          APP_NAME="\${{ github.event.inputs.app_name }}"
          WEB_URL="\${{ github.event.inputs.web_url }}"

          cat > myapp/lib/main.dart << 'DART'
          import 'package:flutter/material.dart';
          import 'package:flutter/services.dart';
          import 'package:webview_flutter/webview_flutter.dart';
          import 'package:connectivity_plus/connectivity_plus.dart';
          import 'dart:async';

          void main() {
            WidgetsFlutterBinding.ensureInitialized();
            SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
              statusBarColor: Colors.transparent,
              statusBarIconBrightness: Brightness.dark,
            ));
            runApp(const MyApp());
          }

          class MyApp extends StatelessWidget {
            const MyApp({super.key});
            @override
            Widget build(BuildContext context) {
              return MaterialApp(
                title: '\$APP_NAME',
                debugShowCheckedModeBanner: false,
                theme: ThemeData(useMaterial3: true, primarySwatch: Colors.blue),
                home: const SplashScreen(),
              );
            }
          }

          class SplashScreen extends StatefulWidget {
            const SplashScreen({super.key});
            @override
            State<SplashScreen> createState() => _SplashScreenState();
          }

          class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
            late AnimationController _fadeController;
            late AnimationController _scaleController;
            late AnimationController _dotController;
            late Animation<double> _fadeAnim;
            late Animation<double> _scaleAnim;
            late Animation<double> _dot1Anim;
            late Animation<double> _dot2Anim;
            late Animation<double> _dot3Anim;
            bool _isChecking = false;
            bool _dialogShown = false;

            @override
            void initState() {
              super.initState();
              _fadeController = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));
              _scaleController = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));
              _dotController = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..repeat();

              _fadeAnim = Tween<double>(begin: 0.0, end: 1.0).animate(CurvedAnimation(parent: _fadeController, curve: Curves.easeOut));
              _scaleAnim = Tween<double>(begin: 0.75, end: 1.0).animate(CurvedAnimation(parent: _scaleController, curve: Curves.easeOutBack));

              _dot1Anim = TweenSequence([
                TweenSequenceItem(tween: Tween<double>(begin: 0.3, end: 1.0), weight: 1),
                TweenSequenceItem(tween: Tween<double>(begin: 1.0, end: 0.3), weight: 1),
                TweenSequenceItem(tween: ConstantTween<double>(0.3), weight: 1),
              ]).animate(CurvedAnimation(parent: _dotController, curve: Curves.easeInOut));

              _dot2Anim = TweenSequence([
                TweenSequenceItem(tween: ConstantTween<double>(0.3), weight: 1),
                TweenSequenceItem(tween: Tween<double>(begin: 0.3, end: 1.0), weight: 1),
                TweenSequenceItem(tween: Tween<double>(begin: 1.0, end: 0.3), weight: 1),
              ]).animate(CurvedAnimation(parent: _dotController, curve: Curves.easeInOut));

              _dot3Anim = TweenSequence([
                TweenSequenceItem(tween: Tween<double>(begin: 1.0, end: 0.3), weight: 1),
                TweenSequenceItem(tween: ConstantTween<double>(0.3), weight: 1),
                TweenSequenceItem(tween: Tween<double>(begin: 0.3, end: 1.0), weight: 1),
              ]).animate(CurvedAnimation(parent: _dotController, curve: Curves.easeInOut));

              _fadeController.forward();
              _scaleController.forward();
              Timer(const Duration(milliseconds: 1500), () => _checkConnectionAndNavigate());
            }

            Future<void> _checkConnectionAndNavigate() async {
              if (_isChecking) return;
              setState(() => _isChecking = true);
              await Future.delayed(const Duration(milliseconds: 1000));
              var connectivityResult = await (Connectivity().checkConnectivity());
              if (connectivityResult.every((r) => r == ConnectivityResult.none)) {
                setState(() => _isChecking = false);
                _showNoConnectionDialog();
              } else {
                if (mounted) {
                  Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const WebViewPage()));
                }
              }
            }

            void _showNoConnectionDialog() {
              if (!mounted || _dialogShown) return;
              setState(() => _dialogShown = true);
              showDialog(
                context: context,
                barrierDismissible: false,
                builder: (context) => AlertDialog(
                  title: const Text('Gagal Terhubung'),
                  content: const Text('Tidak ada koneksi internet.'),
                  actions: [
                    TextButton(onPressed: () { Navigator.pop(context); setState(() => _dialogShown = false); _checkConnectionAndNavigate(); }, child: const Text('Coba Lagi'))
                  ],
                ),
              );
            }

            @override
            void dispose() { _fadeController.dispose(); _scaleController.dispose(); _dotController.dispose(); super.dispose(); }

            @override
            Widget build(BuildContext context) {
              return Scaffold(body: Center(child: Text('\$APP_NAME', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold))));
            }
          }

          class WebViewPage extends StatefulWidget {
            const WebViewPage({super.key});
            @override
            State<WebViewPage> createState() => _WebViewPageState();
          }

          class _WebViewPageState extends State<WebViewPage> {
            late final WebViewController _controller;
            @override
            void initState() {
              super.initState();
              _controller = WebViewController()
                ..setJavaScriptMode(JavaScriptMode.unrestricted)
                ..loadRequest(Uri.parse('\$WEB_URL'));
            }
            @override
            Widget build(BuildContext context) {
              return Scaffold(body: SafeArea(child: WebViewWidget(controller: _controller)));
            }
          }
          DART

          sed -i "s#\\\$APP_NAME#\$APP_NAME#g" myapp/lib/main.dart
          sed -i "s#\\\$WEB_URL#\$WEB_URL#g" myapp/lib/main.dart

      - name: Fix Android Permissions
        run: |
          APP_NAME="\${{ github.event.inputs.app_name }}"
          MANIFEST="myapp/android/app/src/main/AndroidManifest.xml"
          sed -i '/<manifest xmlns:android/a\\    <uses-permission android:name="android.permission.INTERNET"\\/>' \$MANIFEST
          sed -i '/<manifest xmlns:android/a\\    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"\\/>' \$MANIFEST
          sed -i "s/android:label=\\"[^\\"]*\\"/android:label=\\"\$APP_NAME\\"/" \$MANIFEST

      - name: Download Icon
        run: |
          mkdir -p myapp/assets/icon
          sudo apt-get install -y imagemagick
          curl -L \\
            -H "Authorization: Bearer \${{ secrets.GITHUB_TOKEN }}" \\
            -H "Accept: application/octet-stream" \\
            "\${{ github.event.inputs.icon_url }}" \\
            -o myapp/assets/icon/icon_raw
          convert myapp/assets/icon/icon_raw -resize 1024x1024 myapp/assets/icon/icon.png

      - name: Generate Icons
        run: |
          cat > myapp/flutter_launcher_icons.yaml << 'EOF'
          flutter_launcher_icons:
            android: true
            ios: false
            image_path: "assets/icon/icon.png"
            min_sdk_android: 21
          EOF
          cd myapp && dart run flutter_launcher_icons -f flutter_launcher_icons.yaml

      - name: Build APK
        run: cd myapp && flutter build apk --release

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: web2apk-release
          path: myapp/build/app/outputs/flutter-apk/app-release.apk`;

// ─── AUTO-SETUP CORE FUNCTIONS ────────────────────────────────────────────────
async function getRepoPublicKey() {
  const res = await githubRequest(
    "GET",
    `/repos/${FLUTTER.GITHUB_OWNER}/${FLUTTER.GITHUB_REPO}/actions/secrets/public-key`
  );
  if (res.status !== 200) {
    throw new Error(`Gagal ambil Public Key Repo: ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

async function createOrUpdateRepoSecret(secretName, secretValue) {
  console.log(`[DEBUG] Mengambil Public Key GitHub...`);
  const pubKey = await getRepoPublicKey();

  if (!pubKey || !pubKey.key || !pubKey.key_id) {
    throw new Error(`Gagal dapet Public Key bray!`);
  }

  console.log(`[DEBUG] Memulai konversi data ke Uint8Array...`);
  const binKey = Uint8Array.from(Buffer.from(pubKey.key, 'base64'));
  const binSec = Uint8Array.from(Buffer.from(secretValue || ''));

  console.log(`[DEBUG] Memulai enkripsi segel crypto_box_seal...`);
  const encryptedBytes = sodium.crypto_box_seal(binSec, binKey);
  const encryptedValue = Buffer.from(encryptedBytes).toString('base64');

  console.log(`[DEBUG] Enkripsi sukses! Mencoba push secret ke GitHub...`);

  const res = await githubRequest(
    "PUT",
    `/repos/${FLUTTER.GITHUB_OWNER}/${FLUTTER.GITHUB_REPO}/actions/secrets/${secretName}`,
    {
      encrypted_value: encryptedValue,
      key_id: pubKey.key_id,
    }
  );

  if (res.status !== 201 && res.status !== 204) {
    throw new Error(`Gagal pasang secret ${secretName}: ${JSON.stringify(res.body)}`);
  }
  return true;
}

async function createOrUpdateWorkflowFile(pathInRepo, fileContent, commitMessage) {
  const existing = await githubRequest(
    "GET",
    `/repos/${FLUTTER.GITHUB_OWNER}/${FLUTTER.GITHUB_REPO}/contents/${pathInRepo}`
  );

  const body = {
    message: commitMessage,
    content: Buffer.from(fileContent).toString("base64"),
    branch: "main"
  };

  if (existing.status === 200) {
    body.sha = existing.body.sha;
  }

  const res = await githubRequest(
    "PUT",
    `/repos/${FLUTTER.GITHUB_OWNER}/${FLUTTER.GITHUB_REPO}/contents/${pathInRepo}`,
    body
  );

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Gagal push file ${pathInRepo}: ${JSON.stringify(res.body)}`);
  }
  return true;
}

async function runAutoSetupGitHub() {
  const flagPath = path.join(process.cwd(), ".setup_done");

  // 🔥 AUTO-SIMPEN / AUTO-SKIP JIKA SUDAH PERNAH RUNNING SETUP
  if (fs.existsSync(flagPath)) {
    console.log("ℹ️ [AUTO-SETUP] Repository sudah ter-setup sebelumnya. Auto-skip nanya bray! 🚀");
    return true;
  }

  try {
    console.log("[CEK CONFIG OWNER]:", FLUTTER.GITHUB_OWNER);
    console.log("[CEK CONFIG TOKEN]:", FLUTTER.GITHUB_TOKEN ? "Isinya Aman bray!" : "KOSONG / UNDEFINED ❌");
    console.log("⚙️  Menyuntikkan secret GH_TOKEN ke Repository Actions...");
    await createOrUpdateRepoSecret("GH_TOKEN", FLUTTER.GITHUB_TOKEN);
    console.log("✅ Secret GH_TOKEN sukses terpasang!");

    console.log("📄 Mengunggah file .github/workflows/build.yml...");
    await createOrUpdateWorkflowFile(
      ".github/workflows/build.yml",
      buildYmlContent,
      "🤖 Auto-generate build.yml via GramJS Bot Engine"
    );
    console.log("✅ File build.yml sukses mendarat!");

    console.log("📄 Mengunggah file .github/workflows/web2apk.yml...");
    await createOrUpdateWorkflowFile(
      ".github/workflows/web2apk.yml",
      web2apkYmlContent,
      "🤖 Auto-generate web2apk.yml via GramJS Bot Engine"
    );
    console.log("✅ File web2apk.yml sukses mendarat!");
    
    // Tulis file flag penanda sukses bray biar pas restart gausah nanya console lagi
    fs.writeFileSync(flagPath, "SETUP_DONE_" + new Date().toISOString());
    console.log("💾 [AUTO-SETUP] Status sukses disimpan ke file .setup_done!");

    return true;
  } catch (error) {
    console.error("❌ [AUTO-SETUP] Gagal eksekusi otomatis bray:", error.message);
    return false;
  }
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = {
  githubRequest,
  uploadZipToRelease,
  deleteRelease,
  triggerWorkflow,
  getRunStatus,
  getArtifacts,
  downloadArtifactZip,
  getFailedStepLog,
  sleep,
  createReleaseOnly,
  uploadAssetFile,
  publishRelease,
  triggerWeb2ApkWorkflow,
  getGitHubToken,
  getRepoPublicKey,
  createOrUpdateRepoSecret,
  createOrUpdateWorkflowFile,
  runAutoSetupGitHub,
  waitForNewRunId,
};