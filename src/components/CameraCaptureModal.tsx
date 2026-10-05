import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, RefreshCw, CheckCircle2, Sparkles, Volume2, VolumeX, Timer, Plus, Minus, AlertCircle } from 'lucide-react';
import { cameraService, CameraDevice } from '../services/cameraService';
import { bluetoothService } from '../services/bluetoothService';
import { realP2PService } from '../services/realP2PService';
import { sounds } from '../utils/audio';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredPhotos: number;
  onPhotosCaptured: (photos: string[]) => void;
  isMockMode: boolean;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  requiredPhotos,
  onPhotosCaptured,
  isMockMode: initialMockMode,
}) => {
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('phone-live-camera');
  const [isMock, setIsMock] = useState(initialMockMode);
  const [phoneLiveFrame, setPhoneLiveFrame] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  
  // Custom Countdown Duration (1s to 15s, default 3s)
  const [countdownSeconds, setCountdownSeconds] = useState<number>(3);
  const [isShooting, setIsShooting] = useState(false);
  const [currentShotIndex, setCurrentShotIndex] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isMirrored, setIsMirrored] = useState(true);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Subscribe to Phone Live Camera Frame stream & WebRTC MediaStream
  useEffect(() => {
    if (!isOpen) return;

    // Immediately pick up existing stream/frame if already broadcasting
    const currentRemote = realP2PService.getRemoteMediaStream();
    if (currentRemote) {
      setRemoteStream(currentRemote);
    }
    const currentFrame = realP2PService.getLatestPhoneFrame();
    if (currentFrame) {
      setPhoneLiveFrame(currentFrame);
    }

    const unsubFrame = realP2PService.onPhoneCameraFrame((frameUrl) => {
      setPhoneLiveFrame(frameUrl);
    });

    const unsubStream = realP2PService.onRemoteMediaStream((stream) => {
      setRemoteStream(stream);
      if (selectedDevice === 'phone-live-camera' && videoRef.current && stream) {
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
        }
        videoRef.current.play().catch(() => {});
      }
    });

    return () => {
      unsubFrame();
      unsubStream();
    };
  }, [isOpen, selectedDevice]);

  // Step-by-Step Single Shot Capture (Capture 1 photo -> Stop -> User presses button for next photo)
  const triggerNextShot = useCallback(async () => {
    if (isShooting || capturedPhotos.length >= requiredPhotos) return;
    setCaptureError(null);

    // Validate active camera stream before starting
    if (selectedDevice === 'phone-live-camera') {
      const activeStream = remoteStream || realP2PService.getRemoteMediaStream();
      const activeFrame = phoneLiveFrame || realP2PService.getLatestPhoneFrame();
      if (!activeStream && !activeFrame) {
        setCaptureError('Chưa nhận được hình ảnh camera. Vui lòng bấm "Bật Phát Camera Live" trên máy phát trước khi chụp!');
        sounds.playBluetoothDisconnect();
        return;
      }
    } else if (!isMock && !streamRef.current && !videoRef.current?.videoWidth) {
      // Validate webcam
      try {
        const stream = await cameraService.startStream(selectedDevice);
        if (!stream && !videoRef.current?.videoWidth) {
          setCaptureError('Không thể mở camera. Vui lòng kiểm tra quyền camera hoặc chọn nguồn khác.');
          return;
        }
      } catch {
        setCaptureError('Không thể mở camera. Vui lòng kiểm tra quyền camera.');
        return;
      }
    }

    setIsShooting(true);
    const nextIndex = capturedPhotos.length + 1;
    setCurrentShotIndex(nextIndex);

    // Custom Countdown Duration (User set between 1s and 15s)
    const totalCount = Math.min(15, Math.max(1, countdownSeconds));
    for (let c = totalCount; c > 0; c--) {
      setCountdown(c);
      if (soundEnabled) sounds.playCountdownBeep(c === 1);
      await new Promise((r) => setTimeout(r, 1000));
    }

    setCountdown(0); // "CƯỜI LÊN NÀO!"

    // Trigger Flash & Shutter
    setShowFlash(true);
    if (soundEnabled) sounds.playShutterSound();

    // Capture frame based on selected source (REAL FRAME ONLY)
    let photoData = '';
    try {
      if (selectedDevice === 'phone-live-camera') {
        if (videoRef.current && (videoRef.current.videoWidth > 0 || videoRef.current.srcObject)) {
          photoData = await cameraService.captureFromVideoElement(videoRef.current, isMirrored);
        } else if (remoteStream) {
          photoData = await cameraService.captureFromMediaStream(remoteStream, isMirrored);
        } else if (realP2PService.getRemoteMediaStream()) {
          photoData = await cameraService.captureFromMediaStream(realP2PService.getRemoteMediaStream()!, isMirrored);
        } else if (phoneLiveFrame) {
          photoData = phoneLiveFrame;
        } else {
          photoData = await cameraService.captureFromPhoneStream();
        }
      } else if (isMock || selectedDevice === 'mock-camera') {
        photoData = await cameraService.getMockPhoto();
      } else if (videoRef.current && (videoRef.current.videoWidth > 0 || videoRef.current.srcObject)) {
        photoData = await cameraService.captureFromVideoElement(videoRef.current, isMirrored);
      } else {
        photoData = await cameraService.captureFromPhoneStream();
      }
    } catch (err: unknown) {
      console.error('Capture error:', err);
      const msg = err instanceof Error ? err.message : 'Lỗi khi chụp ảnh từ camera.';
      setCaptureError(msg);
      setIsShooting(false);
      setCountdown(null);
      setShowFlash(false);
      return;
    }

    const updated = [...capturedPhotos, photoData];
    setCapturedPhotos(updated);

    await new Promise((r) => setTimeout(r, 300));
    setShowFlash(false);
    setCountdown(null);
    setIsShooting(false);

    if (updated.length === requiredPhotos) {
      if (soundEnabled) sounds.playSuccessChime();
    }
  }, [isShooting, capturedPhotos, requiredPhotos, countdownSeconds, soundEnabled, selectedDevice, isMock, isMirrored, remoteStream, phoneLiveFrame]);

  // Retake last single shot (Undo)
  const handleRetakeLast = () => {
    if (capturedPhotos.length > 0 && !isShooting) {
      setCapturedPhotos((prev) => prev.slice(0, -1));
      setCaptureError(null);
    }
  };

  // Retake all shots from beginning
  const handleRetakeAll = () => {
    if (!isShooting) {
      setCapturedPhotos([]);
      setCaptureError(null);
      setCurrentShotIndex(0);
    }
  };

  // Listen to Bluetooth Remote Shutter and Keyboard Shutter (Space/Enter)
  useEffect(() => {
    if (!isOpen) return;

    const unsubShutter = bluetoothService.onShutterTrigger(() => {
      if (!isShooting) {
        if (capturedPhotos.length < requiredPhotos) {
          triggerNextShot();
        } else {
          handleFinish();
        }
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (!isShooting) {
          if (capturedPhotos.length < requiredPhotos) {
            triggerNextShot();
          } else {
            handleFinish();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubShutter();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isShooting, capturedPhotos.length, requiredPhotos, triggerNextShot]);

  // Initialize camera list
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    cameraService.getAvailableDevices().then((devs) => {
      if (!isMounted) return;
      setDevices(devs);
      if (initialMockMode) {
        setSelectedDevice('mock-camera');
        setIsMock(true);
      } else if (devs.length > 0) {
        setSelectedDevice(devs[0].deviceId);
      }
    });

    return () => {
      isMounted = false;
      cameraService.stopStream();
    };
  }, [isOpen, initialMockMode]);

  // Start stream when device changes
  useEffect(() => {
    if (!isOpen) return;

    if (selectedDevice === 'mock-camera') {
      setIsMock(true);
      cameraService.stopStream();
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      return;
    }

    if (selectedDevice === 'phone-live-camera') {
      setIsMock(false);
      cameraService.stopStream();
      if (videoRef.current) {
        if (remoteStream) {
          videoRef.current.srcObject = remoteStream;
          videoRef.current.play().catch(() => {});
        } else {
          videoRef.current.srcObject = null;
        }
      }
      return;
    }

    setIsMock(false);
    cameraService.startStream(selectedDevice).then((stream) => {
      streamRef.current = stream;
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    });

    return () => {
      cameraService.stopStream();
    };
  }, [selectedDevice, isOpen, remoteStream]);

  const handleFinish = () => {
    if (capturedPhotos.length > 0) {
      onPhotosCaptured(capturedPhotos);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Full screen White Flash Overlay */}
      {showFlash && (
        <div className="fixed inset-0 z-[100] bg-white animate-flash pointer-events-none" />
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[96vh] text-white">
        {/* Header - Mobile Responsive */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-3 bg-gray-900 border-b border-gray-800 gap-2.5">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-pink-500/20 text-pink-400 flex items-center justify-center shrink-0">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base sm:text-lg text-pink-400 font-cute leading-tight">
                  Phòng Chụp Photobooth
                </h2>
                <p className="text-[11px] sm:text-xs text-gray-400">
                  Chụp {requiredPhotos} kiểu ảnh liên tiếp (Đếm {countdownSeconds}s mỗi kiểu)
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="sm:hidden p-1.5 rounded-xl bg-gray-800 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-end">
            {/* Custom Countdown Selector (1s to 15s) */}
            <div className="flex items-center gap-1 bg-gray-800/90 border border-gray-700 px-2 py-1 rounded-xl text-xs">
              <Timer className="w-3.5 h-3.5 text-pink-400 shrink-0" />
              <span className="text-gray-400 text-[11px]">Hẹn giờ:</span>
              <button
                type="button"
                onClick={() => setCountdownSeconds((prev) => Math.max(1, prev - 1))}
                disabled={isShooting}
                className="w-5 h-5 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-bold text-pink-400 font-mono text-xs w-6 text-center">
                {countdownSeconds}s
              </span>
              <button
                type="button"
                onClick={() => setCountdownSeconds((prev) => Math.min(15, prev + 1))}
                disabled={isShooting}
                className="w-5 h-5 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Mirror Switch */}
            <button
              onClick={() => setIsMirrored(!isMirrored)}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                isMirrored ? 'border-pink-500 text-pink-400 bg-pink-500/10' : 'border-gray-700 text-gray-400'
              }`}
            >
              {isMirrored ? 'Lật Gương' : 'Góc Thực'}
            </button>

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 rounded-xl bg-gray-800 text-gray-300 hover:text-white"
              title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="hidden sm:block p-1.5 rounded-xl bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Toast if camera fails */}
        {captureError && (
          <div className="mx-4 mt-3 p-3 bg-rose-500/20 border border-rose-500/50 rounded-2xl flex items-center justify-between text-xs text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{captureError}</span>
            </div>
            <button onClick={() => setCaptureError(null)} className="text-rose-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Video Viewport - Mobile Responsive */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[280px] sm:min-h-[420px]">
          {/* CASE 1: PHONE / MAC WIRELESS LIVE STREAM */}
          {selectedDevice === 'phone-live-camera' ? (
            remoteStream ? (
              <div className="w-full h-full max-h-[55vh] sm:max-h-[60vh] flex items-center justify-center relative">
                <video
                  ref={(el) => {
                    videoRef.current = el;
                    if (el && remoteStream && el.srcObject !== remoteStream) {
                      el.srcObject = remoteStream;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full max-h-[55vh] sm:max-h-[60vh] object-cover sm:object-contain transition-transform duration-200 ${
                    isMirrored ? 'scale-x-[-1]' : ''
                  }`}
                />
                <div className="absolute top-3 left-3 bg-emerald-500/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold flex items-center gap-1.5 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>LIVE: CAMERA TỪ MÁY MAC PRO (60FPS)</span>
                </div>
              </div>
            ) : phoneLiveFrame ? (
              <div className="w-full h-full max-h-[55vh] sm:max-h-[60vh] flex items-center justify-center relative">
                <img
                  src={phoneLiveFrame}
                  alt="Remote Live Stream"
                  className={`w-full h-full max-h-[55vh] sm:max-h-[60vh] object-cover sm:object-contain transition-transform duration-200 ${
                    isMirrored ? 'scale-x-[-1]' : ''
                  }`}
                />
                <div className="absolute top-3 left-3 bg-emerald-500/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold flex items-center gap-1.5 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>LIVE: CAMERA TỪ MÁY MAC PRO (P2P Stream)</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-full max-h-[55vh] sm:max-h-[60vh] flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-gray-900 via-purple-950/60 to-gray-900">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-purple-500/20 border-2 border-purple-500 flex items-center justify-center animate-bounce mb-3 text-purple-400">
                  <Camera className="w-8 h-8 sm:w-10 sm:h-10" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white mb-1 font-cute">
                  Đang Chờ Tín Hiệu Camera Từ Máy Mac Pro...
                </h3>
                <p className="text-xs text-gray-300 max-w-md mb-3">
                  Trên máy Mac Pro, mở link <strong>http://localhost:5173/?mode=remote</strong> và bấm nút <strong>"Bật Phát Camera Live"</strong> để truyền hình ảnh camera của máy Mac sang iPhone!
                </p>
                <div className="text-[11px] font-mono bg-purple-950/80 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full">
                  Phòng kết nối: {realP2PService.getRoomId()}
                </div>
              </div>
            )
          ) : !isMock ? (
            /* CASE 2: REGULAR DEVICE CAMERA (IPHONE CAM / WEBCAM) */
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full max-h-[55vh] sm:max-h-[60vh] object-cover sm:object-contain transition-transform duration-200 ${
                isMirrored ? 'scale-x-[-1]' : ''
              }`}
            />
          ) : (
            /* CASE 3: MOCK STUDIO CAMERA */
            <div className="w-full h-full max-h-[55vh] sm:max-h-[60vh] flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-gray-900 via-purple-950 to-gray-900">
              <div className="w-20 h-20 rounded-full bg-pink-500/20 border-2 border-pink-500 flex items-center justify-center animate-pulse mb-3">
                <Sparkles className="w-10 h-10 text-pink-400" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mb-1 font-cute">
                Chế độ Giả lập Camera Studio (Mock LiveView)
              </h3>
              <p className="text-xs sm:text-sm text-gray-300 max-w-md">
                Khi bấm "Bắt đầu chụp", hệ thống sẽ tự động tạo {requiredPhotos} ảnh mẫu chân dung studio sắc nét cho bạn!
              </p>
            </div>
          )}

          {/* Countdown & Guide Overlay */}
          {countdown !== null && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
              <span className="text-xs sm:text-sm font-semibold tracking-widest text-pink-300 uppercase mb-2">
                Kiểu số {currentShotIndex} / {requiredPhotos}
              </span>
              <div className="text-7xl sm:text-9xl font-extrabold text-white animate-ping font-cute">
                {countdown === 0 ? '✨ SMILE! ✨' : countdown}
              </div>
              <p className="text-pink-200 font-medium mt-4 text-xs sm:text-sm bg-pink-900/70 px-4 py-1.5 rounded-full">
                {countdown === 0 ? 'Đang bấm máy...' : `Giữ dáng xinh (${countdown}s)...`}
              </p>
            </div>
          )}

          {/* Bottom Thumbnails preview strip */}
          {capturedPhotos.length > 0 && (
            <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-center gap-2 pointer-events-none overflow-x-auto">
              {capturedPhotos.map((photo, idx) => (
                <div
                  key={idx}
                  className="w-12 h-16 sm:w-16 sm:h-20 rounded-xl overflow-hidden border-2 border-pink-400 shadow-lg bg-black shrink-0"
                >
                  <img src={photo} alt={`Shot ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Controls - Mobile Responsive */}
        <div className="px-4 sm:px-6 py-3 bg-gray-900 border-t border-gray-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Camera Selector Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 shrink-0">Nguồn Camera:</span>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              disabled={isShooting}
              className="flex-1 sm:flex-none max-w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-pink-500 font-semibold truncate"
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            {capturedPhotos.length > 0 && capturedPhotos.length < requiredPhotos && !isShooting && (
              <button
                onClick={handleRetakeLast}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium text-xs transition-all"
                title="Chụp lại kiểu ảnh vừa rồi"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Chụp lại kiểu {capturedPhotos.length}</span>
              </button>
            )}

            {capturedPhotos.length === requiredPhotos ? (
              <>
                <button
                  onClick={handleRetakeLast}
                  disabled={isShooting}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium text-xs sm:text-sm transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Chụp lại kiểu cuối</span>
                </button>
                <button
                  onClick={handleRetakeAll}
                  disabled={isShooting}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium text-xs sm:text-sm transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Chụp lại tất cả</span>
                </button>
                <button
                  onClick={handleFinish}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-900/40 transition-all hover:scale-105 active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Dùng {capturedPhotos.length} ảnh này & Xong</span>
                </button>
              </>
            ) : (
              <button
                onClick={triggerNextShot}
                disabled={isShooting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 sm:px-8 py-3 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-pink-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-pink-900/50 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                <Camera className="w-5 h-5" />
                <span>
                  {isShooting
                    ? `Đang chụp kiểu ${currentShotIndex}/${requiredPhotos}...`
                    : `Chụp Kiểu ${capturedPhotos.length + 1} / ${requiredPhotos} (${countdownSeconds}s)`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
