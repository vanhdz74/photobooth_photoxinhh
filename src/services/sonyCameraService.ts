import { Capacitor, CapacitorHttp } from '@capacitor/core';

/**
 * Sony Camera Remote API Service (Wi-Fi Direct & Local LAN)
 * Uses native iOS CapacitorHttp to bypass WKWebView CORS restrictions
 * Implements Sony JSON-RPC Web API over HTTP:
 * - Direct Remote Shutter Control (actTakePicture)
 * - LiveView Streaming & Frame Decoding
 * - Auto-Download High-Res Captured Photos to Photobooth Canvas
 */

export interface SonyCameraInfo {
  cameraIp: string;
  modelName: string;
  connected: boolean;
  liveviewActive: boolean;
  batteryLevel?: string;
}

export type SonyLiveviewListener = (frameDataUrl: string) => void;
export type SonyStatusListener = (info: SonyCameraInfo) => void;

export class SonyCameraService {
  private cameraIp: string = '192.168.122.1:8080';
  private connected: boolean = false;
  private isLiveviewActive: boolean = false;
  private liveviewAbortController: AbortController | null = null;
  private latestLiveviewFrame: string | null = null;
  private liveviewListeners: SonyLiveviewListener[] = [];
  private statusListeners: SonyStatusListener[] = [];
  private cameraModel: string = 'Sony Alpha (Wi-Fi)';

  constructor() {
    if (typeof localStorage !== 'undefined') {
      this.cameraIp = localStorage.getItem('px_sony_camera_ip') || '192.168.122.1:8080';
    }

    // Always register global native frame receiver (for both Wi-Fi & USB PTP)
    if (typeof window !== 'undefined') {
      (window as any).__onSonyLiveviewFrame = (frameDataUrl: string) => {
        this.latestLiveviewFrame = frameDataUrl;
        this.liveviewListeners.forEach((listener) => listener(frameDataUrl));
      };
    }
  }

  getCameraIp(): string {
    return this.cameraIp;
  }

