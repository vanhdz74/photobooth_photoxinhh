import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  X,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Volume2,
  VolumeX,
  Timer,
  AlertCircle,
  Wifi,
  Settings,
  Usb,
  Folder,
  FolderOpen,
  Maximize2,
  Minimize2,
  RotateCcw,
  Zap,
  ChevronLeft,
  ChevronRight,
  Eye,
  Upload,
} from 'lucide-react';
import { cameraService, CameraDevice } from '../services/cameraService';
import { bluetoothService } from '../services/bluetoothService';
import { realP2PService } from '../services/realP2PService';
import { sonyCameraService, SonyCameraInfo } from '../services/sonyCameraService';
import { hotFolderService, HotFolderStatus } from '../services/hotFolderService';
import { sonyMultiService, SonyMultiStatus } from '../services/sonyMultiService';
import { sounds } from '../utils/audio';
import { safeGetItem, safeSetItem } from '../utils/safeStorage';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredPhotos: number;
  onPhotosCaptured: (photos: string[]) => void;
  isMockMode: boolean;
  onMockModeChange?: (isMock: boolean) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  requiredPhotos,
  onPhotosCaptured,
  isMockMode: initialMockMode,
  onMockModeChange,
}) => {
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>(() => {
    return safeGetItem('photobooth_selected_camera_id') || '';
  });
  const [isMock, setIsMock] = useState<boolean>(() => {
    const saved = safeGetItem('photobooth_is_mock_camera');
    if (saved !== null) return saved === 'true';
    return initialMockMode;
  });
  const [phoneLiveFrame, setPhoneLiveFrame] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [sonyLiveFrame, setSonyLiveFrame] = useState<string | null>(null);
  const [sonyInfo, setSonyInfo] = useState<SonyCameraInfo>(sonyCameraService.getStatusInfo());
  const [sonyIpInput, setSonyIpInput] = useState<string>(sonyCameraService.getCameraIp());
  const [isTestingSony, setIsTestingSony] = useState(false);
  const [sonyTestFeedback, setSonyTestFeedback] = useState<string | null>(null);
  const [isScanningUsb, setIsScanningUsb] = useState(false);
  const [usbFeedback, setUsbFeedback] = useState<string | null>(null);
  const [showSonySettings, setShowSonySettings] = useState(false);

  // Sony Imaging Edge Hot Folder States
  const [hotFolderStatus, setHotFolderStatus] = useState<HotFolderStatus>(hotFolderService.getStatus());
  const [isWaitingHotFolder, setIsWaitingHotFolder] = useState(false);
  const [isTestingShutter, setIsTestingShutter] = useState(false);
  const [hotFolderFeedback, setHotFolderFeedback] = useState<string | null>(null);
  const [showHotFolderSettings, setShowHotFolderSettings] = useState(false);
  const [showSonyMultiSettings, setShowSonyMultiSettings] = useState(false);
  const [sonyMultiStatus, setSonyMultiStatus] = useState<SonyMultiStatus>(sonyMultiService.getStatus());
  const [sonyMultiFeedback, setSonyMultiFeedback] = useState<string | null>(null);
  const [isCapturingCameraPhoto, setIsCapturingCameraPhoto] = useState(false);

  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState<number | null>(null); // Enlarged Photo Inspector
  const [retakeTargetIndex, setRetakeTargetIndex] = useState<number | null>(null); // Replace specific shot

  // Capture Modes & Custom Countdown with Persistence
  const [countdownSeconds, setCountdownSecondsState] = useState<number>(() => {
    const saved = safeGetItem('photobooth_countdown_seconds');
    return saved ? parseInt(saved, 10) || 3 : 3;
  });
  const setCountdownSeconds = (sec: number) => {
    setCountdownSecondsState(sec);
    safeSetItem('photobooth_countdown_seconds', String(sec));
  };

  const [isAutoSeries, setIsAutoSeriesState] = useState<boolean>(() => {
    const saved = safeGetItem('photobooth_is_auto_series');
    return saved !== null ? saved === 'true' : true;
  });
  const setIsAutoSeries = (val: boolean) => {
    setIsAutoSeriesState(val);
    safeSetItem('photobooth_is_auto_series', String(val));
  };

  const [fitMode, setFitModeState] = useState<'cover' | 'contain'>(() => {
    const saved = safeGetItem('photobooth_fit_mode_v3');
    if (saved === 'contain' || saved === 'cover') return saved;
    // Default to 'cover' so camera preview is large and fills the screen
    safeSetItem('photobooth_fit_mode_v3', 'cover');
    return 'cover';
  });
  const setFitMode = (val: 'cover' | 'contain') => {
    setFitModeState(val);
    safeSetItem('photobooth_fit_mode_v3', val);
  };

  const [zoomLevel, setZoomLevelState] = useState<number>(() => {
    const saved = safeGetItem('photobooth_camera_zoom');
    return saved ? parseFloat(saved) || 1.0 : 1.0;
  });
  const setZoomLevel = (val: number) => {
    setZoomLevelState(val);
    safeSetItem('photobooth_camera_zoom', String(val));
  };

  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    const saved = safeGetItem('photobooth_sound_enabled');
    return saved !== null ? saved === 'true' : true;
  });
  const setSoundEnabled = (val: boolean) => {
    setSoundEnabledState(val);
    safeSetItem('photobooth_sound_enabled', String(val));
  };

  const [isMirrored, setIsMirroredState] = useState<boolean>(() => {
    const saved = safeGetItem('photobooth_is_mirrored');
    return saved !== null ? saved === 'true' : false;
  });
  const setIsMirrored = (val: boolean) => {
    setIsMirroredState(val);
    safeSetItem('photobooth_is_mirrored', String(val));
  };

  const [isShooting, setIsShooting] = useState<boolean>(false);
  const [currentShotIndex, setCurrentShotIndex] = useState<number>(1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [breakCountdown, setBreakCountdown] = useState<number | null>(null);
  const [showFlash, setShowFlash] = useState<boolean>(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sonyImgRef = useRef<HTMLImageElement | null>(null);
  const isCancelledRef = useRef<boolean>(false);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);
  const sonySdCardInputRef = useRef<HTMLInputElement>(null);

  // Upload photos directly from device inside the camera modal
  const handleDeviceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    const readPromises = files.slice(0, requiredPhotos).map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve((ev.target?.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    });

    const urls = (await Promise.all(readPromises)).filter(Boolean);
    if (urls.length > 0) {
      setCapturedPhotos(urls);
      sounds.playSuccessChime();
    }
    if (fileUploadInputRef.current) fileUploadInputRef.current.value = '';
  };

  // Import raw high-res photos from Sony SD Card (Mass Storage / DCIM folder)
  const handleSdCardImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    const readPromises = files.slice(0, requiredPhotos).map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve((ev.target?.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    });

    const urls = (await Promise.all(readPromises)).filter(Boolean);
    if (urls.length > 0) {
      setCapturedPhotos((prev) => {
        const merged = [...prev, ...urls].slice(0, requiredPhotos);
        return merged;
      });
      if (soundEnabled) sounds.playSuccessChime();
      setSonyMultiFeedback(`✅ Đã nạp thành công ${urls.length} ảnh gốc từ thẻ nhớ Sony!`);
    }
    if (sonySdCardInputRef.current) sonySdCardInputRef.current.value = '';
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent any document/body/html scrolling while modal is open - rigid 1-screen lock
  useEffect(() => {
    if (!isOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyTouchAction = document.body.style.touchAction;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.touchAction = originalBodyTouchAction;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [isOpen]);

  // Subscribe to Hot Folder Status
  useEffect(() => {
    if (!isOpen) return;

    const unsubHotFolder = hotFolderService.onStatusChange((status) => {
      setHotFolderStatus(status);
    });

    return () => {
      unsubHotFolder();
    };
  }, [isOpen]);

  // Subscribe to Sony Multi Terminal Status & USB PTP Photos
  useEffect(() => {
    if (!isOpen) return;
    sonyMultiService.checkNativeUsbDevices();
    const unsub = sonyMultiService.onStatusChange((st) => {
      setSonyMultiStatus(st);
      if (st.isUsbConnected && (!selectedDevice || selectedDevice === 'mock-camera')) {
        setSelectedDevice('sony-multi-camera');
        safeSetItem('photobooth_selected_camera_id', 'sony-multi-camera');
      }
    });
    const unsubPhoto = sonyMultiService.onPhotoCaptured((photoUrl, fileName) => {
      console.log('⚡️ [Sony Multi Photo Captured via External Trigger]:', fileName);
      setCapturedPhotos((prev) => {
        if (prev.length < requiredPhotos) {
          const next = [...prev, photoUrl];
          if (next.length === requiredPhotos && soundEnabled) {
            sounds.playSuccessChime();
          }
          return next;
        }
        return prev;
      });
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 120);
      if (soundEnabled) sounds.playShutterSound();
    });
    return () => {
      unsub();
      unsubPhoto();
    };
  }, [isOpen, requiredPhotos, soundEnabled]);

  // Subscribe to Sony Camera Frame & Status
  useEffect(() => {
    if (!isOpen) return;

    const unsubSonyFrame = sonyCameraService.onLiveviewFrame((frameUrl) => {
      setSonyLiveFrame(frameUrl);
      if (sonyImgRef.current) {
        sonyImgRef.current.src = frameUrl;
      }
    });

    const unsubSonyStatus = sonyCameraService.onStatusChange((info) => {
      setSonyInfo(info);
    });

    return () => {
      unsubSonyFrame();
      unsubSonyStatus();
    };
  }, [isOpen]);

  // Subscribe to Phone Live Camera Frame stream & WebRTC MediaStream
  useEffect(() => {
    if (!isOpen) return;

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

  // Helper wait function
  const waitMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Run Countdown (smooth non-disappearing numbers)
  const runCountdownSequence = async (seconds: number): Promise<boolean> => {
    for (let c = seconds; c > 0; c--) {
      if (isCancelledRef.current) return false;
      setCountdown(c);
      if (soundEnabled) sounds.playCountdownBeep(c === 1);
      await waitMs(1000);
    }
    if (isCancelledRef.current) return false;
    setCountdown(0);
    return true;
  };

  // Capture single frame from active source without blocking
  const captureCurrentFrame = async (): Promise<string> => {
    let photoData = '';
    const containerBox =
      fitMode === 'cover' && videoRef.current?.parentElement
        ? {
            width: videoRef.current.parentElement.clientWidth,
            height: videoRef.current.parentElement.clientHeight,
          }
        : null;

    if (selectedDevice === 'hot-folder-camera') {
      setIsWaitingHotFolder(true);
      try {
        photoData = await cameraService.captureFromHotFolder();
      } catch (hotErr: any) {
        if (videoRef.current && (videoRef.current.videoWidth > 0 || videoRef.current.srcObject)) {
          console.warn('[Hot Folder Fallback] Failed to get high-res photo from camera folder:', hotErr);
          setCaptureError('⚠️ Không nhận được ảnh gốc từ Canon/Sony Hot Folder (Hết thời gian chờ). Đang chụp tạm từ LiveView nên ảnh có thể bị mờ!');
          photoData = await cameraService.captureFromVideoElement(videoRef.current, isMirrored, containerBox, zoomLevel);
        } else {
          throw hotErr;
        }
      } finally {
        setIsWaitingHotFolder(false);
      }
    } else if (selectedDevice === 'sony-wifi-camera') {
      photoData = await cameraService.captureFromSonyCamera();
    } else if (selectedDevice === 'sony-multi-camera') {
      try {
        // Trigger camera and await high-resolution photo from camera
        photoData = await sonyMultiService.triggerAndCapturePhoto(
          7000,
          async () => {
            let rawPhoto = '';
            if (videoRef.current && videoRef.current.videoWidth > 0) {
              try {
                rawPhoto = await cameraService.captureFromVideoElement(videoRef.current, isMirrored, containerBox, zoomLevel);
              } catch {}
            }
            if (!rawPhoto && sonyLiveFrame) {
              rawPhoto = sonyLiveFrame;
            }
            if (!rawPhoto) {
              rawPhoto = await cameraService.getMockPhoto();
            }
            try {
              return await sonyMultiService.enhanceImageSharpness(rawPhoto);
            } catch {
              return rawPhoto;
            }
          }
        );
        setCaptureError(null);
      } catch (err: any) {
        console.warn('Sony multi capture error, falling back:', err);
        setCaptureError(err?.message || 'Lỗi chụp từ cổng Multi');
        let rawPhoto = '';
        if (videoRef.current && videoRef.current.videoWidth > 0) {
          try {
            rawPhoto = await cameraService.captureFromVideoElement(videoRef.current, isMirrored, containerBox, zoomLevel);
          } catch {}
        }
        if (!rawPhoto && sonyLiveFrame) {
          rawPhoto = sonyLiveFrame;
        }
        if (!rawPhoto) {
          rawPhoto = await cameraService.getMockPhoto();
        }
        photoData = rawPhoto;
      }
    } else if (selectedDevice === 'phone-live-camera') {
      if (videoRef.current && (videoRef.current.videoWidth > 0 || videoRef.current.srcObject)) {
        photoData = await cameraService.captureFromVideoElement(videoRef.current, isMirrored, containerBox, zoomLevel);
      } else if (remoteStream) {
        photoData = await cameraService.captureFromMediaStream(remoteStream, isMirrored, containerBox, zoomLevel);
      } else if (realP2PService.getRemoteMediaStream()) {
        photoData = await cameraService.captureFromMediaStream(realP2PService.getRemoteMediaStream()!, isMirrored, containerBox, zoomLevel);
      } else if (phoneLiveFrame) {
        photoData = phoneLiveFrame;
      } else {
        photoData = await cameraService.captureFromPhoneStream();
      }
    } else if (isMock || selectedDevice === 'mock-camera') {
      photoData = await cameraService.getMockPhoto();
    } else if (videoRef.current && (videoRef.current.videoWidth > 0 || videoRef.current.srcObject)) {
      photoData = await cameraService.captureFromVideoElement(videoRef.current, isMirrored, containerBox, zoomLevel);
    } else {
      photoData = await cameraService.captureFromPhoneStream();
    }
    return photoData;
  };

  // Single shot execution with smooth flash and immediate frame save
  const executeSingleShot = async (currentPhotosList: string[]): Promise<string | null> => {
    const nextIndex = retakeTargetIndex !== null ? retakeTargetIndex + 1 : currentPhotosList.length + 1;
    setCurrentShotIndex(nextIndex);

    // 1. Run Countdown
    const countdownFinished = await runCountdownSequence(countdownSeconds);
    if (!countdownFinished || isCancelledRef.current) return null;

    // 2. Trigger snappy flash and shutter sound
    setShowFlash(true);
    if (soundEnabled) sounds.playShutterSound();

    let photoData = '';
    try {
      setIsCapturingCameraPhoto(true);
      photoData = await captureCurrentFrame();
    } catch (err: unknown) {
      console.error('Capture error:', err);
      const msg = err instanceof Error ? err.message : 'Lỗi khi chụp ảnh từ camera.';
      setCaptureError(msg);
      setShowFlash(false);
      setCountdown(null);
      return null;
    } finally {
      setIsCapturingCameraPhoto(false);
    }

    // Snappy flash reset (120ms) - feels instant and avoids lag
    setTimeout(() => {
      setShowFlash(false);
    }, 120);
    setCountdown(null);

    return photoData;
  };

  // Primary capture handler: supports Auto Continuous Series, Single Shot, and Specific Slot Retake
  const startCaptureProcess = useCallback(async () => {
    if (isShooting || (capturedPhotos.length >= requiredPhotos && retakeTargetIndex === null)) return;
    setCaptureError(null);
    isCancelledRef.current = false;

    // Validation before shooting
    if (selectedDevice === 'phone-live-camera') {
      const activeStream = remoteStream || realP2PService.getRemoteMediaStream();
      const activeFrame = phoneLiveFrame || realP2PService.getLatestPhoneFrame();
      if (!activeStream && !activeFrame) {
        setCaptureError('Chưa nhận được hình ảnh camera. Vui lòng bấm "Bật Phát Camera Live" trên máy phát trước khi chụp!');
        sounds.playBluetoothDisconnect();
        return;
      }
    } else if (selectedDevice === 'sony-wifi-camera') {
      if (!sonyInfo.connected) {
        const test = await sonyCameraService.testConnection();
        if (!test.success) {
          setCaptureError(test.error || 'Chưa kết nối máy ảnh Sony. Vui lòng kiểm tra Wi-Fi máy ảnh!');
          return;
        }
      }
    } else if (
      !isMock &&
      selectedDevice !== 'hot-folder-camera' &&
      selectedDevice !== 'sony-multi-camera' &&
      !streamRef.current &&
      !videoRef.current?.videoWidth
    ) {
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

    // CASE A: Retaking a single specific slot
    if (retakeTargetIndex !== null) {
      try {
        const newPhoto = await executeSingleShot(capturedPhotos);
        if (newPhoto && !isCancelledRef.current) {
          setCapturedPhotos((prev) => {
            const next = [...prev];
            next[retakeTargetIndex] = newPhoto;
            return next;
          });
          setRetakeTargetIndex(null);
          if (soundEnabled) sounds.playSuccessChime();
        }
      } finally {
        setIsShooting(false);
        setCountdown(null);
        setShowFlash(false);
      }
      return;
    }

    // CASE B: Normal shooting (either continuous auto series or single shot)
    let currentList = [...capturedPhotos];

    try {
      while (currentList.length < requiredPhotos && !isCancelledRef.current) {
        const photo = await executeSingleShot(currentList);
        if (!photo || isCancelledRef.current) break;

        currentList = [...currentList, photo];
        setCapturedPhotos([...currentList]);

        // If auto mode and more photos needed: take a 2-second pose break
        if (currentList.length < requiredPhotos && isAutoSeries && !isCancelledRef.current) {
          setBreakCountdown(2);
          await waitMs(1000);
          if (isCancelledRef.current) break;
          setBreakCountdown(1);
          await waitMs(1000);
          if (isCancelledRef.current) break;
          setBreakCountdown(null);
        } else {
          // Manual mode: stop after 1 shot and let user pose and click next
          break;
        }
      }

      if (currentList.length === requiredPhotos) {
        if (soundEnabled) sounds.playSuccessChime();
      }
    } finally {
      setIsShooting(false);
      setCountdown(null);
      setBreakCountdown(null);
      setShowFlash(false);
    }
  }, [
    isShooting,
    capturedPhotos,
    requiredPhotos,
    retakeTargetIndex,
    countdownSeconds,
    isAutoSeries,
    soundEnabled,
    selectedDevice,
    isMock,
    isMirrored,
    remoteStream,
    phoneLiveFrame,
    sonyInfo.connected,
    zoomLevel,
  ]);

  // Cancel / Pause shooting
  const handleCancelShooting = () => {
    isCancelledRef.current = true;
    setIsShooting(false);
    setCountdown(null);
    setBreakCountdown(null);
    setShowFlash(false);
    setRetakeTargetIndex(null);
  };

  // Retake last single shot (Undo)
  const handleRetakeLast = () => {
    if (capturedPhotos.length > 0 && !isShooting) {
      setCapturedPhotos((prev) => prev.slice(0, -1));
      setCaptureError(null);
      setRetakeTargetIndex(null);
    }
  };

  // Retake all shots from beginning
  const handleRetakeAll = () => {
    if (!isShooting) {
      setCapturedPhotos([]);
      setCaptureError(null);
      setCurrentShotIndex(1);
      setRetakeTargetIndex(null);
      setPreviewPhotoIndex(null);
    }
  };

  // Finish and return captured photos
  const handleFinish = () => {
    if (capturedPhotos.length > 0) {
      onPhotosCaptured(capturedPhotos);
      onClose();
    }
  };

  // Select camera device and persist choice across sessions
  const selectDeviceAndPersist = useCallback(
    (deviceId: string, currentDevs?: CameraDevice[]) => {
      setSelectedDevice(deviceId);
      const mockFlag = deviceId === 'mock-camera';
      setIsMock(mockFlag);
      onMockModeChange?.(mockFlag);

      safeSetItem('photobooth_selected_camera_id', deviceId);
      safeSetItem('photobooth_is_mock_camera', mockFlag ? 'true' : 'false');

      const list = currentDevs && currentDevs.length > 0 ? currentDevs : devices;
      const found = list.find((d) => d.deviceId === deviceId);
      if (found) {
        safeSetItem('photobooth_selected_camera_label', found.label);
      }
    },
    [devices, onMockModeChange]
  );

  // Cycle to next available camera
  const cycleNextCamera = () => {
    if (devices.length <= 1 || isShooting) return;
    const currentIndex = devices.findIndex((d) => d.deviceId === selectedDevice);
    const nextIndex = (currentIndex + 1) % devices.length;
    selectDeviceAndPersist(devices[nextIndex].deviceId);
  };

  // Handle 1-click scan and connect to USB Capture Card / Sony Camera
  const handleScanUsb = async () => {
    setIsScanningUsb(true);
    setUsbFeedback(null);
    setCaptureError(null);

    try {
      const updatedDevices = await cameraService.requestPermissionAndGetDevices();
      setDevices(updatedDevices);

      const usbDev = cameraService.findFirstUsbDevice(updatedDevices);
      if (usbDev) {
        selectDeviceAndPersist(usbDev.deviceId, updatedDevices);
        setUsbFeedback(`✅ ĐÃ TÌM THẤY MÁY ẢNH USB: ${usbDev.rawLabel || usbDev.label}`);
      } else if (sonyMultiService.getStatus().isUsbConnected) {
        selectDeviceAndPersist('sony-multi-camera', updatedDevices);
        setUsbFeedback(`✅ ĐÃ TÌM THẤY MÁY ẢNH SONY USB: ${sonyMultiService.getStatus().connectedDeviceName || 'Sony ILCE-6400'}`);
      } else {
        sonyMultiService.checkNativeUsbDevices();
        setUsbFeedback('⚠️ Chưa nhận diện được thiết bị USB Capture Card hoặc máy ảnh Sony.');
      }
    } catch (err: any) {
      setUsbFeedback(`❌ Lỗi quét USB: ${err?.message || 'Không thể truy cập camera'}`);
    } finally {
      setIsScanningUsb(false);
    }
  };

  // Initialize camera list and restore saved camera choice
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    cameraService.requestPermissionAndGetDevices().then((devs) => {
      if (!isMounted) return;
      setDevices(devs);

      // Check saved camera preference from safeStorage
      const savedCameraId = safeGetItem('photobooth_selected_camera_id');
      const savedCameraLabel = safeGetItem('photobooth_selected_camera_label');

      let deviceToSelect: string | null = null;
      const specialIds = ['mock-camera', 'sony-wifi-camera', 'hot-folder-camera', 'phone-live-camera'];

      // 1. If saved ID is a virtual special camera
      if (savedCameraId && specialIds.includes(savedCameraId)) {
        deviceToSelect = savedCameraId;
      }
      // 2. If saved ID matches a hardware camera
      else if (savedCameraId && devs.some((d) => d.deviceId === savedCameraId)) {
        deviceToSelect = savedCameraId;
      }
      // 3. If device ID changed (e.g. browser restart), match by label
      else if (savedCameraLabel) {
        const matchedByLabel = devs.find(
          (d) => d.label === savedCameraLabel || (d.rawLabel && d.rawLabel === savedCameraLabel)
        );
        if (matchedByLabel) {
          deviceToSelect = matchedByLabel.deviceId;
        }
      }

      // 4. Fallback if no valid saved camera found
      if (!deviceToSelect) {
        if (initialMockMode) {
          deviceToSelect = 'mock-camera';
        } else {
          const usbDev = cameraService.findFirstUsbDevice(devs);
          if (usbDev) {
            deviceToSelect = usbDev.deviceId;
          } else if (devs.length > 0) {
            deviceToSelect = devs[0].deviceId;
          }
        }
      }

      if (deviceToSelect) {
        selectDeviceAndPersist(deviceToSelect, devs);
      }
    });

    return () => {
      isMounted = false;
      cameraService.stopStream();
      sonyCameraService.stopLiveview().catch(() => {});
    };
  }, [isOpen]);

  // Start stream when device changes
  useEffect(() => {
    if (!isOpen || !selectedDevice) return;

    if (selectedDevice === 'mock-camera') {
      setIsMock(true);
      cameraService.stopStream();
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      return;
    }

    if (selectedDevice === 'sony-wifi-camera') {
      setIsMock(false);
      cameraService.stopStream();
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (sonyCameraService.isConnected()) {
        sonyCameraService.startLiveview().catch(() => {});
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
    if (selectedDevice === 'sony-multi-camera') {
      sonyMultiService.startUsbLiveview();
    }
    cameraService.startStream(selectedDevice).then((stream) => {
      streamRef.current = stream;
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    });

    return () => {
      cameraService.stopStream();
      if (selectedDevice === 'sony-wifi-camera') {
        sonyCameraService.stopLiveview().catch(() => {});
      }
      if (selectedDevice === 'sony-multi-camera') {
        sonyMultiService.stopUsbLiveview();
      }
    };
  }, [selectedDevice, isOpen, remoteStream]);

  // Listen to Bluetooth Remote Shutter, Keyboard Space / Enter, and Escape
  useEffect(() => {
    if (!isOpen) return;

    const unsubShutter = bluetoothService.onShutterTrigger(() => {
      if (!isShooting) {
        if (capturedPhotos.length < requiredPhotos || retakeTargetIndex !== null) {
          startCaptureProcess();
        } else {
          handleFinish();
        }
      }
    });

    const unsubP2P = realP2PService.onMessage((msg) => {
      if (msg.type === 'SHUTTER_TRIGGER') {
        if (!isShooting) {
          if (capturedPhotos.length < requiredPhotos || retakeTargetIndex !== null) {
            startCaptureProcess();
          } else {
            handleFinish();
          }
        }
      } else if (msg.type === 'PHOTO_TRANSFER' && msg.payload?.photoDataUrl) {
        setCapturedPhotos((prev) => {
          if (prev.length < requiredPhotos) {
            const next = [...prev, msg.payload.photoDataUrl];
            if (next.length === requiredPhotos && soundEnabled) {
              sounds.playSuccessChime();
            }
            return next;
          }
          return prev;
        });
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 120);
        if (soundEnabled) sounds.playShutterSound();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (previewPhotoIndex !== null) {
          setPreviewPhotoIndex(null);
        } else if (!isShooting) {
          if (capturedPhotos.length < requiredPhotos || retakeTargetIndex !== null) {
            startCaptureProcess();
          } else {
            handleFinish();
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (previewPhotoIndex !== null) {
          setPreviewPhotoIndex(null);
        } else if (isShooting) {
          handleCancelShooting();
        } else if (retakeTargetIndex !== null) {
          setRetakeTargetIndex(null);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubShutter();
      unsubP2P();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isShooting, capturedPhotos.length, requiredPhotos, retakeTargetIndex, previewPhotoIndex, startCaptureProcess, onClose]);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] bg-black text-white w-full h-full h-[100dvh] max-h-[100dvh] overflow-hidden overscroll-none select-none animate-in fade-in duration-150"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        touchAction: 'none',
        overscrollBehavior: 'none',
      }}
    >
      {/* 0. Full screen White Flash Overlay (Snappy 120ms) */}
      {showFlash && (
        <div className="fixed inset-0 z-[10002] bg-white animate-flash pointer-events-none" />
      )}

      {/* 1. TOP HEADER BAR (FLOATING TRANSLUCENT HUD) */}
      <header
        onClick={(e) => e.stopPropagation()}
        className="absolute top-0 inset-x-0 z-30 bg-gradient-to-b from-black/90 via-black/50 to-transparent px-3 sm:px-6 pt-2.5 pb-5 flex items-center justify-between gap-2.5 pointer-events-none"
      >
        {/* Left: Photobooth Info & Progress Badges */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white flex items-center justify-center shrink-0 shadow-lg border border-white/20">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-xs sm:text-base text-white font-cute leading-tight flex items-center gap-2 drop-shadow">
              <span>Phòng Chụp Photobooth</span>
              <span className="text-[10px] bg-pink-500 text-white px-2 py-0.5 rounded-full font-sans font-bold shadow-xs">
                {capturedPhotos.length}/{requiredPhotos} Kiểu
              </span>
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              {Array.from({ length: requiredPhotos }).map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${
                    idx < capturedPhotos.length
                      ? 'w-5 sm:w-6 bg-pink-400 shadow-xs'
                      : idx === capturedPhotos.length && isShooting
                      ? 'w-5 sm:w-6 bg-white animate-pulse'
                      : 'w-2 bg-white/40'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Center: Retake indicator banner if active */}
        {retakeTargetIndex !== null && (
          <div className="bg-pink-600/90 text-white px-3 py-1 rounded-full text-xs font-bold border border-white/30 flex items-center gap-1.5 shadow-md animate-pulse pointer-events-auto">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Đang chụp lại kiểu #{retakeTargetIndex + 1}</span>
            <button
              type="button"
              onClick={() => setRetakeTargetIndex(null)}
              className="ml-1 text-white hover:text-amber-200"
            >
              ✕
            </button>
          </div>
        )}

        {/* Right: Quick Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          {/* Quick Timer Selector (1s, 2s, 3s, 5s) */}
          <div className="flex items-center bg-black/60 border border-white/20 rounded-xl p-0.5 gap-0.5 backdrop-blur-md">
            <Timer className="w-3.5 h-3.5 text-pink-400 ml-1.5 shrink-0 hidden sm:block" />
            {[1, 2, 3, 5].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setCountdownSeconds(sec)}
                disabled={isShooting}
                className={`py-1 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  countdownSeconds === sec
                    ? 'bg-pink-600 text-white shadow-md'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
                title={`Hẹn giờ đếm ngược ${sec} giây`}
              >
                {sec}s
              </button>
            ))}
          </div>

          {/* Auto Continuous Series Toggle */}
          <button
            type="button"
            onClick={() => setIsAutoSeries(!isAutoSeries)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 shadow-md backdrop-blur-md ${
              isAutoSeries
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 border-pink-400 text-white'
                : 'bg-black/60 border-white/20 text-gray-300 hover:text-white'
            }`}
            title="Tự động chụp liên tiếp các kiểu với thời gian đổi dáng 2s"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">{isAutoSeries ? 'Tự Động' : 'Thủ Công'}</span>
          </button>

          {/* Mirror Toggle */}
          <button
            type="button"
            onClick={() => setIsMirrored(!isMirrored)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-md backdrop-blur-md ${
              isMirrored
                ? 'bg-pink-600/80 border-pink-400 text-white'
                : 'bg-black/60 border-white/20 text-gray-300 hover:text-white'
            }`}
            title="Lật gương để ngắm ảnh tự nhiên như nhìn gương"
          >
            {isMirrored ? 'Lật Gương' : 'Góc Thực'}
          </button>

          {/* Fit Toggle (Cover vs Contain) */}
          <button
            type="button"
            onClick={() => setFitMode(fitMode === 'cover' ? 'contain' : 'cover')}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-md flex items-center gap-1.5 backdrop-blur-md ${
              fitMode === 'cover'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 border-pink-400 text-white ring-2 ring-pink-500/40'
                : 'bg-black/60 border-white/20 text-gray-300 hover:text-white'
            }`}
            title={
              fitMode === 'cover'
                ? 'Đang ở chế độ Tràn Viền (Toàn màn hình) - Bấm để chuyển sang Xem đủ góc'
                : 'Đang ở chế độ Đủ Góc (Toàn khung) - Bấm để chuyển sang Tràn viền'
            }
          >
            {fitMode === 'cover' ? <Maximize2 className="w-3.5 h-3.5 text-amber-300" /> : <Minimize2 className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{fitMode === 'cover' ? 'Tràn Viền' : 'Đủ Góc'}</span>
          </button>

          {/* Quick Zoom in Header */}
          <button
            type="button"
            onClick={() => {
              const next = zoomLevel === 1.0 ? 1.25 : zoomLevel === 1.25 ? 1.5 : 1.0;
              setZoomLevel(next);
            }}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-md flex items-center gap-1 backdrop-blur-md ${
              zoomLevel > 1.0
                ? 'bg-purple-600 border-purple-400 text-white ring-2 ring-purple-500/40'
                : 'bg-black/60 border-white/20 text-gray-300 hover:text-white'
            }`}
            title="Thu phóng camera (1x -> 1.25x -> 1.5x)"
          >
            <span className="text-[11px]">🔍</span>
            <span className="font-mono">{zoomLevel === 1.0 ? '1x' : `${zoomLevel}x`}</span>
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-xl bg-black/60 hover:bg-white/20 border border-white/20 text-gray-200 hover:text-white transition-all cursor-pointer shadow-md backdrop-blur-md"
            title={soundEnabled ? 'Tắt âm thanh chụp' : 'Bật âm thanh chụp'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
          </button>

          {/* Quick upload from device button instead of camera shooting */}
          <button
            type="button"
            onClick={() => fileUploadInputRef.current?.click()}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-white/20 text-white text-xs font-bold transition-all cursor-pointer shadow-md flex items-center gap-1 active:scale-95"
            title={`Tải ảnh từ máy (${requiredPhotos} kiểu)`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tải Ảnh</span>
          </button>

          {/* Hidden file input for device upload */}
          <input
            ref={fileUploadInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleDeviceUpload}
            className="hidden"
          />

          {/* Hidden file input for Sony SD card photos */}
          <input
            ref={sonySdCardInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleSdCardImport}
            className="hidden"
          />

          {/* Big Close Button (Top-Right) */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (previewPhotoIndex !== null) {
                setPreviewPhotoIndex(null);
              } else if (isShooting) {
                handleCancelShooting();
              } else {
                onClose();
              }
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (previewPhotoIndex !== null) {
                setPreviewPhotoIndex(null);
              } else if (isShooting) {
                handleCancelShooting();
              } else {
                onClose();
              }
            }}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-xl flex items-center justify-center transition-all cursor-pointer border border-white/30 active:scale-95"
            title="Đóng (Phím Esc)"
            aria-label="Đóng camera"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          </button>
        </div>
      </header>

      {/* 2. MAIN VIEWFINDER (FULLSCREEN HERO VIEWPORT) */}
      <main
        onClick={() => {
          // Tap anywhere on viewfinder to shoot
          if (!isShooting && (capturedPhotos.length < requiredPhotos || retakeTargetIndex !== null)) {
            startCaptureProcess();
          }
        }}
        className="absolute inset-0 w-full h-full bg-black flex items-center justify-center overflow-hidden cursor-pointer select-none"
      >
        {/* CASE 0: SONY ALPHA WI-FI REMOTE DIRECT CONTROL */}
        {selectedDevice === 'sony-wifi-camera' ? (
          sonyLiveFrame ? (
            <div
              className={`w-full h-full flex items-center justify-center relative overflow-hidden transition-all duration-200 ${
                fitMode === 'contain' ? 'pt-14 pb-28 sm:pb-32 px-3' : 'p-0'
              }`}
            >
              <img
                ref={sonyImgRef}
                src={sonyLiveFrame}
                alt="Sony Liveview Stream"
                className={`w-full h-full max-h-full max-w-full ${
                  fitMode === 'cover' ? 'object-cover' : 'object-contain'
                } transition-all duration-150 will-change-transform`}
                style={{
                  transform: `scale(${isMirrored ? -zoomLevel : zoomLevel}, ${zoomLevel})`,
                  transformOrigin: 'center center',
                }}
              />
              <div className="absolute top-16 left-4 bg-emerald-600/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg border border-white/20">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                <span>SONY ALPHA (Wi-Fi Direct Remote)</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center z-10 max-w-md">
              <div className="w-14 h-14 rounded-3xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3 border border-indigo-400/40 animate-pulse">
                <Camera className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white mb-1.5 font-cute">
                Đang Kết Nối Máy Ảnh Sony (IP: {sonyInfo.cameraIp})
              </h3>
              <p className="text-xs text-gray-300 mb-4 leading-relaxed">
                Đang chờ luồng hình ảnh LiveView trực tiếp từ máy ảnh Sony qua Wi-Fi...
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    sonyCameraService.startLiveview().catch(() => {});
                  }}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tải Lại LiveView</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSonySettings(true);
                  }}
                  className="px-3 py-1.5 bg-gray-800 text-gray-200 rounded-xl text-xs font-semibold cursor-pointer border border-gray-700"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        ) : !isMock ? (
          /* CASE 1: HARDWARE CAMERA / USB CAPTURE CARD / WEBCAM */
          <div
            className={`w-full h-full flex items-center justify-center relative overflow-hidden transition-all duration-200 ${
              fitMode === 'contain' ? 'pt-14 pb-28 sm:pb-32 px-3' : 'p-0'
            }`}
          >
            {/* 1. If Sony Multi is selected AND Sony Wi-Fi LiveView is active, display the live Sony frame! */}
            {selectedDevice === 'sony-multi-camera' && sonyLiveFrame ? (
              <img
                ref={sonyImgRef}
                src={sonyLiveFrame}
                alt="Sony Liveview Stream"
                className={`w-full h-full max-h-full max-w-full ${
                  fitMode === 'cover' ? 'object-cover' : 'object-contain'
                } transition-all duration-150 will-change-transform`}
                style={{
                  transform: `scale(${isMirrored ? -zoomLevel : zoomLevel}, ${zoomLevel})`,
                  transformOrigin: 'center center',
                }}
              />
            ) : selectedDevice === 'sony-multi-camera' && !streamRef.current ? (
              /* Sony Multi View / Assistant when no video feed is detected yet */
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto z-10 animate-in fade-in zoom-in-95 duration-200">
                {sonyMultiStatus.isUsbConnected ? (
                  <>
                    <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-400 flex items-center justify-center mb-3 shadow-xl">
                      <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                    </div>
                    
                    <div className="mb-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 mx-auto">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>Đã nhận diện: {sonyMultiStatus.connectedDeviceName || 'Sony ILCE-6400'}</span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">
                      Đang Khởi Động LiveView từ Máy Ảnh Sony...
                    </h3>
                    
                    <p className="text-xs text-gray-300 mb-4 leading-relaxed max-w-sm">
                      Đang kết nối luồng PTP USB trực tiếp (chuẩn Monitor+). Khung hình từ ống kính máy ảnh sẽ tự động hiển thị ngay khi mở session.
                    </p>

                    <details className="w-full text-left bg-gray-900/60 border border-gray-700/60 rounded-2xl p-3">
                      <summary className="text-xs font-semibold text-gray-300 cursor-pointer hover:text-white select-none">
                        ⚙️ Tùy chọn nguồn soi dáng khác (Camera iPad / Wi-Fi / Capture Card)
                      </summary>
                      <div className="w-full flex flex-col gap-2.5 mt-3 text-xs">
                        {/* Way 3: Mirror using iPad Camera */}
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                              streamRef.current = fallbackStream;
                              if (videoRef.current) {
                                videoRef.current.srcObject = fallbackStream;
                                videoRef.current.play().catch(() => {});
                              }
                              setSonyMultiFeedback('📱 Đang dùng Camera iPad làm gương soi dáng (Bấm chụp vẫn kích máy ảnh Sony)');
                            } catch {
                              setSonyMultiFeedback('❌ Không thể mở camera iPad làm gương');
                            }
                          }}
                          className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-98"
                        >
                          <Camera className="w-4 h-4 text-white" />
                          <span>Dùng Camera iPad soi dáng (Bấm chụp vẫn chụp bằng Sony {sonyMultiStatus.connectedDeviceName || 'a6400'})</span>
                        </button>

                        {/* Way 1: Wi-Fi LiveView */}
                        <button
                          type="button"
                          onClick={async () => {
                            setSonyMultiFeedback('📡 Đang kết nối Wi-Fi máy ảnh Sony...');
                            const res = await sonyCameraService.testConnection();
                            if (res.success) {
                              await sonyCameraService.startLiveview().catch(() => {});
                              setSonyMultiFeedback('✅ Đã kết nối Wi-Fi Sony! LiveView & Màn trập TÁCH đã sẵn sàng.');
                            } else {
                              setShowSonySettings(true);
                            }
                          }}
                          className="w-full py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-98"
                        >
                          <Wifi className="w-4 h-4 text-white" />
                          <span>Bật Wi-Fi Sony (Xem LiveView không dây qua ống kính)</span>
                        </button>

                        {/* Way 2: Rescan HDMI Capture Card */}
                        <button
                          type="button"
                          onClick={handleScanUsb}
                          disabled={isScanningUsb}
                          className="w-full py-2 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-2xl font-semibold flex items-center justify-center gap-2 border border-gray-700 cursor-pointer transition-all active:scale-98"
                        >
                          <Usb className="w-4 h-4 text-gray-300" />
                          <span>{isScanningUsb ? 'Đang quét...' : 'Cắm cáp Micro-HDMI sang USB Capture Card (1080p 60fps)'}</span>
                        </button>
                      </div>
                    </details>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border-2 border-amber-500/50 text-amber-400 flex items-center justify-center mb-3 shadow-xl">
                      <Usb className="w-8 h-8 animate-pulse" />
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">
                      Chưa Nhận Diện Cáp USB Máy Ảnh Sony
                    </h3>
                    
                    <p className="text-xs text-gray-300 mb-4 leading-relaxed">
                      Vui lòng cắm cáp Micro-USB/USB-C từ máy ảnh Sony vào iPad. Đảm bảo trong Menu máy ảnh đã chọn <strong>USB Connection: PC Remote</strong>.
                    </p>

                    <div className="w-full flex flex-col gap-2.5 text-xs">
                      {/* Way 3: Mirror using iPad Camera */}
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                            streamRef.current = fallbackStream;
                            if (videoRef.current) {
                              videoRef.current.srcObject = fallbackStream;
                              videoRef.current.play().catch(() => {});
                            }
                            setSonyMultiFeedback('📱 Đang dùng Camera iPad làm gương soi dáng (Bấm chụp vẫn kích máy ảnh Sony)');
                          } catch {
                            setSonyMultiFeedback('❌ Không thể mở camera iPad làm gương');
                          }
                        }}
                        className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-98"
                      >
                        <Camera className="w-4 h-4 text-white" />
                        <span>Dùng Camera iPad soi dáng tạm thời</span>
                      </button>

                      {/* Way 1: Wi-Fi LiveView */}
                      <button
                        type="button"
                        onClick={async () => {
                          setSonyMultiFeedback('📡 Đang kết nối Wi-Fi máy ảnh Sony...');
                          const res = await sonyCameraService.testConnection();
                          if (res.success) {
                            await sonyCameraService.startLiveview().catch(() => {});
                            setSonyMultiFeedback('✅ Đã kết nối Wi-Fi Sony! LiveView & Màn trập TÁCH đã sẵn sàng.');
                          } else {
                            setShowSonySettings(true);
                          }
                        }}
                        className="w-full py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-98"
                      >
                        <Wifi className="w-4 h-4 text-white" />
                        <span>Bật Wi-Fi Sony (Xem LiveView không dây qua ống kính)</span>
                      </button>

                      {/* Way 2: Rescan HDMI Capture Card */}
                      <button
                        type="button"
                        onClick={handleScanUsb}
                        disabled={isScanningUsb}
                        className="w-full py-2 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-2xl font-semibold flex items-center justify-center gap-2 border border-gray-700 cursor-pointer transition-all active:scale-98"
                      >
                        <Usb className="w-4 h-4 text-gray-300" />
                        <span>{isScanningUsb ? 'Đang quét...' : 'Cắm cáp Micro-HDMI sang USB Capture Card (1080p 60fps)'}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <video
                ref={(el) => {
                  videoRef.current = el;
                  if (el && streamRef.current && el.srcObject !== streamRef.current) {
                    el.srcObject = streamRef.current;
                    el.play().catch(() => {});
                  }
                }}
                autoPlay
                playsInline
                muted
                className={`w-full h-full max-h-full max-w-full ${
                  fitMode === 'cover' ? 'object-cover' : 'object-contain'
                } transition-all duration-150 will-change-transform`}
                style={{
                  transform: `scale(${isMirrored ? -zoomLevel : zoomLevel}, ${zoomLevel})`,
                  transformOrigin: 'center center',
                }}
              />
            )}

            {/* Top Device Pill Status */}
            {(() => {
              const activeDev = devices.find((d) => d.deviceId === selectedDevice);
              if (!activeDev) return null;
              if (selectedDevice === 'sony-multi-camera') {
                return (
                  <div className="absolute top-16 left-4 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 shadow-xl border border-amber-400/40 bg-amber-950/85">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>
                      🔌 Cổng Multi Sony{' '}
                      {sonyLiveFrame
                        ? '(LiveView: Cảm biến Sony)'
                        : streamRef.current
                        ? '(Capture Card 1080p)'
                        : sonyMultiStatus.isUsbConnected
                        ? `(USB PTP: ${sonyMultiStatus.connectedDeviceName || 'PC Remote'})`
                        : '(Chờ Cáp USB / Wi-Fi)'}
                    </span>
                  </div>
                );
              }
              return (
                <div
                  className={`absolute top-16 left-4 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 shadow-xl border border-white/20 ${
                    activeDev.isUsb ? 'bg-emerald-600/90' : 'bg-gray-900/80'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${activeDev.isUsb ? 'bg-white animate-ping' : 'bg-green-400'}`} />
                  <span>{activeDev.isUsb ? `USB: ${activeDev.rawLabel || 'Máy ảnh rời'}` : activeDev.label}</span>
                </div>
              );
            })()}

            {/* Quick Switch Camera Button in Viewport */}
            {devices.length > 1 && !isShooting && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cycleNextCamera();
                }}
                disabled={isShooting}
                className="absolute top-16 right-4 bg-black/60 hover:bg-black/80 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-white/20 backdrop-blur-md cursor-pointer shadow-lg active:scale-95 transition-all"
                title="Đổi camera tiếp theo"
              >
                <RefreshCw className="w-3.5 h-3.5 text-pink-400" />
                <span>Đổi Cam ({devices.findIndex((d) => d.deviceId === selectedDevice) + 1}/{devices.length})</span>
              </button>
            )}

            {/* Floating Quick Action Bar for Sony Multi Terminal */}
            {selectedDevice === 'sony-multi-camera' && !isShooting && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute top-25 inset-x-3 sm:inset-x-8 max-w-xl mx-auto z-20 bg-gray-950/90 backdrop-blur-md border border-amber-500/40 p-2.5 rounded-2xl shadow-2xl flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2"
              >
                <div className="flex items-center justify-between text-xs text-amber-300 font-bold">
                  <div className="flex items-center gap-1.5">
                    <Usb className="w-4 h-4 text-amber-400" />
                    <span>Xuất hình & bấm chụp máy Sony:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSonyMultiSettings(true)}
                    className="text-[10px] text-gray-300 hover:text-white bg-white/10 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Settings className="w-3 h-3" />
                    <span>Cài Đặt & Hướng Dẫn</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pt-0.5">
                  <button
                    type="button"
                    onClick={async () => {
                      setSonyMultiFeedback('📡 Đang kết nối Wi-Fi máy ảnh Sony...');
                      const res = await sonyCameraService.testConnection();
                      if (res.success) {
                        await sonyCameraService.startLiveview().catch(() => {});
                        setSonyMultiFeedback('✅ Đã kết nối Wi-Fi Sony! LiveView & Màn trập TÁCH đã sẵn sàng.');
                      } else {
                        setShowSonySettings(true);
                      }
                    }}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-sm active:scale-95"
                    title="Bật kết nối Wi-Fi để xem hình trực tiếp và kích chụp màn trập cơ học TÁCH lưu thẻ nhớ"
                  >
                    <Wifi className="w-3.5 h-3.5" />
                    <span>Bật Wi-Fi Sony (Xem Live & Kêu Tách)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleScanUsb}
                    disabled={isScanningUsb}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-sm active:scale-95"
                    title="Quét tìm thiết bị HDMI Capture Card cắm qua cổng Type-C"
                  >
                    <Usb className="w-3.5 h-3.5" />
                    <span>{isScanningUsb ? 'Đang quét...' : 'Quét HDMI Capture Card'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => sonySdCardInputRef.current?.click()}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-sm active:scale-95"
                    title="Chọn ảnh gốc trực tiếp từ thẻ nhớ máy ảnh Sony (thư mục DCIM)"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Chọn Ảnh Thẻ SD</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* CASE 2: MOCK STUDIO CAMERA */
          <div className="flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-gray-950 via-purple-950/40 to-gray-950 w-full h-full">
            <div className="w-16 h-16 rounded-3xl bg-pink-500/20 border-2 border-pink-500 flex items-center justify-center animate-pulse mb-3 text-pink-400 shadow-xl">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1.5 font-cute">
              Chế Độ Giả Lập Camera Studio
            </h3>
            <p className="text-xs text-gray-300 max-w-md">
              Bấm nút chụp to ở dưới để tự động tạo {requiredPhotos} ảnh mẫu chân dung studio HD!
            </p>
          </div>
        )}

        {/* 3. TOP-RIGHT COUNTDOWN OVERLAY - LARGE PROMINENT NUMBERS */}
        {countdown !== null && (
          <div className="absolute top-16 right-4 sm:top-20 sm:right-8 z-40 flex flex-col items-end gap-3 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 rounded-full bg-black/85 backdrop-blur-xl border-4 sm:border-[6px] border-pink-500 flex items-center justify-center shadow-[0_0_50px_rgba(244,63,94,0.9)] animate-in zoom-in-75 duration-150 ring-4 ring-pink-400/40">
              <span
                key={countdown}
                className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black text-white font-cute drop-shadow-[0_6px_25px_rgba(0,0,0,0.95)] animate-in zoom-in-50 duration-150 select-none tracking-tight"
              >
                {countdown === 0 ? '✨' : countdown}
              </span>
            </div>

            <div className="bg-gradient-to-r from-pink-600 to-rose-600 text-white px-4 py-1.5 sm:px-5 sm:py-2 rounded-full font-extrabold text-xs sm:text-base md:text-lg shadow-2xl border border-white/40 flex items-center gap-2 animate-in fade-in duration-150">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300 animate-spin" />
              <span>
                {countdown === 0
                  ? '✨ CƯỜI TƯƠI LÊN NÀO! ✨'
                  : `Kiểu số ${currentShotIndex} / ${requiredPhotos} • (${countdown}s)`}
              </span>
            </div>
          </div>
        )}

        {/* 4. POSE BREAK OVERLAY */}
        {breakCountdown !== null && (
          <div className="absolute top-16 sm:top-20 inset-x-0 z-40 flex justify-center pointer-events-none animate-in fade-in slide-in-from-top-3 duration-150">
            <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 text-white px-6 py-3 rounded-2xl text-base sm:text-lg md:text-xl font-black shadow-2xl flex items-center gap-2.5 border border-white/40 animate-pulse">
              <Sparkles className="w-5 h-5 text-amber-300 animate-spin" />
              <span>Đổi dáng cho kiểu {capturedPhotos.length + 1} nào! ({breakCountdown}s)</span>
            </div>
          </div>
        )}

        {/* 5. HOT FOLDER RECEIVING SPINNER */}
        {isWaitingHotFolder && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-pink-500/20 border-2 border-pink-400 flex items-center justify-center animate-spin mb-3">
              <RefreshCw className="w-7 h-7 text-pink-400" />
            </div>
            <h4 className="text-base font-bold text-white mb-1.5">
              📸 Đang nhận ảnh gốc từ Sony Imaging Edge...
            </h4>
            <p className="text-xs text-gray-300 max-w-sm mb-3">
              Ảnh độ nét cao đang được tải tự động vào Photobooth.
            </p>
          </div>
        )}

        {/* 5.1 CAMERA CAPTURE RECEIVING SPINNER (USB PTP & Wi-Fi) */}
        {isCapturingCameraPhoto && !isWaitingHotFolder && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs p-6 text-center pointer-events-none animate-in fade-in duration-150">
            <div className="w-16 h-16 rounded-full bg-pink-500/25 border-2 border-pink-400 flex items-center justify-center animate-spin mb-3 shadow-[0_0_30px_rgba(244,63,94,0.6)]">
              <RefreshCw className="w-8 h-8 text-pink-300" />
            </div>
            <h4 className="text-base sm:text-lg font-bold text-white mb-1">
              📸 Máy ảnh đang chụp & truyền ảnh về app...
            </h4>
            <p className="text-xs text-pink-200/90 max-w-sm">
              Đang tải ảnh độ phân giải cao từ cảm biến máy ảnh
            </p>
          </div>
        )}

        {/* 6. ERROR TOAST */}
        {captureError && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-4 inset-x-4 max-w-lg mx-auto z-40 p-3.5 bg-rose-600/95 text-white rounded-2xl flex items-center justify-between gap-3 shadow-2xl border border-white/30 text-xs font-bold"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-300 shrink-0" />
              <span>{captureError}</span>
            </div>
            <button
              type="button"
              onClick={() => setCaptureError(null)}
              className="p-1 rounded-lg hover:bg-white/20 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 7. SONY WI-FI SETTINGS MODAL */}
        {showSonySettings && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-16 inset-x-4 max-w-md mx-auto z-50 bg-gray-900/95 backdrop-blur-md border border-gray-700 p-5 rounded-3xl shadow-2xl flex flex-col gap-3"
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <Wifi className="w-4 h-4 text-indigo-400" />
                <span>Cài Đặt Wi-Fi Máy Ảnh Sony</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowSonySettings(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-300">Địa chỉ IP Máy Ảnh Sony:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sonyIpInput}
                  onChange={(e) => setSonyIpInput(e.target.value)}
                  placeholder="192.168.122.1:10000"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-white outline-none font-mono"
                />
                <button
                  type="button"
                  disabled={isTestingSony}
                  onClick={async () => {
                    setIsTestingSony(true);
                    setSonyTestFeedback(null);
                    sonyCameraService.setCameraIp(sonyIpInput);
                    const res = await sonyCameraService.testConnection();
                    setIsTestingSony(false);
                    if (res.success) {
                      setSonyTestFeedback('✅ Kết nối máy ảnh Sony thành công!');
                    } else {
                      setSonyTestFeedback(`❌ ${res.error || 'Không thể kết nối'}`);
                    }
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isTestingSony ? 'Đang thử...' : 'Kết Nối'}
                </button>
              </div>
              {sonyTestFeedback && (
                <div className="text-xs text-indigo-300 bg-indigo-950/60 border border-indigo-500/30 p-2 rounded-xl">
                  {sonyTestFeedback}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 8. HOT FOLDER SETTINGS MODAL */}
        {showHotFolderSettings && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-16 inset-x-4 max-w-lg mx-auto z-50 bg-gray-900/95 backdrop-blur-md border border-gray-700 p-5 rounded-3xl shadow-2xl flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <Folder className="w-4 h-4 text-pink-400" />
                <span>Cài Đặt Hot Folder (Canon EOS Utility / Sony Remote)</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowHotFolderSettings(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status indicator: Camera App Detected or Not */}
            <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-gray-800/80 border border-gray-700">
              <span className="text-gray-300 font-medium">Trạng thái phần mềm máy ảnh:</span>
              {hotFolderStatus.cameraAppRunning ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{hotFolderStatus.cameraAppName || 'Đã sẵn sàng'}</span>
                </span>
              ) : (
                <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Chưa mở EOS Utility / Sony Remote</span>
                </span>
              )}
            </div>

            {/* Folder selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-300 flex items-center justify-between">
                <span>Thư mục nhận ảnh từ Canon / Sony (Hot Folder):</span>
                {hotFolderStatus.isServerBridge && (
                  <span className="text-[10px] text-teal-400 bg-teal-950/60 border border-teal-500/30 px-1.5 py-0.5 rounded-md">
                    Máy tính {hotFolderStatus.serverPlatform === 'darwin' ? 'Mac' : 'Windows'}
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={hotFolderStatus.folderPath || ''}
                  placeholder="Chưa chọn thư mục..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-white outline-none font-mono truncate"
                />
                <button
                  type="button"
                  onClick={async () => {
                    setHotFolderFeedback(null);
                    const sel = await hotFolderService.selectFolder();
                    if (sel) setHotFolderFeedback(`✅ Đã chọn thư mục: ${sel}`);
                  }}
                  className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Chọn Thư Mục</span>
                </button>
              </div>
            </div>

            {/* LiveView source selector for Hot Folder mode */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-300">Nguồn hình ảnh LiveView soi dáng (cho khách ngắm trước):</label>
              <select
                value={hotFolderStatus.liveviewDeviceId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  hotFolderService.setLiveviewDeviceId(val);
                  cameraService.startStream('hot-folder-camera').then((stream) => {
                    streamRef.current = stream;
                    if (videoRef.current && stream) {
                      videoRef.current.srcObject = stream;
                      videoRef.current.play().catch(() => {});
                    }
                  });
                }}
                className="bg-gray-800 border border-gray-700 text-white text-xs rounded-xl px-3 py-1.5 outline-none font-semibold"
              >
                <option value="">Tự động (Camera iPad / Webcam mặc định)</option>
                {devices
                  .filter((d) => d.deviceId !== 'hot-folder-camera' && d.deviceId !== 'sony-wifi-camera' && d.deviceId !== 'mock-camera')
                  .map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
              </select>
            </div>

            {/* Test Trigger Button */}
            <div className="flex gap-2 pt-2 border-t border-gray-800">
              <button
                type="button"
                disabled={isTestingShutter}
                onClick={async () => {
                  setIsTestingShutter(true);
                  setHotFolderFeedback('📸 Đang gửi lệnh chụp sang máy tính...');
                  try {
                    const trig = await hotFolderService.triggerShutter();
                    if (trig.appName) {
                      setHotFolderFeedback(`✅ Đã gửi lệnh chụp thành công tới: ${trig.appName}! Máy ảnh sẽ kêu "TÁCH".`);
                    } else if (trig.warning) {
                      setHotFolderFeedback(`⚠️ ${trig.warning}`);
                    } else if (trig.success) {
                      setHotFolderFeedback('✅ Đã gửi lệnh chụp thành công! Hãy kiểm tra tiếng màn trập.');
                    } else {
                      setHotFolderFeedback(`⚠️ ${trig.error || 'Chưa kích được màn trập'}`);
                    }
                  } catch (e: any) {
                    setHotFolderFeedback(`Lỗi: ${e.message}`);
                  } finally {
                    setIsTestingShutter(false);
                  }
                }}
                className="flex-1 py-2 px-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-98"
              >
                <Camera className="w-4 h-4 text-white" />
                <span>{isTestingShutter ? 'Đang gửi lệnh...' : 'Test Bấm Chụp Canon / Sony (Kêu Tách)'}</span>
              </button>
            </div>

            {hotFolderFeedback && (
              <div className="text-xs text-pink-300 bg-pink-950/60 border border-pink-500/30 p-2.5 rounded-xl">
                {hotFolderFeedback}
              </div>
            )}

            <div className="text-[11px] text-gray-400 bg-black/40 p-2 rounded-xl border border-white/5 space-y-1">
              <p className="font-semibold text-gray-300">💡 Cách hoạt động chuẩn Studio Photobooth:</p>
              <p>1. Cắm máy ảnh Canon/Sony vào máy tính qua dây cáp USB và mở phần mềm <strong>Canon EOS Utility</strong> hoặc <strong>Sony Imaging Edge Remote</strong>.</p>
              <p>2. Đặt thư mục lưu ảnh của Canon/Sony trùng với thư mục ở trên.</p>
              <p>3. Khách đứng trước iPad ngắm dáng qua LiveView. Khi hết đếm ngược 3s, máy ảnh trên tripod sẽ <strong>kêu "TÁCH" cơ học</strong> và nạp file ảnh <strong>gốc siêu nét 24MP</strong> vào dải ảnh!</p>
            </div>
          </div>
        )}

        {/* 8.1 SONY MULTI-TERMINAL SETTINGS MODAL */}
        {showSonyMultiSettings && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-14 inset-x-4 max-w-lg mx-auto z-50 bg-gray-900/95 backdrop-blur-md border border-amber-500/40 p-5 rounded-3xl shadow-2xl flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <Usb className="w-4 h-4 text-amber-400" />
                <span>Cài Đặt Cổng Multi Sony (Multi-Terminal)</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowSonyMultiSettings(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Hardware Status */}
            <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-gray-800/80 border border-gray-700">
              <span className="text-gray-300 font-medium">Kết nối Cổng Multi trên iPad:</span>
              <div className="flex items-center gap-2">
                <span className={`font-bold flex items-center gap-1.5 ${sonyMultiStatus.isUsbConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${sonyMultiStatus.isUsbConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  <span>
                    {sonyMultiStatus.connectedDeviceName
                      ? `Đã nhận: ${sonyMultiStatus.connectedDeviceName}`
                      : sonyMultiStatus.isUsbConnected
                      ? 'Đã cắm thiết bị USB'
                      : 'Chưa cắm HDMI Capture Card'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const ok = sonyMultiService.checkNativeUsbDevices();
                    if (!ok) {
                      setSonyMultiFeedback('Đang quét thiết bị USB trên trình duyệt...');
                      cameraService.requestPermissionAndGetDevices().then((devs) => {
                        setDevices(devs);
                        setSonyMultiFeedback(`Đã quét xong: tìm thấy ${devs.length} nguồn camera.`);
                      });
                    } else {
                      setSonyMultiFeedback('⚡️ Đang quét cổng phần cứng qua iPad native AVFoundation...');
                    }
                  }}
                  className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                >
                  Quét Lại
                </button>
              </div>
            </div>

            {/* Mode Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-300 font-semibold">Chế độ chụp với Cổng Multi:</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => sonyMultiService.setMode('shutter_remote')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    sonyMultiStatus.mode === 'shutter_remote'
                      ? 'bg-amber-500/20 border-amber-400 text-white shadow-md ring-1 ring-amber-400'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <p className="font-bold text-amber-300">1. Cò Bấm Cổng Multi</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Khách cầm cò bấm tay bấm "TÁCH", lưu ảnh thẻ nhớ</p>
                </button>

                <button
                  type="button"
                  onClick={() => sonyMultiService.setMode('uvc_hd')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    sonyMultiStatus.mode === 'uvc_hd'
                      ? 'bg-amber-500/20 border-amber-400 text-white shadow-md ring-1 ring-amber-400'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <p className="font-bold text-amber-300">2. Cáp Multi Xuất LiveView</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Xuất hình ảnh soi gương & chụp tự động</p>
                </button>
              </div>
            </div>

            {/* Solutions Overview Guide */}
            <div className="space-y-2.5 bg-black/50 p-3.5 rounded-2xl border border-white/10 text-xs">
              <p className="font-bold text-amber-400 flex items-center gap-1.5 text-sm">
                <span>💡 2 Cách Xuất Hình & Chụp Máy Ảnh Sony Lên iPad:</span>
              </p>
              
              <div className="space-y-2 text-gray-300 text-[11px] leading-relaxed">
                <div className="bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-xl space-y-1">
                  <p className="font-bold text-emerald-300">✅ Cách 1: Xuất Hình Siêu Nét 1080p bằng Cáp HDMI + Cò Bấm Multi (Khuyên Dùng)</p>
                  <p>• Cắm cáp <strong>Micro-HDMI</strong> từ máy ảnh Sony vào <strong>HDMI Capture Card Type-C</strong> cắm vào iPad. iPad sẽ hiển thị hình ảnh 1080p sắc nét từ cảm biến Sony!</p>
                  <p>• Cổng <strong>MULTI</strong> dùng để cắm <strong>Dây bấm mềm / Cò bấm tay</strong> cho khách bấm chụp "TÁCH" và lưu thẻ nhớ.</p>
                </div>

                <div className="bg-indigo-950/40 border border-indigo-500/30 p-2.5 rounded-xl space-y-1">
                  <p className="font-bold text-indigo-300">📡 Cách 2: Kết Nối Wi-Fi Không Dây (Không Cần Mua Thêm Dây)</p>
                  <p>• Vào Menu máy ảnh Sony &gt; Ứng dụng &gt; <strong>"Điều khiển thông minh tích hợp"</strong> (Smart Remote Control).</p>
                  <p>• Kết nối iPad vào Wi-Fi máy ảnh. App sẽ tự xuất LiveView không dây, bấm chụp màn trập cơ học "TÁCH", chớp flash và nạp ảnh 24MP vào dải ảnh!</p>
                </div>

                <div className="bg-gray-800/60 p-2.5 rounded-xl space-y-1 text-gray-300">
                  <p className="font-bold text-amber-300">⚙️ Cài đặt Menu máy ảnh Sony (khi cắm cáp Multi USB):</p>
                  <p>1. Menu (hình va-li 🧰) &gt; <strong>USB Connection</strong> &gt; Chọn <strong>PC Remote</strong> (hoặc Mass Storage).</p>
                  <p>2. Menu &gt; <strong>USB Power Supply</strong> &gt; Chọn <strong>Off</strong> (để máy ảnh không rút pin sạc từ iPad).</p>
                </div>
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-gray-800">
              <button
                type="button"
                disabled={isTestingShutter}
                onClick={async () => {
                  setIsTestingShutter(true);
                  setSonyMultiFeedback('📸 Đang gửi lệnh kích màn trập máy ảnh...');
                  try {
                    const res = await sonyMultiService.triggerShutter();
                    if (res.success) {
                      setSonyMultiFeedback(`✅ Đã gửi lệnh thành công: ${res.appName || 'Máy ảnh sẽ kêu TÁCH'}`);
                    } else {
                      setSonyMultiFeedback(`⚠️ ${res.warning || res.error || 'Chưa kích được màn trập'}`);
                    }
                  } catch (e: any) {
                    setSonyMultiFeedback(`Lỗi: ${e.message}`);
                  } finally {
                    setIsTestingShutter(false);
                  }
                }}
                className="py-2 px-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-98"
              >
                <Camera className="w-4 h-4 text-white" />
                <span>{isTestingShutter ? 'Đang gửi...' : 'Test Bấm Chụp (Kêu Tách)'}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  setSonyMultiFeedback('📡 Đang kết nối Wi-Fi máy ảnh Sony...');
                  const res = await sonyCameraService.testConnection();
                  if (res.success) {
                    await sonyCameraService.startLiveview().catch(() => {});
                    setSonyMultiFeedback('✅ Đã kết nối Wi-Fi Sony! LiveView & Màn trập TÁCH đã sẵn sàng.');
                  } else {
                    setShowSonySettings(true);
                  }
                }}
                className="py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-98"
              >
                <Wifi className="w-4 h-4 text-white" />
                <span>Bật Wi-Fi Máy Sony</span>
              </button>

              <button
                type="button"
                onClick={() => sonySdCardInputRef.current?.click()}
                className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-98"
              >
                <FolderOpen className="w-4 h-4 text-white" />
                <span>Chọn Ảnh Thẻ Nhớ SD</span>
              </button>
            </div>

            {/* Feedback message */}
            {sonyMultiFeedback && (
              <div className="text-xs text-amber-300 bg-amber-950/60 border border-amber-500/30 p-2.5 rounded-xl">
                {sonyMultiFeedback}
              </div>
            )}
          </div>
        )}

        {/* 9. USB SCAN FEEDBACK TOAST */}
        {usbFeedback && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-16 inset-x-4 max-w-lg mx-auto z-40 p-3.5 bg-gray-900/95 text-white rounded-2xl flex items-center justify-between gap-3 shadow-2xl border border-gray-700 text-xs font-semibold"
          >
            <div className="flex items-center gap-2">
              <Usb className="w-4 h-4 text-teal-400 shrink-0" />
              <span>{usbFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setUsbFeedback(null)}
              className="p-1 rounded-lg hover:bg-white/20 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>

      {/* 3. BOTTOM CONTROL DOCK (FLOATING GLASS DOCK) */}
      <footer
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 inset-x-0 z-30 bg-gradient-to-t from-black/95 via-black/55 to-transparent px-3 sm:px-6 pt-6 pb-2.5 sm:pb-3 flex flex-col gap-1.5 pointer-events-none"
      >
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between gap-3 pointer-events-auto">
          {/* Left: Captured Live Thumbnails Strip WITH CLICK-TO-ENLARGE */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-0.5 max-w-[34vw] sm:max-w-sm no-scrollbar">
            {capturedPhotos.length === 0 ? (
              <div className="text-[11px] text-gray-400 font-semibold px-1 hidden sm:block">
                Ảnh chụp sẽ hiện tại đây
              </div>
            ) : (
              capturedPhotos.map((photo, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewPhotoIndex(idx);
                  }}
                  className={`group relative w-11 h-14 sm:w-14 sm:h-18 rounded-xl overflow-hidden border-2 shadow-lg bg-black shrink-0 transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                    retakeTargetIndex === idx
                      ? 'border-amber-400 ring-2 ring-amber-400 animate-pulse'
                      : 'border-pink-400 hover:border-white'
                  }`}
                  title={`Nhấn để phóng to kiểm tra nét kiểu #${idx + 1}`}
                >
                  <img src={photo} alt={`Kiểu ${idx + 1}`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0.5 right-0.5 bg-black/85 text-white text-[8px] font-bold px-1 rounded">
                    #{idx + 1}
                  </span>
                  {/* Hover Inspect Icon */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Maximize2 className="w-3.5 h-3.5 text-white drop-shadow" />
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Center: QUICK ZOOM + SHUTTER BUTTON */}
          <div className="flex flex-col items-center gap-1">
            {/* Quick Zoom Switcher (1x, 1.25x, 1.5x) */}
            <div className="flex items-center bg-black/60 backdrop-blur-md border border-white/20 rounded-full p-0.5 gap-0.5 shadow-lg mb-0.5">
              {[1.0, 1.25, 1.5].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoomLevel(z);
                  }}
                  disabled={isShooting}
                  className={`py-0.5 px-2.5 rounded-full text-[10px] font-black transition-all cursor-pointer ${
                    zoomLevel === z
                      ? 'bg-pink-600 text-white shadow-md scale-105'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                  title={`Thu phóng camera ${z}x`}
                >
                  {z === 1.0 ? '1x' : `${z}x`}
                </button>
              ))}
            </div>

            {capturedPhotos.length < requiredPhotos || retakeTargetIndex !== null ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isShooting) {
                    handleCancelShooting();
                  } else {
                    startCaptureProcess();
                  }
                }}
                className={`group relative w-16 h-16 sm:w-18 sm:h-18 rounded-full transition-all flex items-center justify-center cursor-pointer active:scale-90 border-4 shadow-2xl ${
                  isShooting
                    ? 'bg-rose-600 border-white ring-4 ring-rose-400/50'
                    : 'bg-white hover:bg-pink-50 border-pink-500 ring-4 ring-white/40 shadow-[0_0_30px_rgba(244,63,94,0.6)] hover:shadow-[0_0_45px_rgba(244,63,94,0.9)]'
                }`}
                title={isShooting ? 'Nhấn để dừng chụp' : 'Chụp ảnh (Phím Space hoặc chạm màn hình)'}
              >
                {isShooting ? (
                  <div className="flex flex-col items-center justify-center text-white">
                    <X className="w-6 h-6 stroke-[3]" />
                    <span className="text-[8px] font-black uppercase">Dừng</span>
                  </div>
                ) : (
                  <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-gradient-to-tr from-pink-500 via-rose-500 to-pink-500 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                    <Camera className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow" />
                  </div>
                )}
              </button>
            ) : (
              /* All Photos Captured: BIG FINISH BUTTON IN CENTER */
              <button
                type="button"
                onClick={handleFinish}
                className="py-2.5 px-6 sm:px-8 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-sm sm:text-base shadow-[0_0_30px_rgba(16,185,129,0.7)] transition-all hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer border-2 border-white/40"
              >
                <CheckCircle2 className="w-5 h-5 text-amber-300" />
                <span>Hoàn Tất & Dùng Bộ Ảnh</span>
              </button>
            )}

            {/* Label under shutter */}
            <span className="text-[11px] font-bold text-white drop-shadow tracking-wide">
              {isShooting
                ? `Đang chụp ${currentShotIndex}/${requiredPhotos}... (Bấm dừng)`
                : retakeTargetIndex !== null
                ? `Bấm chụp lại kiểu #${retakeTargetIndex + 1}`
                : capturedPhotos.length >= requiredPhotos
                ? 'Đã chụp xong đủ ảnh!'
                : isAutoSeries
                ? `Chụp Tự Động (${requiredPhotos} Kiểu)`
                : `Bấm Chụp Kiểu ${capturedPhotos.length + 1}/${requiredPhotos}`}
            </span>
          </div>

          {/* Right: Actions / Retake / Review Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            {capturedPhotos.length > 0 && !isShooting && (
              <>
                {/* Button to quickly inspect all photos */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewPhotoIndex(0);
                  }}
                  className="py-1.5 px-3 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 border border-pink-400/40 text-pink-200 text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Phóng to kiểm tra các ảnh đã chụp"
                >
                  <Eye className="w-3.5 h-3.5 text-pink-300" />
                  <span className="hidden sm:inline">Xem Lại</span>
                </button>

                <button
                  type="button"
                  onClick={handleRetakeLast}
                  className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/20 text-white text-xs font-bold transition-all active:scale-95 flex items-center gap-1 cursor-pointer shadow-xs"
                  title="Chụp lại kiểu ảnh vừa rồi"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-pink-300" />
                  <span className="hidden sm:inline">Lại #{capturedPhotos.length}</span>
                </button>

                <button
                  type="button"
                  onClick={handleRetakeAll}
                  className="py-1.5 px-2.5 rounded-xl bg-white/10 hover:bg-rose-600/60 active:bg-rose-600 border border-white/20 text-white text-xs font-bold transition-all active:scale-95 flex items-center gap-1 cursor-pointer shadow-xs"
                  title="Xoá tất cả và chụp lại từ đầu"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-300" />
                  <span className="hidden sm:inline">Lại Hết</span>
                </button>
              </>
            )}

            {capturedPhotos.length > 0 && capturedPhotos.length < requiredPhotos && !isShooting && (
              <button
                type="button"
                onClick={handleFinish}
                className="py-1.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all active:scale-95 flex items-center gap-1 cursor-pointer shadow-md"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>Xong ({capturedPhotos.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Hardware Bar */}
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between gap-2 text-[11px] border-t border-white/10 pt-1 text-gray-300 pointer-events-auto">
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
            <span className="font-semibold text-gray-400 shrink-0">Nguồn Cam:</span>
            <select
              value={selectedDevice}
              onChange={(e) => selectDeviceAndPersist(e.target.value)}
              disabled={isShooting}
              className="bg-gray-900 border border-gray-700 text-white text-xs rounded-xl px-2 py-0.5 outline-none font-semibold truncate max-w-xs"
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>

            {selectedDevice === 'sony-wifi-camera' && (
              <button
                type="button"
                onClick={() => setShowSonySettings(true)}
                className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-indigo-300 rounded-xl text-xs font-medium border border-gray-700 cursor-pointer flex items-center gap-1 shrink-0"
                title="Cài đặt IP Wi-Fi máy ảnh Sony"
              >
                <Settings className="w-3 h-3" />
                <span>IP Sony</span>
              </button>
            )}

            {selectedDevice === 'sony-multi-camera' && (
              <button
                type="button"
                onClick={() => setShowSonyMultiSettings(true)}
                className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-amber-300 rounded-xl text-xs font-medium border border-gray-700 cursor-pointer flex items-center gap-1 shrink-0"
                title="Cài đặt Cổng Multi Sony"
              >
                <Settings className="w-3 h-3" />
                <span>Cổng Multi</span>
              </button>
            )}

            {selectedDevice === 'hot-folder-camera' && (
              <button
                type="button"
                onClick={() => setShowHotFolderSettings(true)}
                className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-pink-300 rounded-xl text-xs font-medium border border-gray-700 cursor-pointer flex items-center gap-1 shrink-0"
                title="Cài đặt thư mục Hot Folder Imaging Edge"
              >
                <Folder className="w-3 h-3" />
                <span>Thư Mục</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleScanUsb}
              disabled={isShooting || isScanningUsb}
              className="px-2 py-0.5 bg-teal-600/80 hover:bg-teal-500 text-white rounded-xl text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer transition-all active:scale-95"
            >
              <Usb className="w-3 h-3 text-teal-200" />
              <span>{isScanningUsb ? 'Đang quét...' : 'Quét USB'}</span>
            </button>
          </div>

          <div className="text-[10px] text-gray-400 hidden md:block">
            Mẹo: Nhấp ảnh nhỏ góc trái để phóng to xem nét • Phím <strong>Space</strong> để chụp
          </div>
        </div>
      </footer>

      {/* 4. ENLARGED PHOTO INSPECTOR LIGHTBOX (XEM TO ĐỘ NÉT & DUYỆT ẢNH) */}
      {previewPhotoIndex !== null && capturedPhotos[previewPhotoIndex] && (
        <div
          onClick={() => setPreviewPhotoIndex(null)}
          className="fixed inset-0 z-[10005] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-between p-3 sm:p-5 select-none animate-in fade-in duration-150"
          style={{ touchAction: 'none' }}
        >
          {/* Inspector Header */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl flex items-center justify-between bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 text-white z-20 gap-3 shrink-0"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-pink-500/30 text-pink-300 flex items-center justify-center font-bold text-xs">
                #{previewPhotoIndex + 1}
              </div>
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-white font-cute flex items-center gap-2">
                  <span>Kiểm Tra Độ Nét Kiểu #{previewPhotoIndex + 1}</span>
                  <span className="text-[10px] bg-pink-500/40 text-pink-200 px-2 py-0.5 rounded-md font-sans font-semibold">
                    {previewPhotoIndex + 1}/{capturedPhotos.length}
                  </span>
                </h3>
                <p className="text-[10px] text-gray-300 hidden sm:block">
                  Kiểm tra nụ cười, độ nét trước khi in • Nhấn mũi tên để xem các kiểu khác
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPreviewPhotoIndex(null)}
              className="w-9 h-9 rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-md"
              title="Đóng (Phím Esc)"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Center High-Res Image with Prev / Next Navigation Chevrons */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex-1 w-full max-w-4xl min-h-0 flex items-center justify-center my-2 overflow-hidden"
          >
            {/* Prev Shot Button */}
            {previewPhotoIndex > 0 && (
              <button
                type="button"
                onClick={() => setPreviewPhotoIndex(previewPhotoIndex - 1)}
                className="absolute left-2 sm:left-4 z-20 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/75 hover:bg-pink-600 text-white flex items-center justify-center border border-white/30 backdrop-blur-md shadow-2xl transition-all cursor-pointer active:scale-90"
                title="Xem kiểu trước đó"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* The Image */}
            <img
              src={capturedPhotos[previewPhotoIndex]}
              alt={`Kiểm tra ảnh #${previewPhotoIndex + 1}`}
              className="max-h-[68vh] sm:max-h-[72vh] w-auto max-w-[88vw] object-contain rounded-2xl shadow-2xl border-2 border-white/20 select-none animate-in zoom-in-95 duration-100"
            />

            {/* Next Shot Button */}
            {previewPhotoIndex < capturedPhotos.length - 1 && (
              <button
                type="button"
                onClick={() => setPreviewPhotoIndex(previewPhotoIndex + 1)}
                className="absolute right-2 sm:right-4 z-20 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/75 hover:bg-pink-600 text-white flex items-center justify-center border border-white/30 backdrop-blur-md shadow-2xl transition-all cursor-pointer active:scale-90"
                title="Xem kiểu tiếp theo"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Bottom Actions for this Photo */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl flex items-center justify-between gap-3 bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/20 z-20 shadow-xl shrink-0"
          >
            {/* Retake this specific photo */}
            <button
              type="button"
              onClick={() => {
                const targetSlot = previewPhotoIndex;
                setRetakeTargetIndex(targetSlot);
                setPreviewPhotoIndex(null);
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-white/20"
              title="Chụp lại riêng kiểu này"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Chụp Lại Riêng Kiểu #{previewPhotoIndex + 1}</span>
            </button>

            {/* Accept & Keep this photo */}
            <button
              type="button"
              onClick={() => setPreviewPhotoIndex(null)}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-white/20"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-300" />
              <span>Đã Đẹp, Giữ Kiểu Này</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
};
