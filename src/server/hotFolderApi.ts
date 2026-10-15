import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';

export interface HotFolderConfig {
  folderPath: string;
  autoShutter: boolean;
}

// Default folder in user's Pictures directory or local workspace fallback
export function getDefaultHotFolder(): string {
  const userPicturesDir = path.join(os.homedir(), 'Pictures', 'Photobooth_HotFolder');
  try {
    if (!fs.existsSync(userPicturesDir)) {
      fs.mkdirSync(userPicturesDir, { recursive: true });
    }
    return userPicturesDir;
  } catch {
    // Fallback to local project directory if ~/Pictures is permission-restricted
    const projectDir = path.join(process.cwd(), 'hotfolder');
    try {
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }
      return projectDir;
    } catch {
      return userPicturesDir;
    }
  }
}

let currentHotFolder = getDefaultHotFolder();
let autoShutterEnabled = true;

export function isSupportedPhoto(filename: string): boolean {
  if (!filename) return false;
  const ext = path.extname(filename).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
}

/**
 * Checks if gphoto2 CLI is available on the machine
 */
export function checkGphoto2Installed(): Promise<boolean> {
  return new Promise((resolve) => {
    exec('which gphoto2 || where gphoto2', (err, stdout) => {
      resolve(!err && !!(stdout || '').trim());
    });
  });
}

/**
 * Detects connected camera via gphoto2 USB PTP
 */
export function detectGphoto2Camera(): Promise<string | null> {
  return new Promise((resolve) => {
    exec('gphoto2 --auto-detect', (err, stdout) => {
      if (err || !stdout) return resolve(null);
      const lines = stdout.trim().split('\n');
      if (lines.length > 2) {
        const devLine = lines.slice(2).find((l) => l.trim() && !l.includes('---'));
        if (devLine) return resolve(devLine.trim());
      }
      resolve(null);
    });
  });
}

/**
 * Checks if Canon/Sony tethering process is currently running via pgrep / tasklist
 * Avoids macOS System Events permissions issues (-54)
 */
export function checkCameraAppRunning(): Promise<{ isRunning: boolean; appName?: string; appProcess?: string }> {
  return new Promise((resolve) => {
    if (process.platform === 'darwin') {
      exec('pgrep -il -f "EOS Utility|Imaging Edge|Remote|Camera Control|X Acquire"', (err, stdout) => {
        if (err || !stdout) return resolve({ isRunning: false });

        const lines = stdout.split('\n');
        for (const line of lines) {
          const l = line.toLowerCase();
          if (l.includes('mediaremote') || l.includes('remoted') || l.includes('helper') || l.includes('antigravity')) {
            continue;
          }
          if (l.includes('eos utility') || l.includes('eos3') || l.includes('eosutility')) {
            return resolve({ isRunning: true, appName: 'Canon EOS Utility', appProcess: 'EOS Utility' });
          }
          if (l.includes('imaging edge') || l.includes('/remote.app') || (l.includes('remote') && l.includes('sony'))) {
            return resolve({ isRunning: true, appName: 'Sony Imaging Edge Remote', appProcess: 'Remote' });
          }
          if (l.includes('camera control pro')) {
            return resolve({ isRunning: true, appName: 'Nikon Camera Control Pro', appProcess: 'Camera Control Pro' });
          }
          if (l.includes('x acquire')) {
            return resolve({ isRunning: true, appName: 'Fujifilm X Acquire', appProcess: 'X Acquire' });
          }
        }
        resolve({ isRunning: false });
      });
    } else if (process.platform === 'win32') {
      exec('tasklist', (err, stdout) => {
        if (err) return resolve({ isRunning: false });
        const list = stdout.toLowerCase();
        if (list.includes('remote.exe')) resolve({ isRunning: true, appName: 'Sony Imaging Edge Remote', appProcess: 'Remote' });
        else if (list.includes('eos utility') || list.includes('eos3.exe')) resolve({ isRunning: true, appName: 'Canon EOS Utility', appProcess: 'EOS Utility' });
        else if (list.includes('cameracontrol.exe')) resolve({ isRunning: true, appName: 'Nikon Camera Control Pro', appProcess: 'CameraControl' });
        else if (list.includes('xacquire.exe')) resolve({ isRunning: true, appName: 'Fujifilm X Acquire', appProcess: 'XAcquire' });
        else resolve({ isRunning: false });
      });
    } else {
      resolve({ isRunning: false });
    }
  });
}

