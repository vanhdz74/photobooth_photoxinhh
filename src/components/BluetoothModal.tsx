import React, { useState, useEffect, useRef } from 'react';
import {
  Bluetooth,
  X,
  Smartphone,
  Camera,
  Printer,
  Radio,
  BatteryCharging,
  BatteryMedium,
  BatteryLow,
  RefreshCw,
  Send,
  Download,
  Aperture,
  ShieldCheck,
  Sparkles,
  QrCode,
  Copy,
  ExternalLink,
  Check,
  PlusCircle,
  Trash2,
  CheckCircle2,
  Video,
  Filter,
  HelpCircle,
  Search,
  Info,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  bluetoothService,
  BluetoothDevice,
  BleScanFilterMode,
} from '../services/bluetoothService';
import { realP2PService, ConnectedPhoneClient } from '../services/realP2PService';

interface BluetoothModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerShutter?: () => void;
  onPhotoReceived?: (photoUrl: string) => void;
  currentStripDataUrl?: string;
}

export const BluetoothModal: React.FC<BluetoothModalProps> = ({
  isOpen,
  onClose,
  onTriggerShutter,
  onPhotoReceived,
  currentStripDataUrl,
}) => {
  const [activeTab, setActiveTab] = useState<'qr_phone' | 'hid_remote' | 'ble_scanner' | 'printer'>('qr_phone');
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [realPhones, setRealPhones] = useState<ConnectedPhoneClient[]>([]);
  const [pairingDevice, setPairingDevice] = useState<BluetoothDevice | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [scanErrorMessage, setScanErrorMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [customHostInput, setCustomHostInput] = useState(realP2PService.getCustomHost());

  // BLE Scan Filter settings
  const [scanFilterMode, setScanFilterMode] = useState<BleScanFilterMode>('named_only');
  const [customPrefixInput, setCustomPrefixInput] = useState('');
  const [showWhyUnknownTip, setShowWhyUnknownTip] = useState(false);

  // Real HID Bluetooth Remote live indicator
  const [lastHidKey, setLastHidKey] = useState<string | null>(null);
  const [hidKeyCount, setHidKeyCount] = useState(0);
  const [isHidActive, setIsHidActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedPhoneForUpload = useRef<string | null>(null);

  const syncUrl = realP2PService.getSyncUrl();
  const roomId = realP2PService.getRoomId();

  useEffect(() => {
    if (!isOpen) return;

    // Subscribe to bluetooth service updates
    const unsubDevices = bluetoothService.subscribe((devs) => {
      setDevices(devs);
      setPairingDevice(bluetoothService.getPendingPairingDevice());
    });

    // Subscribe to real phone clients
    const unsubClients = realP2PService.onClientsChange(setRealPhones);

    // Subscribe to real Bluetooth HID Button presses
    const unsubHid = bluetoothService.onHidKeyPress((key) => {
      setLastHidKey(key);
      setHidKeyCount((prev) => prev + 1);
      setIsHidActive(true);
      setTimeout(() => setIsHidActive(false), 1200);
    });

    return () => {
      unsubDevices();
      unsubClients();
      unsubHid();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRealWebBluetooth = async (modeOverride?: BleScanFilterMode) => {
    setScanErrorMessage(null);
    const mode = modeOverride || scanFilterMode;

    let modeLabel = 'Lọc chỉ thiết bị có tên (0% Unknown rác)';
    if (mode === 'cameras') modeLabel = 'Máy ảnh (Canon/Sony/Nikon...)';
    if (mode === 'printers') modeLabel = 'Máy in (SELPHY/POS/Thermal...)';
    if (mode === 'remotes') modeLabel = 'Nút bấm Selfie / Remote';
    if (mode === 'custom') modeLabel = `Tên bắt đầu bằng "${customPrefixInput || '...'}"`;
    if (mode === 'all') modeLabel = 'Tất cả thiết bị (Bao gồm không tên)';

    setActionMessage(`Đang mở cửa sổ quét Bluetooth: ${modeLabel}...`);

    const res = await bluetoothService.scanRealWebBluetooth({
      mode,
      customPrefix: customPrefixInput,
    });

    if (!res.success) {
      if (res.error) setScanErrorMessage(res.error);
    } else {
      setActionMessage('Đã kết nối thiết bị Bluetooth thật thành công!');
    }
    setTimeout(() => setActionMessage(null), 3500);
  };

  const handleLoadSampleDevices = () => {
    bluetoothService.loadSampleVirtualDevices();
    setActionMessage('Đã tải danh sách thiết bị thử nghiệm!');
    setTimeout(() => setActionMessage(null), 2500);
  };

  const handleClearDevices = () => {
    bluetoothService.clearDevices();
    setActionMessage('Đã dọn sạch danh sách thiết bị!');
    setTimeout(() => setActionMessage(null), 2000);
  };

  const handleConnect = async (dev: BluetoothDevice) => {
    setConnectingId(dev.id);
    await bluetoothService.connectDevice(dev.id);
    setConnectingId(null);
  };

  const handleDisconnect = (dev: BluetoothDevice) => {
    bluetoothService.disconnectDevice(dev.id);
  };

  const handleConfirmPair = (dev: BluetoothDevice) => {
    bluetoothService.confirmPairing(dev.id);
    setPairingDevice(null);
  };

  const handleCancelPair = (dev: BluetoothDevice) => {
    bluetoothService.cancelPairing(dev.id);
    setPairingDevice(null);
  };

  const handleCopySyncLink = () => {
    navigator.clipboard.writeText(syncUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleOpenRemoteInNewTab = () => {
    window.open(syncUrl, '_blank');
  };

  const handleApplyCustomHost = () => {
    realP2PService.setCustomHost(customHostInput);
    setActionMessage('Đã cập nhật địa chỉ IP kết nối!');
    setTimeout(() => setActionMessage(null), 2000);
  };

  // Actions for Connected Devices
  const handlePhoneSendSamplePhoto = async (deviceId: string) => {
    setActionMessage('Đang truyền ảnh từ điện thoại vào Photobooth...');
    const photoUrl = await bluetoothService.transferPhotoFromPhone(deviceId);
    if (onPhotoReceived) {
      onPhotoReceived(photoUrl);
    }
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handlePhoneUploadCustomPhoto = (deviceId: string) => {
    selectedPhoneForUpload.current = deviceId;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const devId = selectedPhoneForUpload.current;
    if (file && devId) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const url = event.target?.result as string;
        setActionMessage('Đang truyền file ảnh từ điện thoại...');
        await bluetoothService.transferPhotoFromPhone(devId, url);
        if (onPhotoReceived) {
          onPhotoReceived(url);
        }
        setTimeout(() => setActionMessage(null), 3000);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendStripToPhone = async (deviceId: string) => {
    if (!currentStripDataUrl) {
      alert('Chưa có ảnh dải hoàn thành để gửi. Vui lòng thiết kế ảnh trước!');
      return;
    }
    setActionMessage('Đang bắn dải ảnh sang điện thoại qua AirDrop/Bluetooth...');
    await bluetoothService.sendStripToPhone(deviceId, currentStripDataUrl);
    realP2PService.sendStripToPhones(currentStripDataUrl);
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleCameraShutterClick = (deviceId: string) => {
    bluetoothService.triggerRemoteShutter(deviceId);
    if (onTriggerShutter) {
      onTriggerShutter();
    }
    setActionMessage('Đã kích hoạt bấm chụp Shutter từ xa!');
    setTimeout(() => setActionMessage(null), 2500);
  };

  const handlePrintViaBluetooth = async (printerId: string) => {
    if (!currentStripDataUrl) {
      alert('Vui lòng chọn ảnh dải để in thử!');
      return;
    }
    setActionMessage('Đang truyền dữ liệu in 4 lớp màu nhiệt sang máy in...');
    await bluetoothService.printViaBluetooth(printerId, currentStripDataUrl);
    setTimeout(() => setActionMessage(null), 3000);
  };

  const connectedCount = devices.filter((d) => d.status === 'connected' || d.status === 'transferring' || d.status === 'printing').length + realPhones.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />

      <div className="bg-gray-900 border border-gray-800 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col text-white max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-gray-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center relative shadow-inner">
              <Bluetooth className="w-6 h-6 animate-pulse" />
              {connectedCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {connectedCount}
                </span>
              )}
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg font-cute text-white flex items-center gap-2">
                <span>Trung Tâm Kết Nối Không Dây & Bluetooth</span>
                <span className="text-[11px] bg-blue-500/20 text-blue-300 font-normal px-2.5 py-0.5 rounded-full border border-blue-500/30">
                  Phòng: {roomId}
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Nối Điện Thoại Thật (WebRTC P2P Live Camera) • Nút Chụp Bluetooth Thật (HID) • Thiết Bị BLE
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 active:bg-gray-700 transition-colors cursor-pointer active:scale-95"
            title="Đóng"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800 px-4 sm:px-6 bg-gray-900/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab('qr_phone')}
            className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'qr_phone'
                ? 'border-pink-500 text-pink-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <QrCode className="w-4 h-4 text-pink-400" />
            <span>📱 Nối Điện Thoại Thật (QR Code)</span>
            {realPhones.length > 0 && (
              <span className="bg-pink-500 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                {realPhones.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('hid_remote')}
            className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'hid_remote'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Aperture className="w-4 h-4 text-emerald-400" />
            <span>🔘 Nút Chụp Bluetooth (HID)</span>
            {hidKeyCount > 0 && (
              <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                {hidKeyCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('ble_scanner')}
            className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'ble_scanner'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Radio className="w-4 h-4 text-blue-400" />
            <span>📡 Quét Phần Cứng BLE ({devices.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('printer')}
            className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'printer'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Máy In ({devices.filter((d) => d.type === 'printer').length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          {actionMessage && (
            <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs flex items-center gap-2 animate-in fade-in">
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
              <span>{actionMessage}</span>
            </div>
          )}

          {scanErrorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
              <span>{scanErrorMessage}</span>
              <button onClick={() => setScanErrorMessage(null)} className="text-rose-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* TAB 1: REAL SMARTPHONE CONNECTION VIA QR CODE & WEBRTC P2P */}
          {activeTab === 'qr_phone' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center bg-gray-800/40 p-5 rounded-3xl border border-gray-800">
                {/* QR Code Card */}
                <div className="flex flex-col items-center justify-center p-4 bg-gray-950 rounded-2xl border border-gray-800 text-center">
                  <div className="bg-white p-3 rounded-2xl shadow-xl border-2 border-pink-400/40">
                    <QRCodeSVG value={syncUrl} size={160} level="H" includeMargin={true} />
                  </div>
                  <span className="text-xs font-extrabold text-pink-400 mt-3 font-cute">
                    Quét mã QR bằng Camera điện thoại
                  </span>
                  <span className="text-[11px] text-gray-400 mt-0.5">
                    Để biến điện thoại thành camera live 60FPS & nút bấm chụp
                  </span>
                </div>

                {/* Info & Fast Action Deck */}
                <div className="flex flex-col gap-3">
                  <div className="bg-gray-900 p-4 rounded-2xl border border-gray-700/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Mã Phòng P2P</span>
                      <span className="text-xs font-mono font-bold text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-lg border border-pink-500/30">
                        {roomId}
                      </span>
                    </div>

                    {/* Wi-Fi IP Address Box */}
                    <div className="mb-3 bg-gray-950 p-2.5 rounded-xl border border-gray-800 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[11px] text-gray-400">
                        <span>Địa chỉ IP máy tính (Cùng Wi-Fi):</span>
                        <span className="text-emerald-400 font-bold">LAN Wi-Fi</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={customHostInput}
                          onChange={(e) => setCustomHostInput(e.target.value)}
                          placeholder="192.168.0.117:5173"
                          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1 text-xs font-mono text-white outline-none focus:border-pink-500"
                        />
                        <button
                          onClick={handleApplyCustomHost}
                          className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-[11px] text-gray-200 border border-gray-700 font-semibold"
                        >
                          Lưu
                        </button>
                      </div>
                      <span className="text-[10px] text-gray-500">
                        * Đảm bảo điện thoại và máy tính đang cùng kết nối một mạng Wi-Fi.
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs text-purple-200 flex flex-col gap-1 mb-1">
                      <span className="font-bold text-pink-300 flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5" />
                        <span>Dùng Điện Thoại Làm Máy Ảnh Trực Tiếp:</span>
                      </span>
                      <span className="text-[11px] text-gray-300">
                        Sau khi quét QR, bấm <strong>"Bật Live Cam"</strong> trên điện thoại. Màn hình Photobooth sẽ tự động hiển thị camera của điện thoại làm máy ảnh trực tiếp 60FPS!
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <button
                      onClick={handleCopySyncLink}
                      className="w-full flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold border border-gray-700 transition-all hover:scale-102"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Đã sao chép link!' : 'Sao chép link kết nối'}</span>
                    </button>

                    <button
                      onClick={handleOpenRemoteInNewTab}
                      className="w-full flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold shadow-md transition-all hover:scale-102"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Mở thử trên Tab mới</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Connected Real Phones List */}
              <div className="flex flex-col gap-2.5 mt-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>Điện thoại thật đang kết nối WebRTC ({realPhones.length}):</span>
                </span>

                {realPhones.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-gray-800/30 border border-gray-800 text-center text-xs text-gray-400">
                    Chưa có điện thoại nào quét mã. Hãy lấy điện thoại của bạn quét mã QR ở trên để kết nối trực tiếp!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {realPhones.map((phone) => (
                      <div
                        key={phone.id}
                        className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                            <Smartphone className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-xs text-white">{phone.name}</h4>
                            <span className="text-[10px] text-gray-400">{phone.os} • WebRTC Live</span>
                          </div>
                        </div>

                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-md font-bold border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Đã nối</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: REAL PHYSICAL BLUETOOTH HID SHUTTER BUTTON (AB SHUTTER / SELFIE REMOTE) */}
          {activeTab === 'hid_remote' && (
            <div className="flex flex-col gap-4">
              <div className="bg-gradient-to-r from-emerald-950/40 via-gray-900 to-teal-950/40 border border-emerald-500/30 rounded-3xl p-6 flex flex-col items-center text-center shadow-xl">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 mb-3 ${
                  isHidActive
                    ? 'bg-emerald-500 text-white scale-110 shadow-lg shadow-emerald-500/50 animate-bounce'
                    : 'bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-400'
                }`}>
                  <Aperture className="w-10 h-10" />
                </div>

                <h3 className="text-base sm:text-lg font-bold text-white font-cute">
                  Bộ Thu Tín Hiệu Nút Bấm Bluetooth Không Dây (HID Shutter)
                </h3>
                <p className="text-xs text-gray-300 mt-1 max-w-md">
                  Hệ thống luôn tự động lắng nghe tín hiệu từ các loại nút bấm selfie Bluetooth (AB Shutter 3, Nhẫn bấm chụp, Gậy selfie bluetooth, Media Button).
                </p>

                {/* Live Shutter Signal Detector Box */}
                <div className="w-full max-w-md bg-gray-950 border border-gray-800 rounded-2xl p-4 mt-4 flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className={`w-2.5 h-2.5 rounded-full ${isHidActive ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500'}`} />
                    <span className="text-gray-300">Trạng thái: </span>
                    <strong className="text-emerald-400">ĐANG SẴN SÀNG NHẬN LỆNH CHỤP</strong>
                  </div>

                  <div className={`w-full py-3 px-4 rounded-xl border text-xs font-mono transition-all ${
                    isHidActive
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-gray-900 border-gray-800 text-gray-400'
                  }`}>
                    {lastHidKey ? (
                      <span>🎉 Đã nhận tín hiệu phím: <strong>{lastHidKey}</strong> (Tổng: {hidKeyCount} lần bấm)</span>
                    ) : (
                      <span>👉 Bấm thử nút Bluetooth trên tay bạn hoặc phím Space để kiểm tra</span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      bluetoothService.triggerRemoteShutter();
                      if (onTriggerShutter) onTriggerShutter();
                    }}
                    className="mt-1 px-4 py-2 rounded-xl bg-gray-800 hover:bg-emerald-600 hover:text-white text-gray-300 text-xs font-bold border border-gray-700 transition-all active:scale-95"
                  >
                    Bấm Test Thử Lệnh Chụp Ngay
                  </button>
                </div>
              </div>

              {/* Pairing Guide */}
              <div className="p-4 rounded-2xl bg-gray-800/40 border border-gray-700/80 flex flex-col gap-2.5 text-xs text-gray-300">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Cách ghép nối nút bấm Bluetooth vật lý thật vào máy tính / iPad:</span>
                </span>
                <ol className="list-decimal list-inside space-y-1 text-gray-300 text-[11px] sm:text-xs">
                  <li>Bật công tắc nguồn trên nút bấm selfie Bluetooth (đèn LED xanh/đỏ sẽ nhấp nháy tìm kiếm).</li>
                  <li>Mở <strong>Cài đặt Bluetooth</strong> trên macOS / Windows / iPad của bạn.</li>
                  <li>Chọn ghép nối với thiết bị có tên <strong>"AB Shutter 3"</strong>, <strong>"Selfie"</strong> hoặc <strong>"Bluetooth Shutter"</strong>.</li>
                  <li>Sau khi ghép nối xong, bạn chỉ cần bấm nút là Photobooth sẽ tự động bắt đầu đếm ngược 3s và chụp!</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 3: BLUETOOTH BLE HARDWARE GATT SCANNER */}
          {activeTab === 'ble_scanner' && (
            <div className="flex flex-col gap-4">
              {/* Scan Control Header Card */}
              <div className="bg-gradient-to-r from-blue-950/60 via-gray-900 to-purple-950/60 border border-blue-500/40 p-5 rounded-3xl flex flex-col gap-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0">
                      <Radio className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                        <span>Quét Thiết Bị Bluetooth BLE Thật</span>
                        <span className="text-[11px] bg-blue-500/20 text-blue-300 font-semibold px-2 py-0.5 rounded-full border border-blue-500/30">
                          Web Bluetooth API
                        </span>
                      </h3>
                      <p className="text-xs text-gray-300 mt-0.5">
                        Chọn chế độ lọc thông minh để loại bỏ thiết bị vô danh ("Unknown Device")
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowWhyUnknownTip((prev) => !prev)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-amber-300 hover:text-amber-200 text-xs font-semibold border border-amber-500/30 transition-all self-start sm:self-auto"
                  >
                    <HelpCircle className="w-4 h-4 text-amber-400" />
                    <span>{showWhyUnknownTip ? 'Ẩn Hướng Dẫn' : 'Vì sao ra 1 đống Unknown?'}</span>
                    {showWhyUnknownTip ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Filter Mode Selector Pills */}
                <div className="flex flex-col gap-2 pt-2 border-t border-gray-800">
                  <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-blue-400" />
                    <span>Chế độ lọc quét Bluetooth:</span>
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => setScanFilterMode('named_only')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left flex items-center gap-2 transition-all ${
                        scanFilterMode === 'named_only'
                          ? 'bg-blue-600/30 border-blue-500 text-blue-200 shadow-md shadow-blue-500/20'
                          : 'bg-gray-800/60 border-gray-700/80 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                      }`}
                    >
                      <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-white text-[11px] truncate">🎯 Chỉ có tên (Khuyên Dùng)</div>
                        <div className="text-[10px] text-gray-400 truncate">Lọc sạch 100% Unknown</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setScanFilterMode('cameras')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left flex items-center gap-2 transition-all ${
                        scanFilterMode === 'cameras'
                          ? 'bg-blue-600/30 border-blue-500 text-blue-200 shadow-md shadow-blue-500/20'
                          : 'bg-gray-800/60 border-gray-700/80 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                      }`}
                    >
                      <Camera className="w-4 h-4 text-pink-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-white text-[11px] truncate">📷 Máy Ảnh</div>
                        <div className="text-[10px] text-gray-400 truncate">Canon, Sony, Nikon, Fuji...</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setScanFilterMode('printers')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left flex items-center gap-2 transition-all ${
                        scanFilterMode === 'printers'
                          ? 'bg-blue-600/30 border-blue-500 text-blue-200 shadow-md shadow-blue-500/20'
                          : 'bg-gray-800/60 border-gray-700/80 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                      }`}
                    >
                      <Printer className="w-4 h-4 text-purple-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-white text-[11px] truncate">🖨️ Máy In</div>
                        <div className="text-[10px] text-gray-400 truncate">SELPHY, POS, Thermal...</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setScanFilterMode('remotes')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left flex items-center gap-2 transition-all ${
                        scanFilterMode === 'remotes'
                          ? 'bg-blue-600/30 border-blue-500 text-blue-200 shadow-md shadow-blue-500/20'
                          : 'bg-gray-800/60 border-gray-700/80 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                      }`}
                    >
                      <Aperture className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-white text-[11px] truncate">🔘 Nút Chụp / Remote</div>
                        <div className="text-[10px] text-gray-400 truncate">Shutter, Selfie, Button...</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setScanFilterMode('custom')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left flex items-center gap-2 transition-all ${
                        scanFilterMode === 'custom'
                          ? 'bg-blue-600/30 border-blue-500 text-blue-200 shadow-md shadow-blue-500/20'
                          : 'bg-gray-800/60 border-gray-700/80 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                      }`}
                    >
                      <Search className="w-4 h-4 text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-white text-[11px] truncate">🔍 Tên Tùy Chỉnh</div>
                        <div className="text-[10px] text-gray-400 truncate">Nhập từ khóa tiền tố</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setScanFilterMode('all')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left flex items-center gap-2 transition-all ${
                        scanFilterMode === 'all'
                          ? 'bg-blue-600/30 border-blue-500 text-blue-200 shadow-md shadow-blue-500/20'
                          : 'bg-gray-800/60 border-gray-700/80 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                      }`}
                    >
                      <Radio className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-white text-[11px] truncate">🌐 Tất Cả Thiết Bị</div>
                        <div className="text-[10px] text-gray-400 truncate">Bao gồm không tên (Raw)</div>
                      </div>
                    </button>
                  </div>

                  {/* Custom Prefix Input Box */}
                  {scanFilterMode === 'custom' && (
                    <div className="flex items-center gap-2 mt-1 bg-gray-950 p-2.5 rounded-xl border border-gray-800 animate-in fade-in">
                      <Search className="w-4 h-4 text-blue-400 shrink-0 ml-1" />
                      <input
                        type="text"
                        value={customPrefixInput}
                        onChange={(e) => setCustomPrefixInput(e.target.value)}
                        placeholder="Nhập chữ cái bắt đầu của thiết bị (ví dụ: Canon, SELPHY, AB, BT...)"
                        className="flex-1 bg-transparent border-none text-xs text-white placeholder-gray-500 outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Primary Trigger Scan CTA */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-gray-800">
                  <span className="text-xs text-gray-300">
                    Chế độ đang chọn:{' '}
                    <strong className="text-blue-300">
                      {scanFilterMode === 'named_only' && '🎯 Chỉ thiết bị có tên (Không còn Unknown rác)'}
                      {scanFilterMode === 'cameras' && '📷 Máy Ảnh (Canon / Sony / Nikon / Fuji)'}
                      {scanFilterMode === 'printers' && '🖨️ Máy In (SELPHY / POS / Thermal)'}
                      {scanFilterMode === 'remotes' && '🔘 Nút Chụp BLE / Remote'}
                      {scanFilterMode === 'custom' && `🔍 Thiết bị bắt đầu bằng "${customPrefixInput || '...'}"`}
                      {scanFilterMode === 'all' && '🌐 Tất cả (Bao gồm sóng không tên)'}
                    </strong>
                  </span>

                  <button
                    onClick={() => handleRealWebBluetooth()}
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-blue-900/50 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shrink-0"
                  >
                    <Bluetooth className="w-4 h-4" />
                    <span>Bắt Đầu Quét & Ghép Nối Thiết Bị</span>
                  </button>
                </div>
              </div>

              {/* Troubleshooting & Guidance Accordion */}
              {showWhyUnknownTip && (
                <div className="p-5 rounded-3xl bg-amber-950/20 border border-amber-500/30 flex flex-col gap-3 text-xs text-amber-200/90 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                    <Info className="w-4 h-4 text-amber-400" />
                    <span>Giải Đáp: Vì Sao Khi Quét Bluetooth Lại Ra 1 Đống "Unknown Device"?</span>
                  </div>

                  <div className="space-y-2 text-[12px] text-gray-300 leading-relaxed">
                    <p>
                      🔴 <strong>Nguyên nhân:</strong> Trong phòng có rất nhiều thiết bị phát sóng Bluetooth BLE ngầm liên tục (như Smart TV, Apple AirTags, đồng hồ thông minh, vòng đeo tay thể thao, bóng đèn thông minh, thiết bị nhà thông minh...). Các thiết bị này phát các gói tin quảng bá (BLE Advertisements) không chứa chuỗi tên gọi. Trình duyệt khi quét toàn bộ sẽ gom tất cả lại và hiển thị là <em>"Unknown or unsupported device"</em>.
                    </p>

                    <p>
                      🟢 <strong>Cách giải quyết:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-1 pl-2 text-gray-300">
                      <li>
                        <strong>Khuyên Dùng:</strong> Hãy chọn chế độ <strong>"🎯 Chỉ có tên (Khuyên Dùng)"</strong> ở trên. Hệ thống sẽ lọc bỏ 100% các thiết bị vô danh và chỉ hiển thị thiết bị có tên thật rõ ràng!
                      </li>
                      <li>
                        <strong>Máy ảnh / Máy in chưa hiện tên?</strong> Hãy đảm bảo bạn đã bấm giữ nút Bluetooth 3-5 giây trên thiết bị cho đến khi <strong>đèn LED nhấp nháy liên tục (Pairing Mode)</strong> để thiết bị phát tên ra môi trường.
                      </li>
                    </ul>
                  </div>

                  {/* Quick Shortcut Buttons to Tab 1 and Tab 2 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 pt-2 border-t border-amber-500/20">
                    <button
                      onClick={() => setActiveTab('hid_remote')}
                      className="p-3 rounded-xl bg-gray-900/80 hover:bg-emerald-950/40 border border-emerald-500/30 text-left flex items-center justify-between group transition-all"
                    >
                      <div>
                        <div className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                          <Aperture className="w-3.5 h-3.5" />
                          <span>Bạn dùng Nút Bấm Chụp Selfie (AB Shutter 3)?</span>
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          Ghép đôi ở Cài đặt Bluetooth máy tính & dùng trực tiếp tại đây
                        </div>
                      </div>
                      <span className="text-emerald-400 font-bold text-xs group-hover:translate-x-1 transition-transform">→</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('qr_phone')}
                      className="p-3 rounded-xl bg-gray-900/80 hover:bg-pink-950/40 border border-pink-500/30 text-left flex items-center justify-between group transition-all"
                    >
                      <div>
                        <div className="font-bold text-pink-400 text-xs flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>Bạn muốn kết nối Điện thoại (iPhone / Android)?</span>
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          Quét mã QR để biến điện thoại thành Camera Live 60FPS & Bắn ảnh
                        </div>
                      </div>
                      <span className="text-pink-400 font-bold text-xs group-hover:translate-x-1 transition-transform">→</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Devices Cards */}
              {devices.length === 0 ? (
                <div className="bg-gray-800/30 border border-gray-800 rounded-3xl p-8 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center text-gray-500">
                    <Bluetooth className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Chưa có thiết bị Bluetooth BLE nào được ghép nối</h4>
                    <p className="text-xs text-gray-400 mt-1 max-w-md">
                      Bấm nút <strong>"Bắt Đầu Quét & Ghép Nối Thiết Bị"</strong> ở trên để tìm các thiết bị Bluetooth xung quanh bạn.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleLoadSampleDevices}
                      className="px-3.5 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold border border-gray-700 transition-all flex items-center gap-1.5"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-pink-400" />
                      <span>Tải thiết bị mẫu để test</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Danh sách thiết bị ({devices.length}):</span>
                    <button
                      onClick={handleClearDevices}
                      className="text-gray-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa danh sách</span>
                    </button>
                  </div>

                  {devices.map((dev) => {
                    const isConnected = dev.status === 'connected' || dev.status === 'transferring' || dev.status === 'printing';
                    const isConnecting = dev.status === 'connecting' || connectingId === dev.id;

                    return (
                      <div
                        key={dev.id}
                        className={`rounded-2xl border transition-all p-4 flex flex-col gap-3 ${
                          isConnected
                            ? 'bg-blue-950/20 border-blue-500/40 shadow-lg'
                            : 'bg-gray-800/40 border-gray-800 hover:bg-gray-800/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                                isConnected
                                  ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                                  : 'bg-gray-700 text-gray-300'
                              }`}
                            >
                              {dev.type === 'phone' && <Smartphone className="w-5 h-5" />}
                              {dev.type === 'camera' && <Camera className="w-5 h-5" />}
                              {dev.type === 'printer' && <Printer className="w-5 h-5" />}
                              {dev.type === 'remote' && <Aperture className="w-5 h-5" />}
                              {dev.type === 'other' && <Bluetooth className="w-5 h-5" />}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm text-white truncate">{dev.name}</h4>
                                {dev.isRealHardware && (
                                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md font-bold border border-emerald-500/30">
                                    Phần Cứng Thật
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                <span>{dev.brand} - {dev.modelName}</span>
                                <span>•</span>
                                <span className="font-mono text-[11px] text-gray-500">{dev.macAddress}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {dev.batteryLevel !== undefined && (
                              <div className="hidden sm:flex items-center gap-1 text-xs text-gray-300 bg-gray-800/80 px-2.5 py-1 rounded-xl border border-gray-700">
                                {dev.batteryLevel > 70 ? (
                                  <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                                ) : dev.batteryLevel > 20 ? (
                                  <BatteryMedium className="w-3.5 h-3.5 text-amber-400" />
                                ) : (
                                  <BatteryLow className="w-3.5 h-3.5 text-rose-400" />
                                )}
                                <span className="font-mono text-[11px]">{dev.batteryLevel}%</span>
                              </div>
                            )}

                            {isConnected ? (
                              <button
                                onClick={() => handleDisconnect(dev)}
                                className="px-3.5 py-1.5 rounded-xl bg-gray-800 hover:bg-rose-500/20 text-gray-300 hover:text-rose-300 border border-gray-700 hover:border-rose-500/40 text-xs font-semibold transition-all"
                              >
                                Ngắt kết nối
                              </button>
                            ) : (
                              <button
                                onClick={() => handleConnect(dev)}
                                disabled={isConnecting}
                                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all hover:scale-105 disabled:opacity-50 flex items-center gap-1.5"
                              >
                                {isConnecting ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Đang kết nối...</span>
                                  </>
                                ) : (
                                  <>
                                    <Bluetooth className="w-3.5 h-3.5" />
                                    <span>Kết Nối</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Control Actions */}
                        {isConnected && (
                          <div className="mt-1 pt-3 border-t border-gray-700/60 flex flex-col gap-2.5">
                            {dev.type === 'phone' && (
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 bg-blue-950/40 p-3 rounded-xl border border-blue-500/20">
                                <div className="text-xs text-gray-300">
                                  <span className="font-semibold text-blue-300">Truyền Ảnh: </span>
                                  <span>{dev.details.phoneInfo?.os || 'Mobile Device'}</span>
                                </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                  <button
                                    onClick={() => handlePhoneSendSamplePhoto(dev.id)}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs shadow-sm transition-all"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>📥 Bắn Ảnh Vào Booth</span>
                                  </button>

                                  <button
                                    onClick={() => handlePhoneUploadCustomPhoto(dev.id)}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold border border-gray-700"
                                  >
                                    <span>Chọn File</span>
                                  </button>

                                  <button
                                    onClick={() => handleSendStripToPhone(dev.id)}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>📤 Gửi Dải Ảnh</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {(dev.type === 'camera' || dev.type === 'remote') && (
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 bg-purple-950/40 p-3 rounded-xl border border-purple-500/20">
                                <div className="text-xs text-gray-300">
                                  <span className="font-semibold text-purple-300">Nút Chụp Cầm Tay (Shutter): </span>
                                  <span>Kích hoạt chụp tức thì</span>
                                </div>

                                <button
                                  onClick={() => handleCameraShutterClick(dev.id)}
                                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold text-xs shadow-md shadow-pink-900/40 transition-all hover:scale-105 active:scale-95"
                                >
                                  <Aperture className="w-4 h-4 animate-spin" />
                                  <span>Bấm Shutter Chụp Thử (Click)</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PRINTERS */}
          {activeTab === 'printer' && (
            <div className="flex flex-col gap-4">
              <div className="bg-gray-800/40 border border-gray-800 rounded-3xl p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-white">Máy In Nhiệt & In Ảnh Bluetooth (Dye-Sublimation)</h3>
                  <button
                    onClick={handleLoadSampleDevices}
                    className="px-3 py-1 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold border border-gray-700"
                  >
                    + Nạp Máy In Canon SELPHY
                  </button>
                </div>

                {devices.filter((d) => d.type === 'printer').length === 0 ? (
                  <div className="p-6 rounded-2xl bg-gray-950 border border-gray-800 text-center text-xs text-gray-400">
                    Chưa có máy in nào. Bạn có thể bấm "Nạp Máy In Canon SELPHY" để thử nghiệm quá trình in nhiệt 4 lớp màu sống động!
                  </div>
                ) : (
                  devices
                    .filter((d) => d.type === 'printer')
                    .map((printer) => (
                      <div
                        key={printer.id}
                        className="p-4 rounded-2xl bg-pink-950/20 border border-pink-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
                            <Printer className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-xs text-white">{printer.name}</h4>
                            <span className="text-[10px] text-gray-400">
                              Khay giấy: {printer.details.paperLevel || 85}% • Mực: {printer.details.ribbonLevel || 92}%
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handlePrintViaBluetooth(printer.id)}
                          className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs shadow-md transition-all hover:scale-105"
                        >
                          In Dải Ảnh Thử Nghiệm (Dye-Sub)
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pairing PIN Dialog */}
      {pairingDevice && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-lg flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center animate-bounce">
              <Smartphone className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white font-cute">Yêu Cầu Ghép Đôi Bluetooth</h3>
              <p className="text-xs text-gray-400 mt-1">
                Thiết bị <strong className="text-white">{pairingDevice.name}</strong> muốn ghép đôi với PhotoXinhh Kiosk.
              </p>
            </div>

            <div className="w-full bg-gray-800/90 border border-gray-700 rounded-2xl p-4 my-1">
              <span className="text-[11px] text-gray-400 uppercase tracking-widest block mb-1">Mã PIN Xác Thực</span>
              <div className="text-3xl font-mono font-extrabold tracking-widest text-blue-400">
                {pairingDevice.pairedPin || '684 920'}
              </div>
              <span className="text-[11px] text-gray-500 mt-1 block">Xác nhận mã này hiển thị trên màn hình điện thoại</span>
            </div>

            <div className="flex items-center gap-3 w-full">
              <button
                onClick={() => handleCancelPair(pairingDevice)}
                className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-xs"
              >
                Từ Chối
              </button>
              <button
                onClick={() => handleConfirmPair(pairingDevice)}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-900/40"
              >
                Chấp Nhận Ghép Đôi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
