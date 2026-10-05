import React, { useState } from 'react';
import { Camera, Sparkles, Maximize, Minimize, Cpu, Bluetooth, Palette } from 'lucide-react';
import { AppMode } from '../types/photobooth';

interface NavbarProps {
  currentMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  onOpenCustomFrame: () => void;
  onStartCameraModal: () => void;
  onOpenDeviceHub: () => void;
  onOpenBluetooth: () => void;
  connectedBluetoothCount: number;
  isMockMode: boolean;
  onToggleMockMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCustomFrame,
  onStartCameraModal,
  onOpenDeviceHub,
  onOpenBluetooth,
  connectedBluetoothCount,
  isMockMode,
  onToggleMockMode
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-pink-100/80 shadow-xs px-3 sm:px-6 py-2.5 flex items-center justify-between transition-all">
      {/* Brand Logo & Studio Chip */}
      <div
        className="flex items-center gap-2 cursor-pointer group select-none"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-400 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="font-logo text-xl sm:text-2xl text-[#FF5388] tracking-tight leading-none group-hover:opacity-90 transition-opacity">
            PhotoXinhh
          </h1>
          <span className="text-[9px] font-bold text-gray-400 tracking-wider uppercase leading-tight">
            Photobooth Studio
          </span>
        </div>
      </div>

      {/* Center Status Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Fake / Real Camera Toggle */}
        <button
          onClick={onToggleMockMode}
          title={isMockMode ? "Đang bật chế độ giả lập Camera" : "Đang dùng Camera máy tính/DSLR"}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            isMockMode
              ? 'bg-amber-50/80 text-amber-700 border-amber-200/80 hover:bg-amber-100'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isMockMode ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
          <span className="hidden md:inline">{isMockMode ? 'Cam Giả Lập' : 'Camera Thật'}</span>
          <span className="md:hidden">{isMockMode ? 'Fake Cam' : 'Cam'}</span>
        </button>

        {/* Wireless / Bluetooth Pill */}
        <button
          onClick={onOpenBluetooth}
          title="Kết nối không dây & Smartphone"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            connectedBluetoothCount > 0
              ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
          }`}
        >
          <Bluetooth className="w-3.5 h-3.5 text-current" />
          <span className="hidden sm:inline">
            {connectedBluetoothCount > 0 ? `Đã Nối (${connectedBluetoothCount})` : 'Bluetooth'}
          </span>
          <span className="sm:hidden">
            {connectedBluetoothCount > 0 ? `(${connectedBluetoothCount})` : 'BT'}
          </span>
        </button>

        {/* Device Hub */}
        <button
          onClick={onOpenDeviceHub}
          title="Quản lý thiết bị phần cứng (Máy in, Kiosk)"
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200/80 transition-all active:scale-95"
        >
          <Cpu className="w-3.5 h-3.5 text-pink-500" />
          <span>Thiết Bị</span>
        </button>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Frame Studio Trigger */}
        <button
          onClick={onOpenCustomFrame}
          className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs border border-purple-200 shadow-2xs transition-all active:scale-95 hover:scale-102"
        >
          <Palette className="w-3.5 h-3.5 text-purple-600" />
          <span className="hidden sm:inline">Tạo & Sửa Khung</span>
          <span className="sm:hidden">Studio</span>
        </button>

        {/* Shutter Capture Button */}
        <button
          onClick={onStartCameraModal}
          className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xs sm:text-sm shadow-sm transition-all hover:scale-105 active:scale-95"
        >
          <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Chụp Ảnh</span>
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          title="Toàn màn hình"
          className="p-1.5 rounded-full text-gray-500 hover:text-pink-600 hover:bg-pink-50 transition-colors"
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
