import React, { useState, useEffect } from 'react';
import { Download, Share2, Sparkles, Check, ArrowLeft, Camera, Heart } from 'lucide-react';
import confetti from 'canvas-confetti';
import { printService } from '../services/printService';
import { safeGetStrip } from '../utils/safeStorage';

export const StripDownloadView: React.FC = () => {
  const [stripUrl, setStripUrl] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const stripId = urlParams.get('view_strip');

    let foundUrl: string | null = null;
    if (stripId) {
      foundUrl = safeGetStrip(`px_share_${stripId}`);
    }
    if (!foundUrl) {
      foundUrl = safeGetStrip('px_latest_strip');
    }

    if (foundUrl) {
      setStripUrl(foundUrl);
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch {}
    }
  }, []);

  const handleDownload = async () => {
    if (!stripUrl) return;
    setIsSaved(true);
    await printService.downloadImage(stripUrl, `photoxinhh_${Date.now()}.png`);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleShare = async () => {
    if (!stripUrl) return;
    try {
      const blob = await (await fetch(stripUrl)).blob();
      const file = new File([blob], 'photoxinhh_strip.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'PhotoXinhh Strip',
          text: 'Dải ảnh Photobooth xinh xắn của mình nè!',
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }
    } catch {
      await navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleBackToBooth = () => {
    window.location.href = window.location.origin;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-pink-50 flex flex-col items-center justify-center px-4 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-[max(env(safe-area-inset-bottom,0px),1rem)] text-gray-800">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-pink-200 overflow-hidden flex flex-col items-center p-5 sm:p-6 text-center animate-in fade-in zoom-in duration-300">
        {/* Header Badge */}
        <div className="flex items-center gap-2 text-pink-600 font-cute font-bold text-lg mb-1">
          <Sparkles className="w-5 h-5 text-pink-500 animate-spin" />
          <span>PhotoXinhh Photobooth</span>
          <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Dải ảnh kỉ niệm chất lượng cao của bạn đã sẵn sàng!
        </p>

        {/* Photo Strip Image Preview */}
        {stripUrl ? (
          <div className="relative p-2 bg-gradient-to-b from-pink-50 to-purple-50 rounded-2xl border border-pink-200 shadow-inner mb-5 max-h-[58vh] flex items-center justify-center">
            <img
              src={stripUrl}
              alt="Your Photobooth Strip"
              className="max-h-[54vh] rounded-xl object-contain shadow-md"
            />
          </div>
        ) : (
          <div className="w-full h-64 bg-gray-100 rounded-2xl flex flex-col items-center justify-center text-gray-400 mb-5 p-4">
            <Camera className="w-10 h-10 mb-2 text-gray-300" />
            <p className="text-xs">Không tìm thấy dải ảnh hoặc ảnh đã hết hạn.</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2.5">
          {stripUrl && (
            <>
              <button
                onClick={handleDownload}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-pink-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-sm sm:text-base shadow-lg shadow-pink-300 flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {isSaved ? <Check className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                <span>{isSaved ? 'Đã Tải / Lưu Thành Công!' : '📥 Tải & Lưu Ảnh Vào Máy'}</span>
              </button>

              <button
                onClick={handleShare}
                className="w-full py-3 px-6 rounded-2xl bg-pink-50 hover:bg-pink-100 text-pink-700 font-semibold text-xs sm:text-sm border border-pink-200 flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Share2 className="w-4 h-4" />
                <span>{isCopied ? 'Đã sao chép link ảnh!' : '📲 Chia sẻ qua AirDrop / Zalo / Facebook'}</span>
              </button>
            </>
          )}

          <button
            onClick={handleBackToBooth}
            className="w-full py-2.5 px-4 rounded-xl text-gray-500 hover:text-gray-800 text-xs font-medium flex items-center justify-center gap-1.5 transition-all mt-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Chụp bộ ảnh mới tại Booth</span>
          </button>
        </div>
      </div>

      <div className="mt-4 text-center text-gray-400 text-[11px]">
        PhotoXinhh • Kỷ niệm xinh lung linh từng khoảnh khắc ✨
      </div>
    </div>
  );
};
