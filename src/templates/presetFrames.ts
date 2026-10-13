import { FrameTemplate } from '../types/photobooth';

// Preset standard 2-photo card vertical (4x6 inches layout: 1200px x 1800px base)
export const create2Cut4x6Slots = (
  width = 1200,
  height = 1800,
  topPad = 120,
  botPad = 160,
  margin = 50,
  sidePad = 90
) => {
  const availableHeight = height - topPad - botPad - margin;
  const slotHeight = availableHeight / 2;
  const slotWidth = width - (sidePad * 2);

  return [
    { id: 0, x: sidePad, y: topPad, width: slotWidth, height: slotHeight, borderRadius: 20 },
    { id: 1, x: sidePad, y: topPad + slotHeight + margin, width: slotWidth, height: slotHeight, borderRadius: 20 },
  ];
};

// Preset standard 3-photo strip vertical (2x6 inches layout: 600px x 1800px base)
export const create3CutSlots = (width: number, height: number, topPad = 140, botPad = 140, margin = 26, sidePad = 40) => {
  const availableHeight = height - topPad - botPad - (margin * 2);
  const slotHeight = availableHeight / 3;
  const slotWidth = width - (sidePad * 2);

  return [
    { id: 0, x: sidePad, y: topPad, width: slotWidth, height: slotHeight, borderRadius: 16 },
    { id: 1, x: sidePad, y: topPad + slotHeight + margin, width: slotWidth, height: slotHeight, borderRadius: 16 },
    { id: 2, x: sidePad, y: topPad + (slotHeight + margin) * 2, width: slotWidth, height: slotHeight, borderRadius: 16 },
  ];
};

// Preset standard 4-photo strip vertical (2x6 inches layout: 600px x 1800px base)
export const create4CutSlots = (width: number, height: number, topPad = 130, botPad = 130, margin = 20, sidePad = 40) => {
  const availableHeight = height - topPad - botPad - (margin * 3);
  const slotHeight = availableHeight / 4;
  const slotWidth = width - (sidePad * 2);

  return [
    { id: 0, x: sidePad, y: topPad, width: slotWidth, height: slotHeight, borderRadius: 14 },
    { id: 1, x: sidePad, y: topPad + slotHeight + margin, width: slotWidth, height: slotHeight, borderRadius: 14 },
    { id: 2, x: sidePad, y: topPad + (slotHeight + margin) * 2, width: slotWidth, height: slotHeight, borderRadius: 14 },
    { id: 3, x: sidePad, y: topPad + (slotHeight + margin) * 3, width: slotWidth, height: slotHeight, borderRadius: 14 },
  ];
};

// Preset 6-photo grid (2 columns x 3 rows on 4x6 inch card: 1200x1800)
export const create6CutSlots = (width: number, height: number) => {
  const margin = 24;
  const topPad = 150;
  const sidePad = 40;
  const slotWidth = (width - sidePad * 2 - margin) / 2;
  const slotHeight = (height - topPad - 150 - margin * 2) / 3;

  const slots = [];
  let id = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      slots.push({
        id: id++,
        x: sidePad + c * (slotWidth + margin),
        y: topPad + r * (slotHeight + margin),
        width: slotWidth,
        height: slotHeight,
        borderRadius: 16,
      });
    }
  }
  return slots;
};

// Helper to create a pristine, clean pure WHITE frame for new creations
export const createDefaultBlankFrame = (index = 1, slotCount: 2 | 3 | 4 | 6 = 4): FrameTemplate => {
  const is2Cut = slotCount === 2;
  const is3Cut = slotCount === 3;
  const is6Cut = slotCount === 6;
  const is4x6 = is2Cut || is6Cut;
  const width = is4x6 ? 1200 : 600;
  const height = 1800;
  const aspectRatio = is4x6 ? '4x6' : '2x6';
  const slots = is2Cut
    ? create2Cut4x6Slots(1200, 1800)
    : is6Cut
    ? create6CutSlots(1200, 1800)
    : is3Cut
    ? create3CutSlots(600, 1800, 140, 140, 26, 38)
    : create4CutSlots(600, 1800, 120, 120, 22, 38);

  return {
    id: `custom-${Date.now()}`,
    name: is2Cut
      ? `Khung 2 Ảnh 4x6 Trắng ${index}`
      : is3Cut
      ? `Khung 3 Ảnh Trắng ${index}`
      : is6Cut
      ? `Khung 6 Ô Trắng ${index}`
      : `Khung Trắng Mới ${index}`,
    category: 'custom',
    aspectRatio,
    slotCount,
    width,
    height,
    backgroundColor: '#FFFFFF',
    backgroundGradient: undefined,
    backgroundImage: undefined,
    overlayImageUrl: undefined,
    themeColor: '#1F2937',
    slotBorderColor: '#FFFFFF',
    slotBorderWidth: 0,
    slotBorderStyle: 'solid',
    pattern: 'none',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    headerText: undefined,
    footerText: is2Cut ? 'DUO MOMENT 4x6 • 2026' : is3Cut ? 'HARU 3-CUT • 2026' : 'PHOTO XINHH • 2026',
    slots,
    isCustom: true,
    stickers: [],
    updatedAt: Date.now(),
  };
};

