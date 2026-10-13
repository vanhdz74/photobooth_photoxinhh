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
  CheckCircle2,
  Maximize2,
  Layers,
  ShieldCheck,
  SlidersHorizontal,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { printService, PaperSizeId, PAPER_SIZES } from '../services/printService';
import { bluetoothService, BluetoothDevice } from '../services/bluetoothService';
import { realP2PService } from '../services/realP2PService';
import { safeStoreStrip } from '../utils/safeStorage';
import { ImageLightboxModal } from './ImageLightboxModal';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  singleStripDataUrl: string;
  aspectRatio?: '2x6' | '4x6' | '1x1';
  onOpenBluetooth?: () => void;
  onStartNewShoot?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  singleStripDataUrl,
  aspectRatio = '2x6',
  onOpenBluetooth,
  onStartNewShoot,
}) => {
  const [selectedPaperSize, setSelectedPaperSize] = useState<PaperSizeId>(() => printService.getSelectedPaperSize());
  const [safeBleed, setSafeBleed] = useState<boolean>(true);
  const [renderedPrintUrl, setRenderedPrintUrl] = useState<string>('');
  const [printLayout, setPrintLayout] = useState<'single' | 'double'>(() => (aspectRatio === '4x6' ? 'single' : 'double'));

  useEffect(() => {
    if (isOpen) {
      setPrintLayout(aspectRatio === '4x6' ? 'single' : 'double');
    }
  }, [isOpen, aspectRatio]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareId] = useState<string>(() => `strip_${Date.now()}`);
  const [connectedDevices, setConnectedDevices] = useState<BluetoothDevice[]>([]);
  const [btStatusMsg, setBtStatusMsg] = useState<string | null>(null);

  // Fullscreen Zoom / Lightbox State
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const currentPaper = PAPER_SIZES[selectedPaperSize] || PAPER_SIZES['canon-cp1500-postcard'];

  useEffect(() => {
    const unsub = bluetoothService.subscribe((devs) => {
      setConnectedDevices(devs.filter((d) => d.status === 'connected'));
    });
    return unsub;
  }, []);

  // Real LAN / QR Share Link
  const shareUrl = (() => {
    const protocol = typeof window !== 'undefined' && window.location.protocol.startsWith('https') ? 'https:' : 'http:';
    let host = typeof window !== 'undefined' ? window.location.host : '192.168.0.117:5173';
    if (!host || host.includes('localhost') || host.includes('127.0.0.1') || host.includes('capacitor')) {
      host = '192.168.0.117:5173';
    }
    return `${protocol}//${host}/?view_strip=${shareId}`;
  })();

  // Render high-res print canvas whenever strip, paper size, layout or safe-bleed changes
  useEffect(() => {
    if (isOpen && singleStripDataUrl) {
      let isMounted = true;
      printService
        .createPrintCanvas(singleStripDataUrl, selectedPaperSize, {
          layout: printLayout,
          safeBleed,
        })
        .then((url) => {
          if (isMounted && url) {
            setRenderedPrintUrl(url);
          }
        })
        .catch((err) => {
          console.warn('Error generating print canvas:', err);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, singleStripDataUrl, selectedPaperSize, printLayout, safeBleed]);

  useEffect(() => {
    if (isOpen && singleStripDataUrl) {
      safeStoreStrip(`px_share_${shareId}`, singleStripDataUrl);
      safeStoreStrip('px_latest_strip', singleStripDataUrl);

      try {
        realP2PService.sendStripToPhones(singleStripDataUrl, 'Dải ảnh Photobooth');
      } catch (err) {
        console.warn('Could not broadcast strip to remotes:', err);
      }

      try {
        confetti({
          particleCount: 50,
          spread: 55,
          origin: { y: 0.6 },
        });
      } catch {}
    }
  }, [isOpen, singleStripDataUrl, shareId]);

  if (!isOpen) return null;

  const currentActiveUrl = renderedPrintUrl || singleStripDataUrl;

  const handlePaperSizeChange = (newSize: PaperSizeId) => {
    setSelectedPaperSize(newSize);
    printService.setSelectedPaperSize(newSize);
  };

  const handleDownload = async () => {
    setIsSaved(true);
    const targetUrl = currentActiveUrl;
    const filename = `photoxinhh_${currentPaper.id}_${currentPaper.widthMm}x${currentPaper.heightMm}mm_${currentPaper.widthPx}x${currentPaper.heightPx}px_${Date.now()}.png`;
    await printService.downloadImage(targetUrl, filename);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    const targetUrl = currentActiveUrl;
    await printService.printImage(
      targetUrl,
      `PhotoXinhh Print - ${currentPaper.name}`,
      undefined,
      selectedPaperSize
    );
    setIsPrinting(false);
  };

  const handlePrintSPL = async () => {
    setIsPrinting(true);
    setBtStatusMsg(`Đang chuẩn bị khổ ${currentPaper.shortName} (${currentPaper.widthPx}x${currentPaper.heightPx} px)...`);
    const targetUrl = currentActiveUrl;
    await printService.printImage(
      targetUrl,
      `Dải Ảnh Canon SELPHY CP1500 (${currentPaper.shortName})`,
      undefined,
      selectedPaperSize
    );
    setIsPrinting(false);
    setBtStatusMsg(`✓ Đã gửi lệnh in khổ ${currentPaper.shortName}! Kiểm tra khay giấy máy in.`);
    setTimeout(() => setBtStatusMsg(null), 5000);
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
    setBtStatusMsg(`Đang gửi ảnh sang [${targetPhone.name}]...`);
    await bluetoothService.sendStripToPhone(targetPhone.id, currentActiveUrl);
    setBtStatusMsg(`Đã gửi thành công sang ${targetPhone.name}!`);
    setTimeout(() => setBtStatusMsg(null), 3000);
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
    setTimeout(() => setBtStatusMsg(null), 3000);
  };

  const handleOpenLightbox = () => {
    setIsLightboxOpen(true);
  };

  return (
    <>
      {/* MAIN EXPORT MODAL */}
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl border border-pink-100/90 flex flex-col max-h-[94vh]">
          
          {/* Top Header */}
          <div className="px-5 py-3 bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-amber-300">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold font-cute leading-tight flex items-center gap-1.5">
                  <span>Ảnh Đã Sẵn Sàng</span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md font-sans font-semibold tracking-wide">
                    {currentPaper.widthPx}x{currentPaper.heightPx} px (300 DPI)
                  </span>
                </h2>
                <p className="text-[11px] text-pink-100 hidden sm:block">
                  Đã tinh chỉnh kích thước chuẩn cho Canon SELPHY CP1500 & các dòng máy in ảnh
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
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-white/90 hover:text-white bg-white/10 hover:bg-white/20 active:bg-white/30 transition-all cursor-pointer shadow-xs active:scale-95"
              title="Đóng (Esc)"
              aria-label="Đóng"
            >
              <X className="w-5 h-5 stroke-[2.2]" />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col md:flex-row gap-5 items-stretch justify-between">
            
            {/* Left: Strip Preview & Paper Controls */}
            <div className="flex-1 flex flex-col items-center justify-between bg-gray-50/80 p-3 sm:p-4 rounded-2xl border border-gray-100">
              
              {/* Image Preview Container with Click-to-Zoom */}
              <div
                onClick={handleOpenLightbox}
                className="group relative cursor-zoom-in max-h-[330px] flex items-center justify-center rounded-2xl overflow-hidden bg-white p-2.5 shadow-xs border-2 border-gray-200/90 hover:border-pink-300 hover:shadow-lg transition-all"
                title="Nhấn để phóng to ảnh xem chi tiết nét 300 DPI"
              >
                {currentActiveUrl ? (
                  <img
                    src={currentActiveUrl}
                    alt="Photobooth Strip Preview"
                    className="max-h-[300px] w-auto object-contain rounded-lg transition-transform duration-200 group-hover:scale-[1.01]"
                  />
                ) : (
                  <div className="w-40 h-72 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs font-medium">
                    Đang dựng ảnh...
                  </div>
                )}

                {/* Floating Expand Badge */}
                <div className="absolute bottom-3 right-3 bg-black/80 hover:bg-pink-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl backdrop-blur-md flex items-center gap-1.5 shadow-lg opacity-90 group-hover:opacity-100 transition-all cursor-pointer hover:scale-105 active:scale-95">
                  <Maximize2 className="w-3.5 h-3.5 text-pink-300" />
                  <span>Phóng to</span>
                </div>
              </div>

              {/* Quick Zoom Bar Button */}
              <button
                type="button"
                onClick={handleOpenLightbox}
                className="mt-2.5 w-full py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-98 cursor-pointer shadow-2xs hover:shadow-xs"
                title="Nhấn để mở toàn màn hình xem ảnh chất lượng cao 300 DPI"
              >
                <Maximize2 className="w-3.5 h-3.5 text-purple-600" />
                <span>🔍 Mở Toàn Màn Hình (Zoom & Kéo Xem Chi Tiết)</span>
              </button>

              {/* Layout Switch Tabs */}
              <div className="w-full flex items-center justify-between gap-2 mt-3">
                <div className="flex items-center gap-1 bg-gray-200/70 p-1 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setPrintLayout('double')}
                    className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 text-xs ${
                      printLayout === 'double'
                        ? 'bg-white text-pink-600 shadow-2xs font-bold'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    <span>Dải Đôi (Cắt 2 dải)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintLayout('single')}
                    className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 text-xs ${
                      printLayout === 'single'
                        ? 'bg-white text-pink-600 shadow-2xs font-bold'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    <span>Dải Đơn (1 dải)</span>
                  </button>
                </div>

                {/* Safe Bleed Protection Toggle */}
                <button
                  type="button"
                  onClick={() => setSafeBleed(!safeBleed)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    safeBleed
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs font-bold'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  title="Chống máy in phóng to tràn viền xén mất chữ và logo"
                >
                  <ShieldCheck className={`w-3.5 h-3.5 ${safeBleed ? 'text-emerald-600' : 'text-gray-400'}`} />
                  <span>{safeBleed ? '🛡️ Lề An Toàn: BẬT' : '🛡️ Lề An Toàn: TẮT'}</span>
                </button>
              </div>

              {/* Paper Selector Section */}
              <div className="w-full mt-3 bg-white p-2.5 rounded-xl border border-gray-200/80 shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-pink-500" />
                    <span>Cỡ Ảnh Giấy In:</span>
                  </span>
                  <span className="text-[11px] text-pink-600 font-bold bg-pink-50 px-2 py-0.5 rounded-md">
                    {currentPaper.widthMm} x {currentPaper.heightMm} mm ({currentPaper.widthPx}x{currentPaper.heightPx} px)
                  </span>
                </div>

                {/* Paper Size Option Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {Object.values(PAPER_SIZES).map((paper) => {
                    const isSelected = selectedPaperSize === paper.id;
                    const isCanonPrimary = paper.id === 'canon-cp1500-postcard';
                    return (
                      <button
                        key={paper.id}
                        type="button"
                        onClick={() => handlePaperSizeChange(paper.id)}
                        className={`text-left p-1.5 rounded-lg border text-xs transition-all relative ${
                          isSelected
                            ? 'border-pink-500 bg-pink-50/80 text-pink-900 shadow-2xs font-bold'
                            : 'border-gray-200 hover:border-pink-300 bg-white text-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate font-semibold text-[11px]">{paper.shortName}</span>
                          {isCanonPrimary && (
                            <span className="text-[9px] bg-red-500 text-white font-bold px-1 rounded-sm shrink-0 ml-1">
                              CP1500
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate mt-0.5">
                          {paper.widthPx}×{paper.heightPx} px • {paper.widthMm}×{paper.heightMm}mm
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Notice text for Canon CP1500 and Mac AirPrint */}
                <div className="mt-2 space-y-1.5">
                  <div className="p-1.5 bg-amber-50/70 border border-amber-200/60 rounded-lg text-[10px] text-amber-800 flex items-start gap-1">
                    <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Khổ chuẩn Canon CP1500:</strong> Khay bưu thiếp KP-108IN/RP-108 có kích thước vật lý chính xác là <strong>100 x 148 mm (1181 x 1748 px @ 300 DPI)</strong>. Bật "Lề an toàn" giúp ảnh in tràn viền không bao giờ bị xén mất chữ footer hay logo!
                    </div>
                  </div>

                  <div className="p-1.5 bg-rose-50 border border-rose-200 rounded-lg text-[10px] text-rose-800 flex items-start gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Lưu ý in trên macOS:</strong> Trong hộp thoại in của Mac, mục <strong>"Khổ giấy Đích" (Destination Paper Size)</strong> cần chọn đúng <strong>Postcard (100 x 148 mm)</strong> hoặc <strong>Bưu thiếp</strong>. Không để mặc định A4 (210 x 297 mm) vì sẽ bị in lệch chỉ ra góc dưới bên trái!
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Right: Actions, Download & QR */}
            <div className="w-full md:w-64 flex flex-col items-center gap-2.5 text-center shrink-0 justify-between">
              
              {/* Success notice */}
              <div className="w-full py-1.5 px-3 bg-emerald-50 border border-emerald-200/80 rounded-xl flex items-center gap-1.5 text-emerald-800 text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">Sẵn sàng in chuẩn 300 DPI!</span>
              </div>

              {/* QR Code Container */}
              <div className="p-2.5 bg-pink-50/40 border border-pink-100 rounded-2xl flex flex-col items-center w-full">
                <div className="bg-white p-1.5 rounded-xl shadow-2xs border border-pink-100">
                  <QRCodeSVG value={shareUrl} size={90} level="M" />
                </div>
                <span className="text-xs font-bold text-pink-700 mt-1.5">Quét QR tải ảnh</span>
                <span className="text-[10px] text-gray-400">bằng camera điện thoại</span>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="mt-1 text-[11px] text-pink-600 hover:text-pink-700 font-medium flex items-center gap-1 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Share2 className="w-3 h-3" />}
                  <span>{copiedLink ? 'Đã sao chép link' : 'Sao chép link'}</span>
                </button>
              </div>

              {btStatusMsg && (
                <div className="w-full py-1.5 px-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-medium text-center animate-in fade-in">
                  {btStatusMsg}
                </div>
              )}

              {/* Action Buttons */}
              <div className="w-full flex flex-col gap-2">
                {/* Save / Download */}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xs shadow-xs transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSaved ? <Check className="w-3.5 h-3.5 text-amber-300" /> : <Download className="w-3.5 h-3.5" />}
                  <span>{isSaved ? '✓ Đã Lưu Vào Máy' : 'Lưu Ảnh Về Máy (300 DPI)'}</span>
                </button>

                {/* In Qua App SELPHY (SPL) Button */}
                <button
                  type="button"
                  onClick={handlePrintSPL}
                  disabled={isPrinting}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 hover:from-red-700 hover:to-rose-700 text-white font-bold text-xs shadow-md transition-all active:scale-98 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-amber-200" />
                  <span>In Canon SELPHY ({currentPaper.shortName})</span>
                </button>

                {/* Print Button (AirPrint / System) */}
                <div>
                  <button
                    type="button"
                    onClick={handlePrint}
                    disabled={isPrinting}
                    className="w-full py-2 px-3 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-xs shadow-2xs transition-all active:scale-98 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-pink-400" />
                    <span>{isPrinting ? 'Đang gửi lệnh in...' : 'In AirPrint / Trực Tiếp'}</span>
                  </button>
                  <p className="text-[10px] text-gray-500 mt-1 leading-tight text-center">
                    💡 Trên Mac: Hãy chọn <strong>Khổ giấy Đích</strong> là <strong>Postcard (100x148mm)</strong>
                  </p>
                </div>

                {/* Bluetooth Actions */}
                <button
                  type="button"
                  onClick={handleSendBluetooth}
                  className="w-full py-1.5 px-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] shadow-2xs transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Bluetooth className="w-3 h-3" />
                  <span>Bắn Sang ĐT (Bluetooth)</span>
                </button>

                {connectedDevices.some((d) => d.type === 'printer') && (
                  <button
                    type="button"
                    onClick={handlePrintBluetooth}
                    className="w-full py-1.5 px-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-[11px] shadow-2xs transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3 h-3" />
                    <span>In Máy In Bluetooth</span>
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* Bottom Navigation */}
          <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl bg-white hover:bg-pink-50 text-gray-700 hover:text-pink-700 border border-gray-200 hover:border-pink-300 font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5 text-pink-500" />
              <span>Về Trang Chủ</span>
            </button>

            {onStartNewShoot && (
              <button
                type="button"
                onClick={onStartNewShoot}
                className="py-2 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 hover:from-purple-700 hover:to-rose-600 text-white font-bold text-xs shadow-xs transition-all hover:scale-102 active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-amber-300" />
                <span>Chụp Bộ Mới</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* FULLSCREEN LIGHTBOX / ZOOM VIEWER */}
      <ImageLightboxModal
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        imageUrl={currentActiveUrl}
        title={`Dải Ảnh ${currentPaper.name}`}
        subtitle={`${currentPaper.widthPx}x${currentPaper.heightPx} px @ 300 DPI`}
        isSaved={isSaved}
        isPrinting={isPrinting}
        onDownload={handleDownload}
        onPrint={handlePrint}
      />
    </>
  );
};