/**
 * Triggers Shutter on macOS (AppleScript) or Windows (PowerShell) or via gphoto2
 */
export async function executeShutterTrigger(): Promise<{ success: boolean; appName?: string; warning?: string; error?: string }> {
  // 1. Check if gphoto2 is installed and has a camera connected
  const hasGphoto = await checkGphoto2Installed();
  if (hasGphoto) {
    const cam = await detectGphoto2Camera();
    if (cam) {
      return new Promise((resolve) => {
        exec('gphoto2 --trigger-capture', (err, _stdout, stderr) => {
          if (err) {
            console.warn('[gphoto2 trigger error]:', err.message, stderr);
            resolve({ success: false, error: `gphoto2: ${stderr || err.message}` });
          } else {
            resolve({ success: true, appName: `USB Camera [gphoto2: ${cam}]` });
          }
        });
      });
    }
  }

  // 2. Check if Canon / Sony software is currently running
  const cameraApp = await checkCameraAppRunning();

  if (!cameraApp.isRunning) {
    return {
      success: false,
      warning:
        'Chưa tìm thấy phần mềm Canon EOS Utility hoặc Sony Remote đang chạy trên máy tính. Bạn hãy mở Canon/Sony lên (hoặc cắm máy ảnh trực tiếp vào máy tính và cài gphoto2)!',
    };
  }

  // 3. Send spacebar trigger to the detected app
  return new Promise((resolve) => {
    if (process.platform === 'darwin') {
      const procName = cameraApp.appProcess || 'Remote';
      const script = `
        tell application "${procName}" to activate
        delay 0.1
        tell application "System Events"
          key code 49 -- Spacebar trigger shutter
        end tell
        return "OK"
      `;
      exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err, _stdout, stderr) => {
        if (err) {
          console.warn('[Hot Folder Shutter] osascript error:', err.message, stderr);
          if (err.message.includes('-54') || err.message.includes('-1743') || err.message.includes('Quyền') || err.message.includes('Not authorized')) {
            resolve({
              success: false,
              warning:
                'macOS yêu cầu cấp quyền Trợ Năng (Accessibility) cho Terminal / Node để gửi phím bấm Space. Vào Cài đặt hệ thống > Quyền riêng tư & bảo mật > Trợ năng > Bật quyền!',
            });
            return;
          }
          resolve({ success: false, error: err.message });
          return;
        }
        resolve({ success: true, appName: cameraApp.appName });
      });
    } else if (process.platform === 'win32') {
      const ps = `
        Add-Type -AssemblyName System.Windows.Forms
        $p = Get-Process | Where-Object { $_.Name -match "^(Remote|EOS Utility|EOS3|EOSUtility|CameraControl|XAcquire)" } | Select-Object -First 1
        if ($p) {
          [Microsoft.VisualBasic.Interaction]::AppActivate($p.Id)
          Start-Sleep -Milliseconds 100
          [System.Windows.Forms.SendKeys]::SendWait(" ")
          Write-Output ("OK:" + $p.Name)
        } else {
          Write-Output "NOT_RUNNING"
        }
      `;
      exec(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, (err, _stdout) => {
        if (err) return resolve({ success: false, error: err.message });
        resolve({ success: true, appName: cameraApp.appName });
      });
    } else {
      resolve({ success: false, error: 'Chưa hỗ trợ hệ điều hành này.' });
    }
  });
}

/**
 * Native folder picker on host computer
 */
