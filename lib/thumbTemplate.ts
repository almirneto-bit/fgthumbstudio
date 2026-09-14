export type ThumbPlatform = 'instagram' | 'tiktok';

export type ImageAdjustment = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type ThumbFields = {
  imageUrl: string | null;
  instagramImage: ImageAdjustment;
  tiktokImage: ImageAdjustment;
  line1: string;
  line2: string;
  line3: string;
  fontSize: number;
  lineGap: number;
  bottomShadowEnabled: boolean;
  topShadowEnabled: boolean;
  colorOverlayEnabled: boolean;
  colorOverlay: string;
  colorOverlayOpacity: number;
  noiseEnabled: boolean;
  noiseIntensity: number;
  noiseSize: number;
};

export type ThumbFormatSpec = {
  id: ThumbPlatform;
  name: string;
  width: number;
  height: number;
  bottomInset: number;
  safeMargin: number;
};

export const THUMB_FORMATS: Record<ThumbPlatform, ThumbFormatSpec> = {
  instagram: { id: 'instagram', name: 'Instagram', width: 1080, height: 1920, bottomInset: 283, safeMargin: 88 },
  tiktok: { id: 'tiktok', name: 'TikTok', width: 1080, height: 1440, bottomInset: 207, safeMargin: 88 },
};

export const THUMB_COLORS = ['#ffffff', '#ef7828', '#ffffff'] as const;
export const TEXT_BOX = { upperX: 41, upperWidth: 721, bottomX: 197, bottomWidth: 721 };
export const ARROW = { x: 95, width: 92, height: 92, lineTopOffset: 37 };

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const DEFAULT_IMAGE = `${basePath}/thumb/default-image.png`;
export const ARROW_IMAGE = `${basePath}/thumb/arrow.png`;

export function createDefaultFields(): ThumbFields {
  return {
    imageUrl: DEFAULT_IMAGE,
    instagramImage: { scale: 1, offsetX: 0, offsetY: 0 },
    tiktokImage: { scale: 1, offsetX: 0, offsetY: 0 },
    line1: 'Insira o seu',
    line2: 'texto aqui!',
    line3: '',
    fontSize: 160,
    lineGap: 6,
    bottomShadowEnabled: true,
    topShadowEnabled: false,
    colorOverlayEnabled: true,
    colorOverlay: '#000000',
    colorOverlayOpacity: 5,
    noiseEnabled: false,
    noiseIntensity: 35,
    noiseSize: 4,
  };
}
