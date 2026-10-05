import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Printer,
  Share2,
  Check,
  Sparkles,
  Bluetooth,
  Home,
  Camera,
  CheckCircle2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { printService } from '../services/printService';
import { bluetoothService, BluetoothDevice } from '../services/bluetoothService';
import { realP2PService } from '../services/realP2PService';

import { safeStoreStrip } from '../utils/safeStorage';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  singleStripDataUrl: string;
  onOpenBluetooth?: () => void;
  onStartNewShoot?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  singleStripDataUrl,
  onOpenBluetooth,
  onStartNewShoot
}) => {
  const [doubleStripUrl, setDoubleStripUrl] = useState<string>('');
  const [printLayout, setPrintLayout] = useState<'single' | 'double'>('single');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareId] = useState<string>(() => `strip_${Date.now()}`);
  const [connectedDevices, setConnectedDevices] = useState<BluetoothDevice[]>([]);
  const [btStatusMsg, setBtStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = bluetoothService.subscribe((devs) => {
      setConnectedDevices(devs.filter((d) => d.status === 'connected'));
    });
    return unsub;
  }, []);

  // Real LAN / QR Share Link that any smartphone on Wi-Fi can scan and download
  const shareUrl = (() => {
    const protocol = typeof window !== 'undefined' && window.location.protocol.startsWith('https') ? 'https:' : 'http:';
    let host = typeof window !== 'undefined' ? window.location.host : '192.168.0.117:5173';
    if (!host || host.includes('localhost') || host.includes('127.0.0.1') || host.includes('capacitor')) {
      host = '192.168.0.117:5173';
    }
    return `${protocol}//${host}/?view_strip=${shareId}`;
  })();

  useEffect(() => {
    if (isOpen && singleStripDataUrl) {
      // Safely store in memory/storage without QuotaExceededError
      safeStoreStrip(`px_share_${shareId}`, singleStripDataUrl);
      safeStoreStrip('px_latest_strip', singleStripDataUrl);

      // Automatically deliver strip to connected phone remotes
      try {
        realP2PService.sendStripToPhones(singleStripDataUrl, 'Dải ảnh Photobooth');
      } catch (err) {
        console.warn('Could not broadcast strip to remotes:', err);
      }

      // Fire celebration confetti
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 }
        });
      } catch {}

      // Generate 4x6 double strip in background
      try {
        printService.createDoubleStripCanvas(singleStripDataUrl).then((url) => {
          if (url) setDoubleStripUrl(url);
        }).catch(() => {});
      } catch {}
    }
  }, [isOpen, singleStripDataUrl, shareId]);

  if (!isOpen) return null;

  const currentActiveUrl = printLayout === 'double' && doubleStripUrl ? doubleStripUrl : singleStripDataUrl;

  const handleDownload = async () => {
    setIsSaved(true);
    await printService.downloadImage(
      currentActiveUrl,
      `photoxinhh_${printLayout === 'double' ? '4x6_double' : '2x6_strip'}_${Date.now()}.png`
    );
    setTimeout(() => setIsSaved(false), 3500);
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    await printService.printImage(currentActiveUrl, 'PhotoXinhh Print');
    setIsPrinting(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSendBluetooth = async () => {
    const phones = connectedDevices.filter((d) => d.type === 'phone');
    if (phones.length === 0) {
      if (onOpenBluetooth) {
        onOpenBluetooth();
      } else {
        alert('Chưa có điện thoại nào kết nối Bluetooth. Vui lòng mở bảng Bluetooth để ghép đôi!');
      }
      return;
    }

    const targetPhone = phones[0];
    setBtStatusMsg(`Đang bắn ảnh sang [${targetPhone.name}]...`);
    await bluetoothService.sendStripToPhone(targetPhone.id, currentActiveUrl);
    setBtStatusMsg(`Đã gửi thành công sang ${targetPhone.name}!`);
    setTimeout(() => setBtStatusMsg(null), 3500);
  };

  const handlePrintBluetooth = async () => {
    const printers = connectedDevices.filter((d) => d.type === 'printer');
    if (printers.length === 0) {
      if (onOpenBluetooth) {
        onOpenBluetooth();
      } else {
        alert('Chưa có máy in Bluetooth nào kết nối. Vui lòng mở bảng Bluetooth để ghép đôi!');
      }
      return;
    }

    const targetPrinter = printers[0];
    setBtStatusMsg(`Đang in qua [${targetPrinter.name}]...`);
    await bluetoothService.printViaBluetooth(targetPrinter.id, currentActiveUrl);
    setBtStatusMsg(`In hoàn tất trên ${targetPrinter.name}!`);
    setTimeout(() => setBtStatusMsg(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-pink-100 flex flex-col max-h-[94vh]">
        
        {/* Top Header */}
        <div className="px-5 sm:px-6 py-3.5 bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-amber-300 shadow-inner">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-cute leading-tight flex items-center gap-1.5">
                <span>Ảnh Của Bạn Đã Sẵn Sàng!</span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-sans font-bold">300 DPI HD</span>
              </h2>
              <p className="text-[11px] text-pink-100 hidden sm:block">
                Lưu về máy, quét mã QR tải về điện thoại hoặc in ảnh ngay tại Booth
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: 2 Columns */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col md:flex-row gap-5 items-center justify-between">
          
          {/* Left: Strip Preview */}
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            <div className="relative p-2 bg-gray-50 rounded-2xl border border-pink-100 shadow-inner max-h-[420px] flex items-center justify-center">
              {currentActiveUrl ? (
                <img
                  src={currentActiveUrl}
                  alt="Photobooth Strip Preview"
                  className="max-h-[380px] object-contain rounded-xl shadow-md"
                />
              ) : (
                <div className="w-48 h-80 bg-gray-200 rounded-xl flex items-center justify-center text-gray-400 text-xs">
                  Đang tải ảnh...
                </div>
              )}
            </div>

            {/* Layout switch pills */}
            <div className="flex items-center gap-1.5 mt-3 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPrintLayout('single')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  printLayout === 'single'
                    ? 'bg-white text-pink-600 shadow-xs font-bold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Khổ 2x6 (Dải Đơn)
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout('double')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  printLayout === 'double'
                    ? 'bg-white text-pink-600 shadow-xs font-bold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Khổ 4x6 (2 Dải Cắt Đôi)
              </button>
            </div>

            <p className="text-[10px] text-gray-400 text-center mt-2">
              💡 Chạm & giữ vào ảnh để lưu trực tiếp vào ứng dụng Ảnh trên iPad / iPhone
            </p>
          </div>

          {/* Right: Actions & QR */}
          <div className="w-full md:w-72 flex flex-col items-center gap-3 text-center">
            
            {/* Status notification banner */}
            <div className="w-full p-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-emerald-800 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Đã xuất ảnh thành công! Bạn có thể lưu hoặc in bên dưới.</span>
            </div>

            {/* QR Code Container */}
            <div className="p-3 bg-pink-50/50 border border-pink-100 rounded-2xl flex flex-col items-center w-full">
              <div className="bg-white p-2 rounded-xl shadow-xs border border-pink-100">
                <QRCodeSVG value={shareUrl} size={100} level="M" />
              </div>
              <span className="text-xs font-bold text-pink-700 mt-1.5">Quét QR bằng điện thoại</span>
              <span className="text-[10px] text-gray-500">để tải ảnh gốc chất lượng cao về máy</span>

              <button
                type="button"
                onClick={handleCopyLink}
                className="mt-1 text-[11px] text-pink-600 hover:text-pink-700 font-medium flex items-center gap-1"
              >
                {copiedLink ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
                <span>{copiedLink ? 'Đã sao chép link!' : 'Sao chép liên kết'}</span>
              </button>
            </div>

            {btStatusMsg && (
              <div className="w-full p-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs font-medium text-center animate-in fade-in">
                {btStatusMsg}
              </div>
            )}

            {/* Main Action Buttons */}
            <div className="w-full flex flex-col gap-2">
              {/* Primary: Save / Download */}
              <button
                type="button"
                onClick={handleDownload}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xs shadow-md transition-all hover:scale-102 active:scale-95 flex items-center justify-center gap-2"
              >
                {isSaved ? <Check className="w-4 h-4 text-amber-300" /> : <Download className="w-4 h-4" />}
                <span>{isSaved ? '✓ Đã Lưu Vào Máy Thành Công!' : 'Lưu Ảnh Về Thiết Bị'}</span>
              </button>

              {/* Print Button */}
              <button
                type="button"
                onClick={handlePrint}
                disabled={isPrinting}
                className="w-full py-2 px-3 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-xs shadow-xs transition-all hover:scale-102 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-pink-400" />
                <span>{isPrinting ? 'Đang gửi lệnh in...' : 'In Ảnh Ngay'}</span>
              </button>

              {/* Bluetooth Transfer Actions */}
              <button
                type="button"
                onClick={handleSendBluetooth}
                className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition-all hover:scale-102 flex items-center justify-center gap-1.5"
              >
                <Bluetooth className="w-3.5 h-3.5" />
                <span>Bắn Sang ĐT (Bluetooth)</span>
              </button>

              {connectedDevices.some((d) => d.type === 'printer') && (
                <button
                  type="button"
                  onClick={handlePrintBluetooth}
                  className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-xs transition-all hover:scale-102 flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In Máy In Bluetooth (Dye-Sub)</span>
                </button>
              )}
            </div>

          </div>
        </div>

        {/* Bottom Navigation Actions (Back to Home / New Shoot) */}
        <div className="px-5 sm:px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
          {/* Back to Home Button */}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none py-2.5 px-5 rounded-xl bg-white hover:bg-pink-50 text-gray-700 hover:text-pink-700 border border-gray-200 hover:border-pink-300 font-bold text-xs sm:text-sm shadow-2xs transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Home className="w-4 h-4 text-pink-500" />
            <span>🏠 Quay Lại Trang Chủ</span>
          </button>

          {/* New Shoot Button */}
          {onStartNewShoot && (
            <button
              type="button"
              onClick={onStartNewShoot}
              className="flex-1 sm:flex-none py-2.5 px-5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 hover:from-purple-700 hover:to-rose-600 text-white font-bold text-xs sm:text-sm shadow-md transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Camera className="w-4 h-4 text-amber-300" />
              <span>Chụp Bộ Ảnh Mới</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