export function openHostFolderPicker(): Promise<string | null> {
  return new Promise((resolve) => {
    if (process.platform === 'darwin') {
      const script = `
        tell application "Finder"
          activate
          set chosenFolder to choose folder with prompt "Chọn thư mục nhận ảnh từ Canon EOS Utility / Sony Remote:"
          return POSIX path of chosenFolder
        end tell
      `;
      exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err, stdout) => {
        if (err) return resolve(null);
        const p = (stdout || '').trim();
        resolve(p || null);
      });
    } else if (process.platform === 'win32') {
      const ps = `
        Add-Type -AssemblyName System.Windows.Forms
        $f = New-Object System.Windows.Forms.FolderBrowserDialog
        $f.Description = "Chọn thư mục nhận ảnh Canon/Sony Hot Folder"
        if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
          Write-Output $f.SelectedPath
        }
      `;
      exec(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, (err, stdout) => {
        if (err) return resolve(null);
        const p = (stdout || '').trim();
        resolve(p || null);
      });
    } else {
      resolve(null);
    }
  });
}

/**
 * Waits for a newly created or modified photo in the Hot Folder,
 * or captures directly via gphoto2 if supported
 */
export async function waitForNewPhotoInFolder(
  folderPath: string,
  timeoutMs = 15000,
  triggerShutter = true
): Promise<{ success: boolean; dataUrl?: string; fileName?: string; filePath?: string; error?: string; warning?: string }> {
  const targetDir = folderPath || currentHotFolder;

  if (!targetDir || !fs.existsSync(targetDir)) {
    return { success: false, error: `Thư mục Hot Folder không tồn tại: ${targetDir}` };
  }

  // 1. Direct gphoto2 capture if available
  const hasGphoto = await checkGphoto2Installed();
  if (hasGphoto) {
    const cam = await detectGphoto2Camera();
    if (cam) {
      const timestamp = Date.now();
      const fileName = `shot_${timestamp}.jpg`;
      const filePath = path.join(targetDir, fileName);

      return new Promise((resolve) => {
        console.log(`[gphoto2] Direct USB PTP Shooting: ${cam} -> ${filePath}`);
        exec(`gphoto2 --capture-image-and-download --filename "${filePath}" --force-overwrite`, async (err, _stdout, _stderr) => {
          if (err) {
            console.warn('[gphoto2 capture failed, fallback to folder poll]:', err.message);
          } else if (fs.existsSync(filePath)) {
            try {
              const buffer = await fs.promises.readFile(filePath);
              const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
              return resolve({
                success: true,
                filePath,
                fileName,
                dataUrl,
              });
            } catch (e) {}
          }
          // Fallback to standard folder poll below
        });
      });
    }
  }

  // 2. Standard Hot Folder Polling (Canon EOS Utility / Sony Remote)
  const startTime = Date.now();
  let existingFiles = new Set<string>();
  try {
    const list = await fs.promises.readdir(targetDir);
    existingFiles = new Set(list);
  } catch (e) {}

  let shutterWarning: string | undefined = undefined;
  if (triggerShutter) {
    const shutterRes = await executeShutterTrigger();
    if (shutterRes.warning) {
      shutterWarning = shutterRes.warning;
    }
  }

  return new Promise((resolve) => {
    let resolved = false;
    let timer: NodeJS.Timeout | null = null;
    let interval: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (interval) clearInterval(interval);
    };

    timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve({
          success: false,
          error: shutterWarning || `Hết thời gian chờ (${Math.round(timeoutMs / 1000)}s): Chưa thấy file ảnh mới trong thư mục Hot Folder.`,
          warning: shutterWarning,
        });
      }
    }, timeoutMs);

    interval = setInterval(async () => {
      if (resolved) return;
      try {
        const currentList = await fs.promises.readdir(targetDir);
        for (const fname of currentList) {
          if (!isSupportedPhoto(fname)) continue;
          const fullPath = path.join(targetDir, fname);
          const stat = await fs.promises.stat(fullPath);

          if ((!existingFiles.has(fname) || stat.mtimeMs >= startTime - 800) && stat.size > 2000) {
            const initialSize = stat.size;
            await new Promise((r) => setTimeout(r, 250));
            const stat2 = await fs.promises.stat(fullPath);

            if (stat2.size === initialSize) {
              resolved = true;
              cleanup();

              const buffer = await fs.promises.readFile(fullPath);
              const ext = path.extname(fullPath).toLowerCase();
              const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
              const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;

              resolve({
                success: true,
                filePath: fullPath,
                fileName: fname,
                dataUrl,
                warning: shutterWarning,
              });
              return;
            }
          }
        }
      } catch (err) {}
    }, 200);
  });
}

