/**
 * Hot Folder & Sony Imaging Edge Remote Integration Service
 * 
 * Enables PhotoXinhh to control Sony cameras via:
 * 1. Sony Imaging Edge Desktop Remote (Hot Folder Auto-Import + Shutter Trigger)
 * 2. Works seamlessly in Electron (Native Chokidar / AppleScript / File Dialog)
 * 3. Works seamlessly in Web Browsers (Chrome File System Access API)
 */

export interface HotFolderStatus {
  folderPath: string;
  isElectron: boolean;
  isWatching: boolean;
  autoShutterEnabled: boolean;
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
  private latestPhotoUrl: string | null = null;
  private latestPhotoName: string | null = null;
  private lastMessage: string | null = null;
  private isError: boolean = false;

  private statusListeners: HotFolderStatusListener[] = [];
  private photoListeners: HotFolderPhotoListener[] = [];
  private unsubscribeElectronPhoto: (() => void) | null = null;

  // Browser-based File System Access handle (Chromium)
  private webDirHandle: any = null;

  constructor() {
    if (typeof localStorage !== 'undefined') {
      this.folderPath = localStorage.getItem('px_hot_folder_path') || '';
      const autoSaved = localStorage.getItem('px_hot_folder_auto_shutter');
      this.autoShutterEnabled = autoSaved !== null ? autoSaved === 'true' : true;
      this.liveviewDeviceId = localStorage.getItem('px_hot_folder_liveview_device') || '';
    }

    // Auto-listen to Electron photo events if in Electron
    if (typeof window !== 'undefined' && window.electronAPI) {
      this.unsubscribeElectronPhoto = window.electronAPI.onHotFolderPhoto((data) => {
        this.latestPhotoUrl = data.dataUrl;
        this.latestPhotoName = data.fileName;
        this.lastMessage = `Đã nhận ảnh mới: ${data.fileName}`;
        this.isError = false;
        this.notifyStatus();
        this.notifyPhoto(data.dataUrl, data.fileName);
      });

      // Auto start watching saved folder if present
      if (this.folderPath) {
        this.startWatching(this.folderPath).catch(() => {});
      }
    }
  }

  destroy() {
    if (this.unsubscribeElectronPhoto) {
      this.unsubscribeElectronPhoto();
      this.unsubscribeElectronPhoto = null;
    }
  }

  isElectronEnvironment(): boolean {
    return typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
  }

  getStatus(): HotFolderStatus {
    return {
      folderPath: this.folderPath,
      isElectron: this.isElectronEnvironment(),
      isWatching: this.isWatching,
      autoShutterEnabled: this.autoShutterEnabled,
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

    // 2. Web File System Access API (Chrome, Edge, Opera)
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

    this.lastMessage = 'Trình duyệt hiện tại không hỗ trợ chọn thư mục trực tiếp. Hãy dùng ứng dụng Desktop PhotoXinhh (Electron) hoặc Chrome!';
    this.isError = true;
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
   * Triggers Sony Imaging Edge Remote Shutter
   */
  async triggerShutter(): Promise<{ success: boolean; warning?: string; error?: string }> {
    if (this.isElectronEnvironment() && window.electronAPI) {
      const res = await window.electronAPI.triggerSonyShutter();
      if (res.warning) {
        this.lastMessage = res.warning;
        this.notifyStatus();
      }
      return res;
    }
    return {
      success: true,
      warning: 'Đang chạy trên web. Vui lòng bấm chụp trên máy ảnh hoặc remote cầm tay Sony!',
    };
  }

  /**
   * Main Capture routine for Photobooth:
   * 1. (Optional) Triggers Shutter
   * 2. Waits for newly arrived photo in Hot Folder
   * 3. Returns base64 DataURL
   */
  async capturePhoto(timeoutMs = 15000): Promise<string> {
    if (!this.folderPath && !this.webDirHandle) {
      throw new Error('Chưa chọn thư mục Hot Folder. Vui lòng bấm "Chọn Thư Mục" lưu ảnh của Sony Imaging Edge!');
    }

    // 1. Electron Workflow (Native and robust)
    if (this.isElectronEnvironment() && window.electronAPI) {
      this.lastMessage = '📸 Đang kích hoạt chụp và chờ ảnh từ máy ảnh Sony...';
      this.notifyStatus();

      const res = await window.electronAPI.waitForHotFolderPhoto({
        folderPath: this.folderPath,
        timeoutMs,
        triggerShutter: this.autoShutterEnabled,
      });

      if (res.success && res.dataUrl) {
        this.latestPhotoUrl = res.dataUrl;
        this.latestPhotoName = res.fileName || 'photo.jpg';
        this.lastMessage = `✅ Đã nhận ảnh: ${res.fileName}`;
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

    // 2. Web Browser File System Access Workflow (Chromium showDirectoryPicker)
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

      // Wait for new file
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
                  // File found! Read as DataURL
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
    }
    return this.latestPhotoUrl;
  }
}

export const hotFolderService = new HotFolderService();
