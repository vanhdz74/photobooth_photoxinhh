/**
 * Hot Folder & Canon / Sony Remote Integration Service
 * 
 * Enables PhotoXinhh to control Canon & Sony cameras via:
 * 1. Canon EOS Utility / Sony Imaging Edge Remote / Nikon / Fuji
 * 2. Works natively in Electron (Chokidar / AppleScript / PowerShell / Native Picker)
 * 3. Works seamlessly on iPad / Mobile / LAN Browsers via Local Server Bridge API (/api/hot-folder/*)
 * 4. Fallback for Chromium File System Access API
 */

export interface HotFolderStatus {
  folderPath: string;
  isElectron: boolean;
  isServerBridge: boolean;
  serverPlatform?: string;
  isWatching: boolean;
  autoShutterEnabled: boolean;
  cameraAppRunning?: boolean;
  cameraAppName?: string | null;
  liveviewDeviceId: string;
  latestPhotoUrl: string | null;
  latestPhotoName: string | null;
  lastMessage: string | null;
  isError: boolean;
}

export type HotFolderStatusListener = (status: HotFolderStatus) => void;
export type HotFolderPhotoListener = (photoDataUrl: string, fileName: string) => void;

export class HotFolderService {
  private folderPath: string = '';
  private autoShutterEnabled: boolean = true;
  private liveviewDeviceId: string = '';
  private isWatching: boolean = false;
  private isServerBridge: boolean = false;
  private serverPlatform: string = '';
  private cameraAppRunning: boolean = false;
  private cameraAppName: string | null = null;
  private latestPhotoUrl: string | null = null;
  private latestPhotoName: string | null = null;
  private lastMessage: string | null = null;
  private isError: boolean = false;

  private statusListeners: HotFolderStatusListener[] = [];
  private photoListeners: HotFolderPhotoListener[] = [];
  private unsubscribeElectronPhoto: (() => void) | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  // Browser-based File System Access handle (Chromium)
  private webDirHandle: any = null;

  constructor() {
    if (typeof localStorage !== 'undefined') {
      this.folderPath = localStorage.getItem('px_hot_folder_path') || '';
      const autoSaved = localStorage.getItem('px_hot_folder_auto_shutter');
      this.autoShutterEnabled = autoSaved !== null ? autoSaved === 'true' : true;
      this.liveviewDeviceId = localStorage.getItem('px_hot_folder_liveview_device') || '';
    }

    // 1. Electron Environment
    if (this.isElectronEnvironment() && window.electronAPI) {
      this.unsubscribeElectronPhoto = window.electronAPI.onHotFolderPhoto((data) => {
        this.latestPhotoUrl = data.dataUrl;
        this.latestPhotoName = data.fileName;
        this.lastMessage = `✅ Đã nhận ảnh mới: ${data.fileName}`;
        this.isError = false;
        this.notifyStatus();
        this.notifyPhoto(data.dataUrl, data.fileName);
      });

      if (this.folderPath) {
        this.startWatching(this.folderPath).catch(() => {});
      }
    } else {
      // 2. Web / iPad / LAN Browser Environment -> Connect to local Server Bridge
      this.checkServerBridge().catch(() => {});
      // Periodic status sync every 6 seconds when active
      if (typeof window !== 'undefined') {
        this.checkInterval = setInterval(() => {
          this.checkServerBridge().catch(() => {});
        }, 6000);
      }
    }
  }

