const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  silentPrint: (options) => ipcRenderer.invoke('silent-print', options),
  toggleKiosk: (enable) => ipcRenderer.invoke('toggle-kiosk', enable),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
