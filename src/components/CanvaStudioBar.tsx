import React, { useState, useRef, useMemo } from 'react';
import {
  Sparkles,
  Upload,
  Type,
  Smile,
  Palette,
  Layout,
  Plus,
  Trash2,
  Sliders,
  Check,
  Search,
  Filter,
  UploadCloud,
  Edit3,
  Copy,
  FolderOpen,
  Download,
  RotateCw,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { FrameTemplate, StickerItem } from '../types/photobooth';
import { PRESET_FRAMES, CATEGORIES } from '../templates/presetFrames';

interface CanvaStudioBarProps {
  selectedFrame: FrameTemplate;
  onSelectFrame: (frame: FrameTemplate) => void;
  onUpdateFrame: (updated: Partial<FrameTemplate>) => void;
  customFrames: FrameTemplate[];
  stickers: StickerItem[];
  onAddSticker: (sticker: Omit<StickerItem, 'id'>) => void;
  onUpdateSticker?: (stickerId: string, updates: Partial<StickerItem>) => void;
  onRemoveSticker?: (stickerId: string) => void;
  onClearAllStickers: () => void;
  onOpenFullStudio: (frame?: FrameTemplate) => void;
  onSaveAsNewTemplate?: (name: string) => void;
  onUpdateCurrentTemplate?: () => void;
  onDeleteCustomFrame?: (frameId: string) => void;
  onDuplicateCustomFrame?: (frame: FrameTemplate) => void;
  onAddCustomFrame?: (frame: FrameTemplate) => void;
}

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
    id: 'fun',
    name: '🕶️ Vui Nhộn',
    items: ['🕶️', '👓', '👒', '🧢', '👑', '🥳', '😜', '🔥', '💯', '✌️', '🤟', '🍕', '🎉', '🎈', '🍾'],
  },
  {
    id: 'stamps',
    name: '🏷️ Nhãn Chữ',
    items: ['PHOTO XINHH', 'LIFE4CUTS', 'BESTIES ❤️', 'LOVE YOU', 'CUTE ✨', 'Y2K BABY', 'HARU FILM', 'HAPPY DAY 🎂', 'FOREVER', '2026'],
  }
];

const FONT_OPTIONS = [
  { id: "'Caveat', cursive", name: 'Viết tay (Caveat)' },
  { id: "'Fredoka', sans-serif", name: 'Bo tròn Cute (Fredoka)' },
  { id: "'Pacifico', cursive", name: 'Nghệ thuật (Pacifico)' },
  { id: "'Plus Jakarta Sans', sans-serif", name: 'Hiện đại (Jakarta)' },
  { id: "'Playfair Display', serif", name: 'Cổ điển (Playfair)' },
  { id: "'Courier Prime', monospace", name: 'Máy đánh chữ (Courier)' },
];

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
  { name: 'Sweet Pink', css: 'linear-gradient(180deg, #FF69B4 0%, #FF1493 100%)', color1: '#FF69B4', color2: '#FF1493' },
  { name: 'Cotton Candy', css: 'linear-gradient(180deg, #FFAFBD 0%, #ffc3a0 100%)', color1: '#FFAFBD', color2: '#ffc3a0' },
  { name: 'Lilac Dream', css: 'linear-gradient(180deg, #E0C3FC 0%, #8EC5FC 100%)', color1: '#E0C3FC', color2: '#8EC5FC' },
  { name: 'Sunset Glow', css: 'linear-gradient(180deg, #FF512F 0%, #DD2476 100%)', color1: '#FF512F', color2: '#DD2476' },
  { name: 'Vintage Mocha', css: 'linear-gradient(180deg, #3E2723 0%, #D7CCC8 100%)', color1: '#3E2723', color2: '#D7CCC8' },
  { name: 'Mint Lime', css: 'linear-gradient(180deg, #A8FF78 0%, #78FFD6 100%)', color1: '#A8FF78', color2: '#78FFD6' },
  { name: 'Baby Sky', css: 'linear-gradient(180deg, #E0F2FE 0%, #0284C7 100%)', color1: '#E0F2FE', color2: '#0284C7' },
  { name: 'Dark Noir', css: 'linear-gradient(180deg, #111827 0%, #1F2937 100%)', color1: '#111827', color2: '#1F2937' },
];

