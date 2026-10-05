import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { FrameTemplate, PhotoData, StickerItem } from '../types/photobooth';
import { PHOTO_FILTERS } from '../templates/presetFrames';
import { Plus, Trash2, Sliders, ZoomIn, ZoomOut, RotateCw, X } from 'lucide-react';

export interface CanvasRendererHandle {
  getHighResDataUrl: (scale?: number) => Promise<string>;
}

interface CanvasRendererProps {
  frame: FrameTemplate;
  photos: PhotoData[];
  stickers: StickerItem[];
  onUploadPhotoToSlot: (slotIndex: number, file: File) => void;
  onRemovePhotoFromSlot: (slotIndex: number) => void;
  onUpdatePhoto: (slotIndex: number, updates: Partial<PhotoData>) => void;
  onUpdateSticker?: (stickerId: string, updates: Partial<StickerItem>) => void;
  onRemoveSticker?: (stickerId: string) => void;
}

export const CanvasRenderer = forwardRef<CanvasRendererHandle, CanvasRendererProps>(({
  frame,
  photos,
  stickers,
  onUploadPhotoToSlot,
  onRemovePhotoFromSlot,
  onUpdatePhoto,
  onUpdateSticker,
  onRemoveSticker
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [targetSlotIndex, setTargetSlotIndex] = useState<number | null>(null);
  const [editingSlot, setEditingSlot] = useState<PhotoData | null>(null);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);

  // Dragging sticker state
  const [isDraggingSticker, setIsDraggingSticker] = useState<boolean>(false);
  const dragStartRef = useRef<{ stickerId: string; startX: number; startY: number; origStickerX: number; origStickerY: number } | null>(null);

  // Cached loaded images
  const loadedImagesMap = useRef<Map<string, HTMLImageElement>>(new Map());

  const loadImage = useCallback((url: string): Promise<HTMLImageElement> => {
    if (loadedImagesMap.current.has(url)) {
      return Promise.resolve(loadedImagesMap.current.get(url)!);
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loadedImagesMap.current.set(url, img);
        resolve(img);
      };
      img.onerror = (e) => reject(e);
      img.src = url;
    });
  }, []);

  const showOverlay = true;

  // Draw frame to canvas
  const renderCanvas = useCallback(async (targetCanvas: HTMLCanvasElement, renderScale = 1) => {
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    const width = frame.width * renderScale;
    const height = frame.height * renderScale;

    targetCanvas.width = width;
    targetCanvas.height = height;

    // 1. Draw Background
    if (frame.backgroundImage) {
      try {
        const bgImg = await loadImage(frame.backgroundImage);
        ctx.drawImage(bgImg, 0, 0, width, height);
      } catch (err) {
        console.warn('Failed to load background image:', err);
        ctx.fillStyle = frame.backgroundColor || '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
      }
    } else if (frame.backgroundGradient) {
      // General Gradient generator
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      if (frame.backgroundGradient.includes('#') || frame.backgroundGradient.includes('rgb')) {
        const matches = frame.backgroundGradient.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^\)]+\))/g);
        if (matches && matches.length >= 2) {
          matches.forEach((col, idx) => {
            gradient.addColorStop(idx / (matches.length - 1), col);
          });
        } else {
          gradient.addColorStop(0, frame.backgroundColor || '#FF69B4');
          gradient.addColorStop(1, '#FF1493');
        }
      } else {
        gradient.addColorStop(0, frame.backgroundColor || '#FFFFFF');
        gradient.addColorStop(1, '#F3F4F6');
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = frame.backgroundColor || '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
    }

    // Pattern Overlays (Polka dots, Grid, Diagonal Stripes, Stars, Hearts, Flowers, Film)
    if (frame.pattern && frame.pattern !== 'none') {
      ctx.save();
      if (frame.pattern === 'dots') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        const dotGap = 24 * renderScale;
        const dotRadius = 3.5 * renderScale;
        for (let y = dotGap / 2; y < height; y += dotGap) {
          for (let x = dotGap / 2; x < width; x += dotGap) {
            ctx.beginPath();
            ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (frame.pattern === 'grid') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1 * renderScale;
        const gridGap = 30 * renderScale;
        for (let x = 0; x < width; x += gridGap) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += gridGap) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      } else if (frame.pattern === 'stripes') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 12 * renderScale;
        const stripeGap = 36 * renderScale;
        for (let d = -height; d < width + height; d += stripeGap) {
          ctx.beginPath();
          ctx.moveTo(d, 0);
          ctx.lineTo(d + height, height);
          ctx.stroke();
        }
      } else if (frame.pattern === 'stars') {
        ctx.font = `${15 * renderScale}px sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const starGap = 45 * renderScale;
        for (let y = 22 * renderScale; y < height; y += starGap) {
          for (let x = 22 * renderScale; x < width; x += starGap) {
            ctx.fillText('✦', x, y);
          }
        }
      } else if (frame.pattern === 'hearts') {
        ctx.font = `${14 * renderScale}px sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const heartGap = 42 * renderScale;
        for (let y = 20 * renderScale; y < height; y += heartGap) {
          for (let x = 20 * renderScale; x < width; x += heartGap) {
            ctx.fillText('♥', x, y);
          }
        }
      } else if (frame.pattern === 'flowers') {
        ctx.font = `${15 * renderScale}px sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const flowerGap = 46 * renderScale;
        for (let y = 23 * renderScale; y < height; y += flowerGap) {
          for (let x = 23 * renderScale; x < width; x += flowerGap) {
            ctx.fillText('✿', x, y);
          }
        }
      } else if (frame.pattern === 'film') {
        ctx.fillStyle = '#FFFFFF';
        const holeSize = 18 * renderScale;
        const holeGap = 35 * renderScale;
        for (let y = 30 * renderScale; y < height - 30 * renderScale; y += holeGap) {
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(14 * renderScale, y, holeSize, holeSize * 0.7, 4 * renderScale);
            ctx.fill();
            ctx.beginPath();
            ctx.roundRect(width - 14 * renderScale - holeSize, y, holeSize, holeSize * 0.7, 4 * renderScale);
            ctx.fill();
          } else {
            ctx.fillRect(14 * renderScale, y, holeSize, holeSize * 0.7);
            ctx.fillRect(width - 14 * renderScale - holeSize, y, holeSize, holeSize * 0.7);
          }
        }
      }
      ctx.restore();
    }

    // Special Film Strip Holes decoration for classic-film frame
    if (frame.id === 'classic-film' && frame.pattern !== 'film') {
      ctx.fillStyle = '#FFFFFF';
      const holeSize = 18 * renderScale;
      const holeGap = 35 * renderScale;
      for (let y = 30 * renderScale; y < height - 30 * renderScale; y += holeGap) {
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(14 * renderScale, y, holeSize, holeSize * 0.7, 4 * renderScale);
          ctx.fill();
          ctx.beginPath();
          ctx.roundRect(width - 14 * renderScale - holeSize, y, holeSize, holeSize * 0.7, 4 * renderScale);
          ctx.fill();
        } else {
          ctx.fillRect(14 * renderScale, y, holeSize, holeSize * 0.7);
          ctx.fillRect(width - 14 * renderScale - holeSize, y, holeSize, holeSize * 0.7);
        }
      }
    }

    // 2. Draw Photo Slots
    for (const slot of frame.slots) {
      const slotX = slot.x * renderScale;
      const slotY = slot.y * renderScale;
      const slotW = slot.width * renderScale;
      const slotH = slot.height * renderScale;
      const radius = (slot.borderRadius !== undefined ? slot.borderRadius : 16) * renderScale;

      const photo = photos.find((p) => p.slotIndex === slot.id);

      ctx.save();
      // Create rounded clipping path for slot
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(slotX, slotY, slotW, slotH, radius);
      } else {
        ctx.rect(slotX, slotY, slotW, slotH);
      }
      ctx.clip();

      if (photo && photo.dataUrl) {
        try {
          const img = await loadImage(photo.dataUrl);

          // Apply CSS Filters to Canvas context
          const filterObj = PHOTO_FILTERS.find((f) => f.id === photo.filter);
          if (filterObj && filterObj.id !== 'none') {
            ctx.filter = filterObj.css;
          }

          // Calculate aspect ratio cover fit
          const imgAspect = img.width / img.height;
          const slotAspect = slotW / slotH;
          let drawW = slotW;
          let drawH = slotH;

          if (imgAspect > slotAspect) {
            drawW = slotH * imgAspect;
          } else {
            drawH = slotW / imgAspect;
          }

          // Apply zoom & offsets
          const zoom = photo.zoom || 1.0;
          drawW *= zoom;
          drawH *= zoom;

          const centerX = slotX + slotW / 2 + (photo.offsetX || 0) * renderScale;
          const centerY = slotY + slotH / 2 + (photo.offsetY || 0) * renderScale;

          ctx.save();
          if (photo.mirror) {
            ctx.translate(centerX, centerY);
            ctx.scale(-1, 1);
            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
          } else {
            ctx.drawImage(
              img,
              centerX - drawW / 2,
              centerY - drawH / 2,
              drawW,
              drawH
            );
          }
          ctx.restore();
        } catch {
          ctx.fillStyle = '#E5E7EB';
          ctx.fillRect(slotX, slotY, slotW, slotH);
        }
      } else {
        if (!frame.backgroundImage) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(slotX, slotY, slotW, slotH);
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.fillRect(slotX, slotY, slotW, slotH);
        }
        
        ctx.fillStyle = frame.backgroundImage ? '#065F46' : '#9CA3AF';
        ctx.font = `bold ${16 * renderScale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`+ Nhấn để thêm ảnh #${slot.id + 1}`, slotX + slotW / 2, slotY + slotH / 2);
      }
      ctx.restore();

      // Customizable Slot Border (Color, Width, Style)
      const borderWidth = (frame.slotBorderWidth !== undefined ? frame.slotBorderWidth : 1) * renderScale;
      if (borderWidth > 0) {
        ctx.save();
        ctx.strokeStyle = frame.slotBorderColor || 'rgba(0,0,0,0.08)';
        ctx.lineWidth = borderWidth;

        if (frame.slotBorderStyle === 'dashed') {
          ctx.setLineDash([8 * renderScale, 6 * renderScale]);
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(slotX, slotY, slotW, slotH, radius);
          } else {
            ctx.rect(slotX, slotY, slotW, slotH);
          }
          ctx.stroke();
        } else if (frame.slotBorderStyle === 'dotted') {
          ctx.setLineDash([3 * renderScale, 4 * renderScale]);
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(slotX, slotY, slotW, slotH, radius);
          } else {
            ctx.rect(slotX, slotY, slotW, slotH);
          }
          ctx.stroke();
        } else if (frame.slotBorderStyle === 'double') {
          ctx.setLineDash([]);
          // Outer stroke
          ctx.lineWidth = Math.max(1, borderWidth * 0.45);
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(slotX, slotY, slotW, slotH, radius);
          } else {
            ctx.rect(slotX, slotY, slotW, slotH);
          }
          ctx.stroke();

          // Inner stroke
          const inset = Math.max(3 * renderScale, borderWidth * 0.9);
          if (slotW > inset * 2 && slotH > inset * 2) {
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(slotX + inset, slotY + inset, slotW - inset * 2, slotH - inset * 2, Math.max(0, radius - inset));
            } else {
              ctx.rect(slotX + inset, slotY + inset, slotW - inset * 2, slotH - inset * 2);
            }
            ctx.stroke();
          }
        } else {
          ctx.setLineDash([]);
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(slotX, slotY, slotW, slotH, radius);
          } else {
            ctx.rect(slotX, slotY, slotW, slotH);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 3. Draw Foreground Overlay Image (e.g. Transparent Frame with characters on top of photos)
    if (frame.overlayImageUrl && showOverlay) {
      try {
        const overlayImg = await loadImage(frame.overlayImageUrl);
        ctx.drawImage(overlayImg, 0, 0, width, height);
      } catch (err) {
        console.warn('Failed to load overlay image:', err);
      }
    }

    // 4. Draw Header Text
    const fontFam = frame.fontFamily || "'Plus Jakarta Sans', sans-serif";
    if (frame.headerText) {
      ctx.save();
      ctx.fillStyle = frame.themeColor || '#111827';
      ctx.font = `bold ${18 * renderScale}px ${fontFam}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(frame.headerText, width / 2, 70 * renderScale);
      ctx.restore();
    }

    // 4. Draw Footer Text
    if (frame.footerText) {
      ctx.save();
      ctx.fillStyle = frame.themeColor || '#111827';
      ctx.font = `600 ${15 * renderScale}px ${fontFam}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(frame.footerText, width / 2, height - 70 * renderScale);
      ctx.restore();
    }

    // 5. Draw Stickers (Images, Text, Emojis)
    for (const sticker of stickers) {
      ctx.save();
      const sx = sticker.x * renderScale;
      const sy = sticker.y * renderScale;
      ctx.translate(sx, sy);
      if (sticker.rotation) {
        ctx.rotate((sticker.rotation * Math.PI) / 180);
      }

      if (sticker.type === 'image') {
        try {
          const sImg = await loadImage(sticker.content);
          const baseSize = (sticker.width || 120) * (sticker.scale || 1.0) * renderScale;
          const aspect = (sImg.width || 1) / (sImg.height || 1);
          let dw = baseSize;
          let dh = baseSize;
          if (aspect > 1) {
            dh = baseSize / aspect;
          } else {
            dw = baseSize * aspect;
          }
          ctx.drawImage(sImg, -dw / 2, -dh / 2, dw, dh);
        } catch {
          // fallback
        }
      } else if (sticker.type === 'text') {
        const fSize = 28 * (sticker.scale || 1.0) * renderScale;
        const fFam = sticker.fontFamily || "'Plus Jakarta Sans', sans-serif";
        ctx.font = `bold ${fSize}px ${fFam}`;
        ctx.fillStyle = sticker.color || frame.themeColor || '#111827';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sticker.content, 0, 0);
      } else {
        ctx.font = `${42 * (sticker.scale || 1.0) * renderScale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sticker.content, 0, 0);
      }
      ctx.restore();
    }
  }, [frame, photos, stickers, loadImage, showOverlay]);

  // Redraw when state changes (Render at Retina 2x resolution for razor-sharp preview)
  useEffect(() => {
    if (canvasRef.current) {
      const dpr = typeof window !== 'undefined' ? Math.min(3, Math.max(2, window.devicePixelRatio || 2)) : 2;
      renderCanvas(canvasRef.current, dpr);
    }
  }, [renderCanvas]);

  // Imperative handle to export high-res 300 DPI image (renderScale = 2.5 or 3 for crystal clear print quality)
  useImperativeHandle(ref, () => ({
    getHighResDataUrl: async (scale = 2.5) => {
      const exportCanvas = document.createElement('canvas');
      await renderCanvas(exportCanvas, scale);
      return exportCanvas.toDataURL('image/png');
    },
  }));

  const handleSlotClick = (slotIndex: number) => {
    const existing = photos.find((p) => p.slotIndex === slotIndex);
    if (existing) {
      setEditingSlot(existing);
    } else {
      setTargetSlotIndex(slotIndex);
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && targetSlotIndex !== null) {
      onUploadPhotoToSlot(targetSlotIndex, file);
      setTargetSlotIndex(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Sticker Interactive Pointer Drag handlers
  const handleStickerPointerDown = (e: React.PointerEvent, sticker: StickerItem) => {
    e.stopPropagation();
    setSelectedStickerId(sticker.id);
    setIsDraggingSticker(true);
    dragStartRef.current = {
      stickerId: sticker.id,
      startX: e.clientX,
      startY: e.clientY,
      origStickerX: sticker.x,
      origStickerY: sticker.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleStickerPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingSticker || !dragStartRef.current || !containerRef.current || !onUpdateSticker) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const scaleX = frame.width / containerRect.width;
    const scaleY = frame.height / containerRect.height;

    const deltaX = (e.clientX - dragStartRef.current.startX) * scaleX;
    const deltaY = (e.clientY - dragStartRef.current.startY) * scaleY;

    const newX = Math.round(dragStartRef.current.origStickerX + deltaX);
    const newY = Math.round(dragStartRef.current.origStickerY + deltaY);

    onUpdateSticker(dragStartRef.current.stickerId, { x: newX, y: newY });
  };

  const handleStickerPointerUp = (e: React.PointerEvent) => {
    if (isDraggingSticker) {
      setIsDraggingSticker(false);
      dragStartRef.current = null;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center p-2">
      {/* Hidden file input for slot uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />



      {/* Main Canvas with Interactive Slot & Sticker Overlays */}
      <div
        ref={containerRef}
        onClick={() => setSelectedStickerId(null)}
        className="relative photobooth-shadow rounded-2xl overflow-hidden select-none max-h-[46vh] sm:max-h-[62vh] max-w-[280px] sm:max-w-[320px] w-auto h-auto mx-auto"
        style={{
          aspectRatio: `${frame.width} / ${frame.height}`,
        }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block cursor-pointer"
        />

        {/* Clickable slot hotspot overlays */}
        {frame.slots.map((slot) => {
          const photo = photos.find((p) => p.slotIndex === slot.id);
          const leftPct = (slot.x / frame.width) * 100;
          const topPct = (slot.y / frame.height) * 100;
          const widthPct = (slot.width / frame.width) * 100;
          const heightPct = (slot.height / frame.height) * 100;

          return (
            <div
              key={slot.id}
              onClick={(e) => {
                e.stopPropagation();
                handleSlotClick(slot.id);
              }}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
              }}
              className="group absolute cursor-pointer rounded-lg transition-all duration-150 flex items-center justify-center hover:bg-pink-500/20 pointer-events-auto"
            >
              {photo ? (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-xs text-white p-2 rounded-xl flex items-center gap-2">
                  <Sliders className="w-4 h-4" />
                  <span className="text-xs font-semibold">Chỉnh sửa</span>
                </div>
              ) : (
                <div className="opacity-0 group-hover:opacity-100 bg-pink-500 text-white p-2 rounded-full shadow-lg">
                  <Plus className="w-5 h-5" />
                </div>
              )}
            </div>
          );
        })}

        {/* Interactive Draggable Sticker Elements on Top */}
        {stickers.map((stk) => {
          const isSelected = selectedStickerId === stk.id;
          const leftPct = (stk.x / frame.width) * 100;
          const topPct = (stk.y / frame.height) * 100;

          return (
            <div
              key={stk.id}
              onPointerDown={(e) => handleStickerPointerDown(e, stk)}
              onPointerMove={handleStickerPointerMove}
              onPointerUp={handleStickerPointerUp}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedStickerId(stk.id);
              }}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                transform: `translate(-50%, -50%) rotate(${stk.rotation || 0}deg) scale(${stk.scale || 1.0})`,
                touchAction: 'none',
              }}
              className={`absolute cursor-grab active:cursor-grabbing p-1.5 transition-shadow z-20 ${
                isSelected
                  ? 'ring-2 ring-pink-500 rounded-xl bg-white/30 backdrop-blur-xs shadow-lg'
                  : 'hover:ring-1 hover:ring-pink-300 rounded-lg'
              }`}
            >
              {/* Sticker Content View */}
              {stk.type === 'image' ? (
                <img
                  src={stk.content}
                  alt="Sticker"
                  className="w-16 h-16 object-contain pointer-events-none drop-shadow-md"
                />
              ) : stk.type === 'text' ? (
                <span
                  style={{
                    fontFamily: stk.fontFamily || "'Plus Jakarta Sans', sans-serif",
                    color: stk.color || '#111827',
                  }}
                  className="font-bold text-base whitespace-nowrap drop-shadow-sm select-none"
                >
                  {stk.content}
                </span>
              ) : (
                <span className="text-3xl drop-shadow-md select-none leading-none">
                  {stk.content}
                </span>
              )}

              {/* Floating Canva Tooltip when Sticker is Selected */}
              {isSelected && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900/90 text-white rounded-full py-1 px-2 flex items-center gap-1.5 shadow-xl text-[11px] backdrop-blur-md z-30"
                  style={{
                    transform: `translate(-50%, -50%) scale(${1 / (stk.scale || 1.0)}) rotate(${-stk.rotation || 0}deg)`,
                  }}
                >
                  {/* Zoom In */}
                  <button
                    type="button"
                    title="Phóng to"
                    onClick={() => onUpdateSticker && onUpdateSticker(stk.id, { scale: Math.min(2.5, (stk.scale || 1.0) + 0.15) })}
                    className="p-1 hover:bg-white/20 rounded-full text-pink-300"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>

                  {/* Zoom Out */}
                  <button
                    type="button"
                    title="Thu nhỏ"
                    onClick={() => onUpdateSticker && onUpdateSticker(stk.id, { scale: Math.max(0.4, (stk.scale || 1.0) - 0.15) })}
                    className="p-1 hover:bg-white/20 rounded-full text-pink-300"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>

                  {/* Rotate */}
                  <button
                    type="button"
                    title="Xoay 15°"
                    onClick={() => onUpdateSticker && onUpdateSticker(stk.id, { rotation: ((stk.rotation || 0) + 15) % 360 })}
                    className="p-1 hover:bg-white/20 rounded-full text-amber-300"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    title="Xoá sticker"
                    onClick={() => {
                      if (onRemoveSticker) onRemoveSticker(stk.id);
                      setSelectedStickerId(null);
                    }}
                    className="p-1 hover:bg-rose-500 rounded-full text-rose-300 hover:text-white"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Close Selection */}
                  <button
                    type="button"
                    title="Xong"
                    onClick={() => setSelectedStickerId(null)}
                    className="p-1 hover:bg-white/20 rounded-full text-gray-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Photo Adjustment Modal */}
      {editingSlot && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-pink-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-800 mb-4 font-cute">
              Chỉnh sửa & Căn vị trí ảnh #{editingSlot.slotIndex + 1}
            </h3>

            {/* Filter selection */}
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Bộ lọc màu</label>
              <div className="grid grid-cols-3 gap-2">
                {PHOTO_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      onUpdatePhoto(editingSlot.slotIndex, { filter: f.id });
                      setEditingSlot({ ...editingSlot, filter: f.id });
                    }}
                    className={`py-1.5 px-2 rounded-xl text-xs font-medium border transition-all ${
                      editingSlot.filter === f.id
                        ? 'border-pink-500 bg-pink-50 text-pink-700 font-bold'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Position Pan Controls */}
            <div className="mb-4 bg-gray-50 p-3 rounded-2xl border border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 uppercase">Căn vị trí ảnh</span>
                <button
                  type="button"
                  onClick={() => {
                    const resetObj = { offsetX: 0, offsetY: 0, zoom: 1.0, mirror: false };
                    onUpdatePhoto(editingSlot.slotIndex, resetObj);
                    setEditingSlot({ ...editingSlot, ...resetObj });
                  }}
                  className="text-[11px] text-pink-600 font-semibold hover:underline"
                >
                  Căn giữa lại
                </button>
              </div>

              {/* Offset X Slider (Left / Right) */}
              <div>
                <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                  <span>← Dịch Trái</span>
                  <span className="font-semibold">{Math.round(editingSlot.offsetX || 0)}px</span>
                  <span>Dịch Phải →</span>
                </div>
                <input
                  type="range"
                  min="-200"
                  max="200"
                  step="5"
                  value={editingSlot.offsetX || 0}
                  onChange={(e) => {
                    const offsetX = parseFloat(e.target.value);
                    onUpdatePhoto(editingSlot.slotIndex, { offsetX });
                    setEditingSlot({ ...editingSlot, offsetX });
                  }}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
              </div>

              {/* Offset Y Slider (Up / Down) */}
              <div>
                <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                  <span>↑ Dịch Lên</span>
                  <span className="font-semibold">{Math.round(editingSlot.offsetY || 0)}px</span>
                  <span>Dịch Xuống ↓</span>
                </div>
                <input
                  type="range"
                  min="-200"
                  max="200"
                  step="5"
                  value={editingSlot.offsetY || 0}
                  onChange={(e) => {
                    const offsetY = parseFloat(e.target.value);
                    onUpdatePhoto(editingSlot.slotIndex, { offsetY });
                    setEditingSlot({ ...editingSlot, offsetY });
                  }}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
              </div>
            </div>

            {/* Zoom slider */}
            <div className="mb-4">
              <div className="flex justify-between text-xs font-bold text-gray-500 uppercase mb-1">
                <span>Phóng to / Thu nhỏ</span>
                <span>{(editingSlot.zoom || 1.0).toFixed(1)}x</span>
              </div>
              <div className="flex items-center gap-2">
                <ZoomOut className="w-4 h-4 text-gray-400" />
                <input
                  type="range"
                  min="0.8"
                  max="2.5"
                  step="0.05"
                  value={editingSlot.zoom || 1.0}
                  onChange={(e) => {
                    const zoom = parseFloat(e.target.value);
                    onUpdatePhoto(editingSlot.slotIndex, { zoom });
                    setEditingSlot({ ...editingSlot, zoom });
                  }}
                  className="flex-1 accent-pink-500"
                />
                <ZoomIn className="w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Mirror / Flip toggle */}
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase">Lật gương (Mirror)</span>
              <button
                type="button"
                onClick={() => {
                  const mirror = !editingSlot.mirror;
                  onUpdatePhoto(editingSlot.slotIndex, { mirror });
                  setEditingSlot({ ...editingSlot, mirror });
                }}
                className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                  editingSlot.mirror
                    ? 'border-pink-500 bg-pink-50 text-pink-700 font-bold'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {editingSlot.mirror ? 'Đang Lật 🔄' : 'Gốc ➡️'}
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  onRemovePhotoFromSlot(editingSlot.slotIndex);
                  setEditingSlot(null);
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 hover:text-rose-700 py-2 px-3 rounded-xl hover:bg-rose-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xoá ảnh này</span>
              </button>

              <button
                onClick={() => setEditingSlot(null)}
                className="py-2 px-5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs shadow-md"
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
