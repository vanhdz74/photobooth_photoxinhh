import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Printer,
  Eye,
  Check,
  Move,
} from 'lucide-react';

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
  subtitle?: string;
  onDownload?: () => void;
  onPrint?: () => void;
  isSaved?: boolean;
  isPrinting?: boolean;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title = 'Xem Chi Tiết Ảnh HD',
  subtitle = '300 DPI Siêu Nét',
  onDownload,
  onPrint,
  isSaved = false,
  isPrinting = false,
}) => {
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedRef = useRef<boolean>(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Universal dismiss handler that stops propagation and cleans up
  const handleDismiss = useCallback(
    (e?: React.MouseEvent | React.TouchEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      onClose();
    },
    [onClose]
  );

  // Reset zoom and pan whenever modal opens or image changes
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
      hasMovedRef.current = false;
    }
  }, [isOpen, imageUrl]);

  // Handle Keyboard Shortcuts (ESC, +, -, 0)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setScale((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setScale((prev) => Math.max(0.5, Number((prev - 0.25).toFixed(2))));
      } else if (e.key === '0') {
        e.preventDefault();
        setScale(1);
        setPosition({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDismiss]);

  // Handle Mouse Wheel to Zoom in/out
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
    setScale((prev) => {
      const next = Math.min(4, Math.max(0.5, Number((prev + zoomFactor).toFixed(2))));
      if (next === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  // Handle Double Click to Toggle Quick Zoom (1x <-> 2x)
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale > 1.2) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2);
    }
  };

  // Pan / Drag Handlers (Mouse & Touch)
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag with left mouse button
    if (e.button !== 0) return;
    setIsDragging(true);
    hasMovedRef.current = false;
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    if (Math.abs(dx - position.x) > 4 || Math.abs(dy - position.y) > 4) {
      hasMovedRef.current = true;
    }
    setPosition({ x: dx, y: dy });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile / iPad / Kiosk touchscreens
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      hasMovedRef.current = false;
      const touch = e.touches[0];
      dragStartRef.current = {
        x: touch.clientX - position.x,
        y: touch.clientY - position.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStartRef.current.x;
    const dy = touch.clientY - dragStartRef.current.y;

    if (Math.abs(dx - position.x) > 4 || Math.abs(dy - position.y) > 4) {
      hasMovedRef.current = true;
    }
    setPosition({ x: dx, y: dy });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Dismiss when clicking on the dark backdrop if not dragging
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (hasMovedRef.current) return;
    // Dismiss if click is directly on outer container or viewport background
    if (
      e.target === e.currentTarget ||
      e.target === viewportRef.current ||
      e.target === imageContainerRef.current
    ) {
      handleDismiss(e);
    }
  };

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const modalContent = (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-between p-2 sm:p-5 select-none animate-in fade-in duration-200"
      style={{ touchAction: 'none' }}
    >
      {/* 1. TOP HEADER & CONTROLS */}
      <header
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl flex items-center justify-between bg-white/10 backdrop-blur-md px-3 sm:px-5 py-2 rounded-2xl border border-white/20 text-white shadow-xl z-20 gap-2"
      >
        {/* Title & Info */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-pink-500/30 text-pink-300 flex items-center justify-center shrink-0">
            <Eye className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-xs sm:text-sm text-white font-cute truncate leading-tight flex items-center gap-2">
              <span className="truncate">{title}</span>
              <span className="text-[10px] bg-pink-500/40 text-pink-200 px-2 py-0.5 rounded-md font-sans font-semibold shrink-0">
                {subtitle}
              </span>
            </h3>
            <p className="text-[10px] text-gray-300 hidden sm:block truncate">
              Nhấp đúp hoặc lăn chuột để phóng to • Kéo để di chuyển • Nhấp nền để đóng
            </p>
          </div>
        </div>

        {/* Zoom Controls Bar */}
        <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/15 shrink-0">
          {/* Zoom Out Button */}
          <button
            type="button"
            onClick={() => setScale((prev) => Math.max(0.5, Number((prev - 0.25).toFixed(2))))}
            className="w-8 h-8 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-white/20 active:bg-white/30 rounded-lg text-white/90 hover:text-white transition-all cursor-pointer active:scale-95"
            title="Thu nhỏ (-)"
            aria-label="Thu nhỏ"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Reset 100% / Fit Button */}
          <button
            type="button"
            onClick={() => {
              setScale(1);
              setPosition({ x: 0, y: 0 });
            }}
            className="px-2.5 py-1 text-xs font-bold hover:bg-white/20 active:bg-white/30 rounded-lg text-pink-300 hover:text-white transition-all cursor-pointer min-w-[50px] text-center active:scale-95"
            title="Khôi phục 100% vừa màn hình (Phím 0)"
          >
            {Math.round(scale * 100)}%
          </button>

          {/* Zoom In Button */}
          <button
            type="button"
            onClick={() => setScale((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))))}
            className="w-8 h-8 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-white/20 active:bg-white/30 rounded-lg text-white/90 hover:text-white transition-all cursor-pointer active:scale-95"
            title="Phóng to (+)"
            aria-label="Phóng to"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* 200% Quick Button */}
          <button
            type="button"
            onClick={() => {
              setScale(2);
            }}
            className="hidden sm:flex px-2.5 py-1 text-[11px] font-semibold hover:bg-white/20 active:bg-white/30 rounded-lg text-gray-300 hover:text-white transition-all cursor-pointer active:scale-95 items-center justify-center"
            title="Phóng to 200% siêu nét"
          >
            2x
          </button>

          {/* Reset position button */}
          <button
            type="button"
            onClick={() => {
              setScale(1);
              setPosition({ x: 0, y: 0 });
            }}
            className="w-8 h-8 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-white/20 active:bg-white/30 rounded-lg text-white/90 hover:text-white transition-all cursor-pointer active:scale-95"
            title="Đặt lại vị trí ban đầu"
            aria-label="Đặt lại vị trí"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Header Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          onTouchEnd={handleDismiss}
          className="flex items-center gap-1.5 py-1.5 px-3 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-xl transition-all cursor-pointer shadow-md font-bold text-xs shrink-0 active:scale-95 border border-white/20"
          title="Đóng (Phím Esc)"
        >
          <X className="w-4 h-4 stroke-[2.5]" />
          <span className="hidden sm:inline">Đóng</span>
        </button>
      </header>

      {/* 2. CENTER IMAGE VIEWPORT (PAN / ZOOM / DRAG AREA) */}
      <div
        ref={viewportRef}
        onClick={handleBackdropClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`flex-1 w-full max-w-6xl flex items-center justify-center overflow-hidden my-2 relative touch-none select-none ${
          isDragging ? 'cursor-grabbing' : scale > 1 ? 'cursor-grab' : 'cursor-zoom-in'
        }`}
      >
        <div
          ref={imageContainerRef}
          onClick={handleBackdropClick}
          onDoubleClick={handleDoubleClick}
          className="transition-transform duration-75 ease-out flex items-center justify-center will-change-transform max-h-full max-w-full"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Photobooth Full View"
              draggable={false}
              onClick={(e) => {
                // Prevent clicking on the image from closing
                e.stopPropagation();
              }}
              className="max-h-[76vh] w-auto max-w-[88vw] object-contain rounded-2xl shadow-2xl border-2 border-white/25 select-none"
            />
          ) : (
            <div className="w-64 h-96 bg-gray-900 rounded-2xl flex items-center justify-center text-gray-400 text-xs border border-white/10">
              Đang kết xuất ảnh...
            </div>
          )}
        </div>

        {/* Floating Pan Hint when Zoomed */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-full text-[11px] text-pink-200 border border-white/20 flex items-center gap-1.5 shadow-xl pointer-events-none animate-in fade-in">
          <Move className="w-3.5 h-3.5 text-pink-400" />
          <span>
            {scale > 1
              ? 'Giữ & kéo để di chuyển • Nhấp đúp để thu nhỏ • Nhấp nền để đóng'
              : 'Nhấp đúp ảnh để phóng to • Nhấp nền tối hoặc nút X để đóng'}
          </span>
        </div>
      </div>

      {/* 3. BOTTOM ACTION BAR */}
      <footer
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl flex items-center justify-between gap-2.5 bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/20 z-20 shadow-xl"
      >
        {/* Quick Close / Exit Button */}
        <button
          type="button"
          onClick={handleDismiss}
          onTouchEnd={handleDismiss}
          className="py-2.5 px-4 rounded-xl bg-white/20 hover:bg-rose-600 active:bg-rose-700 text-white font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs border border-white/10"
        >
          <X className="w-4 h-4 stroke-[2.5]" />
          <span>Thoát</span>
        </button>

        {/* Download Action if provided */}
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isSaved ? <Check className="w-4 h-4 text-amber-300" /> : <Download className="w-4 h-4" />}
            <span>{isSaved ? '✓ Đã Lưu' : 'Lưu Ảnh Về Máy'}</span>
          </button>
        )}

        {/* Print Action if provided */}
        {onPrint && (
          <button
            type="button"
            onClick={onPrint}
            disabled={isPrinting}
            className="flex-1 py-2.5 px-4 rounded-xl bg-white text-gray-900 hover:bg-gray-100 font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-pink-600" />
            <span>{isPrinting ? 'Đang In...' : 'In Dải Ảnh'}</span>
          </button>
        )}
      </footer>
    </div>
  );

  return createPortal(modalContent, document.body);
};
