const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  silentPrint: (options) => ipcRenderer.invoke('silent-print', options),
  toggleKiosk: (enable) => ipcRenderer.invoke('toggle-kiosk', enable),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // 📸 Hot Folder & Sony Imaging Edge Remote
  selectHotFolder: () => ipcRenderer.invoke('hot-folder-select'),
  startHotFolderWatch: (folderPath) => ipcRenderer.invoke('hot-folder-start-watch', folderPath),
  stopHotFolderWatch: () => ipcRenderer.invoke('hot-folder-stop-watch'),
  triggerSonyShutter: () => ipcRenderer.invoke('hot-folder-trigger-shutter'),
  waitForHotFolderPhoto: (options) => ipcRenderer.invoke('hot-folder-wait-photo', options),
  getLatestHotFolderPhoto: (folderPath) => ipcRenderer.invoke('hot-folder-get-latest-photo', folderPath),
  onHotFolderPhoto: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('hot-folder-new-photo', handler);
    return () => ipcRenderer.removeListener('hot-folder-new-photo', handler);
  },
});
