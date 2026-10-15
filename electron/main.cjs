const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'PhotoXinhh - Photobooth Desktop & Kiosk Hub',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allows loading local media & camera streams smoothly
    },
    icon: path.join(__dirname, '../public/icon.png'),
  });

  const isDev = process.env.ELECTRON_DEV === 'true' || !app.isPackaged;

  // Handle Bluetooth Pairing & Permissions in Electron
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'bluetooth' || permission === 'bluetooth-scanning') {
      return true;
    }
    return true;
  });

  mainWindow.webContents.session.setDevicePermissionHandler((details) => {
    if (details.deviceType === 'bluetooth') {
      return true;
    }
    return true;
  });

  mainWindow.webContents.session.setBluetoothPairingHandler((details, callback) => {
    callback({ confirmed: true, pairingKind: details.pairingKind });
  });

  let selectBluetoothCallback = null;
  mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();
    selectBluetoothCallback = callback;
    const namedDevice = deviceList.find((d) => d.deviceName && d.deviceName.trim() !== '' && !d.deviceName.toLowerCase().includes('unknown'));
    if (namedDevice) {
      callback(namedDevice.deviceId);
      selectBluetoothCallback = null;
    }
  });

  if (isDev) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 🖨️ 1. IPC Handler: Get all system printers (DNP, HiTi, Canon, Brother, PDF, etc.)
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      description: p.description || '',
      status: p.status,
      isDefault: p.isDefault,
    }));
  } catch (err) {
    console.error('Error fetching printers:', err);
    return [];
  }
});