// Filtered, pristine collection of top-tier preset frames
export const PRESET_FRAMES: FrameTemplate[] = [
  {
    id: 'minimal-2cut-white',
    name: 'Seoul Minimal White (2 Ảnh 4x6)',
    category: 'minimal',
    aspectRatio: '4x6',
    slotCount: 2,
    width: 1200,
    height: 1800,
    backgroundColor: '#FFFFFF',
    themeColor: '#1F2937',
    headerText: 'PHOTOISM • DUO CARD 4x6',
    footerText: 'MEMORIES TOGETHER • 2026',
    slots: create2Cut4x6Slots(1200, 1800),
  },
  {
    id: 'minimal-2cut-black',
    name: 'Seoul Minimal Black (2 Ảnh 4x6)',
    category: 'minimal',
    aspectRatio: '4x6',
    slotCount: 2,
    width: 1200,
    height: 1800,
    backgroundColor: '#0F172A',
    themeColor: '#F8FAFC',
    headerText: 'HARU FILM • DUO BLACK 4x6',
    footerText: 'AUTHENTIC MOMENTS • 2026',
    slots: create2Cut4x6Slots(1200, 1800),
  },
  {
    id: 'pastel-2cut-sweet',
    name: 'Pastel Dream (2 Ảnh 4x6)',
    category: 'cute',
    aspectRatio: '4x6',
    slotCount: 2,
    width: 1200,
    height: 1800,
    backgroundColor: '#FFF1F2',
    backgroundGradient: 'linear-gradient(180deg, #FFF1F2 0%, #FFE4E6 50%, #FCE7F3 100%)',
    themeColor: '#E11D48',
    headerText: '♡ SWEET DUO MOMENT ♡',
    footerText: 'BEST MEMORIES WITH YOU • 2026',
    slots: create2Cut4x6Slots(1200, 1800),
  },
  {
    id: 'film-2cut-vintage',
    name: '35mm Film Noir (2 Ảnh 4x6)',
    category: 'film',
    aspectRatio: '4x6',
    slotCount: 2,
    width: 1200,
    height: 1800,
    backgroundColor: '#18181B',
    themeColor: '#F59E0B',
    headerText: '▪ KODAK PORTRA 400 ▪ 4x6 DUO',
    footerText: '35MM EXP 12 • TWIN POSTCARD',
    pattern: 'film',
    slots: create2Cut4x6Slots(1200, 1800),
  },
  {
    id: 'minimal-korean-white',
    name: 'Seoul Minimal White (4 Ảnh Dọc)',
    category: 'minimal',
    aspectRatio: '2x6',
    slotCount: 4,
    width: 600,
    height: 1800,
    backgroundColor: '#FFFFFF',
    themeColor: '#1F2937',
    headerText: 'HARU FILM • 하루필름',
    footerText: 'DAILY MOMENT • 2026',
    slots: create4CutSlots(600, 1800, 120, 120, 22, 38),
  },
  {
    id: 'minimal-3cut-white',
    name: 'Seoul Minimal White (3 Ảnh Dọc)',
    category: 'minimal',
    aspectRatio: '2x6',
    slotCount: 3,
    width: 600,
    height: 1800,
    backgroundColor: '#FFFFFF',
    themeColor: '#1F2937',
    headerText: 'HARU FILM • 하루필름',
    footerText: '3-CUT STRIP • 2026',
    slots: create3CutSlots(600, 1800, 140, 140, 26, 38),
  },
  {
    id: 'minimal-3cut-black',
    name: 'Seoul Minimal Black (3 Ảnh Dọc)',
    category: 'minimal',
    aspectRatio: '2x6',
    slotCount: 3,
    width: 600,
    height: 1800,
    backgroundColor: '#0F172A',
    themeColor: '#F8FAFC',
    headerText: 'PHOTOISM • 3-CUT',
    footerText: 'AUTHENTIC MOMENTS • 2026',
    slots: create3CutSlots(600, 1800, 140, 140, 26, 38),
  },
  {
    id: 'pastel-3cut-sweet',
    name: 'Pastel Dream (3 Ảnh Dọc)',
    category: 'cute',
    aspectRatio: '2x6',
    slotCount: 3,
    width: 600,
    height: 1800,
    backgroundColor: '#FFF1F2',
    backgroundGradient: 'linear-gradient(180deg, #FFF1F2 0%, #FFE4E6 50%, #FCE7F3 100%)',
    themeColor: '#E11D48',
    headerText: '♡ SWEET MEMORIES ♡',
    footerText: '3-CUT SPECIAL • 2026',
    slots: create3CutSlots(600, 1800, 140, 140, 26, 38),
  },
  {
    id: 'classic-film-3cut',
    name: '35mm Film Noir (3 Ảnh Dọc)',
    category: 'film',
    aspectRatio: '2x6',
    slotCount: 3,
    width: 600,
    height: 1800,
    backgroundColor: '#18181B',
    themeColor: '#F59E0B',
    headerText: '▪ KODAK PORTRA 400 ▪ 3-CUT',
    footerText: '35MM EXP 36 • 3-FRAME STRIP',
    pattern: 'film',
    slots: create3CutSlots(600, 1800, 140, 140, 28, 44),
  },
  {
    id: 'zootopia-disney',
    name: 'Zootopia Disney+',
    category: 'popular',
    aspectRatio: '2x6',
    slotCount: 4,
    width: 600,
    height: 1800,
    backgroundColor: '#84CC16',
    backgroundGradient: 'linear-gradient(180deg, #E0F2FE 0%, #BAE6FD 50%, #84CC16 100%)',
    backgroundImage: undefined,
    overlayImageUrl: '/frames/zootopia_overlay.png?v=clean3',
    themeColor: '#15803D',
    slots: [
      { id: 0, x: 36, y: 50, width: 528, height: 375, borderRadius: 24 },
      { id: 1, x: 36, y: 465, width: 528, height: 375, borderRadius: 24 },
      { id: 2, x: 36, y: 880, width: 528, height: 375, borderRadius: 24 },
      { id: 3, x: 36, y: 1295, width: 528, height: 375, borderRadius: 24 },
    ],
  },
  {
    id: 'minimal-korean-black',
    name: 'Seoul Minimal Black',
    category: 'minimal',
    aspectRatio: '2x6',
    slotCount: 4,
    width: 600,
    height: 1800,
    backgroundColor: '#0F172A',
    themeColor: '#F8FAFC',
    headerText: 'PHOTOISM • 포토이즘',
    footerText: 'AUTHENTIC MOMENTS • 2026',
    slots: create4CutSlots(600, 1800, 120, 120, 22, 38),
  },
  {
    id: 'star1',
    name: 'Pink Star Y2K',
    category: 'cute',
    aspectRatio: '2x6',
    slotCount: 4,
    width: 600,
    height: 1800,
    backgroundColor: '#FF69B4',
    backgroundGradient: 'linear-gradient(180deg, #FF69B4 0%, #FF1493 50%, #FF69B4 100%)',
    themeColor: '#FF69B4',
    headerText: '★ LIFE4CUTS ★',
    footerText: '2026.10.05 ★ SWEET MEMORIES',
    slots: create4CutSlots(600, 1800, 130, 130, 24, 40),
  },
  {
    id: 'classic-film',
    name: '35mm Film Noir',
    category: 'film',
    aspectRatio: '2x6',
    slotCount: 4,
    width: 600,
    height: 1800,
    backgroundColor: '#18181B',
    themeColor: '#F59E0B',
    headerText: '▪ KODAK PORTRA 400 ▪ ISO 400',
    footerText: '35MM EXP 24 • FRAME 04A',
    pattern: 'film',
    slots: create4CutSlots(600, 1800, 130, 130, 26, 44),
  },
  {
    id: 'grid-6-cute',
    name: 'Pastel 6-Grid Card',
    category: 'popular',
    aspectRatio: '4x6',
    slotCount: 6,
    width: 1200,
    height: 1800,
    backgroundColor: '#FFF1F2',
    backgroundGradient: 'linear-gradient(180deg, #FFF1F2 0%, #FFE4E6 100%)',
    themeColor: '#E11D48',
    headerText: '✦ PHOTO BOOTH SPECIAL EDITION ✦',
    footerText: 'THANK YOU FOR YOUR SMILE ♡ 2026',
    slots: create6CutSlots(1200, 1800),
  },
];

