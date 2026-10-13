import { SAMPLE_PORTRAITS } from '../templates/samplePhotos';
import { realP2PService } from './realP2PService';
import { sonyCameraService } from './sonyCameraService';
import { hotFolderService } from './hotFolderService';

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
            lower.includes('built-in');

          const isUsb =
            lower.includes('usb') ||
            lower.includes('capture') ||
            lower.includes('cam link') ||
            lower.includes('hdmi') ||
            lower.includes('uvc') ||
            lower.includes('elgato') ||
            lower.includes('avermedia') ||
            lower.includes('hagibis') ||
            lower.includes('ugreen') ||
            lower.includes('video') ||
            lower.includes('external') ||
            (!isInternal && videoDevices.length > 1);

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
      }
    } catch (e) {
      console.warn('enumerateDevices error:', e);
    } finally {
      if (tempStream) {
        tempStream.getTracks().forEach(t => t.stop());
      }
    }

    // Hot Folder (Sony Imaging Edge Desktop Remote Tethering)
    list.push({
      deviceId: 'hot-folder-camera',
      label: '📁 [Hot Folder] Máy ảnh Sony qua Imaging Edge Remote (Ảnh gốc High-Res)',
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

    // For hot-folder-camera: Try to start liveview from configured stream (Webcam, Imaging Edge Webcam, HDMI Capture)
    let actualStreamId = deviceId;
    if (deviceId === 'hot-folder-camera') {
      const liveviewPref = hotFolderService.getLiveviewDeviceId();
      if (liveviewPref && liveviewPref !== 'hot-folder-camera' && liveviewPref !== 'none') {
        actualStreamId = liveviewPref;
      } else {
        actualStreamId = 'default';
      }
    }

    try {
      let stream: MediaStream | null = null;
      if (actualStreamId && actualStreamId !== 'default') {
        try {
          // 1. Try with exact deviceId
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: actualStreamId },
            },
            audio: false,
          });
        } catch (e1) {
          try {
            // 2. Try with loose deviceId constraint (avoids OverconstrainedError on iPadOS)
            stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: actualStreamId },
              audio: false,
            });
          } catch (e2) {
            try {
              // 3. Try with ideal deviceId constraint
              stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { ideal: actualStreamId } },
                audio: false,
              });
            } catch (e3) {
              // 4. Fallback to general camera stream
              stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            }
          }
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      this.currentStream = stream;
      return this.currentStream;
    } catch (err) {
      console.warn('Cannot access real camera stream:', err);
      return null;
    }
  }

  stopStream() {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }
  }

  async captureFromVideoElement(video: HTMLVideoElement, mirror = true): Promise<string> {
    // If video element is not ready or has 0 dimensions, try srcObject stream or wait briefly
    if (!video.videoWidth || !video.videoHeight) {
      if (video.srcObject instanceof MediaStream) {
        return this.captureFromMediaStream(video.srcObject, mirror);
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

    const width = video.videoWidth > 0 ? video.videoWidth : 1280;
    const height = video.videoHeight > 0 ? video.videoHeight : 960;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    if (mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.95);
  }

  async captureFromMediaStream(stream: MediaStream, mirror = true): Promise<string> {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) throw new Error('Không tìm thấy luồng video từ camera.');

    // If ImageCapture is natively supported
    if (typeof window !== 'undefined' && 'ImageCapture' in window) {
      try {
        // @ts-ignore
        const imageCapture = new window.ImageCapture(videoTrack);
        const bitmap: ImageBitmap = await imageCapture.grabFrame();
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (mirror) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(bitmap, 0, 0);
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
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }
          if (mirror) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
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
    throw new Error('Chưa có tín hiệu camera. Hãy bấm "Bật Phát Camera Live" trên máy phát trước khi chụp!');
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