// 🖨️ 2. IPC Handler: Silent Print to thermal printer or selected device
ipcMain.handle('silent-print', async (event, options) => {
  const {
    dataUrl,
    printerName,
    copies = 1,
    silent = true,
    pageSize = { width: 100000, height: 148000 }, // Default Canon SELPHY Postcard 100x148mm in microns
    cssPageSize = '100mm 148mm',
  } = options || {};

  return new Promise((resolve) => {
    // Create a hidden worker window for printing
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            @page {
              size: ${cssPageSize};
              margin: 0;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body, html {
              width: 100vw;
              height: 100vh;
              overflow: hidden;
              display: flex;
              justify-content: center;
              align-items: center;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            img {
              width: 100%;
              height: 100%;
              object-fit: contain;
              display: block;
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" id="print-image" />
        </body>
      </html>
    `;

    printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    printWindow.webContents.on('did-finish-load', () => {
      // Execute silent print
      printWindow.webContents.print(
        {
          silent: silent,
          printBackground: true,
          deviceName: printerName || undefined,
          copies: copies,
          margins: { marginType: 'none' },
          pageSize: pageSize,
        },
        (success, failureReason) => {
          printWindow.close();
          if (success) {
            resolve({ success: true });
          } else {
            console.error('Print failed:', failureReason);
            resolve({ success: false, error: failureReason });
          }
        }
      );
    });
  });
});

// 🖥️ 3. IPC Handler: Toggle Kiosk Mode
ipcMain.handle('toggle-kiosk', async (event, enable) => {
  if (!mainWindow) return false;
  const isKiosk = enable !== undefined ? enable : !mainWindow.isKiosk();
  mainWindow.setKiosk(isKiosk);
  return isKiosk;
});

// 💻 4. IPC Handler: Get System Info
ipcMain.handle('get-system-info', async () => {
  return {
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    hostname: os.hostname(),
    isElectron: true,
    version: app.getVersion(),
  };
});

// 🌐 5. IPC Handler: Open External
ipcMain.handle('open-external', async (event, url) => {
  shell.openExternal(url);
  return true;
});

// 📸 6. IPC Handlers: Sony Imaging Edge Hot Folder & Remote Shutter Control
let hotFolderWatcher = null;
let currentWatchedFolder = null;

function isSupportedPhoto(filename) {
  if (!filename) return false;
  const ext = path.extname(filename).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
}

// 6.1 Select Hot Folder Dialog
ipcMain.handle('hot-folder-select', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Chọn Thư Mục Lưu Ảnh của Sony Imaging Edge (Hot Folder)',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

// 6.2 Trigger Canon EOS Utility / Sony Remote Shutter via AppleScript / OS automation
ipcMain.handle('hot-folder-trigger-shutter', async () => {
  if (process.platform === 'darwin') {
    // macOS: Send Spacebar trigger to Canon EOS Utility, Sony Imaging Edge Remote, Nikon, Fuji
    const script = `
      tell application "System Events"
        set cameraProcs to (every process whose name is "Remote" or name contains "Imaging Edge" or name is "Sony Remote" or name contains "EOS Utility" or name is "EOS Utility" or name is "EOS Utility 3" or name is "EOS Utility 2" or name contains "Remote Shooting" or name contains "Camera Control Pro" or name is "X Acquire" or name contains "FUJIFILM")
        if (count of cameraProcs) > 0 then
          set targetProc to item 1 of cameraProcs
          set targetName to name of targetProc
          set frontmost of targetProc to true
          delay 0.1
          key code 49 -- Spacebar trigger shutter
          return "OK:" & targetName
        else
          return "NOT_RUNNING"
        end if
      end tell
    `;
    return new Promise((resolve) => {
      exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err, stdout) => {
        if (err) {
          console.warn('[Camera Shutter] osascript error:', err.message);
          if (err.message.includes('-1743') || err.message.includes('Not authorized') || err.message.includes('Quyền')) {
            resolve({
              success: false,
              warning: 'macOS chưa cấp quyền Tự Động Hóa (Automation) cho PhotoXinhh. Vui lòng vào Cài đặt hệ thống > Quyền riêng tư & bảo mật > Tự động hóa để bật quyền!',
            });
            return;
          }
          resolve({ success: false, error: err.message });
        } else {
          const res = (stdout || '').trim();
          if (res.startsWith('OK:')) {
            const appName = res.replace('OK:', '').trim();
            resolve({ success: true, appName });
          } else if (res === 'NOT_RUNNING') {
            resolve({
              success: false,
              warning: 'Phần mềm Canon EOS Utility hoặc Sony Remote chưa được mở trên Mac. Bạn hãy mở Canon/Sony lên hoặc bấm chụp trực tiếp trên máy ảnh!',
            });
          } else {
            resolve({ success: true });
          }
        }
      });
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
    return new Promise((resolve) => {
      exec(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, (err, stdout) => {
        if (err) resolve({ success: false, error: err.message });
        else {
          const res = (stdout || '').trim();
          if (res.startsWith('OK:')) {
            const appName = res.replace('OK:', '').trim();
            resolve({ success: true, appName });
          } else if (res === 'NOT_RUNNING') {
            resolve({ success: false, warning: 'Phần mềm Canon EOS Utility hoặc Sony Remote chưa được mở trên Windows!' });
          } else {
            resolve({ success: true });
          }
        }
      });
    });
  } else {
    return { success: false, error: 'Chức năng tự kích chụp chưa hỗ trợ trên OS này' };
  }
});

// 6.3 Start watching Hot Folder
ipcMain.handle('hot-folder-start-watch', async (event, folderPath) => {
  try {
    if (!folderPath || !fs.existsSync(folderPath)) {
      return { success: false, error: 'Thư mục không tồn tại' };
    }

    if (hotFolderWatcher) {
      if (typeof hotFolderWatcher.close === 'function') await hotFolderWatcher.close();
      hotFolderWatcher = null;
    }

    currentWatchedFolder = folderPath;

    let chokidar = null;
    try { chokidar = require('chokidar'); } catch (e) {}

    if (chokidar) {
      hotFolderWatcher = chokidar.watch(folderPath, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true,
        depth: 1,
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100,
        },
      });

      hotFolderWatcher.on('add', async (filePath) => {
        if (!isSupportedPhoto(filePath)) return;
        try {
          const buffer = await fs.promises.readFile(filePath);
          const ext = path.extname(filePath).toLowerCase();
          const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
          const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('hot-folder-new-photo', {
              filePath,
              fileName: path.basename(filePath),
              dataUrl,
              timestamp: Date.now(),
            });
          }
        } catch (readErr) {
          console.error('[Hot Folder Watcher] Read error:', readErr);
        }
      });
    } else {
      hotFolderWatcher = fs.watch(folderPath, { recursive: false }, (eventType, filename) => {
        if (filename && isSupportedPhoto(filename)) {
          setTimeout(async () => {
            try {
              const fullPath = path.join(folderPath, filename);
              if (fs.existsSync(fullPath)) {
                const buffer = await fs.promises.readFile(fullPath);
                const ext = path.extname(fullPath).toLowerCase();
                const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
                const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('hot-folder-new-photo', {
                    filePath: fullPath,
                    fileName: filename,
                    dataUrl,
                    timestamp: Date.now(),
                  });
                }
              }
            } catch (e) {}
          }, 800);
        }
      });
    }

    return { success: true, folder: folderPath };
  } catch (err) {
    console.error('[Hot Folder] start-watch error:', err);
    return { success: false, error: err.message };
  }
});

// 6.4 Stop watching Hot Folder
ipcMain.handle('hot-folder-stop-watch', async () => {
  if (hotFolderWatcher) {
    if (typeof hotFolderWatcher.close === 'function') await hotFolderWatcher.close();
    hotFolderWatcher = null;
  }
  currentWatchedFolder = null;
  return true;
});

// 6.5 Wait for next photo in Hot Folder (with optional auto-trigger)
ipcMain.handle('hot-folder-wait-photo', async (event, options = {}) => {
  const { folderPath, timeoutMs = 15000, triggerShutter = true } = options;
  const targetDir = folderPath || currentWatchedFolder;

  if (!targetDir || !fs.existsSync(targetDir)) {
    return { success: false, error: 'Thư mục Hot Folder không tồn tại hoặc chưa được chọn.' };
  }

  const startTime = Date.now();
  let existingFiles = new Set();
  try {
    const list = await fs.promises.readdir(targetDir);
    existingFiles = new Set(list);
  } catch (e) {}

  // Trigger shutter if requested
  if (triggerShutter) {
    if (process.platform === 'darwin') {
      const script = `
        tell application "System Events"
          set cameraProcs to (every process whose name is "Remote" or name contains "Imaging Edge" or name is "Sony Remote" or name contains "EOS Utility" or name is "EOS Utility" or name is "EOS Utility 3" or name is "EOS Utility 2" or name contains "Camera Control Pro" or name is "X Acquire")
          if (count of cameraProcs) > 0 then
            set targetProc to item 1 of cameraProcs
            set frontmost of targetProc to true
            delay 0.05
            key code 49
          end if
        end tell
      `;
      exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, () => {});
    } else if (process.platform === 'win32') {
      const ps = `
        Add-Type -AssemblyName System.Windows.Forms
        $p = Get-Process | Where-Object { $_.Name -match "^(Remote|EOS Utility|EOS3|CameraControl|XAcquire)" } | Select-Object -First 1
        if ($p) {
          [Microsoft.VisualBasic.Interaction]::AppActivate($p.Id)
          Start-Sleep -Milliseconds 60
          [System.Windows.Forms.SendKeys]::SendWait(" ")
        }
      `;
      exec(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, () => {});
    }
  }

  // Poll for newly arrived / stabilized file
  return new Promise((resolve) => {
    let resolved = false;
    let timer = null;
    let interval = null;

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
          error: `Hết thời gian chờ (${Math.round(timeoutMs / 1000)}s): Chưa thấy file ảnh mới từ Imaging Edge.`,
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

          // If file was created/modified around or after startTime
          if ((!existingFiles.has(fname) || stat.mtimeMs >= startTime - 500) && stat.size > 1000) {
            const initialSize = stat.size;
            await new Promise((r) => setTimeout(r, 200));
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
              });
              return;
            }
          }
        }
      } catch (err) {}
    }, 250);
  });
});

// 6.6 Get Latest Photo
ipcMain.handle('hot-folder-get-latest-photo', async (event, folderPath) => {
  const targetDir = folderPath || currentWatchedFolder;
  if (!targetDir || !fs.existsSync(targetDir)) {
    return { success: false, error: 'Thư mục không tồn tại' };
  }
  try {
    const list = await fs.promises.readdir(targetDir);
    let latestFile = null;
    let latestTime = 0;

    for (const fname of list) {
      if (!isSupportedPhoto(fname)) continue;
      const fullPath = path.join(targetDir, fname);
      const stat = await fs.promises.stat(fullPath);
      if (stat.mtimeMs > latestTime) {
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
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// App Lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
