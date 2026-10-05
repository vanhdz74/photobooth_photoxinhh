const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');

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
  const { dataUrl, printerName, copies = 1, silent = true } = options;

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
              size: 4in 6in;
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
          pageSize: { width: 101600, height: 152400 }, // 4x6 inches in microns
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