const BORDER_COLOR_PALETTES = [
  '#FFFFFF', '#000000', '#F43F5E', '#EC4899', '#8B5CF6', 
  '#3B82F6', '#06B6D4', '#10B981', '#FBBF24', '#FEF08A', 
  '#E0F2FE', '#FCE7F3', '#FEF3C7', 'rgba(255,255,255,0.6)'
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

export const CanvaStudioBar: React.FC<CanvaStudioBarProps> = ({
  selectedFrame,
  onSelectFrame,
  onUpdateFrame,
  customFrames,
  stickers,
  onAddSticker,
  onUpdateSticker,
  onRemoveSticker,
  onClearAllStickers,
  onOpenFullStudio,
  onSaveAsNewTemplate,
  onUpdateCurrentTemplate,
  onDeleteCustomFrame,
  onDuplicateCustomFrame,
  onAddCustomFrame,
}) => {
  type StudioTab = 'frames' | 'borders' | 'stickers' | 'text' | 'background' | 'library';
  const [activeTab, setActiveTab] = useState<StudioTab>('frames');
  const [selectedCategory, setSelectedCategory] = useState('cute');

  // Frame Gallery Search & Filter
  const [frameSearchQuery, setFrameSearchQuery] = useState('');
  const [frameCategoryFilter, setFrameCategoryFilter] = useState('all');

  // Custom Text Input State
  const [customText, setCustomText] = useState('');
  const [selectedFont, setSelectedFont] = useState("'Caveat', cursive");
  const [selectedTextColor, setSelectedTextColor] = useState('#111827');

  // Save Dialog State
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');

  const customImageInputRef = useRef<HTMLInputElement>(null);
  const jsonImportRef = useRef<HTMLInputElement>(null);

  // Filtered frames for Tab 1
  const allFrames = useMemo(() => {
    return [...customFrames, ...PRESET_FRAMES];
  }, [customFrames]);

  const filteredFrames = useMemo(() => {
    return allFrames.filter((frame) => {
      const matchCat = frameCategoryFilter === 'all' || 
        (frameCategoryFilter === 'custom' ? frame.isCustom : frame.category === frameCategoryFilter);
      const matchSearch = frame.name.toLowerCase().includes(frameSearchQuery.toLowerCase()) ||
        (frame.headerText && frame.headerText.toLowerCase().includes(frameSearchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [allFrames, frameCategoryFilter, frameSearchQuery]);

  // Upload Custom Image/PNG as Draggable Sticker Element
  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        onAddSticker({
          content: dataUrl,
          type: 'image',
          x: selectedFrame.width / 2 + (Math.random() * 60 - 30),
          y: selectedFrame.height / 2 + (Math.random() * 100 - 50),
          scale: 1.0,
          rotation: 0,
          width: 140,
          height: 140,
        });
      };
      reader.readAsDataURL(file);
    }
    if (customImageInputRef.current) customImageInputRef.current.value = '';
  };

  // Add custom text layer
  const handleAddTextLayer = (e: React.FormEvent) => {
    e.preventDefault();
    const txt = customText.trim();
    if (!txt) return;

    onAddSticker({
      content: txt,
      type: 'text',
      x: selectedFrame.width / 2 + (Math.random() * 40 - 20),
      y: selectedFrame.height / 2 + (Math.random() * 100 - 50),
      scale: 1.0,
      rotation: 0,
      fontFamily: selectedFont,
      color: selectedTextColor,
    });
    setCustomText('');
  };

  // Trigger Save Current Frame Setup as Template
  const handleTriggerSave = (e: React.FormEvent) => {
    e.preventDefault();
    const name = saveTemplateName.trim() || `Mẫu Khung ${new Date().toLocaleDateString('vi-VN')}`;
    if (onSaveAsNewTemplate) {
      onSaveAsNewTemplate(name);
    }
    setShowSaveDialog(false);
    setSaveTemplateName('');
  };

  // Export JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(customFrames, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `photobooth_custom_frames_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAddCustomFrame) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            parsed.forEach((f) => onAddCustomFrame(f));
            alert(`Đã nhập thành công ${parsed.length} mẫu khung vào kho!`);
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
    if (jsonImportRef.current) jsonImportRef.current.value = '';
  };

  return (
    <div className="w-full bg-white/95 backdrop-blur-md rounded-3xl border border-pink-200/90 shadow-md overflow-hidden flex flex-col transition-all">
      {/* Hidden file inputs */}
      <input
        ref={customImageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        onChange={handleCustomImageUpload}
        className="hidden"
      />
      <input
        ref={jsonImportRef}
        type="file"
        accept=".json"
        onChange={handleImportJson}
        className="hidden"
      />

      {/* Save Template Prompt Modal Popup */}
      {showSaveDialog && (
        <div className="p-3 bg-gradient-to-r from-purple-50 via-pink-50 to-rose-50 border-b border-pink-200 animate-in fade-in duration-150">
          <form onSubmit={handleTriggerSave} className="flex flex-col sm:flex-row items-center gap-2">
            <span className="text-xs font-bold text-pink-900 shrink-0">
              💾 Đặt Tên Mẫu Để Dùng Lâu Dài:
            </span>
            <input
              type="text"
              value={saveTemplateName}
              onChange={(e) => setSaveTemplateName(e.target.value)}
              placeholder={`VD: Khung Sinh Nhật ${new Date().toLocaleDateString('vi-VN')}`}
              autoFocus
              className="flex-1 w-full px-3 py-1.5 rounded-xl border border-pink-300 bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
              <button
                type="submit"
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs shadow-xs"
              >
                Lưu Ngay
              </button>
              <button
                type="button"
                onClick={() => setShowSaveDialog(false)}
                className="px-2.5 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-xs"
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="px-3 sm:px-4 py-2 bg-gradient-to-r from-pink-50 via-purple-50 to-pink-50 border-b border-pink-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-bold text-xs text-pink-700">
          <Sparkles className="w-4 h-4 text-pink-500 animate-pulse" />
          <span className="hidden sm:inline">Bộ Trang Bị Tự Sửa & Thiết Kế Khung</span>
          <span className="sm:hidden">Bộ Trang Bị Khung</span>
        </div>

        {/* Action buttons: Save Template & Full Studio */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {onSaveAsNewTemplate && (
            <button
              onClick={() => {
                setSaveTemplateName(`${selectedFrame.name} (Bản Mới)`);
                setShowSaveDialog(true);
              }}
              title="Lưu lại toàn bộ viền, sticker và màu sắc thành mẫu dùng lâu dài"
              className="py-1 px-2.5 rounded-full bg-pink-100 hover:bg-pink-200 text-pink-800 font-bold text-[11px] sm:text-xs shadow-xs transition-all hover:scale-105 active:scale-95 flex items-center gap-1"
            >
              <span>💾 Lưu Mẫu Mới</span>
            </button>
          )}

          {selectedFrame.isCustom && onUpdateCurrentTemplate && (
            <button
              onClick={onUpdateCurrentTemplate}
              title="Cập nhật thay đổi vào mẫu khung đang chọn"
              className="py-1 px-2.5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold text-[11px] sm:text-xs shadow-xs transition-all hover:scale-105 active:scale-95 flex items-center gap-1"
            >
              <span>⚡ Cập Nhật Mẫu</span>
            </button>
          )}

          <button
            onClick={() => onOpenFullStudio(selectedFrame)}
            className="py-1 px-2.5 sm:px-3 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 text-white font-bold text-[11px] sm:text-xs shadow-xs hover:shadow-pink-200 transition-all hover:scale-105 active:scale-95 flex items-center gap-1 shrink-0"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Studio Nâng Cao</span>
            <span className="sm:hidden">Studio Pro</span>
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation (Scrollable on mobile) */}
      <div className="flex items-center bg-gray-50 border-b border-gray-200 text-xs font-bold px-2 pt-1 gap-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('frames')}
          className={`py-2 px-2.5 rounded-t-xl transition-all border-b-2 flex items-center justify-center gap-1.5 shrink-0 ${
            activeTab === 'frames'
              ? 'border-pink-500 text-pink-600 bg-white shadow-xs'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Layout className="w-3.5 h-3.5" />
          <span>🖼️ Chọn Khung</span>
        </button>

        <button
          onClick={() => setActiveTab('borders')}
          className={`py-2 px-2.5 rounded-t-xl transition-all border-b-2 flex items-center justify-center gap-1.5 shrink-0 ${
            activeTab === 'borders'
              ? 'border-pink-500 text-pink-600 bg-white shadow-xs'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>📐 Sửa Viền Ô</span>
        </button>

        <button
          onClick={() => setActiveTab('stickers')}
          className={`py-2 px-2.5 rounded-t-xl transition-all border-b-2 flex items-center justify-center gap-1.5 shrink-0 ${
            activeTab === 'stickers'
              ? 'border-pink-500 text-pink-600 bg-white shadow-xs'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Smile className="w-3.5 h-3.5" />
          <span>🎀 Sticker & Ảnh ({stickers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('text')}
          className={`py-2 px-2.5 rounded-t-xl transition-all border-b-2 flex items-center justify-center gap-1.5 shrink-0 ${
            activeTab === 'text'
              ? 'border-pink-500 text-pink-600 bg-white shadow-xs'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          <span>🔤 Thêm Chữ</span>
        </button>

        <button
          onClick={() => setActiveTab('background')}
          className={`py-2 px-2.5 rounded-t-xl transition-all border-b-2 flex items-center justify-center gap-1.5 shrink-0 ${
            activeTab === 'background'
              ? 'border-pink-500 text-pink-600 bg-white shadow-xs'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>🎨 Màu Nền</span>
        </button>

        <button
          onClick={() => setActiveTab('library')}
          className={`py-2 px-2.5 rounded-t-xl transition-all border-b-2 flex items-center justify-center gap-1.5 shrink-0 ${
            activeTab === 'library'
              ? 'border-pink-500 text-pink-600 bg-white shadow-xs'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>💾 Kho Mẫu ({customFrames.length})</span>
        </button>
      </div>

      {/* TAB 1: INTEGRATED FRAME SELECTOR GALLERY */}
      {activeTab === 'frames' && (
        <div className="p-3 sm:p-4 flex flex-col gap-3 animate-in fade-in duration-150">
          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-pink-400" />
              <input
                type="text"
                placeholder="Tìm khung ảnh, chủ đề..."
                value={frameSearchQuery}
                onChange={(e) => setFrameSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-pink-200 bg-white text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-400 shadow-xs"
              />
            </div>

            <div className="relative min-w-[150px]">
              <select
                value={frameCategoryFilter}
                onChange={(e) => setFrameCategoryFilter(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-1.5 rounded-xl border border-pink-200 bg-white text-xs font-semibold text-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-400 shadow-xs cursor-pointer"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.id === 'custom' && customFrames.length > 0 ? `⭐ Mẫu của bạn (${customFrames.length})` : cat.label}
                  </option>
                ))}
              </select>
              <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-pink-400 pointer-events-none" />
            </div>
          </div>

          {/* Frames Scrollable Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2.5 max-h-72 sm:max-h-80 overflow-y-auto p-1 bg-gray-50/60 rounded-2xl border border-gray-100">
            {/* Create New Frame Card */}
            <button
              onClick={() => onOpenFullStudio()}
              className="group flex flex-col items-center p-1.5 rounded-xl transition-all hover:scale-105 border-2 border-dashed border-purple-300 hover:border-pink-500 bg-gradient-to-b from-purple-50/70 to-pink-50/70 shadow-xs"
            >
              <div className="w-full aspect-[1/3] rounded-lg border border-dashed border-purple-300 flex flex-col items-center justify-center p-1 text-center text-purple-700 gap-1 bg-white/80">
                <UploadCloud className="w-5 h-5 text-pink-500 group-hover:scale-110 transition-transform" />
                <span className="text-[8px] font-extrabold leading-tight text-purple-800">
                  + Tạo Mới
                </span>
              </div>
              <span className="text-[10px] font-bold mt-1 text-purple-700 text-center">
                Thiết Kế Mới
              </span>
            </button>

            {filteredFrames.map((frame) => {
              const isSelected = selectedFrame.id === frame.id;
              const isCustom = frame.isCustom;

              return (
                <div
                  key={frame.id}
                  onClick={() => onSelectFrame(frame)}
                  className={`group relative flex flex-col items-center p-1.5 rounded-xl transition-all cursor-pointer ${
                    isSelected
                      ? 'ring-2 ring-pink-500 bg-pink-50/90 shadow-md scale-102 font-bold'
                      : 'hover:bg-pink-50/40 hover:scale-102 border border-transparent'
                  }`}
                >
                  <div
                    className="w-full aspect-[1/3] rounded-lg overflow-hidden border border-gray-200/80 shadow-xs flex flex-col p-0.5 relative"
                    style={{ background: frame.backgroundGradient || frame.backgroundColor }}
                  >
                    {frame.headerText && (
                      <div className="w-full text-[5px] text-center font-bold tracking-tighter truncate opacity-80 mb-0.5" style={{ color: frame.themeColor }}>
                        {frame.headerText.slice(0, 10)}
                      </div>
                    )}

                    <div className="flex-1 flex flex-col justify-between gap-0.5">
                      {frame.slots.map((slot) => (
                        <div key={slot.id} className="w-full flex-1 bg-white/90 rounded-[1px] border border-black/5" />
                      ))}
                    </div>

                    {(frame.overlayImageUrl || frame.backgroundImage) && (
                      <img
                        src={frame.overlayImageUrl || frame.backgroundImage}
                        alt={frame.name}
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      />
                    )}

                    {isCustom && (
                      <div className="absolute top-0.5 left-0.5 px-1 py-0.2 bg-purple-600 text-white rounded text-[6px] font-bold shadow z-10 flex items-center gap-0.5">
                        ⭐ Mẫu riêng
                      </div>
                    )}

                    {isSelected && (
                      <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-pink-500 text-white rounded-full flex items-center justify-center text-[8px] shadow z-10 font-bold">
                        ✓
                      </div>
                    )}
                  </div>

                  <span className={`text-[10px] font-semibold mt-1 truncate max-w-full text-center ${
                    isSelected ? 'text-pink-600' : 'text-gray-600'
                  }`}>
                    {frame.name}
                  </span>

                  {isCustom && (
                    <div className="mt-0.5 flex items-center gap-1 opacity-75 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFullStudio(frame);
                        }}
                        title="Sửa mẫu này"
                        className="p-0.5 rounded bg-white hover:bg-pink-100 text-pink-700 shadow-2xs border border-pink-200"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                      </button>
                      {onDuplicateCustomFrame && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateCustomFrame(frame);
                          }}
                          title="Nhân bản mẫu này"
                          className="p-0.5 rounded bg-white hover:bg-purple-100 text-purple-700 shadow-2xs border border-purple-200"
                        >
                          <Copy className="w-2.5 h-2.5" />
                        </button>
                      )}
                      {onDeleteCustomFrame && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Xoá mẫu "${frame.name}"?`)) {
                              onDeleteCustomFrame(frame.id);
                            }
                          }}
                          title="Xoá mẫu này"
                          className="p-0.5 rounded bg-white hover:bg-rose-100 text-rose-600 shadow-2xs border border-rose-200"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: QUICK BORDER & LAYOUT CUSTOMIZER */}
      {activeTab === 'borders' && (
        <div className="p-3.5 flex flex-col gap-3 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Border Width Slider */}
            <div className="bg-gray-50 p-2.5 rounded-2xl border border-gray-200 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                <span>Độ dày viền ô ảnh:</span>
                <span className="text-pink-600">{selectedFrame.slotBorderWidth ?? 0}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="24"
                value={selectedFrame.slotBorderWidth ?? 0}
                onChange={(e) => onUpdateFrame({ slotBorderWidth: Number(e.target.value) })}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
              />
            </div>

            {/* Corner Radius Slider */}
            <div className="bg-gray-50 p-2.5 rounded-2xl border border-gray-200 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                <span>Bo tròn góc ô ảnh:</span>
                <span className="text-pink-600">{selectedFrame.slots[0]?.borderRadius ?? 16}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="45"
                value={selectedFrame.slots[0]?.borderRadius ?? 16}
                onChange={(e) => {
                  const rad = Number(e.target.value);
                  const updatedSlots = selectedFrame.slots.map((s) => ({ ...s, borderRadius: rad }));
                  onUpdateFrame({ slots: updatedSlots });
                }}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
              />
            </div>
          </div>

          {/* Border Style Buttons */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-gray-700">Kiểu nét đường viền:</span>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'solid', label: '─ Nét Liền' },
                { id: 'dashed', label: '╌ Nét Đứt' },
                { id: 'dotted', label: '⋯ Chấm Bi' },
                { id: 'double', label: '═ Viền Đôi' },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => onUpdateFrame({ slotBorderStyle: st.id as any })}
                  className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                    (selectedFrame.slotBorderStyle || 'solid') === st.id
                      ? 'border-pink-500 bg-pink-50 text-pink-700 font-bold shadow-xs'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Border Color Swatches */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
              <span>Màu sắc đường viền:</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400 font-normal">Tùy chỉnh:</span>
                <input
                  type="color"
                  value={selectedFrame.slotBorderColor?.startsWith('#') ? selectedFrame.slotBorderColor : '#FFFFFF'}
                  onChange={(e) => onUpdateFrame({ slotBorderColor: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer border border-gray-200"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {BORDER_COLOR_PALETTES.map((col, idx) => (
                <button
                  key={idx}
                  onClick={() => onUpdateFrame({ slotBorderColor: col })}
                  style={{ backgroundColor: col }}
                  className={`w-6 h-6 rounded-full border border-gray-300 shadow-xs transition-transform hover:scale-115 flex items-center justify-center shrink-0 ${
                    selectedFrame.slotBorderColor === col ? 'ring-2 ring-pink-500 ring-offset-1' : ''
                  }`}
                >
                  {selectedFrame.slotBorderColor === col && (
                    <Check className="w-3 h-3 text-pink-600 drop-shadow" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STICKERS & CUSTOM IMAGE UPLOAD */}
      {activeTab === 'stickers' && (
        <div className="p-3.5 flex flex-col gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <button
              onClick={() => customImageInputRef.current?.click()}
              className="flex-1 py-2 px-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 hover:scale-102 active:scale-95"
            >
              <Upload className="w-4 h-4 text-amber-300" />
              <span>+ Tải Ảnh PNG / Logo / Sticker Riêng Từ Máy</span>
            </button>

            {stickers.length > 0 && (
              <button
                onClick={onClearAllStickers}
                title="Gỡ tất cả sticker trên khung"
                className="py-2 px-3 rounded-2xl bg-gray-100 hover:bg-rose-50 text-gray-600 hover:text-rose-600 text-xs font-semibold transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Gỡ hết ({stickers.length})</span>
              </button>
            )}
          </div>

          {/* Category Switcher */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {STICKER_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`py-1 px-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-pink-500 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Stickers Shelf */}
          <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5 max-h-36 overflow-y-auto p-1 bg-gray-50 rounded-2xl border border-gray-100">
            {STICKER_CATEGORIES.find((c) => c.id === selectedCategory)?.items.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  onAddSticker({
                    content: item,
                    type: item.length > 2 ? 'text' : 'emoji',
                    x: selectedFrame.width / 2 + (Math.random() * 80 - 40),
                    y: selectedFrame.height / 2 + (Math.random() * 160 - 80),
                    scale: 1.2,
                    rotation: 0,
                  });
                }}
                className="h-9 bg-white hover:bg-pink-50 rounded-xl border border-gray-200 flex items-center justify-center text-lg hover:scale-120 active:scale-95 transition-all shadow-2xs"
              >
                {item}
              </button>
            ))}
          </div>

          {/* Layer List of Active Stickers with Quick Tools */}
          {stickers.length > 0 && (
            <div className="flex flex-col gap-1 pt-1 border-t border-gray-100 max-h-36 overflow-y-auto">
              <span className="text-[10px] font-bold text-gray-500 uppercase">
                Các phần tử đang có trên khung ({stickers.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {stickers.map((stk) => (
                  <div
                    key={stk.id}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-2 py-1 flex items-center gap-1.5 text-xs shadow-2xs"
                  >
                    {stk.type === 'image' ? (
                      <img src={stk.content} alt="stk" className="w-5 h-5 object-contain rounded bg-white" />
                    ) : stk.type === 'text' ? (
                      <span className="font-bold text-pink-700 truncate max-w-[80px]">{stk.content}</span>
                    ) : (
                      <span>{stk.content}</span>
                    )}

                    {onUpdateSticker && (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => onUpdateSticker(stk.id, { scale: Math.min(3.0, (stk.scale || 1.0) + 0.15) })}
                          className="p-0.5 hover:bg-pink-100 rounded text-gray-600"
                          title="Phóng to"
                        >
                          <ZoomIn className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => onUpdateSticker(stk.id, { scale: Math.max(0.3, (stk.scale || 1.0) - 0.15) })}
                          className="p-0.5 hover:bg-pink-100 rounded text-gray-600"
                          title="Thu nhỏ"
                        >
                          <ZoomOut className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => onUpdateSticker(stk.id, { rotation: ((stk.rotation || 0) + 15) % 360 })}
                          className="p-0.5 hover:bg-pink-100 rounded text-gray-600"
                          title="Xoay"
                        >
                          <RotateCw className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}

                    {onRemoveSticker && (
                      <button
                        onClick={() => onRemoveSticker(stk.id)}
                        className="p-0.5 hover:bg-rose-100 text-rose-500 rounded"
                        title="Xoá"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: TYPOGRAPHY / ADD TEXT */}
      {activeTab === 'text' && (
        <div className="p-3.5 flex flex-col gap-3 animate-in fade-in duration-150">
          <form onSubmit={handleAddTextLayer} className="flex flex-col gap-2.5">
            <div className="flex gap-2">
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Nhập chữ/watermark/tên bạn bè..."
                className="flex-1 px-3.5 py-2 rounded-2xl border border-gray-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-pink-400 bg-white"
              />
              <button
                type="submit"
                disabled={!customText.trim()}
                className="px-4 py-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-xs shadow-sm disabled:opacity-40 shrink-0 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Chèn Chữ</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">Kiểu phông chữ:</label>
                <select
                  value={selectedFont}
                  onChange={(e) => setSelectedFont(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 bg-white"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-gray-600 mb-1">
                  <span>Màu chữ:</span>
                  <input
                    type="color"
                    value={selectedTextColor}
                    onChange={(e) => setSelectedTextColor(e.target.value)}
                    className="w-5 h-5 rounded cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {['#111827', '#FFFFFF', '#F43F5E', '#EC4899', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B'].map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setSelectedTextColor(col)}
                      style={{ backgroundColor: col }}
                      className={`w-5 h-5 rounded-full border border-gray-300 shrink-0 ${
                        selectedTextColor === col ? 'ring-2 ring-pink-500' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* TAB 5: BACKGROUND COLORS & PATTERNS */}
      {activeTab === 'background' && (
        <div className="p-3.5 flex flex-col gap-3 animate-in fade-in duration-150">
          {/* Solid Color Palettes */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
              <span>Bảng màu pastel trending:</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400 font-normal">Tùy chỉnh:</span>
                <input
                  type="color"
                  value={selectedFrame.backgroundColor || '#FFFFFF'}
                  onChange={(e) => onUpdateFrame({ backgroundColor: e.target.value, backgroundGradient: undefined })}
                  className="w-5 h-5 rounded cursor-pointer border border-gray-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5">
              {SOLID_COLOR_PALETTES.map((c, idx) => (
                <button
                  key={idx}
                  title={c.label}
                  onClick={() => onUpdateFrame({ backgroundColor: c.color, backgroundGradient: undefined })}
                  style={{ backgroundColor: c.color }}
                  className={`w-full aspect-square rounded-xl border border-gray-300 shadow-2xs transition-transform hover:scale-115 flex items-center justify-center ${
                    selectedFrame.backgroundColor === c.color && !selectedFrame.backgroundGradient ? 'ring-2 ring-pink-500 ring-offset-1' : ''
                  }`}
                >
                  {selectedFrame.backgroundColor === c.color && !selectedFrame.backgroundGradient && (
                    <Check className="w-3 h-3 text-pink-600 drop-shadow" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Gradient Presets */}
          <div className="flex flex-col gap-1.5 pt-1 border-t border-gray-100">
            <span className="text-xs font-bold text-gray-700">Dải chuyển sắc Gradient:</span>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {GRADIENT_PRESETS.map((g, idx) => (
                <button
                  key={idx}
                  onClick={() => onUpdateFrame({ backgroundGradient: g.css, backgroundColor: g.color1 })}
                  className="h-8 rounded-xl border border-gray-200 shadow-2xs hover:scale-105 transition-transform flex items-center justify-center text-[10px] font-bold text-white drop-shadow"
                  style={{ background: g.css }}
                >
                  {g.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Pattern Overlays */}
          <div className="flex flex-col gap-1.5 pt-1 border-t border-gray-100">
            <span className="text-xs font-bold text-gray-700">Họa tiết phủ nền:</span>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {PATTERN_OPTIONS.map((pat) => (
                <button
                  key={pat.id}
                  onClick={() => onUpdateFrame({ pattern: pat.id as any })}
                  className={`p-1.5 rounded-xl text-center border text-xs transition-all flex flex-col items-center gap-0.5 ${
                    (selectedFrame.pattern || 'none') === pat.id
                      ? 'border-pink-500 bg-pink-50 text-pink-700 font-bold'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm">{pat.icon}</span>
                  <span className="text-[9px] leading-tight truncate w-full">{pat.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: SAVED TEMPLATES LIBRARY */}
      {activeTab === 'library' && (
        <div className="p-3.5 flex flex-col gap-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 uppercase">
              Kho Mẫu Khung Đã Lưu ({customFrames.length})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleExportJson}
                className="py-1 px-2.5 rounded-lg bg-pink-50 text-pink-700 border border-pink-200 text-[11px] font-bold flex items-center gap-1 hover:bg-pink-100"
              >
                <Download className="w-3 h-3" />
                <span>Xuất .json</span>
              </button>
              <button
                type="button"
                onClick={() => jsonImportRef.current?.click()}
                className="py-1 px-2.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-200 text-[11px] font-bold flex items-center gap-1 hover:bg-gray-200"
              >
                <Upload className="w-3 h-3" />
                <span>Nhập Mẫu</span>
              </button>
            </div>
          </div>

          {customFrames.length === 0 ? (
            <div className="p-6 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-300 text-gray-400 text-xs">
              Chưa có mẫu khung nào được lưu. Hãy chỉnh viền/sticker rồi bấm "💾 Lưu Mẫu Mới" ở trên nhé!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto">
              {customFrames.map((cf) => (
                <div
                  key={cf.id}
                  className="bg-gray-50 p-2.5 rounded-2xl border border-gray-200 flex items-center justify-between gap-2"
                >
                  <div className="overflow-hidden">
                    <h4 className="font-bold text-xs text-gray-800 truncate">{cf.name}</h4>
                    <p className="text-[10px] text-gray-500">{cf.slotCount} ô • {cf.stickers?.length || 0} sticker</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onSelectFrame(cf)}
                      className="px-2 py-1 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-xs font-bold"
                    >
                      Dùng
                    </button>
                    {onDeleteCustomFrame && (
                      <button
                        onClick={() => {
                          if (confirm(`Xoá mẫu "${cf.name}"?`)) onDeleteCustomFrame(cf.id);
                        }}
                        className="p-1 hover:bg-rose-100 text-rose-600 rounded-lg"
                      >
                        <Trash2 className="w-3 h-3" />
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
  );
};
