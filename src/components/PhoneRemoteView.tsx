import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  Aperture,
  CheckCircle2,
  Sparkles,
  Smartphone,
  Download,
  Wifi,
  Send,
  Video,
  VideoOff,
  SwitchCamera,
  Laptop,
  Image as ImageIcon,
} from 'lucide-react';
import { realP2PService, P2PMessage } from '../services/realP2PService';
import { sounds } from '../utils/audio';

export const PhoneRemoteView: React.FC = () => {
  const [roomId, setRoomId] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>('');
  const [isMacOrPC, setIsMacOrPC] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<Array<{ deviceId: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSendingPhoto, setIsSendingPhoto] = useState(false);
  const [isShutterPressed, setIsShutterPressed] = useState(false);
  const [receivedStrips, setReceivedStrips] = useState<Array<{ url: string; title: string; time: string }>>([]);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Live Camera Streaming states
  const [isStreamingLiveCam, setIsStreamingLiveCam] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [streamError, setStreamError] = useState<string | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasCaptureRef = useRef<HTMLCanvasElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const rId = realP2PService.getRoomId();
    setRoomId(rId);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isMac = /Macintosh|MacIntel|MacPPC|Mac68K/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    setIsMacOrPC(isMac || (!isIOS && !isAndroid));

    const name = isMac
      ? 'Camera Máy Mac Pro'
      : isIOS
      ? 'iPhone của bạn'
      : isAndroid
      ? 'Điện thoại Android'
      : 'Máy tính (Webcam)';
    setDeviceName(name);

    const cId = realP2PService.joinRoomAsPhone(name);
    setClientId(cId);

    const unsubStatus = realP2PService.onConnectionStatusChange(setConnectionStatus);

    // Enumerate all cameras available on this device (e.g. FaceTime Camera on Mac)
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devs) => {
        const videoDevs = devs
          .filter((d) => d.kind === 'videoinput')
          .map((d, idx) => ({
            deviceId: d.deviceId,
            label: d.label || `Camera ${idx + 1}`,
          }));
        setAvailableCameras(videoDevs);
        if (videoDevs.length > 0) {
          setSelectedCameraId(videoDevs[0].deviceId);
        }
      });
    }

    // Listen to messages from Photobooth
    const unsub = realP2PService.onMessage((msg: P2PMessage) => {
      if (msg.type === 'STRIP_DELIVERY') {
        sounds.playSuccessChime();
        setReceivedStrips((prev) => [
          {
            url: msg.payload.stripDataUrl,
            title: msg.payload.title,
            time: new Date().toLocaleTimeString(),
          },
          ...prev,
        ]);
        setStatusFeedback('✨ Đã nhận được dải ảnh mới từ Photobooth!');
        setTimeout(() => setStatusFeedback(null), 4000);
      }
    });

    return () => {
      unsubStatus();
      unsub();
      stopLiveCamStream();
    };
  }, []);

  // Stop Live Camera Stream
  const stopLiveCamStream = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreamingLiveCam(false);
    realP2PService.stopPhoneCameraStream(clientId);
  };

  // Start Live Camera Stream (Mac FaceTime HD camera or Phone Camera)
  const startLiveCamStream = async (devId = selectedCameraId, mode = facingMode) => {
    stopLiveCamStream();
    setStreamError(null);

    try {
      const constraints: MediaStreamConstraints = {
        video: devId
          ? { deviceId: { exact: devId }, width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 } }
          : { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setIsStreamingLiveCam(true);
      realP2PService.startPhoneCameraStream(clientId, deviceName, stream, mode);
      sounds.playBluetoothConnect();

      // Create hidden canvas for frame encoding fallback
      if (!canvasCaptureRef.current) {
        canvasCaptureRef.current = document.createElement('canvas');
      }

      // Stream frames at ~20 fps to Photobooth (HD resolution for sharp preview)
      frameIntervalRef.current = setInterval(() => {
        if (videoRef.current && canvasCaptureRef.current && videoRef.current.videoWidth) {
          const video = videoRef.current;
          const canvas = canvasCaptureRef.current;
          const vWidth = video.videoWidth || 1280;
          const vHeight = video.videoHeight || 720;
          const targetW = Math.min(vWidth, 1280);
          const targetH = Math.round((vHeight / vWidth) * targetW);
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frameUrl = canvas.toDataURL('image/jpeg', 0.82);
            realP2PService.sendPhoneCameraFrame(clientId, frameUrl);
          }
        }
      }, 55);

      setStatusFeedback(`🎥 Đang phát trực tiếp Camera ${deviceName} sang Photobooth Kiosk!`);
      setTimeout(() => setStatusFeedback(null), 3000);
    } catch (err: unknown) {
      console.error('Live camera access error:', err);
      setStreamError('Không thể mở Camera. Vui lòng cho phép quyền truy cập Camera trên trình duyệt.');
      setIsStreamingLiveCam(false);
    }
  };

  const handleToggleLiveCam = () => {
    if (isStreamingLiveCam) {
      stopLiveCamStream();
      setStatusFeedback('Đã dừng phát LiveView camera.');
      setTimeout(() => setStatusFeedback(null), 2000);
    } else {
      startLiveCamStream(selectedCameraId, facingMode);
    }
  };

  const handleSwitchFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (isStreamingLiveCam) {
      startLiveCamStream('', nextMode);
    }
  };

  // Trigger Remote Shutter on Booth
  const handleShutterClick = () => {
    setIsShutterPressed(true);
    sounds.playShutterSound();
    realP2PService.triggerShutter(clientId, deviceName);

    if (navigator.vibrate) {
      navigator.vibrate(100);
    }

    setStatusFeedback('📸 Đã gửi lệnh bấm chụp sang Photobooth Kiosk!');
    setTimeout(() => {
      setIsShutterPressed(false);
      setTimeout(() => setStatusFeedback(null), 2500);
    }, 400);
  };

  // Handle Photo selection from camera or gallery
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Send selected photo to Photobooth
  const handleSendPhotoToBooth = async () => {
    if (!selectedImage) return;

    setIsSendingPhoto(true);
    sounds.playBluetoothConnect();

    realP2PService.sendPhotoFromPhone(selectedImage, 'Camera_Capture.jpg', clientId, deviceName);

    setStatusFeedback('🚀 Đã bắn ảnh thành công vào ô Photobooth!');
    setIsSendingPhoto(false);
    setSelectedImage(null);

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';

    setTimeout(() => setStatusFeedback(null), 3000);
  };

  const handleDownloadStrip = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white px-3 sm:px-6 pt-[max(env(safe-area-inset-top,0px),0.75rem)] pb-[max(env(safe-area-inset-bottom,0px),1rem)] flex flex-col items-center select-none">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header */}
      <header className="w-full max-w-lg bg-gray-900/90 border border-gray-800 rounded-3xl p-4 shadow-xl backdrop-blur-md mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-pink-500/20 border border-pink-500/30 text-pink-400 flex items-center justify-center">
            {isMacOrPC ? <Laptop className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
          </div>
          <div>
            <h1 className="font-bold text-base font-cute text-white flex items-center gap-1.5">
              <span>{isMacOrPC ? 'Trạm Phát Camera Máy Mac' : 'PhotoXinhh Remote & Cam'}</span>
              <Sparkles className="w-4 h-4 text-amber-300" />
            </h1>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
              {connectionStatus === 'connected' ? (
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Đã nối Kiosk: Phòng {roomId}</span>
                </span>
              ) : connectionStatus === 'connecting' ? (
                <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Đang kết nối: Phòng {roomId}...</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  <span>Chờ Kiosk: Phòng {roomId}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={`flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-full border ${
          connectionStatus === 'connected'
            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
            : connectionStatus === 'connecting'
            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            : 'bg-gray-800 text-gray-400 border-gray-700'
        }`}>
          <Wifi className="w-3 h-3" />
          <span>Live P2P</span>
        </div>
      </header>

      {/* Main Controls Card */}
      <main className="w-full max-w-lg flex flex-col gap-3.5">
        {/* Status Toast Banner */}
        {statusFeedback && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold text-center flex items-center justify-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusFeedback}</span>
          </div>
        )}

        {/* SECTION 1: LIVE CAMERA BROADCAST (PHÁT CAMERA SANG KIOSK IPHONE/IPAD) */}
        <div className="bg-gradient-to-br from-purple-950/40 via-gray-900 to-gray-900 border border-purple-500/30 rounded-3xl p-5 shadow-xl flex flex-col gap-3.5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">
                  {isMacOrPC ? 'Phát Camera Máy Mac Sang iPhone' : 'Biến Điện Thoại Thành Máy Ảnh Booth'}
                </h3>
                <span className="text-[11px] text-gray-400 block">
                  Truyền video trực tiếp 60FPS sang màn hình Photobooth Kiosk
                </span>
              </div>
            </div>

            <button
              onClick={handleToggleLiveCam}
              className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 ${
                isStreamingLiveCam
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-purple-900/50 hover:scale-105'
              }`}
            >
              {isStreamingLiveCam ? (
                <>
                  <VideoOff className="w-4 h-4" />
                  <span>Dừng Phát Stream</span>
                </>
              ) : (
                <>
                  <Video className="w-4 h-4" />
                  <span>Bật Phát Camera Live</span>
                </>
              )}
            </button>
          </div>

          {/* Camera Device Selector on Mac/PC */}
          {availableCameras.length > 1 && (
            <div className="flex items-center gap-2 bg-gray-950 p-2.5 rounded-xl border border-gray-800">
              <span className="text-xs text-gray-400 font-semibold shrink-0">Chọn Camera:</span>
              <select
                value={selectedCameraId}
                onChange={(e) => {
                  setSelectedCameraId(e.target.value);
                  if (isStreamingLiveCam) {
                    startLiveCamStream(e.target.value);
                  }
                }}
                className="w-full bg-gray-900 border border-gray-700 text-xs text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-pink-500"
              >
                {availableCameras.map((cam) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Live Video Preview Box */}
          {isStreamingLiveCam && (
            <div className="relative rounded-2xl overflow-hidden border-2 border-purple-500 bg-black aspect-video flex items-center justify-center shadow-lg">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 shadow-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>ĐANG PHÁT LIVE SANG BOOTH IPHONE/IPAD (60FPS)</span>
              </div>

              {!isMacOrPC && (
                <button
                  onClick={handleSwitchFacingMode}
                  className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/90 text-white p-2 rounded-xl backdrop-blur-md border border-white/20 text-xs font-semibold flex items-center gap-1"
                >
                  <SwitchCamera className="w-4 h-4" />
                  <span>Đổi Cam ({facingMode === 'environment' ? 'Sau' : 'Trước'})</span>
                </button>
              )}
            </div>
          )}

          {streamError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl">
              {streamError}
            </div>
          )}
        </div>

        {/* SECTION 2: GIANT REMOTE SHUTTER BUTTON */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-3xl p-6 shadow-xl flex flex-col items-center text-center">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Nút Bấm Chụp Từ Xa (Wireless Shutter)
          </span>
          <p className="text-xs text-gray-400 mb-4">
            Bấm nút dưới đây để kích hoạt Photobooth Kiosk đếm ngược 3s và chụp!
          </p>

          <button
            onClick={handleShutterClick}
            className={`w-32 h-32 rounded-full border-4 border-pink-500/40 shadow-2xl flex flex-col items-center justify-center gap-1 transition-all transform active:scale-90 ${
              isShutterPressed
                ? 'bg-pink-600 scale-95 shadow-pink-500/50'
                : 'bg-gradient-to-tr from-pink-500 via-rose-500 to-pink-500 hover:scale-105 shadow-pink-900/50'
            }`}
          >
            <Aperture className={`w-10 h-10 text-white ${isShutterPressed ? 'animate-spin' : ''}`} />
            <span className="font-extrabold text-xs uppercase tracking-wider text-white">
              BẤM CHỤP
            </span>
          </button>
        </div>

        {/* SECTION 3: PHOTO BEAM */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-3xl p-4 shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Upload className="w-4 h-4" />
              <span>Bắn File Ảnh Vào Khung Photobooth</span>
            </span>
          </div>

          {selectedImage ? (
            <div className="flex flex-col items-center gap-3 bg-gray-950 p-3 rounded-2xl border border-gray-800">
              <div className="w-28 h-40 rounded-xl overflow-hidden border-2 border-pink-500 shadow-md">
                <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
              </div>

              <div className="flex items-center gap-2 w-full">
                <button
                  onClick={() => setSelectedImage(null)}
                  className="flex-1 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold"
                >
                  Chọn Lại
                </button>
                <button
                  onClick={handleSendPhotoToBooth}
                  disabled={isSendingPhoto}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi Vào Khung Ngay</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="p-3.5 rounded-2xl bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/30 hover:border-pink-500/60 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <div className="w-9 h-9 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs text-white">Chụp 1 Tấm Gửi</span>
                <span className="text-[10px] text-gray-400">Từ máy ảnh thiết bị này</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/30 hover:border-blue-500/60 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs text-white">Chọn Album / File</span>
                <span className="text-[10px] text-gray-400">File ảnh lưu trên máy</span>
              </button>
            </div>
          )}
        </div>

        {/* SECTION 4: RECEIVED STRIPS FROM PHOTOBOOTH */}
        {receivedStrips.length > 0 && (
          <div className="bg-gray-900/80 border border-gray-800 rounded-3xl p-4 shadow-xl flex flex-col gap-3">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Download className="w-4 h-4" />
              <span>Dải Ảnh Nhận Được Từ Photobooth ({receivedStrips.length})</span>
            </span>

            <div className="flex flex-col gap-2.5">
              {receivedStrips.map((strip, idx) => (
                <div
                  key={idx}
                  className="bg-gray-950 border border-gray-800 rounded-2xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="w-12 h-20 rounded-lg overflow-hidden border border-pink-400 shrink-0 bg-black">
                    <img src={strip.url} alt="Strip" className="w-full h-full object-cover" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs text-white truncate">{strip.title}</h4>
                    <span className="text-[11px] text-gray-400 block">{strip.time} • 300 DPI</span>
                  </div>

                  <button
                    onClick={() => handleDownloadStrip(strip.url, `photoxinhh_${Date.now()}.png`)}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shrink-0 flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Lưu Máy</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Return to Booth link */}
        <div className="text-center py-2">
          <a
            href="/"
            className="text-xs text-gray-500 hover:text-pink-400 underline transition-colors"
          >
            Quay lại màn hình chính Photobooth
          </a>
        </div>
      </main>
    </div>
  );
};
