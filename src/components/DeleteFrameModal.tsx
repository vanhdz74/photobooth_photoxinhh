import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, AlertTriangle, AlertOctagon, X } from 'lucide-react';
import { FrameTemplate } from '../types/photobooth';

interface DeleteFrameModalProps {
  isOpen: boolean;
  frame: FrameTemplate | null;
  onClose: () => void;
  onConfirmDelete: (frameId: string) => void;
}

export const DeleteFrameModal: React.FC<DeleteFrameModalProps> = ({
  isOpen,
  frame,
  onClose,
  onConfirmDelete,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !frame || typeof document === 'undefined') return null;

  const isCustom = frame.isCustom;

  const modalContent = (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-rose-200 flex flex-col gap-4 text-center relative overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Top Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 flex items-center justify-center transition-all cursor-pointer"
          title="Đóng (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Warning Icon Badge */}
        <div className="w-16 h-16 rounded-full bg-rose-100 border-4 border-rose-200 flex items-center justify-center mx-auto text-rose-600 shadow-md">
          <Trash2 className="w-8 h-8 stroke-[2.2]" />
        </div>

        {/* Title */}
        <div>
          <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 font-cute">
            Xác Nhận Xoá Mẫu Khung
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Vui lòng xác nhận trước khi tiếp tục thao tác xoá mẫu này.
          </p>
        </div>

        {/* Frame Info Card */}
        <div className="bg-gray-50 rounded-2xl p-3 border border-gray-200/80 flex items-center gap-3 text-left">
          {/* Mini Visual Preview */}
          <div
            className="w-12 h-16 rounded-lg border border-black/10 shadow-xs flex flex-col justify-between p-1 shrink-0 overflow-hidden relative"
            style={{
              background: frame.backgroundGradient || frame.backgroundColor || '#FFF',
            }}
          >
            <div className="flex-1 flex flex-col justify-between gap-0.5">
              {frame.slots.slice(0, 4).map((_, idx) => (
                <div key={idx} className="w-full flex-1 bg-white/90 rounded-[1px] border border-black/5" />
              ))}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-sm text-gray-900 truncate">
              {frame.name}
            </h4>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  isCustom
                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                    : 'bg-blue-100 text-blue-700 border border-blue-200'
                }`}
              >
                {isCustom ? '⭐ Mẫu tự tạo' : 'Mẫu mặc định'}
              </span>
              <span className="text-[10px] bg-gray-200/80 text-gray-700 px-2 py-0.5 rounded-md font-semibold">
                {frame.slotCount} ảnh • {frame.aspectRatio}
              </span>
            </div>
          </div>
        </div>

        {/* Big Alert Warning Banner */}
        <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-3.5 text-left flex items-start gap-2.5">
          <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-950 leading-relaxed">
            <span className="font-extrabold text-rose-700 block uppercase tracking-wide text-[11px] mb-0.5 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> CẢNH BÁO: XOÁ VĨNH VIỄN
            </span>
            <span>
              {isCustom
                ? 'Mẫu khung này sẽ bị xoá VĨNH VIỄN khỏi thiết bị của bạn. Mọi bố cục ảnh, màu sắc nền, sticker và thiết kế liên quan sẽ KHÔNG THỂ KHÔI PHỤC LẠI sau khi xoá!'
                : 'Mẫu khung này sẽ bị xoá khỏi bộ sưu tập hiển thị trên thiết bị. Bạn có thể khôi phục lại các mẫu mặc định bất kỳ lúc nào.'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl border border-gray-300 hover:bg-gray-100 active:bg-gray-200 text-gray-700 font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" />
            <span>Huỷ Bỏ</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onConfirmDelete(frame.id);
              onClose();
            }}
            className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-extrabold text-xs sm:text-sm transition-all cursor-pointer shadow-md active:scale-95 flex items-center justify-center gap-1.5 border border-rose-700"
          >
            <Trash2 className="w-4 h-4 stroke-[2.5]" />
            <span>Xoá Vĩnh Viễn</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
