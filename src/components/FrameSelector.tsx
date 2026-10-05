import React, { useState, useMemo } from 'react';
import { Search, Plus, Edit3, Copy, Trash2, Sparkles, X } from 'lucide-react';
import { FrameTemplate } from '../types/photobooth';
import { PRESET_FRAMES, CATEGORIES } from '../templates/presetFrames';

interface FrameSelectorProps {
  selectedFrame: FrameTemplate;
  onSelectFrame: (frame: FrameTemplate) => void;
  customFrames: FrameTemplate[];
  onCreateNewFrame: () => void;
  onEditCurrentFrame: (frame?: FrameTemplate) => void;
  onDeleteCustomFrame?: (frameId: string) => void;
  onDuplicateCustomFrame?: (frame: FrameTemplate) => void;
}

export const FrameSelector: React.FC<FrameSelectorProps> = ({
  selectedFrame,
  onSelectFrame,
  customFrames,
  onCreateNewFrame,
  onEditCurrentFrame,
  onDeleteCustomFrame,
  onDuplicateCustomFrame
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const allFrames = useMemo(() => {
    return [...customFrames, ...PRESET_FRAMES];
  }, [customFrames]);

  const filteredFrames = useMemo(() => {
    return allFrames.filter((frame) => {
      const matchCat = selectedCategory === 'all' || 
        (selectedCategory === 'custom' ? frame.isCustom : frame.category === selectedCategory);
      const matchSearch = frame.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (frame.headerText && frame.headerText.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (frame.footerText && frame.footerText.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [allFrames, selectedCategory, searchQuery]);

  return (
    <div className="w-full flex flex-col gap-4 bg-white/90 backdrop-blur-xl rounded-3xl p-4 sm:p-6 border border-pink-100/80 shadow-xs">
      
      {/* HEADER & TOP ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-pink-100/60">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-base sm:text-lg text-gray-800 tracking-tight">
              Bộ Sưu Tập Khung
            </h2>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-pink-50 text-pink-600 border border-pink-100">
              {filteredFrames.length} mẫu
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Chọn mẫu chụp bên dưới hoặc tự thiết kế khung riêng
          </p>
        </div>

        {/* 2 Main Action Buttons: Edit Current & Create New */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEditCurrentFrame(selectedFrame)}
            title="Chỉnh sửa màu sắc, viền, sticker của khung đang chọn"
            className="flex-1 sm:flex-none py-2 px-3.5 rounded-xl bg-purple-50 hover:bg-purple-100/80 text-purple-700 border border-purple-200/80 font-bold text-xs shadow-2xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5 text-purple-600" />
            <span>Sửa Khung Này</span>
          </button>

          <button
            type="button"
            onClick={onCreateNewFrame}
            title="Tự tạo mẫu khung mới từ đầu hoặc nhập từ Canva"
            className="flex-1 sm:flex-none py-2 px-4 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold text-xs shadow-xs transition-all hover:scale-102 active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>+ Tự Tạo Khung Mới</span>
          </button>
        </div>
      </div>

      {/* SEARCH & CATEGORY CHIPS */}
      <div className="flex flex-col gap-2.5">
        {/* Search input */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo tên khung, chủ đề, họa tiết..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 rounded-xl border border-gray-200/80 bg-gray-50/50 text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-400/40 focus:bg-white transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {CATEGORIES.map((cat) => {
            const isCatActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`py-1.5 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  isCatActive
                    ? 'bg-gray-900 text-white shadow-xs font-bold'
                    : 'bg-gray-100 hover:bg-gray-200/80 text-gray-600'
                }`}
              >
                {cat.id === 'custom' && customFrames.length > 0 ? `⭐ Mẫu của bạn (${customFrames.length})` : cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* FRAME GALLERY GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 max-h-[560px] overflow-y-auto p-1 rounded-2xl">
        
        {/* ACTION CARD: CREATE NEW FRAME */}
        <button
          type="button"
          onClick={onCreateNewFrame}
          className="group flex flex-col items-center p-2 rounded-2xl transition-all duration-150 text-left border-2 border-dashed border-pink-300/80 hover:border-pink-500 bg-pink-50/30 hover:bg-pink-50/70 shadow-2xs cursor-pointer"
        >
          <div className="w-full aspect-[1/3] rounded-xl border border-dashed border-pink-200 flex flex-col items-center justify-center p-2 text-center text-pink-700 gap-2 bg-white/80">
            <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 group-hover:scale-110 transition-transform shadow-xs">
              <Plus className="w-4 h-4" />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-bold text-gray-800 leading-tight">
                Tạo Khung Mới
              </span>
              <span className="text-[9px] text-gray-400 mt-0.5">
                Tùy biến tự do
              </span>
            </div>
          </div>
          <span className="text-[11px] font-bold mt-2 text-pink-600 text-center">
            + Thiết Kế Mới
          </span>
        </button>

        {/* LIST OF FRAMES */}
        {filteredFrames.map((frame) => {
          const isSelected = selectedFrame.id === frame.id;
          const isCustom = frame.isCustom;

          return (
            <div
              key={frame.id}
              onClick={() => onSelectFrame(frame)}
              className={`group relative flex flex-col items-center p-2 rounded-2xl transition-all duration-150 text-left cursor-pointer ${
                isSelected
                  ? 'ring-2 ring-pink-500 ring-offset-2 bg-pink-50/70 shadow-sm'
                  : 'bg-white hover:bg-pink-50/30 border border-gray-100 hover:border-pink-200 shadow-2xs'
              }`}
            >
              {/* Mini Frame Strip Thumbnail */}
              <div
                className="w-full aspect-[1/3] rounded-xl overflow-hidden border border-gray-200/60 shadow-2xs flex flex-col p-1 relative transition-transform"
                style={{
                  background: frame.backgroundGradient || frame.backgroundColor,
                }}
              >
                {/* Decorative Header Text */}
                {frame.headerText && (
                  <div
                    className="w-full text-[6px] text-center font-bold tracking-tighter truncate opacity-80 mb-0.5"
                    style={{ color: frame.themeColor }}
                  >
                    {frame.headerText.slice(0, 14)}
                  </div>
                )}

                {/* Mini Photo Slots */}
                <div className="flex-1 flex flex-col justify-between gap-0.5">
                  {frame.slots.map((slot) => (
                    <div
                      key={slot.id}
                      className="w-full flex-1 bg-white/90 rounded-[2px] border border-black/5 shadow-inner"
                    />
                  ))}
                </div>

                {/* Decorative Footer Text */}
                {frame.footerText && (
                  <div
                    className="w-full text-[5px] text-center truncate opacity-70 mt-0.5"
                    style={{ color: frame.themeColor }}
                  >
                    {frame.footerText.slice(0, 14)}
                  </div>
                )}

                {/* Overlay or Background Frame Image */}
                {(frame.overlayImageUrl || frame.backgroundImage) && (
                  <img
                    src={frame.overlayImageUrl || frame.backgroundImage}
                    alt={frame.name}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  />
                )}

                {/* Custom badge */}
                {isCustom && (
                  <div className="absolute top-1 left-1 px-1.5 py-0.2 bg-purple-600 text-white rounded text-[6px] font-bold shadow-xs z-10 flex items-center gap-0.5">
                    <Sparkles className="w-2 h-2 text-amber-300" />
                    <span>Mẫu riêng</span>
                  </div>
                )}

                {/* Selected Checkmark */}
                {isSelected && (
                  <div className="absolute top-1 right-1 w-4 h-4 bg-pink-500 text-white rounded-full flex items-center justify-center text-[9px] shadow-sm z-10 font-bold">
                    ✓
                  </div>
                )}

                {/* Attached Stickers Count badge */}
                {frame.stickers && frame.stickers.length > 0 && (
                  <div className="absolute bottom-1 right-1 bg-black/60 text-white px-1 py-0.2 rounded text-[6px] font-bold z-10">
                    {frame.stickers.length} 🎀
                  </div>
                )}
              </div>

              {/* Frame Name & Info */}
              <span
                className={`text-[11px] font-bold mt-2 truncate max-w-full text-center ${
                  isSelected ? 'text-pink-600' : 'text-gray-800 group-hover:text-pink-600'
                }`}
              >
                {frame.name}
              </span>
              <span className="text-[10px] text-gray-400 font-medium capitalize mt-0.5">
                {frame.slotCount} ảnh • {frame.aspectRatio}
              </span>

              {/* Action buttons on selection / hover for custom frames */}
              {isCustom && (
                <div className="mt-1.5 flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditCurrentFrame(frame);
                    }}
                    title="Sửa mẫu khung này trong Studio"
                    className="p-1 rounded-md bg-white hover:bg-pink-100 text-pink-700 shadow-2xs border border-pink-200"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  {onDuplicateCustomFrame && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateCustomFrame(frame);
                      }}
                      title="Nhân bản mẫu này"
                      className="p-1 rounded-md bg-white hover:bg-purple-100 text-purple-700 shadow-2xs border border-purple-200"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                  {onDeleteCustomFrame && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Bạn muốn xoá mẫu "${frame.name}" khỏi danh sách lưu?`)) {
                          onDeleteCustomFrame(frame.id);
                        }
                      }}
                      title="Xoá mẫu này"
                      className="p-1 rounded-md bg-white hover:bg-rose-100 text-rose-600 shadow-2xs border border-rose-200"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};
