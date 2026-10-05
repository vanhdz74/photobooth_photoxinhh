import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Sparkles,
  Upload,
  Link as LinkIcon,
  HelpCircle,
  Layers,
  Palette,
  Layout,
  Type,
  Check,
  RotateCcw,
  Sliders,
  Image as ImageIcon,
  Plus,
  Trash2,
  Download,
  FolderOpen,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Smile
} from 'lucide-react';
import { FrameTemplate, PhotoData, PhotoSlot, StickerItem } from '../types/photobooth';
import { SAMPLE_PORTRAITS } from '../templates/samplePhotos';

interface CustomFrameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCustomFrame: (frame: FrameTemplate) => void;
  onUpdateCurrentFrame?: (frame: FrameTemplate) => void;
  onDeleteCustomFrame?: (frameId: string) => void;
  initialFrame?: FrameTemplate | null;
  activePhotos?: PhotoData[];
  customFrames?: FrameTemplate[];
  stickers?: StickerItem[];
  onSelectFrame?: (frame: FrameTemplate) => void;
}

// Preset color palettes
const SOLID_COLOR_PALETTES = [
  { label: 'Trắng Tinh', color: '#FFFFFF' },
  { label: 'Đen Film', color: '#111827' },
  { label: 'Hồng Phấn', color: '#FCE7F3' },
  { label: 'Hồng Dâu', color: '#FB7185' },
  { label: 'Be Vintage', color: '#FEF3C7' },
  { label: 'Vàng Bơ', color: '#FEF08A' },
  { label: 'Xanh Bơ', color: '#D9F99D' },
  { label: 'Xanh Lá', color: '#86EFAC' },
  { label: 'Xanh Baby', color: '#BAE6FD' },
  { label: 'Xanh Pastel', color: '#E0F2FE' },
  { label: 'Tím Lilac', color: '#E9D5FF' },
  { label: 'Tím Mơ', color: '#F3E8FF' },
  { label: 'Cam Đào', color: '#FFEDD5' },
  { label: 'Xám Xi Măng', color: '#F3F4F6' },
];

const GRADIENT_PRESETS = [
  { name: 'Sunset Glow', css: 'linear-gradient(180deg, #FF512F 0%, #DD2476 100%)', color1: '#FF512F', color2: '#DD2476' },
  { name: 'Sweet Pink', css: 'linear-gradient(180deg, #FF69B4 0%, #FF1493 50%, #FF69B4 100%)', color1: '#FF69B4', color2: '#FF1493' },
  { name: 'Cotton Candy', css: 'linear-gradient(180deg, #FFAFBD 0%, #ffc3a0 100%)', color1: '#FFAFBD', color2: '#ffc3a0' },
  { name: 'Lilac Dream', css: 'linear-gradient(180deg, #E0C3FC 0%, #8EC5FC 100%)', color1: '#E0C3FC', color2: '#8EC5FC' },
  { name: 'Cyberpunk', css: 'linear-gradient(180deg, #FA709A 0%, #FEE140 100%)', color1: '#FA709A', color2: '#FEE140' },
  { name: 'Vintage Mocha', css: 'linear-gradient(180deg, #3E2723 0%, #8D6E63 50%, #D7CCC8 100%)', color1: '#3E2723', color2: '#D7CCC8' },
  { name: 'Mint Lime', css: 'linear-gradient(180deg, #A8FF78 0%, #78FFD6 100%)', color1: '#A8FF78', color2: '#78FFD6' },
  { name: 'Baby Sky', css: 'linear-gradient(180deg, #E0F2FE 0%, #38BDF8 50%, #0284C7 100%)', color1: '#E0F2FE', color2: '#0284C7' },
  { name: 'Disney Gold', css: 'linear-gradient(180deg, #1E1B4B 0%, #312E81 50%, #FBBF24 100%)', color1: '#1E1B4B', color2: '#FBBF24' },
  { name: 'Dark Noir', css: 'linear-gradient(180deg, #111827 0%, #1F2937 100%)', color1: '#111827', color2: '#1F2937' },
];

const BORDER_COLOR_PALETTES = [
  '#FFFFFF', '#000000', '#F43F5E', '#EC4899', '#8B5CF6', 
  '#3B82F6', '#06B6D4', '#10B981', '#EAB308', '#F97316', 
  '#78716C', '#E2E8F0', 'rgba(255,255,255,0.6)', 'rgba(0,0,0,0.2)'
];

const FONT_OPTIONS = [
  { id: "'Plus Jakarta Sans', sans-serif", name: 'Hiện đại (Jakarta)' },
  { id: "'Fredoka', sans-serif", name: 'Bo tròn Cute (Fredoka)' },
  { id: "'Caveat', cursive", name: 'Viết tay (Caveat)' },
  { id: "'Pacifico', cursive", name: 'Nghệ thuật (Pacifico)' },
  { id: "'Playfair Display', serif", name: 'Cổ điển (Playfair)' },
  { id: "'Courier Prime', monospace", name: 'Máy đánh chữ (Courier)' },
];

const STICKER_CATEGORIES = [
  {
    id: 'cute',
    name: '🎀 Cute Y2K',
    items: ['🎀', '🍒', '🍓', '🐰', '🐱', '🌸', '🌷', '🌼', '🧁', '🍭', '🧸', '🍰', '🐶', '🍑', '🐣'],
  },
  {
    id: 'love',
    name: '💖 Trái Tim',
    items: ['💖', '💕', '💗', '💓', '💞', '💘', '💌', '❤️', '🤍', '🫶', '💑', '🌹', '🕊️', '💐', '💍'],
  },
  {
    id: 'stars',
    name: '✨ Lấp Lánh',
    items: ['✨', '⭐', '🌟', '💫', '✦', '👑', '🦄', '🌈', '🪄', '💎', '🌙', '⚡', '🪐', '🎇', '🔮'],
  },
  {
    id: 'stamps',
    name: '🏷️ Nhãn Chữ',
    items: ['PHOTO XINHH', 'LIFE4CUTS', 'BESTIES ❤️', 'LOVE YOU', 'CUTE ✨', 'Y2K BABY', 'HARU FILM', 'HAPPY DAY 🎂', 'FOREVER', '2026'],
  }
];

const PATTERN_OPTIONS = [
  { id: 'none', label: 'Không họa tiết', icon: '◻️' },
  { id: 'dots', label: 'Chấm bi Polka', icon: '●' },
  { id: 'grid', label: 'Lưới Caro', icon: '▦' },
  { id: 'stripes', label: 'Sọc chéo', icon: '▨' },
  { id: 'stars', label: 'Sao lấp lánh', icon: '✦' },
  { id: 'hearts', label: 'Trái tim', icon: '♥' },
  { id: 'flowers', label: 'Hoa cúc Daisy', icon: '✿' },
  { id: 'film', label: 'Dải lỗ Film', icon: '🎞' },
];

// Helper to punch clean transparent slots out of any Canva/Custom image
const createCutoutOverlay = (
  imageUrl: string,
  slots: PhotoSlot[],
  width = 600,
  height = 1800
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Punch transparent cutouts for each photo slot
      ctx.globalCompositeOperation = 'destination-out';
      for (const slot of slots) {
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(slot.x, slot.y, slot.width, slot.height, slot.borderRadius || 20);
        } else {
          ctx.rect(slot.x, slot.y, slot.width, slot.height);
        }
        ctx.fill();
      }
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(imageUrl);
    img.src = imageUrl;
  });
};

