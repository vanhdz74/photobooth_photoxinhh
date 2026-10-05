export interface PrintOptions {
  layout: 'single-strip' | 'double-strip' | 'grid-card'; // double strip fits a standard 4x6 dye-sub paper (DNP/HiTi) with middle cut
  copies: number;
}

export class PrintService {
  /**
   * Generates a printable high-res 4x6 canvas containing two side-by-side 2x6 strips
   * (Standard industry format for DNP RX1HS, HiTi P525L, Citizen dye-sub printers)
   */
  async createDoubleStripCanvas(singleStripDataUrl: string): Promise<string> {
    return new Promise((resolve) => {
      if (!singleStripDataUrl) {
        resolve('');
        return;
      }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // 4x6 inches at 300 DPI = 1200 x 1800 px
        canvas.width = 1200;
        canvas.height = 1800;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(singleStripDataUrl);
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw left strip (0 to 600)
        ctx.drawImage(img, 0, 0, 600, 1800);

        // Draw right strip (600 to 1200)
        ctx.drawImage(img, 600, 0, 600, 1800);

        // Optional cut mark dotted line in center
        ctx.strokeStyle = '#D1D5DB';
        ctx.setLineDash([8, 8]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(600, 0);
        ctx.lineTo(600, 1800);
        ctx.stroke();

        resolve(canvas.toDataURL('image/jpeg', 0.98));
      };
      img.onerror = () => resolve(singleStripDataUrl);
      img.src = singleStripDataUrl;
    });
  }

  /**
   * Triggers browser print or Electron Silent Print
   */
  async printImage(dataUrl: string, title = 'Photobooth Strip') {
    // Check if running inside Electron wrapper
    if ((window as unknown as { electronAPI?: { print: (url: string) => Promise<boolean> } }).electronAPI) {
      try {
        await (window as unknown as { electronAPI: { print: (url: string) => Promise<boolean> } }).electronAPI.print(dataUrl);
        return true;
      } catch (err) {
        console.error('Electron print error:', err);
      }
    }

    // Web Print Pop-up with strict 4x6 / 2x6 print styling
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Vui lòng cho phép Pop-up trên trình duyệt để in ảnh!');
      return false;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            @page {
              size: 4in 6in;
              margin: 0;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              width: 100vw;
              height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            img {
              max-width: 100%;
              max-height: 100%;
              object-fit: contain;
              display: block;
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" onload="window.print(); setTimeout(() => window.close(), 500);" />
        </body>
      </html>
    `);
    printWindow.document.close();
    return true;
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
   * Reliably saves or downloads photo strip without opening blank white tabs on iOS/iPadOS/Capacitor
   */
  async downloadImage(dataUrl: string, filename = 'photoxinhh_strip.png'): Promise<boolean> {
    try {
      const blob = this.dataUrlToBlob(dataUrl);

      // 1. Native Web Share API (Save directly to Camera Roll on iOS/iPadOS if user accepts)
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
        try {
          const file = new File([blob], filename, { type: blob.type || 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'PhotoXinhh Strip',
              text: 'Dải ảnh Photobooth xinh xắn của bạn',
            });
            return true;
          }
        } catch (shareErr: unknown) {
          if (shareErr instanceof Error && shareErr.name === 'AbortError') {
            // User dismissed share sheet, continue to download link
          }
        }
      }

      // 2. Direct Anchor Click Download for Desktop & Mobile
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
    } catch (err) {
      console.warn('Fallback data URL download:', err);
      try {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => document.body.removeChild(link), 1000);
        return true;
      } catch {
        return false;
      }
    }
  }
}

export const printService = new PrintService();
