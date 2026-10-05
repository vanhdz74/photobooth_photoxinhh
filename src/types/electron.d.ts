export interface PrinterInfo {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  osRelease: string;
  hostname: string;
  isElectron: boolean;
  version: string;
}

export interface SilentPrintOptions {
  dataUrl: string;
  printerName?: string;
  copies?: number;
  silent?: boolean;
}

export interface ElectronAPI {
  isElectron: boolean;
  getPrinters: () => Promise<PrinterInfo[]>;
  silentPrint: (options: SilentPrintOptions) => Promise<{ success: boolean; error?: string }>;
  toggleKiosk: (enable?: boolean) => Promise<boolean>;
  getSystemInfo: () => Promise<SystemInfo>;
  openExternal: (url: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
