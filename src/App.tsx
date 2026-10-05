import React, { useState, useRef, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CanvasRenderer, CanvasRendererHandle } from './components/CanvasRenderer';
import { FrameSelector } from './components/FrameSelector';
import { FrameStudioScreen } from './components/FrameStudioScreen';
import { CameraCaptureModal } from './components/CameraCaptureModal';
import { ExportModal } from './components/ExportModal';
import { DeviceHubModal } from './components/DeviceHubModal';
import { BluetoothModal } from './components/BluetoothModal';
import { BluetoothStatusToast } from './components/BluetoothStatusToast';
import { PhoneRemoteView } from './components/PhoneRemoteView';
import { AdBanner } from './components/AdBanner';
import { PRESET_FRAMES } from './templates/presetFrames';
import { SAMPLE_PORTRAITS } from './templates/samplePhotos';
import { FrameTemplate, PhotoData, StickerItem, AppMode } from './types/photobooth';
import { bluetoothService } from './services/bluetoothService';
import { realP2PService, P2PMessage } from './services/realP2PService';
import { sounds } from './utils/audio';
import { Download, Camera, Upload, RefreshCw, Bluetooth, Edit3 } from 'lucide-react';
import { StripDownloadView } from './components/StripDownloadView';

import { ErrorBoundary } from './components/ErrorBoundary';
import { safeGetItem, safeSetItem } from './utils/safeStorage';

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

  const [selectedFrame, setSelectedFrame] = useState<FrameTemplate>(PRESET_FRAMES[0]);

  // Sync customFrames to safeStorage
  useEffect(() => {
    try {
      safeSetItem('photobooth_custom_frames_v3', JSON.stringify(customFrames));
    } catch (e) {
      console.error('Failed to persist custom frames to storage', e);
    }
  }, [customFrames]);
  
  // Photos in slots (Initialized with sample portraits)
  const [photos, setPhotos] = useState<PhotoData[]>([
    { id: '1', slotIndex: 0, dataUrl: SAMPLE_PORTRAITS[0], filter: 'none', zoom: 1.0, offsetX: 0, offsetY: 0, rotation: 0, mirror: false },
    { id: '2', slotIndex: 1, dataUrl: SAMPLE_PORTRAITS[1], filter: 'none', zoom: 1.0, offsetX: 0, offsetY: 0, rotation: 0, mirror: false },
    { id: '3', slotIndex: 2, dataUrl: SAMPLE_PORTRAITS[2], filter: 'none', zoom: 1.0, offsetX: 0, offsetY: 0, rotation: 0, mirror: false },
    { id: '4', slotIndex: 3, dataUrl: SAMPLE_PORTRAITS[3], filter: 'none', zoom: 1.0, offsetX: 0, offsetY: 0, rotation: 0, mirror: false },
  ]);

  const [stickers, setStickers] = useState<StickerItem[]>([]);
  const [isMockCamera, setIsMockCamera] = useState(true);

  // Screen View State: 'home' | 'studio'
  const [currentScreen, setCurrentScreen] = useState<'home' | 'studio'>('home');
  const [editingFrameTarget, setEditingFrameTarget] = useState<FrameTemplate | null>(null);

  // Modals
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isDeviceHubOpen, setIsDeviceHubOpen] = useState(false);
  const [isBluetoothOpen, setIsBluetoothOpen] = useState(false);
  const [connectedBluetoothCount, setConnectedBluetoothCount] = useState(0);
  const [exportDataUrl, setExportDataUrl] = useState<string>('');

  const canvasRef = useRef<CanvasRendererHandle>(null);
  const batchUploadRef = useRef<HTMLInputElement>(null);

  // Open Studio Screen (either for new frame or editing existing)
  const handleOpenFrameStudio = (frameToEdit?: FrameTemplate | null) => {
    if (frameToEdit) {
      setEditingFrameTarget(frameToEdit);
    } else {
      // Create new frame based on default template
      const newBlank: FrameTemplate = {
        ...JSON.parse(JSON.stringify(PRESET_FRAMES[0])),
        id: `custom-${Date.now()}`,
        name: `Khung Mẫu Mới ${customFrames.length + 1}`,
        category: 'custom',
        isCustom: true,
        stickers: [],
      };
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

  // Batch upload from computer
  const handleBatchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.slice(0, selectedFrame.slotCount).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setPhotos((prev) => {
          const filtered = prev.filter((p) => p.slotIndex !== index);
          return [
            ...filtered,
            {
              id: `batch-${Date.now()}-${index}`,
              slotIndex: index,
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
    });
    if (batchUploadRef.current) batchUploadRef.current.value = '';
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
  };

  // Delete Custom Frame
  const handleDeleteCustomFrame = (frameId: string) => {
    setCustomFrames((prev) => prev.filter((f) => f.id !== frameId));
    if (selectedFrame.id === frameId) {
      handleSelectFrame(PRESET_FRAMES[0]);
    }
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
    <div className="min-h-screen flex flex-col bg-[#FFF5F8]">
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
        onToggleMockMode={() => setIsMockCamera(!isMockCamera)}
      />

      {/* Main Workspace Layout: 2 Columns on Desktop (Left: Live Preview Strip; Right: Frame Selector) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 flex flex-col gap-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: LIVE PHOTO STRIP PREVIEW & QUICK PHOTO ACTIONS */}
          <section className="lg:col-span-5 flex flex-col items-center bg-white/90 backdrop-blur-xl rounded-3xl p-4 sm:p-6 border border-pink-100/80 shadow-xs sticky top-16">
            
            {/* Header of Preview Box */}
            <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-pink-100/60">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                <span className="font-bold text-sm text-gray-800 truncate max-w-[200px]">{selectedFrame.name}</span>
              </div>
              <span className="text-[11px] font-bold text-pink-600 bg-pink-50 px-2.5 py-0.5 rounded-full border border-pink-100/80">
                {selectedFrame.slotCount} ảnh • {selectedFrame.aspectRatio}
              </span>
            </div>

            {/* Canvas Preview Area */}
            <div className="w-full flex justify-center py-2">
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
              />
            </div>

            {/* Primary Action Buttons Directly Below the Strip */}
            <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              {/* Primary Action Button: Export */}
              <button
                type="button"
                onClick={handleOpenExport}
                className="py-2.5 px-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 hover:scale-102 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất Ảnh</span>
              </button>

              {/* Camera Capture */}
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 hover:scale-102 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Chụp Ảnh</span>
              </button>

              {/* Batch Upload */}
              <label className="py-2.5 px-3 rounded-2xl bg-pink-50 hover:bg-pink-100/80 text-pink-700 border border-pink-200/80 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 text-center shadow-2xs">
                <Upload className="w-3.5 h-3.5" />
                <span>Tải Ảnh</span>
                <input
                  ref={batchUploadRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleBatchUpload}
                  className="hidden"
                />
              </label>

              {/* Randomize Mock Photos */}
              <button
                type="button"
                onClick={handleRandomizeMockPhotos}
                title="Đổi sang bộ ảnh mẫu khác để xem trước"
                className="py-2.5 px-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Đổi Ảnh</span>
              </button>
            </div>

            {/* Quick Studio Shortcut */}
            <div className="w-full flex items-center justify-center gap-2 mt-3 pt-3 border-t border-pink-100/60">
              <button
                type="button"
                onClick={() => handleOpenFrameStudio(selectedFrame)}
                className="py-2 px-4 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Edit3 className="w-3.5 h-3.5 text-purple-600" />
                <span>Chỉnh Sửa Khung Này Trong Studio</span>
              </button>
            </div>

            {/* Bluetooth Status Link */}
            <div className="mt-2.5 text-center">
              <button
                type="button"
                onClick={handlePrepareBluetoothStrip}
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center justify-center gap-1 mx-auto font-medium"
              >
                <Bluetooth className="w-3.5 h-3.5" />
                <span>
                  {connectedBluetoothCount > 0
                    ? `Đã nối ${connectedBluetoothCount} thiết bị không dây`
                    : 'Kết nối không dây Bluetooth / Smartphone'}
                </span>
              </button>
            </div>
          </section>

          {/* RIGHT COLUMN: FRAME SELECTOR GALLERY */}
          <section className="lg:col-span-7 flex flex-col gap-4">
            <FrameSelector
              selectedFrame={selectedFrame}
              onSelectFrame={handleSelectFrame}
              customFrames={customFrames}
              onCreateNewFrame={() => handleOpenFrameStudio(null)}
              onEditCurrentFrame={(frame) => handleOpenFrameStudio(frame || selectedFrame)}
              onDeleteCustomFrame={handleDeleteCustomFrame}
              onDuplicateCustomFrame={handleDuplicateCustomFrame}
            />
          </section>

        </div>

        {/* Bottom Banner Quảng cáo */}
        <AdBanner />
      </main>

      {/* Modals */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        requiredPhotos={selectedFrame.slotCount}
        onPhotosCaptured={handlePhotosCaptured}
        isMockMode={isMockCamera}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        singleStripDataUrl={exportDataUrl}
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
        onToggleMockMode={() => setIsMockCamera(!isMockCamera)}
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
    </div>
  );
}
