import React, { useEffect, useState } from 'react';
import { Bluetooth, Smartphone, Camera, Printer, CheckCircle2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { bluetoothService, TransferProgress, PrintJobProgress } from '../services/bluetoothService';
import { realP2PService } from '../services/realP2PService';

export const BluetoothStatusToast: React.FC = () => {
  const [transfer, setTransfer] = useState<TransferProgress | null>(null);
  const [printJob, setPrintJob] = useState<PrintJobProgress | null>(null);
  const [quickNotification, setQuickNotification] = useState<{
    id: string;
    icon: 'bluetooth' | 'phone' | 'camera' | 'printer';
    title: string;
    subtitle: string;
  } | null>(null);

  useEffect(() => {
    const unsubTransfer = bluetoothService.onTransferProgress(setTransfer);
    const unsubPrint = bluetoothService.onPrintProgress(setPrintJob);

    // 1. Toast when Real Phone joins via QR Code / WebRTC
    let prevCount = realP2PService.getConnectedClients().length;
    const unsubClients = realP2PService.onClientsChange((clients) => {
      if (clients.length > prevCount) {
        const latest = clients[clients.length - 1];
        setQuickNotification({
          id: `phone-join-${Date.now()}`,
          icon: 'phone',
          title: `Đã Kết Nối ${latest.name}!`,
          subtitle: `${latest.os} • Sẵn sàng làm Live Cam & Shutter từ xa`,
        });
        setTimeout(() => setQuickNotification(null), 4000);
      }
      prevCount = clients.length;
    });

    // 2. Toast when Bluetooth Shutter is triggered
    const unsubShutter = bluetoothService.onShutterTrigger((dev) => {
      setQuickNotification({
        id: `shutter-${Date.now()}`,
        icon: 'camera',
        title: 'Nút Chụp Bluetooth Kích Hoạt!',
        subtitle: `Tín hiệu chụp từ: ${dev.name}`,
      });
      setTimeout(() => setQuickNotification(null), 3000);
    });

    // 3. Toast when photo is received
    const unsubPhoto = bluetoothService.onPhotoReceived((_url, devName) => {
      setQuickNotification({
        id: `photo-${Date.now()}`,
        icon: 'phone',
        title: 'Đã Nhận Ảnh Thành Công',
        subtitle: `Đã tự động nạp ảnh từ [${devName}] vào khung!`,
      });
      setTimeout(() => setQuickNotification(null), 4000);
    });

    return () => {
      unsubTransfer();
      unsubPrint();
      unsubClients();
      unsubShutter();
      unsubPhoto();
    };
  }, []);

  if (!transfer && !printJob && !quickNotification) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[150] w-full max-w-md px-4 pointer-events-none animate-in slide-in-from-top-4 duration-300">
      {/* 1. File Transfer Progress Toast */}
      {transfer && (
        <div className="bg-gray-900/95 backdrop-blur-xl border border-blue-500/40 shadow-2xl rounded-2xl p-3.5 text-white flex items-center gap-3.5 pointer-events-auto">
          <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400">
            {transfer.direction === 'incoming' ? (
              <ArrowDownCircle className="w-6 h-6 animate-bounce" />
            ) : (
              <ArrowUpCircle className="w-6 h-6 animate-bounce" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-bold text-xs truncate text-white">
                {transfer.direction === 'incoming' ? 'Đang nhận ảnh từ điện thoại...' : 'Đang gửi ảnh sang điện thoại...'}
              </span>
              <span className="text-[11px] font-mono font-bold text-blue-400">{transfer.progress}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-200 rounded-full"
                style={{ width: `${transfer.progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-gray-400">
              <span className="truncate">{transfer.fileName} ({transfer.fileSize})</span>
              <span className="text-blue-300 font-medium shrink-0">{transfer.speed}</span>
            </div>
          </div>

          {transfer.previewUrl && (
            <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-700 shrink-0 bg-black">
              <img src={transfer.previewUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      )}

      {/* 2. Print Progress Toast */}
      {printJob && !transfer && (
        <div className="bg-gray-900/95 backdrop-blur-xl border border-pink-500/40 shadow-2xl rounded-2xl p-3.5 text-white flex items-center gap-3.5 pointer-events-auto">
          <div className="w-11 h-11 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center shrink-0 text-pink-400 animate-pulse">
            <Printer className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-bold text-xs truncate text-white">{printJob.printerName}</span>
              <span className="text-[11px] font-mono font-bold text-pink-400">{printJob.progress}%</span>
            </div>

            {/* Progress Bar with Dye-Sub Color gradient */}
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-pink-500 to-cyan-400 transition-all duration-300 rounded-full"
                style={{ width: `${printJob.progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-gray-300">
              <span className="truncate font-medium text-pink-300">{printJob.passName}</span>
              <span className="text-gray-400 shrink-0">{printJob.statusText}</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Quick Action Notification Toast */}
      {quickNotification && !transfer && !printJob && (
        <div className="bg-gray-900/95 backdrop-blur-xl border border-emerald-500/40 shadow-2xl rounded-2xl p-3 text-white flex items-center gap-3 pointer-events-auto">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            {quickNotification.icon === 'camera' && <Camera className="w-4 h-4" />}
            {quickNotification.icon === 'phone' && <Smartphone className="w-4 h-4" />}
            {quickNotification.icon === 'printer' && <Printer className="w-4 h-4" />}
            {quickNotification.icon === 'bluetooth' && <Bluetooth className="w-4 h-4" />}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
              <span>{quickNotification.title}</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </h4>
            <p className="text-[11px] text-gray-300 truncate">{quickNotification.subtitle}</p>
          </div>
        </div>
      )}
    </div>
  );
};
