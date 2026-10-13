import { safeGetItem, safeSetItem } from '../utils/safeStorage';

export type PaperSizeId =
  | 'canon-cp1500-postcard'       // 100 x 148 mm (1181 x 1748 px) - Chuẩn Canon SELPHY CP1500/CP1300/CP1200
  | 'canon-cp1500-postcard-safe'  // 100 x 148 mm (1181 x 1748 px) + Bù lề an toàn 2.5% chống xén mép
  | 'standard-4x6'                // 101.6 x 152.4 mm (1200 x 1800 px) - Chuẩn US 4x6 / DNP / HiTi
  | 'canon-l-size'                // 89 x 119 mm (1051 x 1406 px) - Khổ L / 3R
  | 'canon-card'                  // 54 x 86 mm (638 x 1016 px) - Khổ thẻ Card / ATM
  | 'canon-square'                // 54 x 54 mm (638 x 638 px) - Khổ vuông Sticker
  | 'single-strip-2x6';           // 50 x 148 mm (590 x 1748 px) - Dải đơn Photobooth

export interface PaperSizeConfig {
  id: PaperSizeId;
  name: string;
  shortName: string;
  category: 'canon' | 'standard' | 'mini';
  widthMm: number;
  heightMm: number;
  widthPx: number; // Kích thước Pixel gốc ở 300 DPI
  heightPx: number;
  dpi: number;
  paperType: string;
  description: string;
  badge?: string;
  cssSize: string; // CSS @page size (ví dụ: '100mm 148mm' hoặc '4in 6in')
  microns: { width: number; height: number }; // Cho driver Electron / Hệ thống
  safeMarginPx?: number; // Đệm viền bù đắp overscan chống máy in xén mép
}

export const PAPER_SIZES: Record<PaperSizeId, PaperSizeConfig> = {
  'canon-cp1500-postcard': {
    id: 'canon-cp1500-postcard',
    name: 'Canon SELPHY Postcard (100 x 148 mm)',
    shortName: 'Canon CP1500 Chuẩn (10x14.8cm)',
    category: 'canon',
    widthMm: 100,
    heightMm: 148,
    widthPx: 1181,
    heightPx: 1748,
    dpi: 300,
    paperType: 'KP-108IN / RP-108 / KP-36IP',
    badge: 'Khuyên Dùng Cho CP1500',
    description: 'Khổ giấy chuẩn xác 100% của khay Canon SELPHY CP1500 (100x148 mm = 1181x1748 px @ 300 DPI). Tỷ lệ khớp hoàn hảo khay nạp.',
    cssSize: '100mm 148mm',
    microns: { width: 100000, height: 148000 },
  },
  'canon-cp1500-postcard-safe': {
    id: 'canon-cp1500-postcard-safe',
    name: 'Canon SELPHY + Bù Lề An Toàn (Chống xén chữ)',
    shortName: 'CP1500 Chống Cắt Mép (Safe Bleed)',
    category: 'canon',
    widthMm: 100,
    heightMm: 148,
    widthPx: 1181,
    heightPx: 1748,
    dpi: 300,
    paperType: 'KP-108IN / RP-108',
    badge: 'Chống Cắt Mép 100%',
    description: 'Chừa lề an toàn 2.5% (28px). Khi máy in tự phóng to tràn viền (overscan), chữ footer, logo và góc ảnh vẫn nguyên vẹn 100%!',
    cssSize: '100mm 148mm',
    microns: { width: 100000, height: 148000 },
    safeMarginPx: 28,
  },
  'standard-4x6': {
    id: 'standard-4x6',
    name: 'Khổ 4x6 inch Chuẩn Quốc Tế (101.6 x 152.4 mm)',
    shortName: 'Chuẩn 4x6 inch (US / DNP / HiTi)',
    category: 'standard',
    widthMm: 101.6,
    heightMm: 152.4,
    widthPx: 1200,
    heightPx: 1800,
    dpi: 300,
    paperType: 'DNP DS-RX1HS, HiTi P525L, Epson, Lab',
    badge: 'Chuẩn Quốc Tế',
    description: 'Khổ giấy 4x6 inch thực tế 1200 x 1800 px (tỷ lệ 1:1.5) dành cho máy in cuộn hoặc thợ lab chuyên nghiệp.',
    cssSize: '4in 6in',
    microns: { width: 101600, height: 152400 },
  },
  'canon-l-size': {
    id: 'canon-l-size',
    name: 'Canon SELPHY Khổ L / 3R (89 x 119 mm)',
    shortName: 'Khổ L / 3R (8.9 x 11.9 cm)',
    category: 'canon',
    widthMm: 89,
    heightMm: 119,
    widthPx: 1051,
    heightPx: 1406,
    dpi: 300,
    paperType: 'KL-36IP',
    badge: 'Khổ Bưu Ảnh 3R',
    description: 'Khổ ảnh bưu ảnh L-Size (3.5 x 4.7 inch) chuẩn Nhật Bản của dòng Canon SELPHY.',
    cssSize: '89mm 119mm',
    microns: { width: 89000, height: 119000 },
  },
  'canon-card': {
    id: 'canon-card',
    name: 'Canon SELPHY Thẻ Card Mini (54 x 86 mm)',
    shortName: 'Thẻ ATM / Mini Card (5.4 x 8.6 cm)',
    category: 'mini',
    widthMm: 54,
    heightMm: 86,
    widthPx: 638,
    heightPx: 1016,
    dpi: 300,
    paperType: 'KC-36IP / KC-18IF / KC-18IL',
    badge: 'Bỏ Ví Tiền / Polaroid',
    description: 'Khổ giấy thẻ ngân hàng, nhét vừa ví tiền hoặc ốp điện thoại, tỷ lệ tương đương ảnh Instax Mini.',
    cssSize: '54mm 86mm',
    microns: { width: 54000, height: 86000 },
  },
  'canon-square': {
    id: 'canon-square',
    name: 'Canon SELPHY Vuông Sticker (54 x 54 mm)',
    shortName: 'Vuông Sticker (5.4 x 5.4 cm)',
    category: 'mini',
    widthMm: 54,
    heightMm: 54,
    widthPx: 638,
    heightPx: 638,
    dpi: 300,
    paperType: 'KC-18IS Square Label',
    badge: 'Sticker Dán Điện Thoại',
    description: 'Giấy in nhãn dán vuông tỉ lệ 1:1, phù hợp in ảnh cặp đôi dán sau ốp lưng điện thoại.',
    cssSize: '54mm 54mm',
    microns: { width: 54000, height: 54000 },
  },
  'single-strip-2x6': {
    id: 'single-strip-2x6',
    name: 'Dải Đơn Photobooth 2x6 (50 x 148 mm)',
    shortName: 'Dải Đơn 1 Strip (5 x 14.8 cm)',
    category: 'standard',
    widthMm: 50,
    heightMm: 148,
    widthPx: 590,
    heightPx: 1748,
    dpi: 300,
    paperType: 'Dải cắt đơn',
    badge: 'Dải Đơn',
    description: 'Xuất 1 dải ảnh duy nhất cho máy in có dao chẻ tự động hoặc chia sẻ mạng xã hội.',
    cssSize: '50mm 148mm',
    microns: { width: 50000, height: 148000 },
  },
};