/**
 * Gets the most recent photo from the Hot Folder
 */
export async function getLatestPhotoInFolder(folderPath: string): Promise<{ success: boolean; dataUrl?: string; fileName?: string; filePath?: string; error?: string }> {
  const targetDir = folderPath || currentHotFolder;
  if (!targetDir || !fs.existsSync(targetDir)) {
    return { success: false, error: 'Thư mục không tồn tại' };
  }

  try {
    const list = await fs.promises.readdir(targetDir);
    let latestFile: string | null = null;
    let latestTime = 0;

    for (const fname of list) {
      if (!isSupportedPhoto(fname)) continue;
      const fullPath = path.join(targetDir, fname);
      const stat = await fs.promises.stat(fullPath);
      if (stat.mtimeMs > latestTime && stat.size > 2000) {
        latestTime = stat.mtimeMs;
        latestFile = fullPath;
      }
    }

    if (!latestFile) {
      return { success: false, error: 'Chưa có ảnh nào trong thư mục' };
    }

    const buffer = await fs.promises.readFile(latestFile);
    const ext = path.extname(latestFile).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;

    return {
      success: true,
      filePath: latestFile,
      fileName: path.basename(latestFile),
      dataUrl,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * HTTP Middleware dispatcher for /api/hot-folder/*
 */
export async function handleHotFolderApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
): Promise<void> {
  if (!req.url?.startsWith('/api/hot-folder/')) {
    return next();
  }

  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const host = req.headers.host || '127.0.0.1:5173';
  const url = new URL(req.url, `http://${host}`);
  const pathname = url.pathname;

  // 1. GET /api/hot-folder/status
  if (pathname === '/api/hot-folder/status' && req.method === 'GET') {
    const cameraApp = await checkCameraAppRunning();
    const gphotoInstalled = await checkGphoto2Installed();
    const gphotoCamera = gphotoInstalled ? await detectGphoto2Camera() : null;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        isServerBridge: true,
        serverPlatform: process.platform,
        folderPath: currentHotFolder,
        autoShutterEnabled,
        cameraAppRunning: cameraApp.isRunning,
        cameraAppName: cameraApp.appName || null,
        gphotoInstalled,
        gphotoCamera,
        defaultFolder: getDefaultHotFolder(),
      })
    );
    return;
  }

  // 2. POST /api/hot-folder/config
  if (pathname === '/api/hot-folder/config' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (payload.folderPath) {
          currentHotFolder = String(payload.folderPath).trim();
          if (!fs.existsSync(currentHotFolder)) {
            try { fs.mkdirSync(currentHotFolder, { recursive: true }); } catch (e) {}
          }
        }
        if (payload.autoShutter !== undefined) {
          autoShutterEnabled = Boolean(payload.autoShutter);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, folderPath: currentHotFolder, autoShutterEnabled }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 3. POST /api/hot-folder/select-folder
  if (pathname === '/api/hot-folder/select-folder' && req.method === 'POST') {
    const pickedFolder = await openHostFolderPicker();
    if (pickedFolder) {
      currentHotFolder = pickedFolder;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: !!pickedFolder, folderPath: currentHotFolder }));
    return;
  }

  // 4. POST /api/hot-folder/trigger-shutter
  if (pathname === '/api/hot-folder/trigger-shutter' && req.method === 'POST') {
    const result = await executeShutterTrigger();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // 5. POST /api/hot-folder/wait-photo
  if (pathname === '/api/hot-folder/wait-photo' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const folder = payload.folderPath || currentHotFolder;
        const timeoutMs = Number(payload.timeoutMs) || 15000;
        const triggerShutter = payload.triggerShutter !== undefined ? Boolean(payload.triggerShutter) : autoShutterEnabled;

        const result = await waitForNewPhotoInFolder(folder, timeoutMs, triggerShutter);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 6. GET /api/hot-folder/latest
  if (pathname === '/api/hot-folder/latest' && req.method === 'GET') {
    const folder = url.searchParams.get('folder') || currentHotFolder;
    const result = await getLatestPhotoInFolder(folder);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  next();
}
