import { useState, useRef, useEffect, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { CanvasRenderer, CanvasRendererHandle } from './components/CanvasRenderer';
import { FrameSelector } from './components/FrameSelector';
import { FrameStudioScreen } from './components/FrameStudioScreen';
import { CameraCaptureModal } from './components/CameraCaptureModal';
import { PhotoUploadModal } from './components/PhotoUploadModal';
import { ExportModal } from './components/ExportModal';
import { DeviceHubModal } from './components/DeviceHubModal';
import { BluetoothModal } from './components/BluetoothModal';
import { BluetoothStatusToast } from './components/BluetoothStatusToast';
import { PhoneRemoteView } from './components/PhoneRemoteView';
import { PRESET_FRAMES, createDefaultBlankFrame, create2Cut4x6Slots, create3CutSlots, create4CutSlots, create6CutSlots } from './templates/presetFrames';
import { SAMPLE_PORTRAITS } from './templates/samplePhotos';
import { FrameTemplate, PhotoData, StickerItem, AppMode } from './types/photobooth';
import { bluetoothService } from './services/bluetoothService';
import { realP2PService, P2PMessage } from './services/realP2PService';
import { sounds } from './utils/audio';
import { Download, Camera, Upload, RefreshCw, Edit3, Maximize2, Layers, X } from 'lucide-react';
import { StripDownloadView } from './components/StripDownloadView';
import { printService } from './services/printService';

import { ErrorBoundary } from './components/ErrorBoundary';
import { safeGetItem, safeSetItem } from './utils/safeStorage';
import { ImageLightboxModal } from './components/ImageLightboxModal';

export function App() {
  // Check if current view is Smartphone Remote Controller or QR Strip Download
  const urlParams = new URLSearchParams(window.location.search);
  const isRemoteMode = urlParams.get('mode') === 'remote' || urlParams.get('remote') === '1' || urlParams.get('remote') === 'true';
  const isViewStrip = urlParams.get('view_strip') !== null;

  return (
    <ErrorBoundary>
      {isRemoteMode ? (
        <PhoneRemoteView />
      ) : isViewStrip ? (
        <StripDownloadView />
      ) : (
        <PhotoboothApp />
      )}
    </ErrorBoundary>
  );
}

function PhotoboothApp() {
  const [currentMode, setCurrentMode] = useState<AppMode>('editor');
  
  // Custom Frames with persistent storage (localStorage)
  const [customFrames, setCustomFrames] = useState<FrameTemplate[]>(() => {
    try {
      const saved = safeGetItem('photobooth_custom_frames_v3');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load custom frames from storage', e);
    }
    return [];
  });

  // Track hidden/deleted preset frames
  const [deletedPresetIds, setDeletedPresetIds] = useState<string[]>(() => {
    try {
      const saved = safeGetItem('photobooth_deleted_presets_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      safeSetItem('photobooth_deleted_presets_v1', JSON.stringify(deletedPresetIds));
    } catch {}
  }, [deletedPresetIds]);

  const [selectedFrame, setSelectedFrame] = useState<FrameTemplate>(PRESET_FRAMES[0]);

  // Sync customFrames to safeStorage
  useEffect(() => {
    try {
      safeSetItem('photobooth_custom_frames_v3', JSON.stringify(customFrames));
    } catch (e) {
      console.error('Failed to persist custom frames to storage', e);
    }
  }, [customFrames]);

  const availablePresetFrames = useMemo(() => {
    return PRESET_FRAMES.filter((f) => !deletedPresetIds.includes(f.id));
  }, [deletedPresetIds]);
  
  // Photos in slots (Initialized with sample portraits)
  const [photos, setPhotos] = useState<PhotoData[]>([
    { id: '1', slotIndex: 0, dataUrl: SAMPLE_PORTRAITS[0], filter: 'none', zoom: 1.0, offsetX: 0, offsetY: 0, rotation: 0, mirror: false },
    { id: '2', slotIndex: 1, dataUrl: SAMPLE_PORTRAITS[1], filter: 'none', zoom: 1.0, offsetX: 0, offsetY: 0, rotation: 0, mirror: false },
    { id: '3', slotIndex: 2, dataUrl: SAMPLE_PORTRAITS[2], filter: 'none', zoom: 1.0, offsetX: 0, offsetY: 0, rotation: 0, mirror: false },
    { id: '4', slotIndex: 3, dataUrl: SAMPLE_PORTRAITS[3], filter: 'none', zoom: 1.0, offsetX: 0, offsetY: 0, rotation: 0, mirror: false },
  ]);

  const [stickers, setStickers] = useState<StickerItem[]>([]);
  const [isMockCamera, setIsMockCamera] = useState<boolean>(() => {
    const saved = safeGetItem('photobooth_is_mock_camera');
    if (saved !== null) return saved === 'true';
    const savedCam = safeGetItem('photobooth_selected_camera_id');
    if (savedCam) return savedCam === 'mock-camera';
    return false; // Default false (Real camera) instead of forcing mock camera
  });

  const handleToggleMockMode = () => {
    const next = !isMockCamera;
    setIsMockCamera(next);
    safeSetItem('photobooth_is_mock_camera', next ? 'true' : 'false');
    if (next) {
      safeSetItem('photobooth_selected_camera_id', 'mock-camera');
      safeSetItem('photobooth_selected_camera_label', '🎭 Fake Camera (Ảnh mẫu Studio)');
    } else {
      const savedCam = safeGetItem('photobooth_selected_camera_id');
      if (savedCam === 'mock-camera') {
        safeSetItem('photobooth_selected_camera_id', '');
        safeSetItem('photobooth_selected_camera_label', '');
      }
    }
  };

  // Screen View State: 'home' | 'studio'
  const [currentScreen, setCurrentScreen] = useState<'home' | 'studio'>('home');
  const [mobileViewTab, setMobileViewTab] = useState<'preview' | 'frames'>('preview');
  const [editingFrameTarget, setEditingFrameTarget] = useState<FrameTemplate | null>(null);

  // Modals
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isDeviceHubOpen, setIsDeviceHubOpen] = useState(false);
  const [isBluetoothOpen, setIsBluetoothOpen] = useState(false);
  const [connectedBluetoothCount, setConnectedBluetoothCount] = useState(0);
  const [exportDataUrl, setExportDataUrl] = useState<string>('');

  // Main Home Lightbox Preview State
  const [isMainLightboxOpen, setIsMainLightboxOpen] = useState(false);
  const [mainLightboxDataUrl, setMainLightboxDataUrl] = useState<string>('');
  const [isMainLightboxSaved, setIsMainLightboxSaved] = useState(false);
  const [isLightboxLoading, setIsLightboxLoading] = useState(false);

  const canvasRef = useRef<CanvasRendererHandle>(null);

  // Open Fullscreen Lightbox directly from Home Screen
  const handleOpenMainLightbox = async () => {
    try {
      setIsLightboxLoading(true);
      if (canvasRef.current) {
        const url = await canvasRef.current.getHighResDataUrl(2.5);
        if (url) {
          setMainLightboxDataUrl(url);
          setIsMainLightboxOpen(true);
        }
      }
    } catch (e) {
      console.error('Failed to get high-res image for lightbox:', e);
    } finally {
      setIsLightboxLoading(false);
    }
  };

  // Open Studio Screen (either for new frame or editing existing)
  const handleOpenFrameStudio = (frameToEdit?: FrameTemplate | null, targetSlotCount: 2 | 3 | 4 | 6 = 4) => {
    if (frameToEdit) {
      setEditingFrameTarget(frameToEdit);
    } else {
      // Create new frame with pure clean white background
      const newBlank = createDefaultBlankFrame(customFrames.length + 1, targetSlotCount);
      setEditingFrameTarget(newBlank);
    }
    setCurrentScreen('studio');
  };

  // Bluetooth & Real Phone P2P Subscription
  useEffect(() => {
    // 1. Track connected Bluetooth count
    const unsubDevices = bluetoothService.subscribe((devs) => {
      const connected = devs.filter((d) => d.status === 'connected' || d.status === 'transferring' || d.status === 'printing').length;
      const realCount = realP2PService.getConnectedClients().length;
      setConnectedBluetoothCount(connected + realCount);
    });

    const unsubClients = realP2PService.onClientsChange((clients) => {
      const connected = bluetoothService.getConnectedDevices().length;
      setConnectedBluetoothCount(connected + clients.length);
    });

    // 2. Handle photo received from Phone via Bluetooth
    const unsubPhoto = bluetoothService.onPhotoReceived((photoUrl) => {
      setPhotos((prev) => {
        const maxSlots = selectedFrame.slotCount;
        const currentCount = prev.length;
        const targetSlot = currentCount < maxSlots ? currentCount : 0;

        const filtered = prev.filter((p) => p.slotIndex !== targetSlot);
        return [
          ...filtered,
          {
            id: `bt-photo-${Date.now()}-${targetSlot}`,
            slotIndex: targetSlot,
            dataUrl: photoUrl,
            filter: 'none',
            zoom: 1.0,
            offsetX: 0,
            offsetY: 0,
            rotation: 0,
            mirror: false,
          },
        ].sort((a, b) => a.slotIndex - b.slotIndex);
      });
    });

    // 3. Handle P2P Messages from Real Smartphones (QR Code connected)
    const unsubP2P = realP2PService.onMessage((msg: P2PMessage) => {
      if (msg.type === 'SHUTTER_TRIGGER') {
        sounds.playShutterSound();
        setIsCameraOpen(true);
      } else if (msg.type === 'PHOTO_TRANSFER') {
        sounds.playSuccessChime();
        setPhotos((prev) => {
          const maxSlots = selectedFrame.slotCount;
          const currentCount = prev.length;
          const targetSlot = currentCount < maxSlots ? currentCount : 0;

          const filtered = prev.filter((p) => p.slotIndex !== targetSlot);
          return [
            ...filtered,
            {
              id: `p2p-photo-${Date.now()}-${targetSlot}`,
              slotIndex: targetSlot,
              dataUrl: msg.payload.photoDataUrl,
              filter: 'none',
              zoom: 1.0,
              offsetX: 0,
              offsetY: 0,
              rotation: 0,
              mirror: false,
            },
          ].sort((a, b) => a.slotIndex - b.slotIndex);
        });
      }
    });

    // 4. Handle remote shutter trigger from Bluetooth Remote / Camera
    const unsubShutter = bluetoothService.onShutterTrigger(() => {
      setIsCameraOpen((currentOpen) => {
        if (!currentOpen) {
          return true;
        }
        return currentOpen;
      });
    });

    return () => {
      unsubDevices();
      unsubClients();
      unsubPhoto();
      unsubP2P();
      unsubShutter();
    };
  }, [selectedFrame.slotCount]);

  // Handle Photo updates
  const handleUploadPhotoToSlot = (slotIndex: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPhotos((prev) => {
        const filtered = prev.filter((p) => p.slotIndex !== slotIndex);
        return [
          ...filtered,
          {
            id: `photo-${Date.now()}-${slotIndex}`,
            slotIndex,
            dataUrl,
            filter: 'none',
            zoom: 1.0,
            offsetX: 0,
            offsetY: 0,
            rotation: 0,
            mirror: false,
          },
        ];
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhotoFromSlot = (slotIndex: number) => {
    setPhotos((prev) => prev.filter((p) => p.slotIndex !== slotIndex));
  };

  const handleUpdatePhoto = (slotIndex: number, updates: Partial<PhotoData>) => {
    setPhotos((prev) =>
      prev.map((p) => (p.slotIndex === slotIndex ? { ...p, ...updates } : p))
    );
  };

  // When photos captured from Kiosk Camera modal
  const handlePhotosCaptured = (capturedUrls: string[]) => {
    const newPhotos: PhotoData[] = capturedUrls.map((url, idx) => ({
      id: `live-${Date.now()}-${idx}`,
      slotIndex: idx,
      dataUrl: url,
      filter: 'none',
      zoom: 1.0,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      mirror: false,
    }));
    setPhotos(newPhotos);
  };

  // Sticker handlers on canvas
  const handleUpdateSticker = (stickerId: string, updates: Partial<StickerItem>) => {
    setStickers((prev) => prev.map((s) => (s.id === stickerId ? { ...s, ...updates } : s)));
  };

  const handleRemoveSticker = (stickerId: string) => {
    setStickers((prev) => prev.filter((s) => s.id !== stickerId));
  };

  // Frame Selection
  const handleSelectFrame = (frame: FrameTemplate) => {
    setSelectedFrame(frame);
    if (frame.stickers && frame.stickers.length > 0) {
      setStickers(JSON.parse(JSON.stringify(frame.stickers)));
    } else {
      setStickers([]);
    }
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileViewTab('preview');
    }
  };

  // Quick Switch Layout (2 Ảnh 4x6, 3 Ảnh Dọc, 4 Ảnh Dọc, 6 Ô Lưới)
  const handleSwitchLayout = (targetSlots: 2 | 3 | 4 | 6) => {
    if (selectedFrame.slotCount === targetSlots) return;

    let updatedSlots = selectedFrame.slots;
    let newAspectRatio = selectedFrame.aspectRatio;
    let newWidth = selectedFrame.width;
    let newHeight = selectedFrame.height;

    if (targetSlots === 2) {
      newAspectRatio = '4x6';
      newWidth = 1200;
      newHeight = 1800;
      updatedSlots = create2Cut4x6Slots(1200, 1800);
      // Trim photos to max 2 slots
      setPhotos((prev) => prev.filter((p) => p.slotIndex < 2));
    } else if (targetSlots === 3) {
      newAspectRatio = '2x6';
      newWidth = 600;
      newHeight = 1800;
      updatedSlots = create3CutSlots(600, 1800, 140, 140, 26, 38);
      // Trim photos to max 3 slots
      setPhotos((prev) => prev.filter((p) => p.slotIndex < 3));
    } else if (targetSlots === 4) {
      newAspectRatio = '2x6';
      newWidth = 600;
      newHeight = 1800;
      updatedSlots = create4CutSlots(600, 1800, 120, 120, 22, 38);
      setPhotos((prev) => prev.filter((p) => p.slotIndex < 4));
    } else if (targetSlots === 6) {
      newAspectRatio = '4x6';
      newWidth = 1200;
      newHeight = 1800;
      updatedSlots = create6CutSlots(1200, 1800);
    }

    setSelectedFrame((prev) => ({
      ...prev,
      slotCount: targetSlots,
      aspectRatio: newAspectRatio,
      width: newWidth,
      height: newHeight,
      slots: updatedSlots,
    }));
  };

  // Delete Frame (Custom permanently or hide preset)
  const handleDeleteCustomFrame = (frameId: string) => {
    const isCustom = customFrames.some((f) => f.id === frameId);
    if (isCustom) {
      setCustomFrames((prev) => prev.filter((f) => f.id !== frameId));
    } else {
      setDeletedPresetIds((prev) => (prev.includes(frameId) ? prev : [...prev, frameId]));
    }

    if (selectedFrame.id === frameId) {
      const remainingCustom = customFrames.filter((f) => f.id !== frameId);
      const remainingPresets = PRESET_FRAMES.filter((f) => f.id !== frameId && !deletedPresetIds.includes(f.id));
      const nextFrame = remainingCustom[0] || remainingPresets[0] || PRESET_FRAMES[0];
      handleSelectFrame(nextFrame);
    }
  };

  const handleRestorePresetFrames = () => {
    setDeletedPresetIds([]);
  };

  // Quick Toggle Header Text on the active frame
  const handleToggleHeaderText = () => {
    setSelectedFrame((prev) => {
      const isCurrentlyEnabled = prev.showHeader !== false && Boolean(prev.headerText);
      if (isCurrentlyEnabled) {
        return {
          ...prev,
          showHeader: false,
        };
      } else {
        return {
          ...prev,
          showHeader: true,
          headerText: prev.headerText || 'PHOTO BOOTH',
        };
      }
    });
  };

  // Quick Toggle Footer Text on the active frame
  const handleToggleFooterText = () => {
    setSelectedFrame((prev) => {
      const isCurrentlyEnabled = prev.showFooter !== false && Boolean(prev.footerText);
      if (isCurrentlyEnabled) {
        return {
          ...prev,
          showFooter: false,
        };
      } else {
        return {
          ...prev,
          showFooter: true,
          footerText: prev.footerText || (prev.slotCount === 2 ? 'DUO MOMENT 4x6 • 2026' : 'MEMORIES • 2026'),
        };
      }
    });
  };

  const homeBgFileInputRef = useRef<HTMLInputElement>(null);

  const handleHomeUploadBackground = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setSelectedFrame((prev) => ({
          ...prev,
          backgroundImage: dataUrl,
          backgroundImageConfig: prev.backgroundImageConfig || {
            fit: 'cover',
            scale: 1.0,
            offsetX: 0,
            offsetY: 0,
            opacity: 1.0,
            blur: 0,
          },
        }));
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  };

  // Duplicate Custom Frame
  const handleDuplicateCustomFrame = (frame: FrameTemplate) => {
    const duplicated: FrameTemplate = {
      ...JSON.parse(JSON.stringify(frame)),
      id: `custom-${Date.now()}`,
      name: `${frame.name} (Bản sao)`,
      isCustom: true,
      updatedAt: Date.now(),
    };
    setCustomFrames((prev) => [duplicated, ...prev]);
    setSelectedFrame(duplicated);
    if (duplicated.stickers) {
      setStickers(JSON.parse(JSON.stringify(duplicated.stickers)));
    }
  };

  // Save / Apply from Studio Screen
  const handleSaveFromStudio = (savedFrame: FrameTemplate, isNewTemplate = false) => {
    if (isNewTemplate || !customFrames.some((f) => f.id === savedFrame.id)) {
      setCustomFrames((prev) => [savedFrame, ...prev.filter((f) => f.id !== savedFrame.id)]);
    } else {
      setCustomFrames((prev) => prev.map((f) => (f.id === savedFrame.id ? savedFrame : f)));
    }
    setSelectedFrame(savedFrame);
    if (savedFrame.stickers) {
      setStickers(JSON.parse(JSON.stringify(savedFrame.stickers)));
    }
    setCurrentScreen('home');
    setEditingFrameTarget(null);
  };

  // Export / Download action
  const handleOpenExport = async () => {
    try {
      if (canvasRef.current) {
        const dataUrl = await canvasRef.current.getHighResDataUrl(2);
        if (dataUrl) {
          setExportDataUrl(dataUrl);
          setIsExportOpen(true);
          try {
            realP2PService.sendStripToPhones(dataUrl, selectedFrame.name);
          } catch {}
        }
      }
    } catch (err) {
      console.error('Failed to export high-res canvas:', err);
      // Fallback with first photo if any
      setIsExportOpen(true);
    }
  };

  // Prepare strip data URL on demand when opening Bluetooth modal
  const handlePrepareBluetoothStrip = async () => {
    if (canvasRef.current) {
      const dataUrl = await canvasRef.current.getHighResDataUrl(2);
      setExportDataUrl(dataUrl);
      setIsBluetoothOpen(true);
    } else {
      setIsBluetoothOpen(true);
    }
  };

  // Auto fill with fresh mock portraits
  const handleRandomizeMockPhotos = () => {
    const shuffled = [...SAMPLE_PORTRAITS].sort(() => Math.random() - 0.5);
    const newPhotos: PhotoData[] = [];
    for (let i = 0; i < selectedFrame.slotCount; i++) {
      newPhotos.push({
        id: `mock-${Date.now()}-${i}`,
        slotIndex: i,
        dataUrl: shuffled[i % shuffled.length],
        filter: 'none',
        zoom: 1.0,
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
        mirror: false,
      });
    }
    setPhotos(newPhotos);
  };

  // IF IN DEDICATED FRAME STUDIO SCREEN MODE
  if (currentScreen === 'studio') {
    return (
      <FrameStudioScreen
        initialFrame={editingFrameTarget || selectedFrame}
        activePhotos={photos}
        customFrames={customFrames}
        onBack={() => {
          setCurrentScreen('home');
          setEditingFrameTarget(null);
        }}
        onSaveAndApply={handleSaveFromStudio}
        onDeleteCustomFrame={handleDeleteCustomFrame}
        onSelectFrame={handleSelectFrame}
      />
    );
  }

  // MAIN SCREEN VIEW (2-COLUMN: LEFT = PREVIEW, RIGHT = FRAME SELECTOR)
  return (
    <div className="h-full min-h-screen w-full overflow-hidden flex flex-col bg-[#FFF5F8] select-none pb-[env(safe-area-inset-bottom,0px)]">
      {/* Dynamic Island Floating Notification for Bluetooth Transfers & Status */}
      <BluetoothStatusToast />

      {/* Top Navigation */}
      <Navbar
        currentMode={currentMode}
        onSelectMode={setCurrentMode}
        onOpenCustomFrame={() => handleOpenFrameStudio(selectedFrame)}
        onStartCameraModal={() => setIsCameraOpen(true)}
        onOpenDeviceHub={() => setIsDeviceHubOpen(true)}
        onOpenBluetooth={handlePrepareBluetoothStrip}
        connectedBluetoothCount={connectedBluetoothCount}
        isMockMode={isMockCamera}
        onToggleMockMode={handleToggleMockMode}
      />

      {/* Main Workspace Layout: 2 Columns on Desktop & iPad (Left: Live Preview Strip; Right: Frame Selector) */}
      <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-2 sm:px-3.5 pt-2 sm:pt-3 pb-2 sm:pb-3 flex flex-col overflow-hidden">
        
        {/* Mobile View Switcher (Only visible on small phones < 768px, iPad & Desktop show both) */}
        <div className="flex md:hidden items-center justify-center p-0.5 bg-pink-100/80 rounded-xl mb-1.5 shrink-0 gap-1 w-full max-w-xs mx-auto">
          <button
            type="button"
            onClick={() => setMobileViewTab('preview')}
            className={`flex-1 py-1 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              mobileViewTab === 'preview'
                ? 'bg-white text-pink-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-pink-600" />
            <span>Dải Ảnh</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileViewTab('frames')}
            className={`flex-1 py-1 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              mobileViewTab === 'frames'
                ? 'bg-white text-pink-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span>Chọn Khung</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-2.5 items-stretch flex-1 min-h-0 w-full overflow-hidden">
          
          {/* LEFT COLUMN: LIVE PHOTO STRIP PREVIEW & QUICK PHOTO ACTIONS */}
          <section className={`md:col-span-5 h-full max-h-full flex-col bg-white/95 backdrop-blur-xl rounded-2xl p-2.5 sm:p-3 border border-pink-100/80 shadow-xs overflow-hidden min-h-0 ${
            mobileViewTab === 'preview' ? 'flex' : 'hidden md:flex'
          }`}>
            
            {/* 1. Header of Preview Box: Name & Quick Layout Switcher */}
            <div className="w-full flex items-center justify-between pb-1.5 mb-1 border-b border-pink-100/60 shrink-0">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse shrink-0" />
                <span className="font-bold text-xs sm:text-sm text-gray-800 truncate">{selectedFrame.name}</span>
                <button
                  type="button"
                  onClick={() => handleOpenFrameStudio(selectedFrame)}
                  title="Chỉnh sửa khung này trong Studio"
                  className="p-1 rounded-md hover:bg-pink-100 text-purple-600 transition-colors shrink-0 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Layout Switcher (2 ảnh 4x6, 3 ảnh dọc, 4 ảnh dọc, 6 ảnh lưới) */}
              <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-xl shrink-0 border border-gray-200/60">
                <button
                  type="button"
                  onClick={() => handleSwitchLayout(2)}
                  className={`py-0.5 px-1.5 sm:px-2 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${
                    selectedFrame.slotCount === 2
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Đổi khung thành 2 ảnh (Khổ 4x6 inch Postcard)"
                >
                  <span>📸 2 Ảnh (4x6)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchLayout(3)}
                  className={`py-0.5 px-1.5 sm:px-2 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${
                    selectedFrame.slotCount === 3
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Đổi khung thành 3 ảnh dọc (3-Cut Strip)"
                >
                  <span>📐 3 Dọc</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchLayout(4)}
                  className={`py-0.5 px-1.5 sm:px-2 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${
                    selectedFrame.slotCount === 4
                      ? 'bg-pink-600 text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Đổi khung thành 4 ảnh dọc (Chuẩn Life4Cuts)"
                >
                  <span>🎞️ 4 Dọc</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchLayout(6)}
                  className={`py-0.5 px-1.5 sm:px-2 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${
                    selectedFrame.slotCount === 6
                      ? 'bg-teal-600 text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Đổi khung thành 6 ô ảnh (Lưới 2x3)"
                >
                  <span>🖼️ 6 Ô</span>
                </button>
              </div>
            </div>

            {/* 1.5 Quick Toolbar: Header/Footer Text & Background Image */}
            <div className="w-full flex items-center justify-between px-2 py-1 mb-1 bg-pink-50/70 border border-pink-100/80 rounded-xl shrink-0">
              {/* Left: Background image quick actions */}
              <div className="flex items-center gap-1.5 overflow-hidden">
                <input
                  ref={homeBgFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleHomeUploadBackground}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => homeBgFileInputRef.current?.click()}
                  className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                    selectedFrame.backgroundImage
                      ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
                      : 'bg-white text-gray-500 border-gray-200 hover:text-gray-800 hover:border-gray-300'
                  }`}
                  title={selectedFrame.backgroundImage ? 'Bấm để đổi ảnh nền khác từ máy' : 'Chọn ảnh từ máy làm nền phía sau khung'}
                >
                  <Upload className="w-2.5 h-2.5" />
                  <span>{selectedFrame.backgroundImage ? '🖼️ Đổi nền' : '🖼️ Nền ảnh'}</span>
                </button>
                {selectedFrame.backgroundImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFrame((prev) => ({
                        ...prev,
                        backgroundImage: undefined,
                        backgroundImageConfig: undefined,
                      }));
                    }}
                    title="Gỡ ảnh nền hiện tại"
                    className="p-0.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Right: Header / Footer Text Toggles */}
              <div className="flex items-center gap-1">
                {/* Header text toggle button */}
                <button
                  type="button"
                  onClick={handleToggleHeaderText}
                  className={`px-1.5 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all flex items-center gap-0.5 cursor-pointer border ${
                    selectedFrame.showHeader !== false && Boolean(selectedFrame.headerText)
                      ? 'bg-emerald-500 text-white border-emerald-600 shadow-2xs hover:bg-emerald-600'
                      : 'bg-white text-gray-400 border-gray-200 hover:text-gray-600 hover:border-gray-300'
                  }`}
                  title={
                    selectedFrame.showHeader !== false && Boolean(selectedFrame.headerText)
                      ? 'Nhấn để TẮT chữ đầu khung (Header)'
                      : 'Nhấn để BẬT chữ đầu khung (Header)'
                  }
                >
                  <span>
                    {selectedFrame.showHeader !== false && Boolean(selectedFrame.headerText)
                      ? '✓ Đầu: BẬT'
                      : '✕ Đầu: TẮT'}
                  </span>
                </button>

                {/* Footer text toggle button */}
                <button
                  type="button"
                  onClick={handleToggleFooterText}
                  className={`px-1.5 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all flex items-center gap-0.5 cursor-pointer border ${
                    selectedFrame.showFooter !== false && Boolean(selectedFrame.footerText)
                      ? 'bg-emerald-500 text-white border-emerald-600 shadow-2xs hover:bg-emerald-600'
                      : 'bg-white text-gray-400 border-gray-200 hover:text-gray-600 hover:border-gray-300'
                  }`}
                  title={
                    selectedFrame.showFooter !== false && Boolean(selectedFrame.footerText)
                      ? 'Nhấn để TẮT chữ cuối khung (Footer)'
                      : 'Nhấn để BẬT chữ cuối khung (Footer)'
                  }
                >
                  <span>
                    {selectedFrame.showFooter !== false && Boolean(selectedFrame.footerText)
                      ? '✓ Cuối: BẬT'
                      : '✕ Cuối: TẮT'}
                  </span>
                </button>
              </div>
            </div>

            {/* 2. 📸 PRIMARY PHOTO OPERATIONS TOOLBAR - DUAL MAIN ACTIONS: CHỤP HOẶC TẢI ẢNH */}
            <div className="w-full flex flex-col gap-1.5 mb-1 shrink-0">
              {/* Row 1: Dual Primary Actions - Shoot with Camera OR Upload from Device */}
              <div className="grid grid-cols-2 gap-1.5">
                {/* Option 1: Live Camera Shutter */}
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="py-2 px-3 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 hover:scale-101 cursor-pointer"
                  title="Bật camera chụp ảnh trực tiếp"
                >
                  <Camera className="w-4 h-4 text-white animate-pulse shrink-0" />
                  <span className="truncate">Chụp Camera</span>
                  <span className="text-[10px] bg-white/25 px-1.5 py-0.2 rounded-full font-bold shrink-0">
                    {selectedFrame.slotCount}
                  </span>
                </button>

                {/* Option 2: Upload Photos from Device */}
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(true)}
                  className="py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 hover:scale-101 cursor-pointer"
                  title="Tải ảnh có sẵn từ máy tính hoặc điện thoại thay vì chụp"
                >
                  <Upload className="w-4 h-4 text-white shrink-0" />
                  <span className="truncate">Tải Ảnh Từ Máy</span>
                  <span className="text-[10px] bg-white/25 px-1.5 py-0.2 rounded-full font-bold shrink-0">
                    {selectedFrame.slotCount}
                  </span>
                </button>
              </div>

              {/* Row 2: 3 Utility Action Buttons */}
              <div className="grid grid-cols-3 gap-1.5">
                {/* Print / Export */}
                <button
                  type="button"
                  onClick={handleOpenExport}
                  className="py-1 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-1 active:scale-95 hover:scale-102 cursor-pointer"
                  title="In ảnh máy Canon CP1500 & Tải về"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">In & Xuất</span>
                </button>

                {/* Zoom Preview Button */}
                <button
                  type="button"
                  onClick={handleOpenMainLightbox}
                  disabled={isLightboxLoading}
                  className="py-1 px-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-1 active:scale-95 hover:scale-102 cursor-pointer disabled:opacity-50"
                  title="Phóng to toàn màn hình xem ảnh 300 DPI"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span className="truncate">{isLightboxLoading ? 'Đang mở...' : 'Phóng To'}</span>
                </button>

                {/* Randomize Mock Photos */}
                <button
                  type="button"
                  onClick={handleRandomizeMockPhotos}
                  title="Đổi sang bộ ảnh mẫu khác để xem trước"
                  className="py-1 px-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow-2xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Đổi Mẫu</span>
                </button>
              </div>
            </div>

            {/* 3. Canvas Preview Area - Responsive to available middle vertical space */}
            <div className="flex-1 min-h-0 w-full flex items-center justify-center py-0.5 overflow-hidden">
              <CanvasRenderer
                ref={canvasRef}
                frame={selectedFrame}
                photos={photos}
                stickers={stickers}
                onUploadPhotoToSlot={handleUploadPhotoToSlot}
                onRemovePhotoFromSlot={handleRemovePhotoFromSlot}
                onUpdatePhoto={handleUpdatePhoto}
                onUpdateSticker={handleUpdateSticker}
                onRemoveSticker={handleRemoveSticker}
                onOpenLightbox={handleOpenMainLightbox}
              />
            </div>
          </section>

          {/* RIGHT COLUMN: FRAME SELECTOR GALLERY */}
          <section className={`md:col-span-7 h-full max-h-full flex-col min-h-0 overflow-hidden ${
            mobileViewTab === 'frames' ? 'flex' : 'hidden md:flex'
          }`}>
            <FrameSelector
              selectedFrame={selectedFrame}
              onSelectFrame={handleSelectFrame}
              customFrames={customFrames}
              presetFrames={availablePresetFrames}
              onCreateNewFrame={(slotCount = 4) => handleOpenFrameStudio(null, (slotCount as 2 | 3 | 4 | 6) || 4)}
              onEditCurrentFrame={(frame) => handleOpenFrameStudio(frame || selectedFrame)}
              onDeleteCustomFrame={handleDeleteCustomFrame}
              onDuplicateCustomFrame={handleDuplicateCustomFrame}
              onRestorePresetFrames={handleRestorePresetFrames}
              deletedPresetCount={deletedPresetIds.length}
            />
          </section>

        </div>

      </main>

      {/* Modals */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        requiredPhotos={selectedFrame.slotCount}
        onPhotosCaptured={handlePhotosCaptured}
        isMockMode={isMockCamera}
        onMockModeChange={(isMock) => setIsMockCamera(isMock)}
      />

      {/* Photo Uploader Modal (Upload ảnh từ máy thay vì chụp) */}
      <PhotoUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        slotCount={selectedFrame.slotCount}
        currentPhotos={photos}
        onApplyPhotos={(newPhotos) => setPhotos(newPhotos)}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        singleStripDataUrl={exportDataUrl}
        aspectRatio={selectedFrame.aspectRatio}
        onOpenBluetooth={handlePrepareBluetoothStrip}
        onStartNewShoot={() => {
          setIsExportOpen(false);
          setIsCameraOpen(true);
        }}
      />

      <DeviceHubModal
        isOpen={isDeviceHubOpen}
        onClose={() => setIsDeviceHubOpen(false)}
        onOpenBluetooth={handlePrepareBluetoothStrip}
        isMockMode={isMockCamera}
        onToggleMockMode={handleToggleMockMode}
      />

      <BluetoothModal
        isOpen={isBluetoothOpen}
        onClose={() => setIsBluetoothOpen(false)}
        onTriggerShutter={() => setIsCameraOpen(true)}
        onPhotoReceived={(_url) => {
          // Handled in subscriber
        }}
        currentStripDataUrl={exportDataUrl || (photos[0]?.dataUrl ?? '')}
      />

      {/* FULLSCREEN LIGHTBOX ZOOM MODAL (DIRECT FROM HOME SCREEN) */}
      <ImageLightboxModal
        isOpen={isMainLightboxOpen}
        onClose={() => setIsMainLightboxOpen(false)}
        imageUrl={mainLightboxDataUrl}
        title={selectedFrame.name}
        subtitle={`${selectedFrame.aspectRatio} • 300 DPI HD`}
        isSaved={isMainLightboxSaved}
        onDownload={async () => {
          if (!mainLightboxDataUrl) return;
          setIsMainLightboxSaved(true);
          await printService.downloadImage(
            mainLightboxDataUrl,
            `photoxinhh_${selectedFrame.aspectRatio}_${Date.now()}.png`
          );
          setTimeout(() => setIsMainLightboxSaved(false), 3000);
        }}
        onPrint={async () => {
          if (!mainLightboxDataUrl) return;
          await printService.printImage(mainLightboxDataUrl, selectedFrame.name);
        }}
      />
    </div>
  );
}