export interface PrintOptions {
  layout?: 'single-strip' | 'double-strip' | 'grid-card';
  copies?: number;
  paperSizeId?: PaperSizeId;
  safeBleed?: boolean;
}

export class PrintService {
  private selectedPrinter: string = '';
  private selectedPaperSize: PaperSizeId = 'canon-cp1500-postcard';

  constructor() {
    if (typeof localStorage !== 'undefined') {
      this.selectedPrinter = safeGetItem('px_selected_printer') || '';
      const savedPaper = safeGetItem('px_selected_paper_size') as PaperSizeId | null;
      if (savedPaper && PAPER_SIZES[savedPaper]) {
        this.selectedPaperSize = savedPaper;
      }
    }
  }

  setSelectedPrinter(printerName: string) {
    this.selectedPrinter = printerName;
    safeSetItem('px_selected_printer', printerName);
  }

  getSelectedPrinter(): string {
    return this.selectedPrinter;
  }

  setSelectedPaperSize(paperSizeId: PaperSizeId) {
    if (PAPER_SIZES[paperSizeId]) {
      this.selectedPaperSize = paperSizeId;
      safeSetItem('px_selected_paper_size', paperSizeId);
    }
  }

  getSelectedPaperSize(): PaperSizeId {
    return this.selectedPaperSize;
  }

  getPaperSizeConfig(paperSizeId?: PaperSizeId): PaperSizeConfig {
    const id = paperSizeId || this.selectedPaperSize;
    return PAPER_SIZES[id] || PAPER_SIZES['canon-cp1500-postcard'];
  }

  getAvailablePaperSizes(): PaperSizeConfig[] {
    return Object.values(PAPER_SIZES);
  }

