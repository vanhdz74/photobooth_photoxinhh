import { FrameTemplate } from '../types/photobooth';

// Preset standard 4-photo strip vertical (2x6 inches layout: 600px x 1800px base)
const create4CutSlots = (width: number, height: number, topPad = 130, botPad = 130, margin = 20, sidePad = 40) => {
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
const create6CutSlots = (width: number, height: number) => {
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

// Filtered, pristine collection of top-tier preset frames
export const PRESET_FRAMES: FrameTemplate[] = [
  {
    id: 'zootopia-disney',
    name: 'Zootopia Disney+ (Mặc định)',
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
    id: 'minimal-korean-white',
    name: 'Seoul Minimal White',
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
