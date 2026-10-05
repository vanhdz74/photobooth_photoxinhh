import React, { useState, useEffect } from 'react';
import { X, Printer, Camera, Monitor, CheckCircle, Play, Shield, Cpu, Bluetooth } from 'lucide-react';
import { cameraService, CameraDevice } from '../services/cameraService';
import { printService } from '../services/printService';
import { PrinterInfo, SystemInfo } from '../types/electron';

interface DeviceHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBluetooth?: () => void;
  isMockMode: boolean;
  onToggleMockMode: () => void;
}

export const DeviceHubModal: React.FC<DeviceHubModalProps> = ({
  isOpen,
  onClose,
  onOpenBluetooth,
  isMockMode,
  onToggleMockMode,
}) => {
  const [activeTab, setActiveTab] = useState<'printer' | 'camera' | 'kiosk'>('printer');
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [isTestingPrint, setIsTestingPrint] = useState(false);
  const [printSuccessMessage, setPrintSuccessMessage] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState(false);

  // Load hardware devices
  useEffect(() => {
    if (!isOpen) return;

    // 1. Detect Electron API
    if (window.electronAPI) {
      setIsElectron(true);
      window.electronAPI.getSystemInfo().then(setSystemInfo);
      window.electronAPI.getPrinters().then((list) => {
        setPrinters(list);
        const def = list.find((p) => p.isDefault) || list[0];
        if (def) setSelectedPrinter(def.name);
      });
    } else {
      setIsElectron(false);
      // Fallback mock printers for web demo
      const mockList: PrinterInfo[] = [
        { name: 'DNP DS-RX1HS', displayName: 'DNP DS-RX1HS (Máy In Nhiệt USB)', description: '4x6 Dye-Sublimation Photo Printer', status: 0, isDefault: true },
        { name: 'HiTi P525L', displayName: 'HiTi P525L Photobooth Printer', description: 'High Speed Strip Printer', status: 0, isDefault: false },
        { name: 'Canon SELPHY CP1500', displayName: 'Canon SELPHY CP1500 (Wi-Fi/USB)', description: 'Compact Photo Printer', status: 0, isDefault: false },
        { name: 'Save as PDF', displayName: 'In Ra File PDF 4x6 / 2x6', description: 'Ảo lập kiểm tra lề in', status: 0, isDefault: false },
      ];
      setPrinters(mockList);
      setSelectedPrinter(mockList[0].name);
    }

    // 2. Load Cameras
    cameraService.getAvailableDevices().then(setCameras);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestPrint = async () => {
    setIsTestingPrint(true);
    setPrintSuccessMessage(null);

    // Create a dummy test print canvas
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 1800;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FF6EA7';
      ctx.fillRect(0, 0, 600, 1800);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PHOTOXINHH TEST PRINT', 300, 200);
      ctx.font = '24px sans-serif';
      ctx.fillText(`Máy in: ${selectedPrinter}`, 300, 300);
      ctx.fillText(new Date().toLocaleString(), 300, 380);
      ctx.fillRect(50, 450, 500, 400);
      ctx.fillRect(50, 900, 500, 400);
    }

    const testUrl = canvas.toDataURL('image/jpeg');

    if (window.electronAPI) {
      const res = await window.electronAPI.silentPrint({
        printerName: selectedPrinter,
        dataUrl: testUrl,
        silent: true,
        copies: 1,
      });
      if (res.success) {
        setPrintSuccessMessage(`Đã gửi lệnh in thành công đến [${selectedPrinter}]!`);
      } else {
        setPrintSuccessMessage(`Lỗi in: ${res.error || 'Vui lòng kiểm tra cáp USB máy in'}`);
      }
    } else {
      // Web browser print test
      await printService.printImage(testUrl, 'Test Print');
      setPrintSuccessMessage('Đã mở hộp thoại in thử nghiệm trên trình duyệt!');
    }
    setIsTestingPrint(false);
  };

  const handleToggleKioskMode = async () => {
    if (window.electronAPI) {
      await window.electronAPI.toggleKiosk();
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col text-white max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gray-800/80 border-b border-gray-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg font-cute text-white">
                Bảng Quản Lý Thiết Bị Phần Cứng (Device Hub)
              </h2>
              <p className="text-xs text-gray-400">
                {isElectron
                  ? `Desktop Native App (Electron) • ${systemInfo?.platform || 'macOS'}`
                  : 'Đang chạy giao diện Web • Kết nối máy in qua Trình điều khiển'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800 px-6 bg-gray-900/50">
          <button
            onClick={() => setActiveTab('printer')}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'printer'
                ? 'border-pink-500 text-pink-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Máy In Ảnh ({printers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('camera')}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'camera'
                ? 'border-pink-500 text-pink-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Máy Ảnh & LiveView ({cameras.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('kiosk')}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'kiosk'
                ? 'border-pink-500 text-pink-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Cài Đặt Kiosk</span>
          </button>

          {onOpenBluetooth && (
            <button
              onClick={() => {
                onClose();
                onOpenBluetooth();
              }}
              className="flex items-center gap-1.5 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 border-transparent text-blue-400 hover:text-blue-300 ml-auto"
            >
              <Bluetooth className="w-4 h-4 text-blue-400 animate-pulse" />
              <span>Mở Hub Bluetooth & Không Dây →</span>
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* TAB 1: PRINTERS */}
          {activeTab === 'printer' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Danh sách máy in nhận diện trong hệ thống:
                </span>
                <span className="text-xs text-pink-400 bg-pink-500/10 px-2.5 py-0.5 rounded-full border border-pink-500/20">
                  Hỗ trợ Silent Print (In ngầm 1 chạm)
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                {printers.map((p) => {
                  const isSelected = selectedPrinter === p.name;
                  return (
                    <div
                      key={p.name}
                      onClick={() => setSelectedPrinter(p.name)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-pink-500 bg-pink-500/10 shadow-md'
                          : 'border-gray-800 bg-gray-800/40 hover:bg-gray-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${isSelected ? 'bg-pink-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
                          <Printer className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{p.displayName}</span>
                            {p.isDefault && (
                              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md font-medium border border-blue-500/30">
                                Mặc định OS
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 block">{p.description || 'Sẵn sàng in ảnh khổ 4x6 / 2x6'}</span>
                        </div>
                      </div>

                      {isSelected ? (
                        <CheckCircle className="w-5 h-5 text-pink-400" />
                      ) : (
                        <span className="text-xs text-gray-500">Nhấn để chọn</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Test Print Action */}
              <div className="pt-3 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-gray-400">
                  Máy in mục tiêu: <strong className="text-white">{selectedPrinter || 'Chưa chọn'}</strong>
                </div>

                <button
                  onClick={handleTestPrint}
                  disabled={isTestingPrint || !selectedPrinter}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs shadow-lg transition-all hover:scale-105 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isTestingPrint ? 'Đang gửi lệnh...' : 'In Bản Thử Nghiệm (Test Print)'}</span>
                </button>
              </div>

              {printSuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{printSuccessMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CAMERAS */}
          {activeTab === 'camera' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Nguồn Camera & Máy Ảnh:
                </span>
                <button
                  onClick={onToggleMockMode}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                    isMockMode
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  }`}
                >
                  {isMockMode ? '🎭 Fake Mode Đang BẬT' : '📷 Real Camera Đang BẬT'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cameras.map((cam) => (
                  <div
                    key={cam.deviceId}
                    className="p-3.5 rounded-2xl border border-gray-800 bg-gray-800/40 flex items-center gap-3"
                  >
                    <div className="p-2 rounded-xl bg-gray-700 text-gray-300">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-xs sm:text-sm text-white block truncate">
                        {cam.label}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {cam.deviceId === 'mock-camera' ? 'Giả lập 4K Studio' : 'WebRTC / PTP Driver'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-2xl bg-gray-800/60 border border-gray-700 text-xs text-gray-300 flex flex-col gap-2">
                <div className="flex items-center gap-2 font-bold text-pink-400">
                  <Shield className="w-4 h-4" />
                  <span>Hướng dẫn kết nối Máy ảnh DSLR / Mirrorless (Canon/Sony):</span>
                </div>
                <p>1. Cắm dây USB Tethering từ máy ảnh vào máy tính.</p>
                <p>2. Chuyển núm xoay máy ảnh sang chế độ <strong>M (Manual)</strong> hoặc <strong>P</strong>.</p>
                <p>3. Dùng phần mềm <strong>OBS Studio / Canon EOS Utility Webcam</strong> hoặc chọn trực tiếp camera trong danh sách trên.</p>
              </div>
            </div>
          )}

          {/* TAB 3: KIOSK SETTINGS */}
          {activeTab === 'kiosk' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-gray-800/60 border border-gray-700 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-white">Chế độ Toàn Màn Hình Kiosk</h4>
                  <p className="text-xs text-gray-400">Chặn người dùng bấm linh tinh, hiển thị toàn bộ booth</p>
                </div>
                <button
                  onClick={handleToggleKioskMode}
                  className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs shadow-md"
                >
                  Bật / Tắt Kiosk
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-gray-800/60 border border-gray-700 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-white">Tự động Reset sau khi in</h4>
                  <p className="text-xs text-gray-400">Tự động xóa ảnh và trở về màn hình chào sau 60 giây</p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-5 h-5 accent-pink-500 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