  /**
   * Generates a high-res printable canvas tailored precisely to the chosen paper size
   * (Canon CP1500 Postcard 1181x1748, Safe Bleed, Standard 4x6 1200x1800, L-Size, Card, etc.)
   */
  async createPrintCanvas(
    singleStripDataUrl: string,
    paperSizeId: PaperSizeId = this.selectedPaperSize,
    options?: {
      layout?: 'single' | 'double' | 'card';
      safeBleed?: boolean;
    }
  ): Promise<string> {
    return new Promise((resolve) => {
      if (!singleStripDataUrl) {
        resolve('');
        return;
      }

      const paper = this.getPaperSizeConfig(paperSizeId);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = paper.widthPx;
        canvas.height = paper.heightPx;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(singleStripDataUrl);
          return;
        }

        // 1. Fill clean pure white paper background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const stripAspect = img.width / (img.height || 1);
        const shouldApplySafeBleed =
          options?.safeBleed !== undefined
            ? options.safeBleed
            : paper.id === 'canon-cp1500-postcard-safe' || Boolean(paper.safeMarginPx);

        const safeMargin = shouldApplySafeBleed ? (paper.safeMarginPx || 28) : 0;
        
        // Determine layout: double strip (2 side-by-side) or single/card
        const defaultLayout =
          paper.id === 'single-strip-2x6'
            ? 'single'
            : stripAspect <= 0.45
            ? 'double'
            : 'card';
        const layout = options?.layout || defaultLayout;

        if (layout === 'double') {
          // Double Strip: Fit 2 identical strips side-by-side with optional center cut line
          const colW = canvas.width / 2;
          const colH = canvas.height;

          const availW = colW - safeMargin * 2;
          const availH = colH - safeMargin * 2;

          let drawW = availW;
          let drawH = availW / stripAspect;

          if (drawH > availH) {
            drawH = availH;
            drawW = availH * stripAspect;
          }

          const offsetY = safeMargin + (availH - drawH) / 2;
          const offsetX1 = safeMargin + (availW - drawW) / 2;
          const offsetX2 = colW + safeMargin + (availW - drawW) / 2;

          // Draw Left Strip
          ctx.drawImage(img, offsetX1, offsetY, drawW, drawH);

          // Draw Right Strip
          ctx.drawImage(img, offsetX2, offsetY, drawW, drawH);

          // Draw dotted cut mark line down the middle
          ctx.save();
          ctx.strokeStyle = '#D1D5DB';
          ctx.setLineDash([8, 8]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(colW, Math.max(safeMargin, 24));
          ctx.lineTo(colW, canvas.height - Math.max(safeMargin, 24));
          ctx.stroke();

          // Subtle scissors indicator at top and bottom of cut line
          ctx.fillStyle = '#9CA3AF';
          ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✂', colW, Math.max(12, safeMargin / 2));
          ctx.fillText('✂', colW, canvas.height - Math.max(12, safeMargin / 2));
          ctx.restore();
        } else {
          // Single Strip or Card / Grid: Centered on the paper
          const availW = canvas.width - safeMargin * 2;
          const availH = canvas.height - safeMargin * 2;

          let drawW = availW;
          let drawH = availW / stripAspect;

          if (drawH > availH) {
            drawH = availH;
            drawW = availH * stripAspect;
          }

          const ox = safeMargin + (availW - drawW) / 2;
          const oy = safeMargin + (availH - drawH) / 2;

          ctx.drawImage(img, ox, oy, drawW, drawH);
        }

        resolve(canvas.toDataURL('image/jpeg', 0.98));
      };

      img.onerror = () => resolve(singleStripDataUrl);
      img.src = singleStripDataUrl;
    });
  }

  /**
   * Backward-compatible alias for createDoubleStripCanvas
   * Defaulted to Canon SELPHY CP1500 Postcard size (100x148mm = 1181x1748px)
   */
  async createDoubleStripCanvas(
    singleStripDataUrl: string,
    paperSizeId: PaperSizeId = this.selectedPaperSize,
    safeBleed = true
  ): Promise<string> {
    return this.createPrintCanvas(singleStripDataUrl, paperSizeId, {
      layout: 'double',
      safeBleed,
    });
  }

  /**
   * Triggers browser print or Electron Silent Print with exact paper size metrics
   */
  async printImage(
    dataUrl: string,
    title = 'Photobooth Strip',
    customPrinterName?: string,
    paperSizeId: PaperSizeId = this.selectedPaperSize
  ): Promise<boolean> {
    const targetPrinter = customPrinterName || this.selectedPrinter;
    const paper = this.getPaperSizeConfig(paperSizeId);

    // 1. Check if running inside Electron wrapper for Instant Silent Print
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.silentPrint === 'function') {
      try {
        const result = await window.electronAPI.silentPrint({
          dataUrl,
          printerName: targetPrinter || undefined,
          silent: true,
          copies: 1,
          pageSize: paper.microns,
          cssPageSize: paper.cssSize,
        });
        if (result && result.success) {
          return true;
        }
        console.warn('Electron silent print notice:', result?.error);
      } catch (err) {
        console.error('Electron print error:', err);
      }
    }

    // 2. Native iOS / iPadOS AirPrint Trigger (via Native Share & AirPrint Sheet)
    const isIOS =
      typeof navigator !== 'undefined' &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    const isCapacitor = typeof window !== 'undefined' && Boolean((window as unknown as { Capacitor?: unknown }).Capacitor);

    if ((isIOS || isCapacitor) && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
      try {
        const blob = this.dataUrlToBlob(dataUrl);
        const file = new File([blob], `photoxinhh_${paper.id}_${Date.now()}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: title || `In Ảnh Photobooth (${paper.shortName})`,
            text: `Khổ in: ${paper.name}. Chọn "In (Print)" để in ảnh ra máy in AirPrint`,
          });
          return true;
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return true; // User dismissed sheet
        }
        console.warn('Native iOS share print fallback to web print:', err);
      }
    }

    // 3. Universal Web & Desktop Print Engine via Clean Isolated Iframe
    return new Promise<boolean>((resolve) => {
      try {
        // Clean up previous print iframe if any
        const oldIframe = document.getElementById('px-print-iframe');
        if (oldIframe && oldIframe.parentNode) {
          oldIframe.parentNode.removeChild(oldIframe);
        }

        const iframe = document.createElement('iframe');
        iframe.id = 'px-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.top = '-9999px';
        iframe.style.left = '-9999px';
        iframe.style.width = '100mm';
        iframe.style.height = '148mm';
        iframe.style.border = 'none';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) {
          window.print();
          resolve(true);
          return;
        }

        iframeDoc.open();
        iframeDoc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8" />
            <title>${title}</title>
            <style>
              @page {
                size: ${paper.cssSize};
                margin: 0mm;
              }
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
              html, body {
                width: 100%;
                height: 100%;
                margin: 0 !important;
                padding: 0 !important;
                background: #FFFFFF !important;
                overflow: hidden !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .page-container {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                page-break-inside: avoid;
                break-inside: avoid;
              }
              img {
                width: 100%;
                height: 100%;
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                display: block;
                page-break-inside: avoid;
                break-inside: avoid;
              }
            </style>
          </head>
          <body>
            <div class="page-container">
              <img id="print-target-img" src="${dataUrl}" alt="${title}" />
            </div>
          </body>
          </html>
        `);
        iframeDoc.close();

        const imgEl = iframeDoc.getElementById('print-target-img') as HTMLImageElement | null;
        const executePrint = () => {
          setTimeout(() => {
            try {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
              resolve(true);
            } catch (err) {
              console.warn('iframe print notice, fallback to window.print:', err);
              window.print();
              resolve(true);
            } finally {
              setTimeout(() => {
                if (iframe.parentNode) {
                  iframe.parentNode.removeChild(iframe);
                }
              }, 6000);
            }
          }, 300);
        };

        if (imgEl) {
          if (imgEl.complete) {
            executePrint();
          } else {
            imgEl.onload = executePrint;
            imgEl.onerror = executePrint;
          }
        } else {
          executePrint();
        }
      } catch (err) {
        console.error('Print engine error:', err);
        window.print();
        resolve(false);
      }
    });
  }

  /**
   * Converts base64 dataURL to Blob reliably across all iOS/Safari/Android/Desktop environments
   */
  dataUrlToBlob(dataUrl: string): Blob {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  /**
   * Reliably saves or downloads photo strip without opening blank white tabs
   */
  async downloadImage(dataUrl: string, filename = 'photoxinhh_strip.png'): Promise<boolean> {
    try {
      const blob = this.dataUrlToBlob(dataUrl);
      const isIOS =
        typeof navigator !== 'undefined' &&
        (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
      const isCapacitor = typeof window !== 'undefined' && Boolean((window as unknown as { Capacitor?: unknown }).Capacitor);

      // 1. Native Web Share API (Save directly to Camera Roll on iOS/iPadOS/Capacitor)
      if ((isIOS || isCapacitor) && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
        try {
          const file = new File([blob], filename, { type: blob.type || 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'PhotoXinhh Strip',
              text: 'Dải ảnh Photobooth của bạn',
            });
            return true;
          }
        } catch (shareErr: unknown) {
          if (shareErr instanceof Error && shareErr.name === 'AbortError') {
            return true; // User dismissed share sheet
          }
          console.warn('Native share error on iOS:', shareErr);
        }
      }

      // 2. Direct Anchor Click Download for Desktop & Non-Capacitor Browsers ONLY
      if (!isCapacitor) {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = blobUrl;
        link.target = '_self';
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
          URL.revokeObjectURL(blobUrl);
        }, 2000);

        return true;
      }

      return true;
    } catch (err) {
      console.warn('Fallback download notice:', err);
      return false;
    }
  }
}

export const printService = new PrintService();
