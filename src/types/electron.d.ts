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
  pageSize?: { width: number; height: number };
  cssPageSize?: string;
}

export interface HotFolderPhotoData {
  filePath: string;
  fileName: string;
  dataUrl: string;
  timestamp?: number;
}

export interface WaitForHotFolderOptions {
  folderPath?: string;
  timeoutMs?: number;
  triggerShutter?: boolean;
}

export interface ElectronAPI {
  isElectron: boolean;
  getPrinters: () => Promise<PrinterInfo[]>;
  silentPrint: (options: SilentPrintOptions) => Promise<{ success: boolean; error?: string }>;
  toggleKiosk: (enable?: boolean) => Promise<boolean>;
  getSystemInfo: () => Promise<SystemInfo>;
  openExternal: (url: string) => Promise<boolean>;

  // 📸 Hot Folder & Sony Imaging Edge
  selectHotFolder: () => Promise<string | null>;
  startHotFolderWatch: (folderPath: string) => Promise<{ success: boolean; error?: string; folder?: string }>;
  stopHotFolderWatch: () => Promise<boolean>;
  triggerSonyShutter: () => Promise<{ success: boolean; warning?: string; error?: string }>;
  waitForHotFolderPhoto: (options?: WaitForHotFolderOptions) => Promise<{ success: boolean; dataUrl?: string; fileName?: string; filePath?: string; error?: string }>;
  getLatestHotFolderPhoto: (folderPath?: string) => Promise<{ success: boolean; dataUrl?: string; fileName?: string; filePath?: string; error?: string }>;
  onHotFolderPhoto: (callback: (photo: HotFolderPhotoData) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