  destroy() {
    if (this.unsubscribeElectronPhoto) {
      this.unsubscribeElectronPhoto();
      this.unsubscribeElectronPhoto = null;
    }
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  isElectronEnvironment(): boolean {
    return typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
  }

  /**
   * Checks if the Vite Dev Server / Node Server provides /api/hot-folder endpoints
   */
  async checkServerBridge(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return false;

    try {
      const res = await fetch('/api/hot-folder/status', {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return false;

      const data = await res.json();
      if (data && data.isServerBridge) {
        this.isServerBridge = true;
        this.serverPlatform = data.serverPlatform || '';
        this.cameraAppRunning = !!data.cameraAppRunning;
        this.cameraAppName = data.cameraAppName || null;

        if (!this.folderPath && data.folderPath) {
          this.folderPath = data.folderPath;
        }

        this.isWatching = true;
        if (!this.lastMessage) {
          const osName = this.serverPlatform === 'darwin' ? 'Mac' : 'Windows';
          this.lastMessage = `Đã kết nối máy tính chủ (${osName})${this.cameraAppName ? ` & ${this.cameraAppName}` : ''}`;
        }
        this.notifyStatus();
        return true;
      }
    } catch {
      // Server bridge not available (e.g. static host)
    }
    return false;
  }

  getStatus(): HotFolderStatus {
    return {
      folderPath: this.folderPath,
      isElectron: this.isElectronEnvironment(),
      isServerBridge: this.isServerBridge,
      serverPlatform: this.serverPlatform,
      isWatching: this.isWatching,
      autoShutterEnabled: this.autoShutterEnabled,
      cameraAppRunning: this.cameraAppRunning,
      cameraAppName: this.cameraAppName,
      liveviewDeviceId: this.liveviewDeviceId,
      latestPhotoUrl: this.latestPhotoUrl,
      latestPhotoName: this.latestPhotoName,
      lastMessage: this.lastMessage,
      isError: this.isError,
    };
  }

  onStatusChange(listener: HotFolderStatusListener): () => void {
    this.statusListeners.push(listener);
    listener(this.getStatus());
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  onPhotoReceived(listener: HotFolderPhotoListener): () => void {
    this.photoListeners.push(listener);
    return () => {
      this.photoListeners = this.photoListeners.filter((l) => l !== listener);
    };
  }

  private notifyStatus() {
    const status = this.getStatus();
    this.statusListeners.forEach((l) => l(status));
  }

  private notifyPhoto(dataUrl: string, fileName: string) {
    this.photoListeners.forEach((l) => l(dataUrl, fileName));
  }

  setFolderPath(path: string) {
    this.folderPath = path.trim();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('px_hot_folder_path', this.folderPath);
    }
    this.notifyStatus();
    if (this.folderPath) {
      this.startWatching(this.folderPath);
    }
  }

  getFolderPath(): string {
    return this.folderPath;
  }

  setAutoShutter(enabled: boolean) {
    this.autoShutterEnabled = enabled;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('px_hot_folder_auto_shutter', enabled ? 'true' : 'false');
    }
    this.notifyStatus();
    if (this.isServerBridge) {
      fetch('/api/hot-folder/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoShutter: enabled }),
      }).catch(() => {});
    }
  }

  isAutoShutterEnabled(): boolean {
    return this.autoShutterEnabled;
  }

  setLiveviewDeviceId(deviceId: string) {
    this.liveviewDeviceId = deviceId;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('px_hot_folder_liveview_device', deviceId);
    }
    this.notifyStatus();
  }

  getLiveviewDeviceId(): string {
    return this.liveviewDeviceId;
  }

