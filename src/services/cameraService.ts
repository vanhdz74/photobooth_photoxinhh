import { SAMPLE_PORTRAITS } from '../templates/samplePhotos';
import { realP2PService } from './realP2PService';
import { sonyCameraService } from './sonyCameraService';
import { hotFolderService } from './hotFolderService';
import { sonyMultiService } from './sonyMultiService';

export interface CameraDevice {
  deviceId: string;
  label: string;
  isUsb?: boolean;
  rawLabel?: string;
}

export class CameraService {
  private currentStream: MediaStream | null = null;
  private mockPhotoIndex = 0;

  async requestPermissionAndGetDevices(): Promise<CameraDevice[]> {
    let tempStream: MediaStream | null = null;
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
    } catch (e) {
      console.warn('getUserMedia permission request warning:', e);
    }
    const devices = await this.getAvailableDevices(false);
    if (tempStream) {
      tempStream.getTracks().forEach(t => t.stop());
    }
    return devices;
  }

  async getAvailableDevices(checkEmptyLabels = true): Promise<CameraDevice[]> {
    const list: CameraDevice[] = [];
    let tempStream: MediaStream | null = null;

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        console.log('⚡️ [Camera Scan] Calling navigator.mediaDevices.enumerateDevices()...');
        let devices = await navigator.mediaDevices.enumerateDevices();
        let videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log(`⚡️ [Camera Scan] Found ${videoDevices.length} raw videoinput devices:`, videoDevices.map(d => ({ id: d.deviceId, label: d.label || '(no label)' })));

        // On iPadOS/Safari: Device labels are empty until an ACTIVE stream is running!
        const hasEmptyLabels = videoDevices.length === 0 || videoDevices.some(d => !d.label);
        if (checkEmptyLabels && hasEmptyLabels && navigator.mediaDevices.getUserMedia) {
          try {
            console.log('⚡️ [Camera Scan] Requesting temporary getUserMedia stream to unlock device labels on iPadOS...');
            tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            // Must enumerate WHILE tempStream is active on iOS WebKit
            devices = await navigator.mediaDevices.enumerateDevices();
            videoDevices = devices.filter(device => device.kind === 'videoinput');
            console.log(`⚡️ [Camera Scan] After permission unlock: Found ${videoDevices.length} videoinput devices:`, videoDevices.map(d => ({ id: d.deviceId, label: d.label })));
          } catch (err) {
            console.warn('Could not auto-request camera permission on iOS:', err);
          }
        }

        const formattedDevices: CameraDevice[] = videoDevices.map((device, index) => {
          const raw = device.label || `Camera ${index + 1}`;
          const lower = raw.toLowerCase();
          const isInternal =
            lower.includes('facetime') ||
            lower.includes('front') ||
            lower.includes('back') ||
            lower.includes('truedepth') ||
            lower.includes('built-in') ||
            lower.includes('apple camera') ||
            lower.includes('integrated');

          // Strict check for genuine USB video / HDMI Capture Card devices:
          const hasUsbKeywords =
            lower.includes('usb') ||
            lower.includes('capture') ||
            lower.includes('cam link') ||
            lower.includes('hdmi') ||
            lower.includes('uvc') ||
            lower.includes('elgato') ||
            lower.includes('avermedia') ||
            lower.includes('hagibis') ||
            lower.includes('ugreen') ||
            lower.includes('external') ||
            lower.includes('fhd') ||
            lower.includes('obs virtual');

          // Only treat as USB if it's NOT internal and specifically matches USB/Capture keywords
          const isUsb = !isInternal && hasUsbKeywords;

          let formattedLabel = raw;
          if (isUsb) {
            formattedLabel = `🔌 [Cáp USB / HDMI] ${raw}`;
          } else if (isInternal) {
            formattedLabel = `📱 [Camera iPad] ${raw}`;
          } else {
            formattedLabel = `📷 ${raw}`;
          }

          return {
            deviceId: device.deviceId,
            label: formattedLabel,
            isUsb,
            rawLabel: raw,
          };
        });

        // Put USB devices on top of hardware list
        formattedDevices.sort((a, b) => (b.isUsb ? 1 : 0) - (a.isUsb ? 1 : 0));
        list.push(...formattedDevices);

        // Sync real USB hardware status with sonyMultiService
        const realUsbDev = formattedDevices.find((d) => d.isUsb);
        if (realUsbDev) {
          sonyMultiService.updateUsbStatus(true, realUsbDev.rawLabel || realUsbDev.label);
        }
      }
    } catch (e) {
      console.warn('enumerateDevices error:', e);
    } finally {
      if (tempStream) {
        tempStream.getTracks().forEach(t => t.stop());
      }
    }

    // Sony Multi-Terminal Connection
    list.push({
      deviceId: 'sony-multi-camera',
      label: '🔌 [Cổng Multi Sony] Cáp Multi-Terminal & Cò Bấm (Ảnh Gốc Thẻ Nhớ)',
    });

    // Hot Folder (Canon EOS Utility / Sony Imaging Edge Tethering)
    list.push({
      deviceId: 'hot-folder-camera',
      label: '📁 [Hot Folder] Máy ảnh Canon / Sony qua EOS Utility & Imaging Edge (Ảnh gốc High-Res)',
    });

    // Wireless / Wi-Fi & Network options
    list.push({ deviceId: 'sony-wifi-camera', label: '📡 Máy Ảnh Sony (Điều Khiển Wi-Fi Không Dây)' });
    list.push({ deviceId: 'phone-live-camera', label: '📲 Camera Không Dây (Live Stream từ Máy Mac / Điện Thoại)' });

    // Always append mock option for testing without hardware
    list.push({ deviceId: 'mock-camera', label: '🎭 Fake Camera (Ảnh mẫu Studio)' });

    return list;
  }

  findFirstUsbDevice(devices: CameraDevice[]): CameraDevice | undefined {
    return devices.find(d => d.isUsb);
  }

  async startStream(deviceId?: string): Promise<MediaStream | null> {
    this.stopStream();

    if (deviceId === 'mock-camera' || deviceId === 'phone-live-camera' || deviceId === 'sony-wifi-camera') {
      if (deviceId === 'sony-wifi-camera') {
        sonyCameraService.startLiveview().catch(() => {});
      }
      return null; // Signals to use mock rendering, Phone P2P, or Sony LiveView stream
    }

    // For sony-multi-camera: Use USB video capture stream or Wi-Fi LiveView
    let actualStreamId = deviceId;
    if (deviceId === 'sony-multi-camera') {
      // 1. If Sony Wi-Fi is actively connected, start Wi-Fi LiveView
      if (sonyCameraService.isConnected()) {
        sonyCameraService.startLiveview().catch(() => {});
        return null; // Signals modal to render sonyLiveFrame
      }

      // 2. Check for real USB Capture Card
      const devs = await this.getAvailableDevices(false);
      const usbDev = this.findFirstUsbDevice(devs);
      if (usbDev) {
        actualStreamId = usbDev.deviceId;
      } else {
        // No USB capture card found and Wi-Fi not connected yet.
        // Return null so the UI can show the Sony Multi interactive assistant
        return null;
      }
    } else if (deviceId === 'hot-folder-camera') {
      const liveviewPref = hotFolderService.getLiveviewDeviceId();
      if (liveviewPref && liveviewPref !== 'hot-folder-camera' && liveviewPref !== 'none') {
        actualStreamId = liveviewPref;
      } else {
        actualStreamId = 'default';
      }
    }

    try {
      let stream: MediaStream | null = null;
      // High-resolution request for crisp HDMI capture card & webcams
      const highRes = {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      };
      const standardRes = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };

      if (actualStreamId && actualStreamId !== 'default') {
        try {
          // 1. Try with ideal deviceId & 1080p ideal (safe on iOS 17 & desktop)
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { ideal: actualStreamId },
              ...highRes,
            },
            audio: false,
          });
        } catch {
          try {
            // 2. Try with loose deviceId without resolution restrictions (vital for USB HDMI capture cards)
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: actualStreamId,
              },
              audio: false,
            });
          } catch {
            try {
              // 3. Try standard 720p ideal
              stream = await navigator.mediaDevices.getUserMedia({
                video: {
                  deviceId: { ideal: actualStreamId },
                  ...standardRes,
                },
                audio: false,
              });
            } catch {
              try {
                // 4. Try exact deviceId constraint
                stream = await navigator.mediaDevices.getUserMedia({
                  video: {
                    deviceId: { exact: actualStreamId },
                  },
                  audio: false,
                });
              } catch (exactErr) {
                console.warn('Failed to open requested deviceId:', actualStreamId, exactErr);
                // For sony-multi-camera, do not hijack with front camera if capture card failed
                if (deviceId === 'sony-multi-camera') {
                  return null;
                }
                // Fallback to general camera stream
                stream = await navigator.mediaDevices.getUserMedia({
                  video: { ...standardRes },
                  audio: false,
                });
              }
            }
          }
        }
      } else {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { ...highRes },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { ...standardRes },
            audio: false,
          });
        }
      }

      this.currentStream = stream;
      return this.currentStream;
    } catch (err) {
      console.warn('Cannot access real camera stream with HD constraints, falling back to basic video:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        this.currentStream = fallbackStream;
        return this.currentStream;
      } catch (fallbackErr) {
        console.warn('Fallback camera stream failed:', fallbackErr);
        return null;
      }
    }
  }

  stopStream() {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }
  }

  async captureFromVideoElement(
    video: HTMLVideoElement,
    mirror = true,
    cropToContainer?: { width: number; height: number } | null,
    zoom = 1.0
  ): Promise<string> {
    // If video element is not ready or has 0 dimensions, try srcObject stream or wait briefly
    if (!video.videoWidth || !video.videoHeight) {
      if (video.srcObject instanceof MediaStream) {
        return this.captureFromMediaStream(video.srcObject, mirror, cropToContainer, zoom);
      }
      // Wait up to 300ms for video dimensions to load
      await new Promise<void>((resolve) => {
        if (video.videoWidth > 0) return resolve();
        const onLoaded = () => {
          video.removeEventListener('loadeddata', onLoaded);
          resolve();
        };
        video.addEventListener('loadeddata', onLoaded);
        setTimeout(resolve, 300);
      });
    }

    const videoWidth = video.videoWidth > 0 ? video.videoWidth : 1280;
    const videoHeight = video.videoHeight > 0 ? video.videoHeight : 960;

    let sx = 0;
    let sy = 0;
    let sw = videoWidth;
    let sh = videoHeight;

    if (cropToContainer && cropToContainer.width > 0 && cropToContainer.height > 0) {
      const containerAspect = cropToContainer.width / cropToContainer.height;
      const videoAspect = videoWidth / videoHeight;

      if (containerAspect > videoAspect) {
        // Container is wider than video -> top and bottom were cropped in cover mode
        sw = videoWidth;
        sh = Math.round(videoWidth / containerAspect);
        sx = 0;
        sy = Math.round((videoHeight - sh) / 2);
      } else {
        // Container is taller than video -> left and right were cropped in cover mode
        sh = videoHeight;
        sw = Math.round(videoHeight * containerAspect);
        sy = 0;
        sx = Math.round((videoWidth - sw) / 2);
      }
    }

    // Apply digital zoom crop
    if (zoom > 1.0) {
      const zoomedSw = Math.round(sw / zoom);
      const zoomedSh = Math.round(sh / zoom);
      sx += Math.round((sw - zoomedSw) / 2);
      sy += Math.round((sh - zoomedSh) / 2);
      sw = zoomedSw;
      sh = zoomedSh;
    }

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    if (mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    try {
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.95);
    } catch (err) {
      console.warn('captureFromVideoElement canvas error, using mock:', err);
      return this.getMockPhoto();
    }
  }

  async captureFromMediaStream(
    stream: MediaStream,
    mirror = true,
    cropToContainer?: { width: number; height: number } | null,
    zoom = 1.0
  ): Promise<string> {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) throw new Error('Không tìm thấy luồng video từ camera.');

    // If ImageCapture is natively supported
    if (typeof window !== 'undefined' && 'ImageCapture' in window) {
      try {
        // @ts-ignore
        const imageCapture = new window.ImageCapture(videoTrack);
        const bitmap: ImageBitmap = await imageCapture.grabFrame();
        const bWidth = bitmap.width;
        const bHeight = bitmap.height;

        let sx = 0;
        let sy = 0;
        let sw = bWidth;
        let sh = bHeight;

        if (cropToContainer && cropToContainer.width > 0 && cropToContainer.height > 0) {
          const containerAspect = cropToContainer.width / cropToContainer.height;
          const imgAspect = bWidth / bHeight;
          if (containerAspect > imgAspect) {
            sw = bWidth;
            sh = Math.round(bWidth / containerAspect);
            sy = Math.round((bHeight - sh) / 2);
          } else {
            sh = bHeight;
            sw = Math.round(bHeight * containerAspect);
            sx = Math.round((bWidth - sw) / 2);
          }
        }

        if (zoom > 1.0) {
          const zoomedSw = Math.round(sw / zoom);
          const zoomedSh = Math.round(sh / zoom);
          sx += Math.round((sw - zoomedSw) / 2);
          sy += Math.round((sh - zoomedSh) / 2);
          sw = zoomedSw;
          sh = zoomedSh;
        }

        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (mirror) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/jpeg', 0.95);
        }
      } catch (e) {
        console.warn('ImageCapture fallback to canvas video capture:', e);
      }
    }

    return new Promise((resolve, reject) => {
      const tempVideo = document.createElement('video');
      tempVideo.muted = true;
      tempVideo.playsInline = true;
      tempVideo.autoplay = true;
      tempVideo.srcObject = stream;

      const doCapture = () => {
        try {
          const width = tempVideo.videoWidth > 0 ? tempVideo.videoWidth : 1280;
          const height = tempVideo.videoHeight > 0 ? tempVideo.videoHeight : 960;

          let sx = 0;
          let sy = 0;
          let sw = width;
          let sh = height;

          if (cropToContainer && cropToContainer.width > 0 && cropToContainer.height > 0) {
            const containerAspect = cropToContainer.width / cropToContainer.height;
            const vAspect = width / height;
            if (containerAspect > vAspect) {
              sw = width;
              sh = Math.round(width / containerAspect);
              sy = Math.round((height - sh) / 2);
            } else {
              sh = height;
              sw = Math.round(height * containerAspect);
              sx = Math.round((width - sw) / 2);
            }
          }

          if (zoom > 1.0) {
            const zoomedSw = Math.round(sw / zoom);
            const zoomedSh = Math.round(sh / zoom);
            sx += Math.round((sw - zoomedSw) / 2);
            sy += Math.round((sh - zoomedSh) / 2);
            sw = zoomedSw;
            sh = zoomedSh;
          }

          const canvas = document.createElement('canvas');
          canvas.width = sw;
          canvas.height = sh;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }
          if (mirror) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(tempVideo, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
          tempVideo.srcObject = null;
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        } catch (err) {
          reject(err);
        }
      };

      tempVideo.onloadeddata = () => {
        tempVideo.play().then(() => {
          setTimeout(doCapture, 50);
        }).catch(() => {
          doCapture();
        });
      };

      tempVideo.onerror = (e) => reject(e);

      setTimeout(() => {
        if (tempVideo.srcObject) {
          doCapture();
        }
      }, 400);
    });
  }

  async captureFromPhoneStream(): Promise<string> {
    const remoteStream = realP2PService.getRemoteMediaStream();
    if (remoteStream) {
      return this.captureFromMediaStream(remoteStream);
    }
    const frame = realP2PService.getLatestPhoneFrame();
    if (frame) {
      return frame;
    }
    console.warn('captureFromPhoneStream called without active stream, using fallback photo');
    return this.getMockPhoto();
  }

  async captureFromSonyCamera(): Promise<string> {
    return sonyCameraService.takePhoto();
  }

  async captureFromHotFolder(): Promise<string> {
    return hotFolderService.capturePhoto();
  }

  async getMockPhoto(): Promise<string> {
    const url = SAMPLE_PORTRAITS[this.mockPhotoIndex % SAMPLE_PORTRAITS.length];
    this.mockPhotoIndex++;
    return url;
  }
}

export const cameraService = new CameraService();