export const CustomFrameModal: React.FC<CustomFrameModalProps> = ({
  isOpen,
  onClose,
  onAddCustomFrame,
  onUpdateCurrentFrame,
  onDeleteCustomFrame,
  initialFrame,
  activePhotos = [],
  customFrames = [],
  stickers = [],
  onSelectFrame
}) => {
  type TabType = 'borders' | 'background' | 'elements' | 'canva' | 'library';
  const [activeTab, setActiveTab] = useState<TabType>('borders');

  // Frame Properties State
  const [frameName, setFrameName] = useState('Khung Mẫu Tùy Chỉnh');
  const [slotCount, setSlotCount] = useState<number>(4);
  const [aspectRatio, setAspectRatio] = useState<'2x6' | '4x6' | '1x1'>('2x6');
  
  // Border Studio State
  const [slotBorderWidth, setSlotBorderWidth] = useState<number>(0);
  const [slotBorderStyle, setSlotBorderStyle] = useState<'solid' | 'dashed' | 'dotted' | 'double'>('solid');
  const [slotBorderColor, setSlotBorderColor] = useState<string>('#FFFFFF');
  const [slotRadius, setSlotRadius] = useState<number>(16);
  const [slotGap, setSlotGap] = useState<number>(24);
  const [topPadding, setTopPadding] = useState<number>(130);
  const [bottomPadding, setBottomPadding] = useState<number>(130);
  const [sidePadding, setSidePadding] = useState<number>(40);

  // Background Studio State
  const [bgMode, setBgMode] = useState<'solid' | 'gradient' | 'image'>('solid');
  const [bgColor, setBgColor] = useState<string>('#FFFFFF');
  const [gradientColor1, setGradientColor1] = useState<string>('#FFAFBD');
  const [gradientColor2, setGradientColor2] = useState<string>('#FFC3A0');
  const [gradientAngle, setGradientAngle] = useState<number>(180);
  const [pattern, setPattern] = useState<'none' | 'dots' | 'grid' | 'stripes' | 'stars' | 'hearts' | 'flowers' | 'film'>('none');

  // Typography Studio State
  const [headerText, setHeaderText] = useState<string>('');
  const [footerText, setFooterText] = useState<string>('★ PHOTOXINHH ★ 2026');
  const [themeColor, setThemeColor] = useState<string>('#111827');
  const [fontFamily, setFontFamily] = useState<string>("'Plus Jakarta Sans', sans-serif");

  // Canva / Image Upload State
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState<string>('');
  const [frameLayerMode, setFrameLayerMode] = useState<'overlay' | 'background'>('overlay');
  const [showCanvaGuide, setShowCanvaGuide] = useState<boolean>(false);
  const [isLoadingUrl, setIsLoadingUrl] = useState<boolean>(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Template Attached Elements / Stickers State
  const [templateStickers, setTemplateStickers] = useState<StickerItem[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [customTextColor, setCustomTextColor] = useState('#111827');
  const [customTextFont, setCustomTextFont] = useState("'Caveat', cursive");
  const [stickerCategory, setStickerCategory] = useState('cute');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const stickerFileInputRef = useRef<HTMLInputElement>(null);
  const jsonImportInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Dragging state in modal preview
  const [isDraggingSticker, setIsDraggingSticker] = useState<boolean>(false);
  const dragStartRef = useRef<{ stickerId: string; startX: number; startY: number; origStickerX: number; origStickerY: number } | null>(null);

  // Sync with initial frame when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialFrame) {
        setFrameName(initialFrame.name || 'Khung Tùy Chỉnh');
        setSlotCount(initialFrame.slotCount || 4);
        setAspectRatio(initialFrame.aspectRatio || '2x6');
        setSlotBorderWidth(initialFrame.slotBorderWidth ?? 0);
        setSlotBorderStyle(initialFrame.slotBorderStyle || 'solid');
        setSlotBorderColor(initialFrame.slotBorderColor || '#FFFFFF');
        setSlotRadius(initialFrame.slots[0]?.borderRadius ?? 16);
        setBgColor(initialFrame.backgroundColor || '#FFFFFF');
        setPattern(initialFrame.pattern || 'none');
        setHeaderText(initialFrame.headerText || '');
        setFooterText(initialFrame.footerText || '');
        setThemeColor(initialFrame.themeColor || '#111827');
        setFontFamily(initialFrame.fontFamily || "'Plus Jakarta Sans', sans-serif");
        
        if (initialFrame.backgroundGradient) {
          setBgMode('gradient');
          const matches = initialFrame.backgroundGradient.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^\)]+\))/g);
          if (matches && matches.length >= 2) {
            setGradientColor1(matches[0]);
            setGradientColor2(matches[1]);
          }
        } else if (initialFrame.backgroundImage) {
          setBgMode('image');
          setUploadedImage(initialFrame.backgroundImage);
          setFrameLayerMode('background');
        } else if (initialFrame.overlayImageUrl) {
          setUploadedImage(initialFrame.overlayImageUrl);
          setFrameLayerMode('overlay');
        } else {
          setBgMode('solid');
        }

        if (initialFrame.slots && initialFrame.slots.length > 0) {
          setTopPadding(initialFrame.slots[0].y);
          setSidePadding(initialFrame.slots[0].x);
        }

        // Load stickers attached to this frame template or fallback to current stickers
        if (initialFrame.stickers && initialFrame.stickers.length > 0) {
          setTemplateStickers(JSON.parse(JSON.stringify(initialFrame.stickers)));
        } else if (stickers && stickers.length > 0) {
          setTemplateStickers(JSON.parse(JSON.stringify(stickers)));
        } else {
          setTemplateStickers([]);
        }
      }
    }
  }, [isOpen, initialFrame, stickers]);

  // Compute calculated slots geometry
  const computeSlots = useCallback((): PhotoSlot[] => {
    const width = aspectRatio === '4x6' ? 1200 : (aspectRatio === '1x1' ? 1200 : 600);
    const height = aspectRatio === '1x1' ? 1200 : 1800;

    if (aspectRatio === '4x6' && slotCount === 6) {
      const cols = 2;
      const rows = 3;
      const totalColGap = slotGap * (cols - 1);
      const totalRowGap = slotGap * (rows - 1);
      const slotW = (width - sidePadding * 2 - totalColGap) / cols;
      const slotH = (height - topPadding - bottomPadding - totalRowGap) / rows;

      const slots: PhotoSlot[] = [];
      let id = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          slots.push({
            id: id++,
            x: sidePadding + c * (slotW + slotGap),
            y: topPadding + r * (slotH + slotGap),
            width: slotW,
            height: slotH,
            borderRadius: slotRadius,
          });
        }
      }
      return slots;
    }

    if (slotCount === 4 && aspectRatio === '4x6') {
      const cols = 2;
      const rows = 2;
      const totalColGap = slotGap * (cols - 1);
      const totalRowGap = slotGap * (rows - 1);
      const slotW = (width - sidePadding * 2 - totalColGap) / cols;
      const slotH = (height - topPadding - bottomPadding - totalRowGap) / rows;

      const slots: PhotoSlot[] = [];
      let id = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          slots.push({
            id: id++,
            x: sidePadding + c * (slotW + slotGap),
            y: topPadding + r * (slotH + slotGap),
            width: slotW,
            height: slotH,
            borderRadius: slotRadius,
          });
        }
      }
      return slots;
    }

    // Default Vertical Strip (2x6) or Single Polaroids
    const availableHeight = height - topPadding - bottomPadding - slotGap * (slotCount - 1);
    const slotHeight = Math.max(50, availableHeight / slotCount);
    const slotWidth = width - sidePadding * 2;

    const slots: PhotoSlot[] = [];
    for (let i = 0; i < slotCount; i++) {
      slots.push({
        id: i,
        x: sidePadding,
        y: topPadding + i * (slotHeight + slotGap),
        width: slotWidth,
        height: slotHeight,
        borderRadius: slotRadius,
      });
    }
    return slots;
  }, [aspectRatio, slotCount, slotGap, slotRadius, sidePadding, topPadding, bottomPadding]);

  // Live Render on Preview Canvas (WYSIWYG)
  useEffect(() => {
    if (!isOpen || !previewCanvasRef.current) return;

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = aspectRatio === '4x6' ? 1200 : (aspectRatio === '1x1' ? 1200 : 600);
    const height = aspectRatio === '1x1' ? 1200 : 1800;

    canvas.width = width;
    canvas.height = height;

    // 1. Draw Background
    if (bgMode === 'image' && uploadedImage && frameLayerMode === 'background') {
      const img = new Image();
      img.src = uploadedImage;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        drawForegroundElements();
      };
      img.onerror = () => {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
        drawForegroundElements();
      };
    } else if (bgMode === 'gradient') {
      const rad = (gradientAngle * Math.PI) / 180;
      const x2 = Math.cos(rad) * width;
      const y2 = Math.sin(rad) * height;
      const grad = ctx.createLinearGradient(0, 0, Math.abs(x2), Math.abs(y2) || height);
      grad.addColorStop(0, gradientColor1);
      grad.addColorStop(1, gradientColor2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      drawForegroundElements();
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
      drawForegroundElements();
    }

    function drawForegroundElements() {
      if (!ctx) return;

      // Pattern Overlays
      if (pattern !== 'none') {
        ctx.save();
        if (pattern === 'dots') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          const dotGap = 24;
          const dotRadius = 3.5;
          for (let y = dotGap / 2; y < height; y += dotGap) {
            for (let x = dotGap / 2; x < width; x += dotGap) {
              ctx.beginPath();
              ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else if (pattern === 'grid') {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.lineWidth = 1.5;
          const gridGap = 30;
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
        } else if (pattern === 'stripes') {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
          ctx.lineWidth = 14;
          const stripeGap = 36;
          for (let d = -height; d < width + height; d += stripeGap) {
            ctx.beginPath();
            ctx.moveTo(d, 0);
            ctx.lineTo(d + height, height);
            ctx.stroke();
          }
        } else if (pattern === 'stars') {
          ctx.font = '16px sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const starGap = 45;
          for (let y = 22; y < height; y += starGap) {
            for (let x = 22; x < width; x += starGap) {
              ctx.fillText('✦', x, y);
            }
          }
        } else if (pattern === 'hearts') {
          ctx.font = '15px sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const heartGap = 42;
          for (let y = 20; y < height; y += heartGap) {
            for (let x = 20; x < width; x += heartGap) {
              ctx.fillText('♥', x, y);
            }
          }
        } else if (pattern === 'flowers') {
          ctx.font = '16px sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const flowerGap = 46;
          for (let y = 23; y < height; y += flowerGap) {
            for (let x = 23; x < width; x += flowerGap) {
              ctx.fillText('✿', x, y);
            }
          }
        } else if (pattern === 'film') {
          ctx.fillStyle = '#FFFFFF';
          const holeSize = 18;
          const holeGap = 35;
          for (let y = 30; y < height - 30; y += holeGap) {
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(14, y, holeSize, holeSize * 0.7, 4);
              ctx.fill();
              ctx.beginPath();
              ctx.roundRect(width - 14 - holeSize, y, holeSize, holeSize * 0.7, 4);
              ctx.fill();
            } else {
              ctx.fillRect(14, y, holeSize, holeSize * 0.7);
              ctx.fillRect(width - 14 - holeSize, y, holeSize, holeSize * 0.7);
            }
          }
        }
        ctx.restore();
      }

      const slots = computeSlots();

      // 2. Draw Mock Photos inside slots
      slots.forEach((slot, idx) => {
        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(slot.x, slot.y, slot.width, slot.height, slot.borderRadius || 16);
        } else {
          ctx.rect(slot.x, slot.y, slot.width, slot.height);
        }
        ctx.clip();

        const samplePhotoUrl = activePhotos[idx]?.dataUrl || SAMPLE_PORTRAITS[idx % SAMPLE_PORTRAITS.length];
        const sampleImg = new Image();
        sampleImg.src = samplePhotoUrl;
        if (sampleImg.complete) {
          const imgAspect = sampleImg.width / sampleImg.height;
          const slotAspect = slot.width / slot.height;
          let dw = slot.width;
          let dh = slot.height;
          if (imgAspect > slotAspect) {
            dw = slot.height * imgAspect;
          } else {
            dh = slot.width / imgAspect;
          }
          ctx.drawImage(sampleImg, slot.x + slot.width / 2 - dw / 2, slot.y + slot.height / 2 - dh / 2, dw, dh);
        } else {
          sampleImg.onload = () => {
            const imgAspect = sampleImg.width / sampleImg.height;
            const slotAspect = slot.width / slot.height;
            let dw = slot.width;
            let dh = slot.height;
            if (imgAspect > slotAspect) {
              dw = slot.height * imgAspect;
            } else {
              dh = slot.width / imgAspect;
            }
            ctx.drawImage(sampleImg, slot.x + slot.width / 2 - dw / 2, slot.y + slot.height / 2 - dh / 2, dw, dh);
          };
          ctx.fillStyle = '#E5E7EB';
          ctx.fillRect(slot.x, slot.y, slot.width, slot.height);
        }
        ctx.restore();

        // 3. Draw Slot Borders
        if (slotBorderWidth > 0) {
          ctx.save();
          ctx.strokeStyle = slotBorderColor || '#FFFFFF';
          ctx.lineWidth = slotBorderWidth;

          if (slotBorderStyle === 'dashed') {
            ctx.setLineDash([8, 6]);
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(slot.x, slot.y, slot.width, slot.height, slot.borderRadius || 16);
            } else {
              ctx.rect(slot.x, slot.y, slot.width, slot.height);
            }
            ctx.stroke();
          } else if (slotBorderStyle === 'dotted') {
            ctx.setLineDash([3, 4]);
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(slot.x, slot.y, slot.width, slot.height, slot.borderRadius || 16);
            } else {
              ctx.rect(slot.x, slot.y, slot.width, slot.height);
            }
            ctx.stroke();
          } else if (slotBorderStyle === 'double') {
            ctx.setLineDash([]);
            ctx.lineWidth = Math.max(1, slotBorderWidth * 0.45);
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(slot.x, slot.y, slot.width, slot.height, slot.borderRadius || 16);
            } else {
              ctx.rect(slot.x, slot.y, slot.width, slot.height);
            }
            ctx.stroke();

            const inset = Math.max(3, slotBorderWidth * 0.9);
            if (slot.width > inset * 2 && slot.height > inset * 2) {
              ctx.beginPath();
              if (ctx.roundRect) {
                ctx.roundRect(slot.x + inset, slot.y + inset, slot.width - inset * 2, slot.height - inset * 2, Math.max(0, (slot.borderRadius || 16) - inset));
              } else {
                ctx.rect(slot.x + inset, slot.y + inset, slot.width - inset * 2, slot.height - inset * 2);
              }
              ctx.stroke();
            }
          } else {
            ctx.setLineDash([]);
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(slot.x, slot.y, slot.width, slot.height, slot.borderRadius || 16);
            } else {
              ctx.rect(slot.x, slot.y, slot.width, slot.height);
            }
            ctx.stroke();
          }
          ctx.restore();
        }
      });

      // 4. Draw Canva Overlay (Characters / Frame Overlays)
      if (uploadedImage && frameLayerMode === 'overlay') {
        const overlayImg = new Image();
        overlayImg.src = uploadedImage;
        if (overlayImg.complete) {
          ctx.drawImage(overlayImg, 0, 0, width, height);
        } else {
          overlayImg.onload = () => {
            ctx.drawImage(overlayImg, 0, 0, width, height);
          };
        }
      }

      // 5. Draw Header Text
      if (headerText) {
        ctx.save();
        ctx.fillStyle = themeColor;
        ctx.font = `bold 18px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(headerText, width / 2, 70);
        ctx.restore();
      }

      // 6. Draw Footer Text
      if (footerText) {
        ctx.save();
        ctx.fillStyle = themeColor;
        ctx.font = `600 15px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(footerText, width / 2, height - 70);
        ctx.restore();
      }

      // 7. Draw Attached Template Elements (Images / Logos, Texts, Emojis)
      templateStickers.forEach((stk) => {
        ctx.save();
        ctx.translate(stk.x, stk.y);
        if (stk.rotation) {
          ctx.rotate((stk.rotation * Math.PI) / 180);
        }

        if (stk.type === 'image') {
          const img = new Image();
          img.src = stk.content;
          const baseSize = (stk.width || 120) * (stk.scale || 1.0);
          if (img.complete) {
            const aspect = (img.width || 1) / (img.height || 1);
            let dw = baseSize;
            let dh = baseSize;
            if (aspect > 1) {
              dh = baseSize / aspect;
            } else {
              dw = baseSize * aspect;
            }
            ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
          } else {
            img.onload = () => {
              const aspect = (img.width || 1) / (img.height || 1);
              let dw = baseSize;
              let dh = baseSize;
              if (aspect > 1) {
                dh = baseSize / aspect;
              } else {
                dw = baseSize * aspect;
              }
              ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
            };
          }
        } else if (stk.type === 'text') {
          const fSize = 28 * (stk.scale || 1.0);
          const fFam = stk.fontFamily || "'Plus Jakarta Sans', sans-serif";
          ctx.font = `bold ${fSize}px ${fFam}`;
          ctx.fillStyle = stk.color || themeColor || '#111827';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(stk.content, 0, 0);
        } else {
          ctx.font = `${40 * (stk.scale || 1.0)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(stk.content, 0, 0);
        }

        // Highlight selection border
        if (selectedStickerId === stk.id) {
          ctx.strokeStyle = '#EC4899';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          const boxSize = 60 * (stk.scale || 1.0);
          ctx.strokeRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize);
        }
        ctx.restore();
      });
    }
  }, [
    isOpen,
    aspectRatio,
    slotCount,
    bgMode,
    bgColor,
    gradientColor1,
    gradientColor2,
    gradientAngle,
    pattern,
    slotBorderWidth,
    slotBorderStyle,
    slotBorderColor,
    slotRadius,
    slotGap,
    topPadding,
    bottomPadding,
    sidePadding,
    uploadedImage,
    frameLayerMode,
    headerText,
    footerText,
    themeColor,
    fontFamily,
    computeSlots,
    activePhotos,
    templateStickers,
    selectedStickerId
  ]);

  if (!isOpen) return null;

  // File Upload Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
        setActiveTab('canva');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyUrl = async () => {
    const raw = imageUrlInput.trim();
    if (!raw) return;
    setUrlError(null);

    if (raw.includes('canva.link') || raw.includes('canva.com/design')) {
      setIsLoadingUrl(true);
      try {
        const res = await fetch(`/api/canva/resolve?url=${encodeURIComponent(raw)}`);
        const data = await res.json();
        if (data.success && data.imageUrl) {
          setUploadedImage(data.imageUrl);
          setActiveTab('canva');
        } else {
          setUrlError(data.error || 'Không thể tự động tải link Canva này. Bạn vui lòng xuất file PNG từ Canva rồi tải lên nhé!');
        }
      } catch {
        setUrlError('Không thể tự động tải từ link Canva này. Hãy mở Canva -> Chia sẻ -> Tải xuống ảnh PNG và chọn Tải lên file nhé!');
      } finally {
        setIsLoadingUrl(false);
      }
      return;
    }

    setUploadedImage(raw);
    setActiveTab('canva');
  };

  // Upload Custom Image/Logo as Template Element
  const handleUploadElementImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const width = aspectRatio === '4x6' ? 1200 : 600;
        const height = aspectRatio === '1x1' ? 1200 : 1800;
        const newSticker: StickerItem = {
          id: `elem-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          content: dataUrl,
          type: 'image',
          x: width / 2 + (Math.random() * 60 - 30),
          y: height / 2 + (Math.random() * 100 - 50),
          scale: 1.0,
          rotation: 0,
          width: 140,
          height: 140,
        };
        setTemplateStickers((prev) => [...prev, newSticker]);
        setSelectedStickerId(newSticker.id);
      };
      reader.readAsDataURL(file);
    }
    if (stickerFileInputRef.current) stickerFileInputRef.current.value = '';
  };

  // Add Custom Text Layer to Template
  const handleAddTextElement = (e: React.FormEvent) => {
    e.preventDefault();
    const txt = customText.trim();
    if (!txt) return;
    const width = aspectRatio === '4x6' ? 1200 : 600;
    const height = aspectRatio === '1x1' ? 1200 : 1800;
    const newSticker: StickerItem = {
      id: `elem-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      content: txt,
      type: 'text',
      x: width / 2,
      y: height / 2,
      scale: 1.0,
      rotation: 0,
      fontFamily: customTextFont,
      color: customTextColor,
    };
    setTemplateStickers((prev) => [...prev, newSticker]);
    setSelectedStickerId(newSticker.id);
    setCustomText('');
  };

  // Add Cute Sticker / Stamp to Template
  const handleAddEmojiElement = (emoji: string) => {
    const width = aspectRatio === '4x6' ? 1200 : 600;
    const height = aspectRatio === '1x1' ? 1200 : 1800;
    const newSticker: StickerItem = {
      id: `elem-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      content: emoji,
      type: 'emoji',
      x: width / 2 + (Math.random() * 80 - 40),
      y: height / 2 + (Math.random() * 160 - 80),
      scale: 1.2,
      rotation: 0,
    };
    setTemplateStickers((prev) => [...prev, newSticker]);
    setSelectedStickerId(newSticker.id);
  };

  // Pointer Drag-and-Drop in Modal Preview
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!previewContainerRef.current) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    const canvasWidth = aspectRatio === '4x6' ? 1200 : (aspectRatio === '1x1' ? 1200 : 600);
    const canvasHeight = aspectRatio === '1x1' ? 1200 : 1800;
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Find if clicked on any sticker (hit test backwards from top layer)
    for (let i = templateStickers.length - 1; i >= 0; i--) {
      const s = templateStickers[i];
      const hitRadius = (s.type === 'image' ? (s.width || 120) : 70) * (s.scale || 1.0) / 2;
      const dist = Math.hypot(clickX - s.x, clickY - s.y);
      if (dist <= Math.max(35, hitRadius)) {
        setSelectedStickerId(s.id);
        setIsDraggingSticker(true);
        dragStartRef.current = {
          stickerId: s.id,
          startX: e.clientX,
          startY: e.clientY,
          origStickerX: s.x,
          origStickerY: s.y,
        };
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        return;
      }
    }

    // If clicked empty space, deselect
    setSelectedStickerId(null);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSticker || !dragStartRef.current || !previewContainerRef.current) return;

    const rect = previewContainerRef.current.getBoundingClientRect();
    const canvasWidth = aspectRatio === '4x6' ? 1200 : (aspectRatio === '1x1' ? 1200 : 600);
    const scaleX = canvasWidth / rect.width;

    const deltaX = (e.clientX - dragStartRef.current.startX) * scaleX;
    const deltaY = (e.clientY - dragStartRef.current.startY) * scaleX;

    const newX = Math.round(dragStartRef.current.origStickerX + deltaX);
    const newY = Math.round(dragStartRef.current.origStickerY + deltaY);

    setTemplateStickers((prev) =>
      prev.map((s) => (s.id === dragStartRef.current?.stickerId ? { ...s, x: newX, y: newY } : s))
    );
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingSticker) {
      setIsDraggingSticker(false);
      dragStartRef.current = null;
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {}
    }
  };

  // Sticker modification actions
  const handleUpdateSelectedSticker = (updates: Partial<StickerItem>) => {
    if (!selectedStickerId) return;
    setTemplateStickers((prev) =>
      prev.map((s) => (s.id === selectedStickerId ? { ...s, ...updates } : s))
    );
  };

  const handleDeleteSelectedSticker = () => {
    if (!selectedStickerId) return;
    setTemplateStickers((prev) => prev.filter((s) => s.id !== selectedStickerId));
    setSelectedStickerId(null);
  };

  // Load an existing custom frame into Studio
  const handleLoadCustomFrame = (frame: FrameTemplate) => {
    setFrameName(frame.name);
    setSlotCount(frame.slotCount || 4);
    setAspectRatio(frame.aspectRatio || '2x6');
    setSlotBorderWidth(frame.slotBorderWidth ?? 0);
    setSlotBorderStyle(frame.slotBorderStyle || 'solid');
    setSlotBorderColor(frame.slotBorderColor || '#FFFFFF');
    setSlotRadius(frame.slots[0]?.borderRadius ?? 16);
    setBgColor(frame.backgroundColor || '#FFFFFF');
    setPattern(frame.pattern || 'none');
    setHeaderText(frame.headerText || '');
    setFooterText(frame.footerText || '');
    setThemeColor(frame.themeColor || '#111827');
    setFontFamily(frame.fontFamily || "'Plus Jakarta Sans', sans-serif");
    
    if (frame.backgroundGradient) {
      setBgMode('gradient');
      const matches = frame.backgroundGradient.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^\)]+\))/g);
      if (matches && matches.length >= 2) {
        setGradientColor1(matches[0]);
        setGradientColor2(matches[1]);
      }
    } else if (frame.backgroundImage) {
      setBgMode('image');
      setUploadedImage(frame.backgroundImage);
      setFrameLayerMode('background');
    } else if (frame.overlayImageUrl) {
      setUploadedImage(frame.overlayImageUrl);
      setFrameLayerMode('overlay');
    } else {
      setBgMode('solid');
      setUploadedImage(null);
    }

    if (frame.slots && frame.slots.length > 0) {
      setTopPadding(frame.slots[0].y);
      setSidePadding(frame.slots[0].x);
    }

    setTemplateStickers(frame.stickers ? JSON.parse(JSON.stringify(frame.stickers)) : []);
    setActiveTab('borders');
  };

  // Export Custom Frames to JSON file
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(customFrames, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `photobooth_custom_frames_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import Custom Frames from JSON file
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            parsed.forEach((f) => onAddCustomFrame(f));
            alert(`Đã nhập thành công ${parsed.length} mẫu khung vào kho lưu trữ!`);
          } else if (parsed && parsed.id) {
            onAddCustomFrame(parsed);
            alert(`Đã nhập thành công mẫu "${parsed.name}"!`);
          }
        } catch {
          alert('File JSON không đúng định dạng mẫu khung Photobooth!');
        }
      };
      reader.readAsText(file);
    }
    if (jsonImportInputRef.current) jsonImportInputRef.current.value = '';
  };

  // Save Frame Template (Creates new or updates existing)
  const handleSaveAndApply = async (isNew = false) => {
    const width = aspectRatio === '4x6' ? 1200 : (aspectRatio === '1x1' ? 1200 : 600);
    const height = aspectRatio === '1x1' ? 1200 : 1800;
    const slots = computeSlots();

    let finalOverlayUrl: string | undefined = undefined;
    let finalBgImage: string | undefined = undefined;

    if (uploadedImage) {
      if (frameLayerMode === 'overlay') {
        finalOverlayUrl = await createCutoutOverlay(uploadedImage, slots, width, height);
      } else {
        finalBgImage = uploadedImage;
      }
    }

    const calculatedGradient = bgMode === 'gradient'
      ? `linear-gradient(${gradientAngle}deg, ${gradientColor1} 0%, ${gradientColor2} 100%)`
      : undefined;

    const frameData: FrameTemplate = {
      id: isNew || !initialFrame ? `custom-${Date.now()}` : initialFrame.id,
      name: frameName.trim() || 'Khung tùy chỉnh',
      category: 'custom',
      aspectRatio,
      slotCount,
      width,
      height,
      backgroundColor: bgColor,
      backgroundGradient: calculatedGradient,
      backgroundImage: finalBgImage,
      overlayImageUrl: finalOverlayUrl,
      themeColor,
      headerText: headerText.trim() || undefined,
      footerText: footerText.trim() || undefined,
      slotBorderColor,
      slotBorderWidth,
      slotBorderStyle,
      pattern,
      fontFamily,
      slots,
      isCustom: true,
      stickers: templateStickers.length > 0 ? templateStickers : undefined,
      updatedAt: Date.now(),
    };

    if (!isNew && onUpdateCurrentFrame && initialFrame) {
      onUpdateCurrentFrame(frameData);
    } else {
      onAddCustomFrame(frameData);
    }
    onClose();
  };

  const selectedSticker = templateStickers.find((s) => s.id === selectedStickerId);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Hidden file inputs */}
      <input
        ref={stickerFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        onChange={handleUploadElementImage}
        className="hidden"
      />
      <input
        ref={jsonImportInputRef}
        type="file"
        accept=".json"
        onChange={handleImportJson}
        className="hidden"
      />

      <div className="bg-white rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl border border-pink-100 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
        
        {/* Header Bar with Canva Branding */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg font-cute leading-tight flex items-center gap-2">
                <span>Xưởng Tạo Mẫu Khung Photobooth</span>
                <span className="text-[10px] bg-white/25 px-2 py-0.5 rounded-full font-sans font-bold">Lưu Dùng Lâu Dài</span>
              </h2>
              <p className="text-[11px] text-pink-100 hidden sm:block">
                Gắn logo, sticker, tùy biến viền ô, màu sắc và lưu lại thành mẫu để sử dụng nhiều lần
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Body: 2 Columns (Left: Studio Tabs, Right: 60fps Live Preview) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* LEFT COLUMN: Controls & Studio Tabs */}
          <div className="flex-1 flex flex-col border-r border-gray-100 overflow-hidden bg-gray-50/50">
            {/* Studio Navigation 5 Tabs */}
            <div className="grid grid-cols-5 border-b border-gray-200 bg-white px-2 pt-2 gap-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('borders')}
                className={`py-2 px-1 flex flex-col sm:flex-row items-center justify-center gap-1 rounded-t-xl transition-all border-b-2 ${
                  activeTab === 'borders'
                    ? 'border-pink-500 text-pink-600 bg-pink-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Layout className="w-3.5 h-3.5" />
                <span className="truncate">Viền & Bố Cục</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('background')}
                className={`py-2 px-1 flex flex-col sm:flex-row items-center justify-center gap-1 rounded-t-xl transition-all border-b-2 ${
                  activeTab === 'background'
                    ? 'border-pink-500 text-pink-600 bg-pink-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span className="truncate">Màu Nền</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('elements')}
                className={`py-2 px-1 flex flex-col sm:flex-row items-center justify-center gap-1 rounded-t-xl transition-all border-b-2 ${
                  activeTab === 'elements'
                    ? 'border-pink-500 text-pink-600 bg-pink-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Smile className="w-3.5 h-3.5" />
                <span className="truncate">Gắn Sticker/Logo ({templateStickers.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('canva')}
                className={`py-2 px-1 flex flex-col sm:flex-row items-center justify-center gap-1 rounded-t-xl transition-all border-b-2 ${
                  activeTab === 'canva'
                    ? 'border-pink-500 text-pink-600 bg-pink-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="truncate">Nhập Canva</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('library')}
                className={`py-2 px-1 flex flex-col sm:flex-row items-center justify-center gap-1 rounded-t-xl transition-all border-b-2 ${
                  activeTab === 'library'
                    ? 'border-pink-500 text-pink-600 bg-pink-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span className="truncate">Kho Mẫu ({customFrames.length})</span>
              </button>
            </div>

            {/* Tab Contents Scrollable View */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4 text-gray-800">
              
              {/* Frame Name Input */}
              <div className="bg-white p-3 rounded-2xl border border-pink-100 shadow-xs">
                <label className="text-xs font-bold text-gray-700 uppercase mb-1 block flex items-center justify-between">
                  <span>Tên Mẫu Khung Ảnh</span>
                  <span className="text-[10px] text-pink-500 font-normal lowercase">dùng để lưu lâu dài</span>
                </label>
                <input
                  type="text"
                  value={frameName}
                  onChange={(e) => setFrameName(e.target.value)}
                  className="w-full px-3.5 py-1.5 rounded-xl border border-gray-200 text-sm font-semibold focus:ring-2 focus:ring-pink-400 focus:outline-none bg-white shadow-xs"
                  placeholder="VD: Mẫu Khung Kỷ Niệm 2026, Y2K Heart, Life4Cuts..."
                />
              </div>

              {/* TAB 1: BORDERS & SLOTS */}
              {activeTab === 'borders' && (
                <div className="flex flex-col gap-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">
                        Số Lượng Ô Ảnh
                      </label>
                      <select
                        value={slotCount}
                        onChange={(e) => setSlotCount(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-pink-400 bg-white"
                      >
                        <option value={4}>4 ô ảnh (Chuẩn Life4Cuts)</option>
                        <option value={3}>3 ô ảnh dọc</option>
                        <option value={2}>2 ô ảnh (Thẻ lớn)</option>
                        <option value={1}>1 ô ảnh đơn (Polaroid)</option>
                        <option value={6}>6 ô ảnh (Lưới 2x3)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">
                        Kích Thước Khung
                      </label>
                      <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value as any)}
                        className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-pink-400 bg-white"
                      >
                        <option value="2x6">2x6 inch (Dải dọc Photobooth chuẩn)</option>
                        <option value="4x6">4x6 inch (Bưu thiếp lớn / Grid)</option>
                        <option value="1x1">1x1 inch (Khung vuông Instagram)</option>
                      </select>
                    </div>
                  </div>

                  {/* Slot Border Customization Card */}
                  <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-pink-500" />
                        <span>Sửa Viền Ô Ảnh (Borders)</span>
                      </span>
                      <span className="text-xs font-bold text-pink-600">{slotBorderWidth}px</span>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                        <span>Độ dày viền: {slotBorderWidth === 0 ? 'Không viền' : `${slotBorderWidth}px`}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="24"
                        value={slotBorderWidth}
                        onChange={(e) => setSlotBorderWidth(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
                      />
                    </div>

                    <div>
                      <span className="text-[11px] text-gray-500 mb-1.5 block">Kiểu nét viền:</span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { id: 'solid', label: '─ Liền' },
                          { id: 'dashed', label: '╌ Đứt' },
                          { id: 'dotted', label: '⋯ Chấm' },
                          { id: 'double', label: '═ Đôi' },
                        ].map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setSlotBorderStyle(st.id as any)}
                            className={`py-1 px-2 rounded-lg text-xs font-semibold border transition-all ${
                              slotBorderStyle === st.id
                                ? 'border-pink-500 bg-pink-50 text-pink-700 font-bold'
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5">
                        <span>Màu viền ô ảnh:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400">Tùy chọn:</span>
                          <input
                            type="color"
                            value={slotBorderColor.startsWith('#') ? slotBorderColor : '#FFFFFF'}
                            onChange={(e) => setSlotBorderColor(e.target.value)}
                            className="w-5 h-5 rounded cursor-pointer border border-gray-200"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {BORDER_COLOR_PALETTES.map((col, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSlotBorderColor(col)}
                            style={{ backgroundColor: col }}
                            className={`w-6 h-6 rounded-full border border-gray-300 shadow-xs transition-transform hover:scale-110 flex items-center justify-center ${
                              slotBorderColor === col ? 'ring-2 ring-pink-500 ring-offset-1' : ''
                            }`}
                          >
                            {slotBorderColor === col && (
                              <Check className="w-3 h-3 text-pink-600 drop-shadow" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Corner Radius & Spacing Padding Sliders */}
                  <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-xs space-y-3 text-xs">
                    <span className="font-bold text-gray-700 uppercase block">Căn Chỉnh & Bo Góc Ô</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                          <span>Bo góc ô:</span>
                          <span className="font-bold text-gray-700">{slotRadius}px</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="45"
                          value={slotRadius}
                          onChange={(e) => setSlotRadius(Number(e.target.value))}
                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                          <span>Khoảng cách ô:</span>
                          <span className="font-bold text-gray-700">{slotGap}px</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          value={slotGap}
                          onChange={(e) => setSlotGap(Number(e.target.value))}
                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                          <span>Lề trên (Header):</span>
                          <span className="font-bold text-gray-700">{topPadding}px</span>
                        </div>
                        <input
                          type="range"
                          min="40"
                          max="220"
                          value={topPadding}
                          onChange={(e) => setTopPadding(Number(e.target.value))}
                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                          <span>Lề dưới (Footer):</span>
                          <span className="font-bold text-gray-700">{bottomPadding}px</span>
                        </div>
                        <input
                          type="range"
                          min="40"
                          max="220"
                          value={bottomPadding}
                          onChange={(e) => setBottomPadding(Number(e.target.value))}
                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
                        />
                      </div>

                      <div className="col-span-2">
                        <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                          <span>Lề 2 bên (Side Margin):</span>
                          <span className="font-bold text-gray-700">{sidePadding}px</span>
                        </div>
                        <input
                          type="range"
                          min="15"
                          max="80"
                          value={sidePadding}
                          onChange={(e) => setSidePadding(Number(e.target.value))}
                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: BACKGROUND & PATTERNS */}
              {activeTab === 'background' && (
                <div className="flex flex-col gap-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBgMode('solid')}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                        bgMode === 'solid' ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-600 bg-white'
                      }`}
                    >
                      🎨 Màu Đơn Sắc
                    </button>
                    <button
                      type="button"
                      onClick={() => setBgMode('gradient')}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                        bgMode === 'gradient' ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-600 bg-white'
                      }`}
                    >
                      🌈 Màu Gradient (Chuyển Sắc)
                    </button>
                  </div>

                  {bgMode === 'solid' && (
                    <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                        <span>Bảng Màu Pastel Trending</span>
                        <input
                          type="color"
                          value={bgColor}
                          onChange={(e) => setBgColor(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer border border-gray-200"
                        />
                      </div>
                      <div className="grid grid-cols-7 gap-2">
                        {SOLID_COLOR_PALETTES.map((c, i) => (
                          <button
                            key={i}
                            type="button"
                            title={c.label}
                            onClick={() => setBgColor(c.color)}
                            style={{ backgroundColor: c.color }}
                            className={`w-full aspect-square rounded-xl border border-gray-300 shadow-xs transition-transform hover:scale-110 flex items-center justify-center ${
                              bgColor === c.color ? 'ring-2 ring-pink-500 ring-offset-2' : ''
                            }`}
                          >
                            {bgColor === c.color && <Check className="w-3.5 h-3.5 text-pink-600 drop-shadow" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {bgMode === 'gradient' && (
                    <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-xs space-y-3">
                      <span className="text-xs font-bold text-gray-700 block">Gradient Presets</span>
                      <div className="grid grid-cols-2 gap-2">
                        {GRADIENT_PRESETS.map((g, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setGradientColor1(g.color1);
                              setGradientColor2(g.color2);
                            }}
                            className="p-2 rounded-xl text-left border border-gray-200 text-xs font-bold shadow-xs flex items-center gap-2 hover:scale-102 transition-transform"
                            style={{ background: g.css }}
                          >
                            <span className="text-white drop-shadow-md text-[11px] font-bold">{g.name}</span>
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-xs">
                        <div className="flex items-center justify-between bg-gray-50 p-2 rounded-xl">
                          <span>Màu đầu:</span>
                          <input
                            type="color"
                            value={gradientColor1}
                            onChange={(e) => setGradientColor1(e.target.value)}
                            className="w-6 h-6 rounded cursor-pointer"
                          />
                        </div>
                        <div className="flex items-center justify-between bg-gray-50 p-2 rounded-xl">
                          <span>Màu cuối:</span>
                          <input
                            type="color"
                            value={gradientColor2}
                            onChange={(e) => setGradientColor2(e.target.value)}
                            className="w-6 h-6 rounded cursor-pointer"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                          <span>Góc xoay Gradient: {gradientAngle}°</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          value={gradientAngle}
                          onChange={(e) => setGradientAngle(Number(e.target.value))}
                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Pattern Overlays */}
                  <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-xs space-y-2">
                    <span className="text-xs font-bold text-gray-700 block">Họa Tiết Phủ Nền</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {PATTERN_OPTIONS.map((pat) => (
                        <button
                          key={pat.id}
                          type="button"
                          onClick={() => setPattern(pat.id as any)}
                          className={`p-2 rounded-xl text-center border text-xs transition-all flex flex-col items-center gap-1 ${
                            pattern === pat.id
                              ? 'border-pink-500 bg-pink-50 text-pink-700 font-bold'
                              : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-base">{pat.icon}</span>
                          <span className="text-[10px] leading-tight">{pat.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Header & Footer Text Settings */}
                  <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-xs space-y-2.5 text-xs">
                    <span className="font-bold text-gray-700 block uppercase">Chữ Đầu & Cuối Khung (Nametag)</span>
                    
                    <div>
                      <label className="text-[11px] text-gray-500 block mb-0.5">Tiêu đề trên (Header text):</label>
                      <input
                        type="text"
                        value={headerText}
                        onChange={(e) => setHeaderText(e.target.value)}
                        placeholder="VD: ★ BEST FRIENDS ★"
                        className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-pink-400 bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-gray-500 block mb-0.5">Tiêu đề dưới (Footer text):</label>
                      <input
                        type="text"
                        value={footerText}
                        onChange={(e) => setFooterText(e.target.value)}
                        placeholder="VD: 2026.10.04 ★ SMILE TOGETHER"
                        className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-pink-400 bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-gray-500 block mb-0.5">Phông chữ:</label>
                        <select
                          value={fontFamily}
                          onChange={(e) => setFontFamily(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-xl border border-gray-200 text-xs bg-white"
                        >
                          {FONT_OPTIONS.map((f) => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center justify-between bg-gray-50 p-1.5 rounded-xl self-end">
                        <span className="text-[11px] text-gray-600">Màu chữ:</span>
                        <input
                          type="color"
                          value={themeColor}
                          onChange={(e) => setThemeColor(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ATTACH STICKERS, LOGOS & GRAPHICS DIRECTLY TO TEMPLATE */}
              {activeTab === 'elements' && (
                <div className="flex flex-col gap-4 animate-in fade-in duration-150">
                  {/* Upload Custom PNG/Logo/Graphic Button */}
                  <div className="bg-gradient-to-r from-pink-50 via-rose-50 to-purple-50 p-3.5 rounded-2xl border border-pink-200 shadow-xs flex flex-col gap-2.5">
                    <span className="text-xs font-bold text-pink-800 uppercase flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-pink-600" />
                      <span>1. Tải Logo / Sticker Riêng Gắn Lên Khung</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => stickerFileInputRef.current?.click()}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 hover:scale-102 transition-transform"
                    >
                      <Plus className="w-4 h-4 text-amber-300" />
                      <span>+ Chọn Ảnh PNG / Logo / Icon Từ Máy</span>
                    </button>
                    <p className="text-[10px] text-pink-600/80 leading-tight">
                      Ảnh tải lên sẽ được lưu cố định vào mẫu khung này để bạn có thể dùng lại mãi mãi!
                    </p>
                  </div>

                  {/* Add Custom Draggable Text */}
                  <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-xs space-y-2.5 text-xs">
                    <span className="font-bold text-gray-700 uppercase block flex items-center gap-1.5">
                      <Type className="w-4 h-4 text-pink-500" />
                      <span>2. Chèn Chữ Trang Trí Vào Khung</span>
                    </span>
                    
                    <form onSubmit={handleAddTextElement} className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        placeholder="Nhập chữ/logo thương hiệu/ngày kỉ niệm..."
                        className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-pink-400 bg-white"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={customTextFont}
                          onChange={(e) => setCustomTextFont(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-xl border border-gray-200 text-xs bg-white font-medium"
                        >
                          {FONT_OPTIONS.map((f) => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>

                        <div className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded-xl">
                          <span className="text-[11px] text-gray-600">Màu chữ:</span>
                          <input
                            type="color"
                            value={customTextColor}
                            onChange={(e) => setCustomTextColor(e.target.value)}
                            className="w-5 h-5 rounded cursor-pointer"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={!customText.trim()}
                        className="w-full py-2 px-3 rounded-xl bg-pink-100 hover:bg-pink-200 text-pink-800 font-bold text-xs transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Gắn Chữ Này Vào Khung</span>
                      </button>
                    </form>
                  </div>

                  {/* Add Cute Emoji/Stamps */}
                  <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-xs space-y-2.5">
                    <span className="text-xs font-bold text-gray-700 uppercase block">
                      3. Thư Viện Sticker Cute Có Sẵn
                    </span>

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {STICKER_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setStickerCategory(cat.id)}
                          className={`py-1 px-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                            stickerCategory === cat.id
                              ? 'bg-pink-500 text-white shadow-xs'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 max-h-36 overflow-y-auto p-1 bg-gray-50 rounded-xl">
                      {STICKER_CATEGORIES.find((c) => c.id === stickerCategory)?.items.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleAddEmojiElement(item)}
                          className="h-10 bg-white hover:bg-pink-50 rounded-xl border border-gray-200 flex items-center justify-center text-lg hover:scale-115 active:scale-95 transition-all shadow-xs"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Elements Layer List */}
                  {templateStickers.length > 0 && (
                    <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-xs space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-gray-700 uppercase">
                        <span>Danh Sách Phần Tử Đã Gắn ({templateStickers.length})</span>
                        <button
                          type="button"
                          onClick={() => {
                            setTemplateStickers([]);
                            setSelectedStickerId(null);
                          }}
                          className="text-[10px] text-rose-500 hover:underline flex items-center gap-0.5 lowercase font-normal"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Gỡ hết</span>
                        </button>
                      </div>

                      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                        {templateStickers.map((stk, idx) => (
                          <div
                            key={stk.id}
                            onClick={() => setSelectedStickerId(stk.id)}
                            className={`p-2 rounded-xl border flex items-center justify-between text-xs transition-all cursor-pointer ${
                              selectedStickerId === stk.id
                                ? 'border-pink-500 bg-pink-50/70 shadow-xs font-bold'
                                : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span className="w-5 h-5 rounded-full bg-pink-100 text-pink-700 text-[10px] flex items-center justify-center shrink-0 font-bold">
                                {idx + 1}
                              </span>
                              {stk.type === 'image' ? (
                                <img src={stk.content} alt="sticker" className="w-6 h-6 object-contain rounded shrink-0 bg-white border" />
                              ) : stk.type === 'text' ? (
                                <span className="truncate max-w-[120px] text-pink-800" style={{ fontFamily: stk.fontFamily }}>{stk.content}</span>
                              ) : (
                                <span className="text-base">{stk.content}</span>
                              )}
                              <span className="text-[10px] text-gray-400">
                                ({stk.scale.toFixed(1)}x, {stk.rotation || 0}°)
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateSelectedSticker({ scale: Math.min(3.0, (stk.scale || 1.0) + 0.15) });
                                }}
                                title="Phóng to"
                                className="p-1 rounded hover:bg-pink-100 text-gray-600"
                              >
                                <ZoomIn className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateSelectedSticker({ scale: Math.max(0.3, (stk.scale || 1.0) - 0.15) });
                                }}
                                title="Thu nhỏ"
                                className="p-1 rounded hover:bg-pink-100 text-gray-600"
                              >
                                <ZoomOut className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateSelectedSticker({ rotation: ((stk.rotation || 0) + 15) % 360 });
                                }}
                                title="Xoay 15°"
                                className="p-1 rounded hover:bg-pink-100 text-gray-600"
                              >
                                <RotateCw className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTemplateStickers((prev) => prev.filter((item) => item.id !== stk.id));
                                  if (selectedStickerId === stk.id) setSelectedStickerId(null);
                                }}
                                title="Xoá"
                                className="p-1 rounded hover:bg-rose-100 text-rose-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: IMPORT CANVA & IMAGE FILE */}
              {activeTab === 'canva' && (
                <div className="flex flex-col gap-4 animate-in fade-in duration-150">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-3 text-xs text-purple-950">
                    <div className="flex items-center justify-between font-bold">
                      <div className="flex items-center gap-1.5 text-purple-700">
                        <HelpCircle className="w-4 h-4 text-purple-500" />
                        <span>Cách lấy khung từ Canva</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCanvaGuide(!showCanvaGuide)}
                        className="text-pink-600 underline font-semibold hover:text-pink-700"
                      >
                        {showCanvaGuide ? 'Thu gọn' : 'Xem hướng dẫn'}
                      </button>
                    </div>
                    {showCanvaGuide && (
                      <div className="mt-2.5 pt-2 border-t border-purple-200 flex flex-col gap-1.5 text-gray-700 leading-relaxed text-[11px]">
                        <div><strong>• Bước 1:</strong> Thiết kế trên Canva (Khung 2x6 hoặc 4x6 inch).</div>
                        <div><strong>• Bước 2:</strong> Chia sẻ -&gt; Tải xuống -&gt; Chọn định dạng <strong>PNG</strong> (tích nền trong suốt).</div>
                        <div><strong>• Bước 3:</strong> Bấm nút tải lên file ảnh dưới đây. Hệ thống tự động đục lỗ ô ảnh chuẩn xác!</div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase mb-1 block">
                      Tải File Ảnh Khung Canva (PNG / JPG)
                    </label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-3.5 px-4 rounded-2xl border-2 border-dashed border-pink-300 bg-pink-50/60 hover:bg-pink-100/70 text-pink-700 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
                    >
                      <Upload className="w-4 h-4 text-pink-500" />
                      <span>{uploadedImage ? 'Thay Đổi File Ảnh Khung Khác' : 'Chọn File Ảnh Khung PNG Từ Máy'}</span>
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase mb-1 block">
                      Hoặc Dán Link Canva / Link Ảnh Online
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <LinkIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="url"
                          value={imageUrlInput}
                          onChange={(e) => setImageUrlInput(e.target.value)}
                          placeholder="https://canva.link/... hoặc link ảnh"
                          className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-pink-400 bg-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyUrl}
                        disabled={isLoadingUrl || !imageUrlInput.trim()}
                        className="px-4 py-2 rounded-xl bg-pink-600 text-white text-xs font-semibold hover:bg-pink-700 disabled:opacity-50 shrink-0 shadow-sm"
                      >
                        {isLoadingUrl ? 'Đang tải...' : 'Lấy ảnh'}
                      </button>
                    </div>
                    {urlError && (
                      <p className="text-[11px] text-rose-500 mt-1 bg-rose-50 p-2 rounded-lg border border-rose-200">{urlError}</p>
                    )}
                  </div>

                  {uploadedImage && (
                    <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-700 uppercase">Chế Độ Khung Canva</span>
                        <button
                          type="button"
                          onClick={() => setUploadedImage(null)}
                          className="text-[10px] text-rose-500 hover:underline flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Gỡ ảnh khung</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setFrameLayerMode('overlay')}
                          className={`p-2.5 rounded-xl text-left border text-xs transition-all ${
                            frameLayerMode === 'overlay'
                              ? 'border-pink-500 bg-pink-50 text-pink-900 font-bold ring-2 ring-pink-300'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <div className="font-semibold text-[11px] mb-0.5">🌟 Viền đè lên ảnh (Overlay)</div>
                          <div className="text-[10px] text-gray-500 font-normal">Tự động khoét ô ảnh Canva, icon & sticker nằm trên ảnh</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFrameLayerMode('background')}
                          className={`p-2.5 rounded-xl text-left border text-xs transition-all ${
                            frameLayerMode === 'background'
                              ? 'border-pink-500 bg-pink-50 text-pink-900 font-bold ring-2 ring-pink-300'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <div className="font-semibold text-[11px] mb-0.5">🖼️ Khung làm nền (Background)</div>
                          <div className="text-[10px] text-gray-500 font-normal">Ảnh chụp sẽ nằm đè lên toàn bộ nền</div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: SAVED TEMPLATES LIBRARY & BACKUP */}
              {activeTab === 'library' && (
                <div className="flex flex-col gap-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700 uppercase">
                      Kho Mẫu Đã Lưu Của Bạn ({customFrames.length})
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleExportJson}
                        title="Xuất file mẫu để sao lưu"
                        className="py-1 px-2.5 rounded-lg bg-pink-50 text-pink-700 border border-pink-200 text-[11px] font-bold flex items-center gap-1 hover:bg-pink-100"
                      >
                        <Download className="w-3 h-3" />
                        <span>Xuất File .json</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => jsonImportInputRef.current?.click()}
                        title="Nhập file mẫu từ máy khác"
                        className="py-1 px-2.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-200 text-[11px] font-bold flex items-center gap-1 hover:bg-gray-200"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Nhập Mẫu</span>
                      </button>
                    </div>
                  </div>

                  {customFrames.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-gray-300 text-gray-400 flex flex-col items-center gap-2">
                      <Sparkles className="w-8 h-8 text-pink-300" />
                      <p className="text-xs font-semibold text-gray-600">Bạn chưa có mẫu khung tùy chỉnh nào được lưu</p>
                      <p className="text-[11px] text-gray-400">Hãy chỉnh sửa viền, màu nền, gắn sticker rồi bấm "Lưu Thành Mẫu Mới" ở dưới nhé!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto p-1">
                      {customFrames.map((cf) => (
                        <div
                          key={cf.id}
                          className="bg-white p-3 rounded-2xl border border-pink-100 shadow-xs flex items-center justify-between gap-3 hover:border-pink-300 transition-all group"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div
                              className="w-10 h-14 rounded-lg border border-gray-300 overflow-hidden shrink-0 relative flex flex-col p-0.5 justify-between shadow-xs"
                              style={{ background: cf.backgroundGradient || cf.backgroundColor }}
                            >
                              {cf.slots.map((s) => (
                                <div key={s.id} className="w-full flex-1 bg-white/80 rounded-[1px] m-0.5" />
                              ))}
                              {cf.overlayImageUrl && (
                                <img src={cf.overlayImageUrl} alt={cf.name} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                              )}
                            </div>

                            <div className="overflow-hidden">
                              <h4 className="font-bold text-xs text-gray-800 truncate">{cf.name}</h4>
                              <p className="text-[10px] text-gray-500">{cf.slotCount} ô • {cf.aspectRatio}</p>
                              {cf.stickers && cf.stickers.length > 0 && (
                                <span className="inline-block mt-0.5 text-[9px] bg-pink-100 text-pink-700 px-1.5 py-0.2 rounded font-semibold">
                                  {cf.stickers.length} sticker/logo
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleLoadCustomFrame(cf)}
                              className="p-1.5 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 text-xs font-bold transition-colors"
                              title="Nạp vào Studio để sửa"
                            >
                              ✏️ Sửa
                            </button>
                            {onSelectFrame && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectFrame(cf);
                                  onClose();
                                }}
                                className="p-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition-colors"
                                title="Áp dụng chụp ảnh ngay"
                              >
                                Dùng
                              </button>
                            )}
                            {onDeleteCustomFrame && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Bạn có chắc muốn xoá mẫu "${cf.name}"?`)) {
                                    onDeleteCustomFrame(cf.id);
                                  }
                                }}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-colors"
                                title="Xoá mẫu này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: 60fps Live WYSIWYG Photobooth Preview Strip with Interactive Drag */}
          <div className="w-full md:w-84 bg-gray-100 p-4 flex flex-col items-center justify-between border-t md:border-t-0 border-gray-200 select-none">
            <div className="w-full flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-pink-500" />
                <span>Xem Trước Trực Tiếp 60fps</span>
              </span>
              <span className="text-[10px] bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-bold">
                {aspectRatio} • {slotCount} ô
              </span>
            </div>

            {/* Selected Sticker Floating Toolbar in Preview */}
            {selectedSticker && (
              <div className="w-full bg-white/95 backdrop-blur-md rounded-xl p-1.5 border border-pink-300 shadow-md flex items-center justify-between gap-1 mb-2 animate-in fade-in slide-in-from-top-2 text-xs">
                <span className="text-[10px] font-bold text-pink-700 truncate pl-1">
                  {selectedSticker.type === 'image' ? 'Ảnh/Logo' : selectedSticker.type === 'text' ? `Chữ: "${selectedSticker.content}"` : `Sticker ${selectedSticker.content}`}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleUpdateSelectedSticker({ scale: Math.min(3.0, (selectedSticker.scale || 1.0) + 0.15) })}
                    className="p-1 rounded bg-gray-100 hover:bg-pink-100 text-gray-700"
                    title="Phóng to"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateSelectedSticker({ scale: Math.max(0.3, (selectedSticker.scale || 1.0) - 0.15) })}
                    className="p-1 rounded bg-gray-100 hover:bg-pink-100 text-gray-700"
                    title="Thu nhỏ"
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateSelectedSticker({ rotation: ((selectedSticker.rotation || 0) + 15) % 360 })}
                    className="p-1 rounded bg-gray-100 hover:bg-pink-100 text-gray-700"
                    title="Xoay 15°"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSelectedSticker}
                    className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600"
                    title="Xoá phần tử"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStickerId(null)}
                    className="p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600"
                    title="Bỏ chọn"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Canvas Preview Container with Touch/Pointer Drag & Drop */}
            <div
              ref={previewContainerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="relative photobooth-shadow rounded-2xl overflow-hidden border-2 border-white shadow-xl flex items-center justify-center my-auto cursor-grab active:cursor-grabbing touch-none"
              style={{
                width: aspectRatio === '4x6' || aspectRatio === '1x1' ? '220px' : '180px',
                aspectRatio: aspectRatio === '4x6' ? '1200 / 1800' : (aspectRatio === '1x1' ? '1200 / 1200' : '600 / 1800'),
              }}
            >
              <canvas
                ref={previewCanvasRef}
                className="w-full h-full block"
              />
            </div>

            {/* Quick Preview Tips */}
            <p className="text-[10px] text-gray-500 text-center mt-3">
              💡 Chạm & kéo sticker/logo trực tiếp trên dải ảnh để đổi vị trí!
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-white border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 text-xs sm:text-sm font-semibold transition-all"
          >
            Đóng
          </button>

          <div className="flex items-center gap-2">
            {initialFrame && onUpdateCurrentFrame && (
              <button
                type="button"
                onClick={() => handleSaveAndApply(false)}
                className="px-4 py-2.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 text-purple-600" />
                <span>Cập Nhật Vào Mẫu Này</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSaveAndApply(true)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xs sm:text-sm shadow-md transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>💾 Lưu Thành Mẫu Mới (Dùng Lâu Dài)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
