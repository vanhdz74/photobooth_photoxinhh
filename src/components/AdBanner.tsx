import React from 'react';
import { Sparkles } from 'lucide-react';

export const AdBanner: React.FC = () => {
  return (
    <div className="w-full my-6 flex flex-col items-center">
      <span className="text-[10px] font-bold tracking-widest text-pink-300 uppercase mb-1">
        QUẢNG CÁO
      </span>
      <div className="w-full max-w-4xl h-24 bg-gradient-to-r from-pink-100 via-purple-50 to-pink-100 border border-pink-200/60 rounded-2xl flex items-center justify-between px-6 shadow-sm overflow-hidden relative">
        <div className="flex items-center gap-3 z-10">
          <div className="w-12 h-12 rounded-xl bg-pink-500 text-white flex items-center justify-center font-bold font-logo text-xl shadow-md">
            PX
          </div>
          <div>
            <h4 className="font-bold text-sm text-gray-800 font-cute">
              Thuê Trọn Gói Máy Photobooth Sự Kiện & Tiệc Cưới
            </h4>
            <p className="text-xs text-pink-600 font-medium">
              In ảnh lấy ngay 15s • Thiết kế khung độc quyền • Hỗ trợ kỹ thuật 24/7
            </p>
          </div>
        </div>

        <button className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs shadow-md transition-all hover:scale-105 z-10">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Liên hệ báo giá</span>
        </button>

        {/* Decorative background shapes */}
        <div className="absolute right-0 top-0 w-32 h-32 bg-pink-200/40 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-24 h-24 bg-purple-200/40 rounded-full blur-xl pointer-events-none" />
      </div>
    </div>
  );
};
