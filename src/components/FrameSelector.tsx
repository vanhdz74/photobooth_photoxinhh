import React, { useState, useMemo } from 'react';
import { Search, Plus, Edit3, Copy, Trash2, Sparkles, X, RotateCcw } from 'lucide-react';
import { FrameTemplate } from '../types/photobooth';
import { PRESET_FRAMES, CATEGORIES } from '../templates/presetFrames';
import { DeleteFrameModal } from './DeleteFrameModal';

interface FrameSelectorProps {
  selectedFrame: FrameTemplate;
  onSelectFrame: (frame: FrameTemplate) => void;
  customFrames: FrameTemplate[];
  presetFrames?: FrameTemplate[];
  onCreateNewFrame: (slotCount?: number) => void;
  onEditCurrentFrame: (frame?: FrameTemplate) => void;
  onDeleteCustomFrame?: (frameId: string) => void;
  onDuplicateCustomFrame?: (frame: FrameTemplate) => void;
  onRestorePresetFrames?: () => void;
  deletedPresetCount?: number;
}

export const FrameSelector: React.FC<FrameSelectorProps> = ({
  selectedFrame,
  onSelectFrame,
  customFrames,
  presetFrames,
  onCreateNewFrame,
  onEditCurrentFrame,
  onDeleteCustomFrame,
  onDuplicateCustomFrame,
  onRestorePresetFrames,
  deletedPresetCount = 0
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLayout, setSelectedLayout] = useState<'all' | '2' | '3' | '4' | '6'>('all');
  const [frameToDelete, setFrameToDelete] = useState<FrameTemplate | null>(null);

  const allFrames = useMemo(() => {
    const presets = presetFrames || PRESET_FRAMES;
    return [...customFrames, ...presets];
  }, [customFrames, presetFrames]);

  const filteredFrames = useMemo(() => {
    return allFrames.filter((frame) => {
      const matchCat = selectedCategory === 'all' || 
        (selectedCategory === 'custom' ? frame.isCustom : frame.category === selectedCategory);
      const matchLayout = selectedLayout === 'all' ||
        (selectedLayout === '2' && frame.slotCount === 2) ||
        (selectedLayout === '3' && frame.slotCount === 3) ||
        (selectedLayout === '4' && frame.slotCount === 4) ||
        (selectedLayout === '6' && frame.slotCount === 6);
      const matchSearch = frame.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (frame.headerText && frame.headerText.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (frame.footerText && frame.footerText.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchLayout && matchSearch;
    });
  }, [allFrames, selectedCategory, selectedLayout, searchQuery]);

  return (
    <div className="w-full h-full max-h-full flex flex-col gap-2 bg-white/95 backdrop-blur-xl rounded-2xl p-2.5 sm:p-3 border border-pink-100/80 shadow-xs overflow-hidden min-h-0">
      
      {/* COMPACT 1-LINE HEADER & ACTION BUTTONS */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-pink-100/60 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-sm sm:text-base text-gray-800 tracking-tight">
            Bộ Sưu Tập Khung
          </h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-50 text-pink-600 border border-pink-100">
            {filteredFrames.length} mẫu
          </span>
          {deletedPresetCount > 0 && onRestorePresetFrames && (
            <button
              type="button"
              onClick={onRestorePresetFrames}
              className="text-[10px] text-blue-600 hover:text-blue-800 underline font-semibold cursor-pointer flex items-center gap-0.5"
              title="Khôi phục lại các mẫu mặc định đã ẩn"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Khôi phục ({deletedPresetCount})</span>
            </button>
          )}
        </div>

        {/* Compact Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Delete Current Selected Frame */}
          {onDeleteCustomFrame && (
            <button
              type="button"
              onClick={() => setFrameToDelete(selectedFrame)}
              title={`Xoá mẫu "${selectedFrame.name}"`}
              className="py-1.5 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 font-bold text-xs shadow-2xs transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden sm:inline">Xoá Khung</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onEditCurrentFrame(selectedFrame)}
            title="Chỉnh sửa màu sắc, viền, sticker của khung đang chọn"
            className="py-1.5 px-2.5 rounded-xl bg-purple-50 hover:bg-purple-100/80 text-purple-700 border border-purple-200/80 font-bold text-xs shadow-2xs transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden sm:inline">Sửa Khung</span>
          </button>

          <button
            type="button"
            onClick={() => onCreateNewFrame(selectedLayout === '2' ? 2 : selectedLayout === '3' ? 3 : selectedLayout === '6' ? 6 : 4)}
            title="Tự tạo mẫu khung mới từ đầu hoặc nhập từ Canva"
            className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            <span>+ Tạo Mới</span>
          </button>
        </div>
      </div>

      {/* STREAMLINED SEARCH & DUAL FILTERS */}
      <div className="flex flex-col gap-1.5 shrink-0 my-0.5">
        {/* Row 1: Search input + Quick Layout Filter Chips */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm theo tên khung..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-gray-200/80 bg-gray-50/60 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-pink-400 focus:bg-white transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Quick Layout Segmented Chips */}
          <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-xl shrink-0 border border-gray-200/60">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: '2', label: '📸 2 Ảnh' },
              { id: '3', label: '📐 3 Dọc' },
              { id: '4', label: '🎞️ 4 Dọc' },
              { id: '6', label: '🖼️ 6 Ô' },
            ].map((layout) => (
              <button
                key={layout.id}
                type="button"
                onClick={() => setSelectedLayout(layout.id as any)}
                className={`py-1 px-2 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedLayout === layout.id
                    ? 'bg-pink-600 text-white shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {layout.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar text-xs">
          {CATEGORIES.map((cat) => {
            const isCatActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`py-1 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isCatActive
                    ? 'bg-gray-900 text-white shadow-2xs font-bold'
                    : 'bg-gray-100 hover:bg-gray-200/80 text-gray-600'
                }`}
              >
                {cat.id === 'custom' && customFrames.length > 0 ? `⭐ Mẫu của bạn (${customFrames.length})` : cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* STREAMLINED FRAME GALLERY GRID */}
      <div className="flex-1 min-h-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 overflow-y-auto p-0.5 rounded-2xl">
        
        {/* ACTION CARD: CREATE NEW FRAME */}
        <button
          type="button"
          onClick={() => onCreateNewFrame(selectedLayout === '3' ? 3 : 4)}
          className="group flex flex-col items-center p-1.5 rounded-2xl transition-all duration-150 text-left border-2 border-dashed border-pink-300/80 hover:border-pink-500 bg-pink-50/30 hover:bg-pink-50/70 shadow-2xs cursor-pointer"
        >
          <div className="w-full aspect-[1/2.6] rounded-xl border border-dashed border-pink-200 flex flex-col items-center justify-center p-2 text-center text-pink-700 gap-1.5 bg-white/80">
            <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 group-hover:scale-110 transition-transform shadow-xs">
              <Plus className="w-4 h-4" />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-gray-800 leading-tight">
                Tạo Khung
              </span>
              <span className="text-[8px] text-gray-400 mt-0.5">
                Tự do
              </span>
            </div>
          </div>
          <span className="text-[10px] font-bold mt-1.5 text-pink-600 text-center">
            + Mẫu Mới
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
              className={`group relative flex flex-col items-center p-1.5 rounded-2xl transition-all duration-150 text-left cursor-pointer ${
                isSelected
                  ? 'ring-2 ring-pink-500 ring-offset-2 bg-pink-50/70 shadow-sm'
                  : 'bg-white hover:bg-pink-50/30 border border-gray-100 hover:border-pink-200 shadow-2xs'
              }`}
            >
              {/* Mini Frame Strip Thumbnail */}
              <div
                className="w-full aspect-[1/2.6] rounded-xl overflow-hidden border border-gray-200/60 shadow-2xs flex flex-col p-1 relative transition-transform"
                style={{
                  background: frame.backgroundGradient || frame.backgroundColor,
                }}
              >
                {/* Decorative Header Text */}
                {frame.headerText && frame.showHeader !== false && (
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
                {frame.footerText && frame.showFooter !== false && (
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

                {/* Slot Count Badge */}
                <div
                  className={`absolute bottom-1 left-1 px-1.5 py-0.2 text-white rounded text-[6px] font-bold z-10 shadow-xs ${
                    frame.slotCount === 2
                      ? 'bg-amber-600 ring-1 ring-white/50'
                      : frame.slotCount === 3
                      ? 'bg-indigo-600 ring-1 ring-white/50'
                      : frame.slotCount === 6
                      ? 'bg-teal-600 ring-1 ring-white/50'
                      : 'bg-black/60'
                  }`}
                >
                  {frame.slotCount === 2
                    ? '2 ảnh 4x6'
                    : frame.slotCount === 3
                    ? '3 ảnh dọc'
                    : frame.slotCount === 6
                    ? '6 ô lưới'
                    : `${frame.slotCount} ảnh`}
                </div>
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

              {/* Action buttons on selection / hover */}
              <div className="mt-1 flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                {isCustom && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditCurrentFrame(frame);
                    }}
                    title="Sửa mẫu khung này trong Studio"
                    className="p-1 rounded-md bg-white hover:bg-pink-100 text-pink-700 shadow-2xs border border-pink-200 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                )}
                {isCustom && onDuplicateCustomFrame && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateCustomFrame(frame);
                    }}
                    title="Nhân bản mẫu này"
                    className="p-1 rounded-md bg-white hover:bg-purple-100 text-purple-700 shadow-2xs border border-purple-200 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                )}
                {onDeleteCustomFrame && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFrameToDelete(frame);
                    }}
                    title={`Xoá mẫu "${frame.name}"`}
                    className="p-1 rounded-md bg-white hover:bg-rose-100 text-rose-600 shadow-2xs border border-rose-200 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CẢNH BÁO XOÁ VĨNH VIỄN MODAL */}
      <DeleteFrameModal
        isOpen={frameToDelete !== null}
        frame={frameToDelete}
        onClose={() => setFrameToDelete(null)}
        onConfirmDelete={(frameId) => {
          if (onDeleteCustomFrame) {
            onDeleteCustomFrame(frameId);
          }
        }}
      />
    </div>
  );
};
