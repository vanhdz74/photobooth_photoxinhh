import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Upload,
  Image as ImageIcon,
  Trash2,
  Check,
  Plus,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from 'lucide-react';
import { PhotoData } from '../types/photobooth';
import { sounds } from '../utils/audio';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  slotCount: number;
  currentPhotos: PhotoData[];
  onApplyPhotos: (newPhotos: PhotoData[]) => void;
}

interface StagedPhoto {
  slotIndex: number;
  dataUrl: string;
  name?: string;
}

export const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
  isOpen,
  onClose,
  slotCount,
  currentPhotos,
  onApplyPhotos,
}) => {
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const singleSlotInputRef = useRef<HTMLInputElement>(null);
  const targetSlotIndexRef = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync with current photos when modal opens
  useEffect(() => {
    if (isOpen) {
      const initial: StagedPhoto[] = [];
      for (let i = 0; i < slotCount; i++) {
        const found = currentPhotos.find((p) => p.slotIndex === i);
        if (found && found.dataUrl) {
          initial.push({
            slotIndex: i,
            dataUrl: found.dataUrl,
          });
        }
      }
      setStagedPhotos(initial);
    }
  }, [isOpen, slotCount, currentPhotos]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, [isOpen]);

  // Read files to data URLs
  const readFilesToDataUrls = async (files: File[]): Promise<string[]> => {
    const promises = files.map(
      (file) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string) || '');
          reader.onerror = () => resolve('');
          reader.readAsDataURL(file);
        })
    );
    const results = await Promise.all(promises);
    return results.filter(Boolean);
  };

  // Handle batch selection
  const handleProcessBatchFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setIsLoading(true);
    try {
      const imageFiles = files.filter((f) => f.type.startsWith('image/'));
      if (imageFiles.length === 0) return;

      const urls = await readFilesToDataUrls(imageFiles.slice(0, slotCount));
      const newStaged: StagedPhoto[] = urls.map((url, idx) => ({
        slotIndex: idx,
        dataUrl: url,
      }));

      setStagedPhotos(newStaged);
      sounds.playSuccessChime();
    } catch (err) {
      console.error('Lỗi khi đọc file ảnh:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      await handleProcessBatchFiles(files);
    }
  };

  // Individual slot upload
  const handleOpenSingleSlotUpload = (slotIndex: number) => {
    targetSlotIndexRef.current = slotIndex;
    singleSlotInputRef.current?.click();
  };

  const handleSingleSlotFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const targetSlot = targetSlotIndexRef.current;
    const urls = await readFilesToDataUrls([file]);
    if (urls.length > 0) {
      setStagedPhotos((prev) => {
        const filtered = prev.filter((p) => p.slotIndex !== targetSlot);
        return [...filtered, { slotIndex: targetSlot, dataUrl: urls[0] }].sort(
          (a, b) => a.slotIndex - b.slotIndex
        );
      });
      sounds.playSuccessChime();
    }
    if (singleSlotInputRef.current) singleSlotInputRef.current.value = '';
  };

  // Remove photo from specific slot
  const handleRemovePhoto = (slotIndex: number) => {
    setStagedPhotos((prev) => prev.filter((p) => p.slotIndex !== slotIndex));
  };

  // Clear all staged photos
  const handleClearAll = () => {
    setStagedPhotos([]);
  };

  // Swap position of two slots
  const handleSwapSlots = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= slotCount) return;
    setStagedPhotos((prev) => {
      const fromPhoto = prev.find((p) => p.slotIndex === fromIndex);
      const toPhoto = prev.find((p) => p.slotIndex === toIndex);

      const filtered = prev.filter(
        (p) => p.slotIndex !== fromIndex && p.slotIndex !== toIndex
      );

      const nextList: StagedPhoto[] = [...filtered];
      if (fromPhoto) {
        nextList.push({ ...fromPhoto, slotIndex: toIndex });
      }
      if (toPhoto) {
        nextList.push({ ...toPhoto, slotIndex: fromIndex });
      }
      return nextList.sort((a, b) => a.slotIndex - b.slotIndex);
    });
  };

  // Apply staged photos to main app
  const handleApply = () => {
    const newPhotos: PhotoData[] = stagedPhotos.map((item) => ({
      id: `uploaded-${Date.now()}-${item.slotIndex}`,
      slotIndex: item.slotIndex,
      dataUrl: item.dataUrl,
      filter: 'none',
      zoom: 1.0,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      mirror: false,
    }));

    onApplyPhotos(newPhotos);
    sounds.playSuccessChime();
    onClose();
  };

  if (!isOpen || !mounted) return null;

  const filledCount = stagedPhotos.length;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tải ảnh từ máy"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Hidden file inputs */}
      <input
        ref={batchFileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          handleProcessBatchFiles(files);
          if (batchFileInputRef.current) batchFileInputRef.current.value = '';
        }}
        className="hidden"
      />

      <input
        ref={singleSlotInputRef}
        type="file"
        accept="image/*"
        onChange={handleSingleSlotFileChange}
        className="hidden"
      />

      {/* Modal Dialog Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-pink-100 flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-pink-100 bg-gradient-to-r from-pink-50/80 via-white to-purple-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 text-white flex items-center justify-center shadow-xs">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-gray-800 leading-tight">
                Tải Ảnh Từ Máy Lên Khung
              </h3>
              <p className="text-xs text-gray-400">
                Chọn {slotCount} ảnh có sẵn từ thiết bị thay vì chụp trực tiếp
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="Đóng (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4">
          {/* Drag & Drop Quick Batch Upload Box */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => batchFileInputRef.current?.click()}
            className={`w-full p-5 sm:p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2 ${
              isDragging
                ? 'border-pink-500 bg-pink-50/90 scale-[1.01]'
                : 'border-pink-200 hover:border-pink-400 bg-gradient-to-b from-pink-50/40 to-purple-50/20 hover:bg-pink-50/60'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-pink-100 text-pink-600 flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">
                {isLoading ? 'Đang đọc ảnh...' : 'Nhấn để chọn ảnh hoặc Kéo thả ảnh vào đây'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Hỗ trợ chọn cùng lúc {slotCount} ảnh (JPG, PNG, WebP)
              </p>
            </div>
            <button
              type="button"
              className="mt-1 py-1.5 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Chọn Cả {slotCount} Ảnh Từ Máy</span>
            </button>
          </div>

          {/* Slots Preview & Ordering Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-pink-500" />
                <span>
                  Các Ô Ảnh ({filledCount}/{slotCount} đã chọn)
                </span>
              </span>
              {filledCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Xóa hết</span>
                </button>
              )}
            </div>

            <div
              className={`grid gap-3 ${
                slotCount === 2
                  ? 'grid-cols-2'
                  : slotCount === 3
                  ? 'grid-cols-3'
                  : slotCount === 6
                  ? 'grid-cols-2 sm:grid-cols-3'
                  : 'grid-cols-2 sm:grid-cols-4'
              }`}
            >
              {Array.from({ length: slotCount }).map((_, idx) => {
                const photo = stagedPhotos.find((p) => p.slotIndex === idx);

                return (
                  <div
                    key={idx}
                    className="relative flex flex-col rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 shadow-2xs group"
                  >
                    {/* Slot Header Label */}
                    <div className="px-2.5 py-1 bg-white border-b border-gray-100 flex items-center justify-between text-[11px] font-bold text-gray-700">
                      <span>Ô #{idx + 1}</span>
                      {photo && (
                        <div className="flex items-center gap-0.5">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleSwapSlots(idx, idx - 1)}
                              className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                              title="Đổi lên trước"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                          )}
                          {idx < slotCount - 1 && (
                            <button
                              type="button"
                              onClick={() => handleSwapSlots(idx, idx + 1)}
                              className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                              title="Đổi xuống sau"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Slot Thumbnail or Empty Button */}
                    <div className="relative aspect-[4/5] w-full bg-gray-100 flex items-center justify-center overflow-hidden">
                      {photo ? (
                        <>
                          <img
                            src={photo.dataUrl}
                            alt={`Ô ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {/* Hover Actions Overlay */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                            <button
                              type="button"
                              onClick={() => handleOpenSingleSlotUpload(idx)}
                              className="p-2 rounded-xl bg-white/90 hover:bg-white text-gray-800 shadow-sm transition-all"
                              title="Đổi ảnh này"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(idx)}
                              className="p-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all"
                              title="Xóa ảnh ô này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenSingleSlotUpload(idx)}
                          className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-gray-400 hover:text-pink-600 hover:bg-pink-50/50 transition-all cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 group-hover:text-pink-500 mb-1">
                            <Plus className="w-4 h-4" />
                          </div>
                          <span className="text-[11px] font-bold">Thêm ảnh</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-pink-100 bg-gray-50/80 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs transition-all cursor-pointer"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={filledCount === 0}
            className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Áp Dụng Vào Khung ({filledCount}/{slotCount})</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