  /**
   * Prompts user to pick a folder for Hot Folder
   */
  async selectFolder(): Promise<string | null> {
    // 1. Electron Native Folder Picker Dialog
    if (this.isElectronEnvironment() && window.electronAPI) {
      try {
        const folder = await window.electronAPI.selectHotFolder();
        if (folder) {
          this.setFolderPath(folder);
          this.lastMessage = `Đã chọn thư mục: ${folder}`;
          this.isError = false;
          this.notifyStatus();
          await this.startWatching(folder);
          return folder;
        }
        return null;
      } catch (err: any) {
        this.lastMessage = `Lỗi chọn thư mục: ${err.message}`;
        this.isError = true;
        this.notifyStatus();
        return null;
      }
    }

    // 2. Server Bridge (Web on iPad / mobile / local browser)
    if (this.isServerBridge) {
      try {
        const res = await fetch('/api/hot-folder/select-folder', { method: 'POST' });
        const data = await res.json();
        if (data.success && data.folderPath) {
          this.setFolderPath(data.folderPath);
          this.lastMessage = `Đã chọn thư mục trên máy tính: ${data.folderPath}`;
          this.isError = false;
          this.notifyStatus();
          return data.folderPath;
        } else if (data.folderPath) {
          this.setFolderPath(data.folderPath);
          return data.folderPath;
        }
      } catch (err: any) {
        console.warn('Server bridge select folder failed:', err);
      }
    }

    // 3. Web File System Access API (Chromium showDirectoryPicker)
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        // @ts-ignore
        const handle = await window.showDirectoryPicker({
          mode: 'read',
        });
        this.webDirHandle = handle;
        this.setFolderPath(handle.name);
        this.isWatching = true;
        this.lastMessage = `Đã chọn thư mục trình duyệt: ${handle.name}`;
        this.isError = false;
        this.notifyStatus();
        return handle.name;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          this.lastMessage = `Lỗi cấp quyền thư mục: ${err.message}`;
          this.isError = true;
          this.notifyStatus();
        }
        return null;
      }
    }

    this.lastMessage = 'Để sử dụng Hot Folder tốt nhất, hãy kết nối qua máy chủ dev hoặc chạy ứng dụng Desktop!';
    this.notifyStatus();
    return null;
  }

  /**
   * Starts watching Hot Folder for new image additions
   */
  async startWatching(folderPath?: string): Promise<boolean> {
    const target = folderPath || this.folderPath;
    if (!target) return false;

    if (this.isElectronEnvironment() && window.electronAPI) {
      try {
        const res = await window.electronAPI.startHotFolderWatch(target);
        if (res.success) {
          this.isWatching = true;
          this.lastMessage = `Đang theo dõi thư mục: ${target}`;
          this.isError = false;
          this.notifyStatus();
          return true;
        } else {
          this.isWatching = false;
          this.lastMessage = res.error || 'Không thể theo dõi thư mục';
          this.isError = true;
          this.notifyStatus();
          return false;
        }
      } catch (err: any) {
        this.isWatching = false;
        this.lastMessage = err.message;
        this.isError = true;
        this.notifyStatus();
        return false;
      }
    }

    if (this.isServerBridge) {
      try {
        await fetch('/api/hot-folder/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath: target, autoShutter: this.autoShutterEnabled }),
        });
        this.isWatching = true;
        this.lastMessage = `Đang theo dõi thư mục: ${target}`;
        this.isError = false;
        this.notifyStatus();
        return true;
      } catch {}
    }

    if (this.webDirHandle) {
      this.isWatching = true;
      this.notifyStatus();
      return true;
    }

    return false;
  }

  /**
   * Stops watching Hot Folder
   */
  async stopWatching() {
    this.isWatching = false;
    if (this.isElectronEnvironment() && window.electronAPI) {
      await window.electronAPI.stopHotFolderWatch();
    }
    this.notifyStatus();
  }

  /**
   * Triggers Canon EOS Utility / Sony Remote Shutter
   */
  async triggerShutter(): Promise<{ success: boolean; appName?: string; warning?: string; error?: string }> {
    // 1. Electron Mode
    if (this.isElectronEnvironment() && window.electronAPI) {
      const res = await window.electronAPI.triggerSonyShutter();
      if (res.warning) {
        this.lastMessage = res.warning;
        this.notifyStatus();
      }
      return res;
    }

    // 2. Server Bridge Mode (iPad, Phone, Web Browser)
    if (this.isServerBridge) {
      try {
        const res = await fetch('/api/hot-folder/trigger-shutter', { method: 'POST' });
        const data = await res.json();
        if (data.warning) {
          this.lastMessage = data.warning;
          this.notifyStatus();
        }
        return data;
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return {
      success: true,
      warning: 'Đang chạy độc lập trên Web. Vui lòng bấm chụp trên máy ảnh hoặc remote cầm tay!',
    };
  }

  /**
   * Main Capture routine for Photobooth:
   * 1. (Optional) Triggers Shutter
   * 2. Waits for newly arrived photo in Hot Folder
   * 3. Returns base64 DataURL
   */
  async capturePhoto(timeoutMs = 15000): Promise<string> {
    if (!this.folderPath && !this.webDirHandle && !this.isServerBridge) {
      throw new Error('Chưa chọn thư mục Hot Folder. Vui lòng chọn thư mục lưu ảnh của Canon EOS Utility hoặc Sony Imaging Edge!');
    }

    // 1. Electron Workflow
    if (this.isElectronEnvironment() && window.electronAPI) {
      this.lastMessage = '📸 Đang kích hoạt chụp và chờ ảnh từ máy ảnh Canon/Sony...';
      this.notifyStatus();

      const res = await window.electronAPI.waitForHotFolderPhoto({
        folderPath: this.folderPath,
        timeoutMs,
        triggerShutter: this.autoShutterEnabled,
      });

      if (res.success && res.dataUrl) {
        this.latestPhotoUrl = res.dataUrl;
        this.latestPhotoName = res.fileName || 'photo.jpg';
        this.lastMessage = `✅ Đã nhận ảnh gốc: ${res.fileName}`;
        this.isError = false;
        this.notifyStatus();
        this.notifyPhoto(res.dataUrl, res.fileName || 'photo.jpg');
        return res.dataUrl;
      } else {
        const errMsg = res.error || 'Hết thời gian chờ: Không nhận được file ảnh mới.';
        this.lastMessage = errMsg;
        this.isError = true;
        this.notifyStatus();
        throw new Error(errMsg);
      }
    }

    // 2. Server Bridge Workflow (iPad / LAN Mobile Client)
    if (this.isServerBridge) {
      this.lastMessage = '📸 Đang gửi lệnh chụp sang máy tính & chờ ảnh gốc...';
      this.notifyStatus();

      const res = await fetch('/api/hot-folder/wait-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: this.folderPath,
          timeoutMs,
          triggerShutter: this.autoShutterEnabled,
        }),
      });

      if (!res.ok) {
        throw new Error(`Máy chủ không phản hồi (Mã lỗi ${res.status})`);
      }

      const data = await res.json();
      if (data.success && data.dataUrl) {
        this.latestPhotoUrl = data.dataUrl;
        this.latestPhotoName = data.fileName || 'photo.jpg';
        this.lastMessage = `✅ Đã nhận ảnh gốc: ${data.fileName}`;
        this.isError = false;
        this.notifyStatus();
        this.notifyPhoto(data.dataUrl, data.fileName || 'photo.jpg');
        return data.dataUrl;
      } else {
        const errMsg = data.error || data.warning || 'Hết thời gian chờ: Không nhận được file ảnh mới.';
        this.lastMessage = errMsg;
        this.isError = true;
        this.notifyStatus();
        throw new Error(errMsg);
      }
    }

    // 3. Web Browser File System Access Workflow (Chromium showDirectoryPicker)
    if (this.webDirHandle) {
      this.lastMessage = '📸 Đang quét ảnh mới trong thư mục trình duyệt...';
      this.notifyStatus();

      const startTime = Date.now();
      const existingNames = new Set<string>();

      try {
        for await (const [name] of this.webDirHandle.entries()) {
          existingNames.add(name);
        }
      } catch {}

      return new Promise<string>((resolve, reject) => {
        let finished = false;

        const timer = setTimeout(() => {
          if (!finished) {
            finished = true;
            reject(new Error(`Hết thời gian chờ (${Math.round(timeoutMs / 1000)}s): Chưa thấy file ảnh mới trong thư mục đã chọn.`));
          }
        }, timeoutMs);

        const checkInterval = setInterval(async () => {
          if (finished) {
            clearInterval(checkInterval);
            return;
          }

          try {
            for await (const [name, handle] of this.webDirHandle.entries()) {
              const lower = name.toLowerCase();
              if ((lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png')) && !existingNames.has(name)) {
                const file = await handle.getFile();
                if (file.lastModified >= startTime - 500 && file.size > 1000) {
                  finished = true;
                  clearTimeout(timer);
                  clearInterval(checkInterval);

                  const reader = new FileReader();
                  reader.onload = () => {
                    const result = reader.result as string;
                    this.latestPhotoUrl = result;
                    this.latestPhotoName = name;
                    this.lastMessage = `✅ Đã nhận ảnh: ${name}`;
                    this.notifyStatus();
                    this.notifyPhoto(result, name);
                    resolve(result);
                  };
                  reader.onerror = () => reject(new Error('Lỗi khi đọc file ảnh từ thư mục.'));
                  reader.readAsDataURL(file);
                  return;
                }
              }
            }
          } catch {}
        }, 350);
      });
    }

    throw new Error('Chưa kết nối thư mục Hot Folder.');
  }

  /**
   * Fetches the latest photo currently in the Hot Folder
   */
  async getLatestPhoto(): Promise<string | null> {
    if (this.isElectronEnvironment() && window.electronAPI && this.folderPath) {
      try {
        const res = await window.electronAPI.getLatestHotFolderPhoto(this.folderPath);
        if (res.success && res.dataUrl) {
          this.latestPhotoUrl = res.dataUrl;
          this.latestPhotoName = res.fileName || 'latest.jpg';
          this.notifyStatus();
          return res.dataUrl;
        }
      } catch (e) {}
    } else if (this.isServerBridge) {
      try {
        const res = await fetch(`/api/hot-folder/latest?folder=${encodeURIComponent(this.folderPath)}`);
        const data = await res.json();
        if (data.success && data.dataUrl) {
          this.latestPhotoUrl = data.dataUrl;
          this.latestPhotoName = data.fileName || 'latest.jpg';
          this.notifyStatus();
          return data.dataUrl;
        }
      } catch {}
    }
    return this.latestPhotoUrl;
  }
}

export const hotFolderService = new HotFolderService();