  setCameraIp(ip: string) {
    let clean = ip.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (clean && !clean.includes(':')) {
      clean = `${clean}:8080`;
    }
    this.cameraIp = clean || '192.168.122.1:8080';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('px_sony_camera_ip', this.cameraIp);
    }
    this.notifyStatus();
  }

  getEndpointUrl(service = 'camera', hostOverride?: string): string {
    const cleanIp = hostOverride || this.cameraIp;
    return `http://${cleanIp}/sony/${service}`;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getLatestFrame(): string | null {
    return this.latestLiveviewFrame;
  }

  onLiveviewFrame(listener: SonyLiveviewListener): () => void {
    this.liveviewListeners.push(listener);
    if (this.latestLiveviewFrame) {
      listener(this.latestLiveviewFrame);
    }
    return () => {
      this.liveviewListeners = this.liveviewListeners.filter((l) => l !== listener);
    };
  }

  onStatusChange(listener: SonyStatusListener): () => void {
    this.statusListeners.push(listener);
    listener(this.getStatusInfo());
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private notifyStatus() {
    const info = this.getStatusInfo();
    this.statusListeners.forEach((l) => l(info));
  }

  getStatusInfo(): SonyCameraInfo {
    return {
      cameraIp: this.cameraIp,
      modelName: this.cameraModel,
      connected: this.connected,
      liveviewActive: this.isLiveviewActive,
    };
  }

  /**
   * Sends a Sony JSON-RPC 1.0 request to camera.
   * Utilizes CapacitorHttp natively on iOS to avoid CORS blocks.
   */
  async sendJsonRpc(method: string, params: unknown[] = [], version = '1.0', timeoutMs = 8000, hostOverride?: string): Promise<any> {
    const url = this.getEndpointUrl('camera', hostOverride);
    const payload = {
      method,
      params,
      id: 1,
      version,
    };

    console.log(`[Sony RPC] Sending ${method} to ${url}...`);

    // 1. Native iOS / Android via CapacitorHttp (Bypasses CORS completely)
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await CapacitorHttp.post({
          url,
          data: payload,
          headers: {
            'Content-Type': 'application/json',
          },
          connectTimeout: Math.min(timeoutMs, 4000),
          readTimeout: timeoutMs,
        });

        console.log(`[Sony RPC] ${method} response status:`, res.status);

        if (res.status >= 200 && res.status < 300) {
          const json = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
          if (json && json.error) {
            const errCode = json.error[0] || 'Unknown';
            const errMsg = json.error[1] || 'Sony Camera Error';
            // Error 12: "Shooting mode is not available" (means camera is already in rec mode)
            if (method === 'startRecMode' && errCode === 12) {
              console.log('[Sony RPC] startRecMode already active (code 12)');
              return null;
            }
            throw new Error(`[Sony Error ${errCode}] ${errMsg}`);
          }
          return json ? json.result : null;
        } else {
          throw new Error(`Sony Camera HTTP status ${res.status}`);
        }
      } catch (nativeErr: unknown) {
        console.warn(`[Sony RPC] Native CapacitorHttp ${method} failed:`, nativeErr);
        throw nativeErr;
      }
    }

    // 2. Web / Electron Fallback via fetch
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`Sony Camera HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      if (json.error) {
        const errCode = json.error[0] || 'Unknown';
        const errMsg = json.error[1] || 'Sony Camera Error';
        throw new Error(`[Sony Error ${errCode}] ${errMsg}`);
      }
      return json.result;
    } catch (err: unknown) {
      clearTimeout(timer);
      throw err;
    }
  }

  /**
   * Checks if Sony camera is reachable on current Wi-Fi network with smart port fallback
   */
  async testConnection(): Promise<{ success: boolean; model?: string; error?: string }> {
    const rawHost = this.cameraIp.split(':')[0] || '192.168.122.1';
    const candidateHosts = Array.from(new Set([
      this.cameraIp,
      '192.168.122.1:8080',
      `${rawHost}:8080`,
      `${rawHost}:10000`,
      `${rawHost}:60152`,
      rawHost,
    ]));

    let lastError = '';

    for (const host of candidateHosts) {
      try {
        console.log(`[Sony Test] Testing connection to ${host}...`);
        await this.sendJsonRpc('getAvailableApiList', [], '1.0', 1500, host);
        this.cameraIp = host;
        this.connected = true;
        this.cameraModel = 'Sony Alpha Remote Camera';
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('px_sony_camera_ip', this.cameraIp);
        }

        // Try startRecMode to ensure camera is in shooting mode
        try {
          await this.sendJsonRpc('startRecMode', [], '1.0', 1500, host);
        } catch {}

        this.notifyStatus();
        return { success: true, model: this.cameraModel };
      } catch (err: any) {
        lastError = err?.message || String(err);
        const isTimeout = String(lastError).toLowerCase().includes('time') || String(lastError).includes('-1001');
        
        // Only attempt fallback getApplicationInfo if not a raw network timeout
        if (!isTimeout) {
          try {
            const appInfo = await this.sendJsonRpc('getApplicationInfo', [], '1.0', 1500, host);
            this.cameraIp = host;
            this.connected = true;
            this.cameraModel = appInfo && appInfo[0] ? `Sony Camera (${appInfo[0]})` : 'Sony Alpha';
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('px_sony_camera_ip', this.cameraIp);
            }
            this.notifyStatus();
            return { success: true, model: this.cameraModel };
          } catch {}
        }
      }
    }

    this.connected = false;
    this.notifyStatus();
    return {
      success: false,
      error: `Không thể kết nối máy ảnh Sony (${lastError || 'Timeout'}). Vui lòng kiểm tra Wi-Fi máy ảnh và quyền Mạng cục bộ!`,
    };
  }

  /**
   * Checks if native iOS WebKit stream handler is available
   */
  private hasNativeStreamer(): boolean {
    if (typeof window === 'undefined') return false;
    if ((window as any)?.webkit?.messageHandlers?.sonyCameraNative) return true;
    if ((window as any)?.__sonyNativeAvailable) return true;
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') return true;
    return false;
  }

  /**
   * Starts Sony Liveview stream over Wi-Fi
   */
  async startLiveview(): Promise<string> {
    this.stopLiveview();

    // Ensure camera is switched to recording mode
    try {
      await this.sendJsonRpc('startRecMode', [], '1.0', 2000);
    } catch {}

    let liveviewUrl = '';
    try {
      const result = await this.sendJsonRpc('startLiveview', [], '1.0', 3000);
      liveviewUrl = Array.isArray(result) ? result[0] : result;
    } catch (err) {
      console.warn('Sony startLiveview RPC error:', err);
      this.isLiveviewActive = false;
      this.notifyStatus();
      throw err;
    }

    if (!liveviewUrl || typeof liveviewUrl !== 'string') {
      const cleanIp = this.cameraIp.split(':')[0] || '192.168.122.1';
      liveviewUrl = `http://${cleanIp}:60152/liveviewstream`;
    }

    this.isLiveviewActive = true;
    this.notifyStatus();

    if (this.hasNativeStreamer()) {
      this.connectNativeLiveviewStream(liveviewUrl);
    } else {
      this.connectLiveviewStream(liveviewUrl);
    }

    return liveviewUrl;
  }

  /**
   * Native iOS Streamer: Uses Swift URLSessionDataDelegate to stream MJPEG without CORS restrictions
   */
  private connectNativeLiveviewStream(streamUrl: string) {
    console.log('[Sony LiveView] Using iOS Native URLSession Streamer:', streamUrl);
    
    (window as any).__onSonyLiveviewFrame = (frameDataUrl: string) => {
      this.latestLiveviewFrame = frameDataUrl;
      this.liveviewListeners.forEach((listener) => listener(frameDataUrl));
    };

    (window as any).__onSonyLiveviewError = (errorMsg: string) => {
      console.warn('[Sony LiveView] Native stream error:', errorMsg);
    };

    let attempts = 0;
    const sendToNative = () => {
      if ((window as any)?.webkit?.messageHandlers?.sonyCameraNative) {
        try {
          (window as any).webkit.messageHandlers.sonyCameraNative.postMessage({
            action: 'startLiveview',
            url: streamUrl,
          });
          console.log('[Sony LiveView] Sent startLiveview command to native iOS bridge.');
        } catch (err) {
          console.error('[Sony LiveView] Native postMessage failed:', err);
        }
      } else if (attempts < 10) {
        attempts++;
        console.warn(`[Sony LiveView] Native bridge not ready (attempt ${attempts}/10), retrying in 150ms...`);
        setTimeout(sendToNative, 150);
      } else {
        console.warn('[Sony LiveView] Native bridge timed out, trying fetch fallback...');
        this.connectLiveviewStream(streamUrl);
      }
    };

    sendToNative();
  }

  /**
   * Connects to Sony Binary MJPEG stream & extracts live JPEG frames (Web / Browser fallback)
   */
  private async connectLiveviewStream(streamUrl: string) {
    this.liveviewAbortController = new AbortController();
    const signal = this.liveviewAbortController.signal;

    console.log('[Sony LiveView] Connecting to stream via fetch:', streamUrl);
    try {
      const response = await fetch(streamUrl, {
        method: 'GET',
        signal,
      });

      console.log('[Sony LiveView] Stream response status:', response.status);

      if (!response.body) {
        throw new Error('ReadableStream not supported');
      }

      const reader = response.body.getReader();
      let buffer = new Uint8Array(0);
      let framesParsed = 0;

      while (this.isLiveviewActive && !signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;

        // Append received chunk to buffer
        const newBuf = new Uint8Array(buffer.length + value.length);
        newBuf.set(buffer, 0);
        newBuf.set(value, buffer.length);
        buffer = newBuf;

        while (buffer.length >= 8 + 128) {
          if (buffer[0] === 0xFF && buffer[1] === 0x01) {
            const payloadSize = (buffer[8 + 4] << 16) | (buffer[8 + 5] << 8) | buffer[8 + 6];
            const paddingSize = buffer[8 + 7];
            const totalPacketSize = 8 + 128 + payloadSize + paddingSize;

            if (buffer.length >= totalPacketSize) {
              const jpegData = buffer.slice(8 + 128, 8 + 128 + payloadSize);
              const blob = new Blob([jpegData], { type: 'image/jpeg' });
              const frameUrl = URL.createObjectURL(blob);

              if (this.latestLiveviewFrame && this.latestLiveviewFrame.startsWith('blob:')) {
                URL.revokeObjectURL(this.latestLiveviewFrame);
              }

              this.latestLiveviewFrame = frameUrl;
              this.liveviewListeners.forEach((listener) => listener(frameUrl));
              if (framesParsed === 0) {
                console.log('[Sony LiveView] First JPEG frame received successfully!');
              }
              framesParsed++;

              buffer = buffer.slice(totalPacketSize);
              continue;
            }
          }

          let syncIdx = -1;
          for (let i = 1; i < buffer.length - 1; i++) {
            if (buffer[i] === 0xFF && buffer[i + 1] === 0x01) {
              syncIdx = i;
              break;
            }
          }

          if (syncIdx > 0) {
            buffer = buffer.slice(syncIdx);
          } else {
            break;
          }
        }
      }
    } catch (err: unknown) {
      if (!signal.aborted) {
        console.warn('Sony liveview stream socket closed/fallback:', err);
      }
    }
  }

  /**
   * Stops Sony LiveView stream
   */
  async stopLiveview() {
    this.isLiveviewActive = false;
    if (this.hasNativeStreamer()) {
      try {
        (window as any).webkit.messageHandlers.sonyCameraNative.postMessage({
          action: 'stopLiveview',
        });
      } catch {}
    }
    if (this.liveviewAbortController) {
      this.liveviewAbortController.abort();
      this.liveviewAbortController = null;
    }
    try {
      await this.sendJsonRpc('stopLiveview', [], '1.0', 2000);
    } catch {}
    this.notifyStatus();
  }

  /**
   * 📸 DIRECT SHUTTER TRIGGER:
   * App commands Sony camera to physically shoot a photo over Wi-Fi,
   * then downloads and returns the photo as a base64 DataURL.
   */
  async takePhoto(): Promise<string> {
    // 1. Ensure camera is in still shoot mode
    try {
      await this.sendJsonRpc('setShootMode', ['still'], '1.0', 2000);
    } catch {}

    // 2. Clear any touch AF lock
    try {
      await this.sendJsonRpc('cancelTouchAFPosition', [], '1.0', 1000);
    } catch {}

    console.log('[Sony Shutter] Triggering actTakePicture...');
    let result: any = null;
    let lastError: any = null;

    // Attempt 1: Direct actTakePicture
    try {
      result = await this.sendJsonRpc('actTakePicture', [], '1.0', 12000);
    } catch (actErr: any) {
      lastError = actErr;
      console.warn('[Sony Shutter] actTakePicture direct failed, trying halfPressShutter focus lock:', actErr?.message);
    }

    // Attempt 2: If direct failed (e.g. 40400 focus hunting), try half-press focus lock first
    if (!result) {
      try {
        await this.sendJsonRpc('actHalfPressShutter', [], '1.0', 2500);
        await new Promise((r) => setTimeout(r, 400));
        result = await this.sendJsonRpc('actTakePicture', [], '1.0', 12000);
        try { await this.sendJsonRpc('cancelHalfPressShutter', [], '1.0', 1000); } catch {}
      } catch (halfErr: any) {
        lastError = halfErr;
        try { await this.sendJsonRpc('cancelHalfPressShutter', [], '1.0', 1000); } catch {}
      }
    }

    let photoUrl = '';
    if (Array.isArray(result) && result[0]) {
      const first = result[0];
      photoUrl = Array.isArray(first) ? first[0] : first;
    }

    if (!photoUrl) {
      // Fallback: Check awaitTakePicture
      try {
        const awaitResult = await this.sendJsonRpc('awaitTakePicture', [], '1.0', 6000);
        if (Array.isArray(awaitResult) && awaitResult[0]) {
          const first = awaitResult[0];
          photoUrl = Array.isArray(first) ? first[0] : first;
        }
      } catch {}
    }

    if (photoUrl && typeof photoUrl === 'string') {
      console.log('[Sony Shutter] Photo captured! Downloading from:', photoUrl);
      const downloadedDataUrl = await this.downloadImageAsDataUrl(photoUrl);
      return downloadedDataUrl;
    }

    // If liveview frame is available and taking picture threw 40400:
    if (lastError) {
      const errText = lastError?.message || String(lastError);
      if (errText.includes('40400')) {
        throw new Error(
          'Máy ảnh Sony từ chối chụp (Mã lỗi 40400: Không lấy nét được hoặc máy đang bận).\n\n' +
          '👉 CÁCH KHẮC PHỤC TRÊN MÁY SONY:\n' +
          '1. Gạt vòng xoay chế độ chụp trên máy ảnh sang P, A, S hoặc M (không để Auto hay Movie)\n' +
          '2. Gạt nút lấy nét trên ống kính sang MF (Manual Focus)\n' +
          '3. Mở nắp che ống kính và đảm bảo đã cắm thẻ nhớ SD'
        );
      }
      throw new Error(`Lỗi chụp máy Sony: ${errText}`);
    }

    // Grab latest liveview frame if available
    if (this.latestLiveviewFrame) {
      return this.latestLiveviewFrame;
    }

    throw new Error('Chưa nhận được ảnh chụp từ máy ảnh Sony. Vui lòng kiểm tra máy ảnh và bấm chụp lại!');
  }

  /**
   * Helper: Downloads an image URL (even from local camera IP) and converts to Base64 Data URL
   */
  private async downloadImageAsDataUrl(imageUrl: string): Promise<string> {
    // 1. Try Native iOS CapacitorHttp
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await CapacitorHttp.get({
          url: imageUrl,
          responseType: 'blob',
        });
        if (res.data) {
          if (typeof res.data === 'string') {
            if (res.data.startsWith('data:')) return res.data;
            return `data:image/jpeg;base64,${res.data}`;
          }
        }
      } catch (err) {
        console.warn('CapacitorHttp download image failed, trying fetch fallback:', err);
      }
    }

    // 2. Fetch / Blob
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      // 3. Fallback via Image Canvas render
      return new Promise<string>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width || 1920;
          canvas.height = img.height || 1080;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.95));
          } else {
            resolve(imageUrl);
          }
        };
        img.onerror = () => resolve(imageUrl);
        img.src = imageUrl;
      });
    }
  }
}

export const sonyCameraService = new SonyCameraService();
