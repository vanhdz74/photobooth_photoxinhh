import { SAMPLE_PORTRAITS } from '../templates/samplePhotos';
import { realP2PService } from './realP2PService';

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export class CameraService {
  private currentStream: MediaStream | null = null;
  private mockPhotoIndex = 0;

  async getAvailableDevices(): Promise<CameraDevice[]> {
    const list: CameraDevice[] = [
      { deviceId: 'phone-live-camera', label: '📡 Camera Không Dây (Live Stream từ Máy Mac / Thiết Bị Ngoài)' },
    ];

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices
          .filter(device => device.kind === 'videoinput')
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `Camera ${index + 1}`
          }));
        list.push(...videoDevices);
      }
    } catch {
      // ignore
    }

    // Always append mock option for testing without hardware
    list.push({ deviceId: 'mock-camera', label: '🎭 Fake Camera (Ảnh mẫu Studio)' });

    return list;
  }

  async startStream(deviceId?: string): Promise<MediaStream | null> {
    this.stopStream();

    if (deviceId === 'mock-camera' || deviceId === 'phone-live-camera') {
      return null; // Signals to use mock rendering or Phone P2P Frame Stream
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId && deviceId !== 'default' ? { exact: deviceId } : undefined,
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          facingMode: 'user'
        },
        audio: false
      };

      this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.currentStream;
    } catch (err) {
      console.warn('Cannot access real camera, falling back to mock mode:', err);
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

  async getMockPhoto(): Promise<string> {
    const url = SAMPLE_PORTRAITS[this.mockPhotoIndex % SAMPLE_PORTRAITS.length];
    this.mockPhotoIndex++;
    return url;
  }
}

export const cameraService = new CameraService();
