export interface PhotoSlot {
  id: number;
  x: number; // percentage or px in coordinate system
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
  rotation?: number;
}

export interface FrameTemplate {
  id: string;
  name: string;
  category: 'popular' | 'cute' | 'film' | 'idol' | 'minimal' | 'custom' | 'event';
  aspectRatio: '2x6' | '4x6' | '1x1'; // 2x6 is vertical strip (Life4Cuts style), 4x6 is classic card/grid
  slotCount: number;
  width: number;  // Base canvas width (e.g. 600px for 2x6)
  height: number; // Base canvas height (e.g. 1800px for 2x6)
  slots: PhotoSlot[];
  backgroundColor: string;
  backgroundGradient?: string;
  backgroundImage?: string;
  overlaySvg?: string; // Custom SVG decorative frame
  overlayImageUrl?: string; // Custom transparent PNG frame
  headerText?: string;
  footerText?: string;
  themeColor: string;
  slotBorderColor?: string;
  slotBorderWidth?: number;
  slotBorderStyle?: 'solid' | 'dashed' | 'dotted' | 'double';
  pattern?: 'none' | 'dots' | 'grid' | 'stripes' | 'stars' | 'hearts' | 'flowers' | 'film';
  fontFamily?: string;
  slotGap?: number;
  topPadding?: number;
  bottomPadding?: number;
  sidePadding?: number;
  slotRadius?: number;
  isCustom?: boolean;
  stickers?: StickerItem[];
  updatedAt?: number;
}

export interface PhotoData {
  id: string;
  slotIndex: number;
  dataUrl: string;
  filter: string; // 'none' | 'bw' | 'vintage' | 'warm' | 'cool' | 'korean-bright' | 'sepia' | 'contrast'
  zoom: number; // 1.0 = fit, 1.5 = zoom in
  offsetX: number; // px shift
  offsetY: number; // px shift
  rotation: number; // degrees
  mirror: boolean;
}

export interface StickerItem {
  id: string;
  content: string; // emoji, text string, or base64 / image URL
  type: 'emoji' | 'text' | 'image';
  x: number;
  y: number;
  scale: number;
  rotation: number;
  fontFamily?: string;
  color?: string;
  width?: number;
  height?: number;
}

export interface CaptureConfig {
  countdownDuration: number; // 3, 5, 10
  totalShots: number; // 3, 4, 6
  flashEnabled: boolean;
  soundEnabled: boolean;
  cameraDeviceId: string;
  isMockCamera: boolean;
}

export type AppMode = 'booth' | 'editor' | 'custom-frame';