export const CATEGORIES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'popular', label: '🔥 Phổ biến' },
  { id: 'minimal', label: '🤍 Tối giản' },
  { id: 'cute', label: '🎀 Y2K & Cute' },
  { id: 'film', label: '🎞️ Film' },
  { id: 'custom', label: '⭐ Khung của bạn' }
];

export const PHOTO_FILTERS = [
  { id: 'none', name: 'Gốc', css: 'none' },
  { id: 'korean-bright', name: 'Trắng hồng', css: 'brightness(1.08) contrast(1.05) saturate(1.15)' },
  { id: 'vintage', name: 'Vintage', css: 'sepia(0.35) contrast(1.1) brightness(0.95)' },
  { id: 'bw', name: 'Trắng đen', css: 'grayscale(1) contrast(1.2)' },
  { id: 'warm', name: 'Ấm áp', css: 'sepia(0.2) saturate(1.3) hue-rotate(-10deg)' },
  { id: 'cool', name: 'Tone lạnh', css: 'saturate(0.9) hue-rotate(15deg) brightness(1.05)' },
  { id: 'soft-pastel', name: 'Pastel mơ màng', css: 'brightness(1.12) contrast(0.92) saturate(1.1)' }
];

export const STICKER_LIST = [
  '🎀', '⭐', '✨', '💖', '🍒', '🧸', '🐰', '🐾', 
  '🌷', '🎂', '🎉', '🦋', '🍀', '🍓', '🤍', '👑'
];
