'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  ARROW,
  ARROW_IMAGE,
  TEXT_BOX,
  THUMB_COLORS,
  THUMB_FORMATS,
  type ImageAdjustment,
  type ThumbFields,
  type ThumbPlatform,
} from '@/lib/thumbTemplate';

export type ThumbCanvasHandle = {
  exportPng: () => Promise<Blob>;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    image.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  adjustment: ImageAdjustment,
) {
  const cover = Math.max(width / image.width, height / image.height);
  const scale = cover * adjustment.scale;
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const x = (width - drawWidth) / 2 + adjustment.offsetX;
  const y = (height - drawHeight) / 2 + adjustment.offsetY;
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

function drawGradient(ctx: CanvasRenderingContext2D, width: number, height: number, direction: 'top' | 'bottom') {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  if (direction === 'bottom') {
    gradient.addColorStop(0.1347, 'rgba(12,12,15,0)');
    gradient.addColorStop(1, 'rgba(12,12,15,1)');
  } else {
    gradient.addColorStop(0, 'rgba(12,12,15,1)');
    gradient.addColorStop(0.8653, 'rgba(12,12,15,0)');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawNoise(ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number, grainSize: number) {
  if (intensity <= 0) return;
  const size = Math.max(1, Math.round(grainSize));
  const noise = document.createElement('canvas');
  noise.width = Math.ceil(width / size);
  noise.height = Math.ceil(height / size);
  const noiseContext = noise.getContext('2d');
  if (!noiseContext) return;
  const imageData = noiseContext.createImageData(noise.width, noise.height);
  let seed = 23917;
  for (let index = 0; index < imageData.data.length; index += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const value = seed / 4294967296 > 0.5 ? 255 : 0;
    imageData.data[index] = value;
    imageData.data[index + 1] = value;
    imageData.data[index + 2] = value;
    imageData.data[index + 3] = 255;
  }
  noiseContext.putImageData(imageData, 0, 0);
  ctx.save();
  ctx.globalAlpha = (intensity / 100) * 0.22;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(noise, 0, 0, width, height);
  ctx.restore();
}

function getVisibleLines(fields: ThumbFields) {
  return [fields.line1, fields.line2, fields.line3]
    .map((text, index) => ({ text: text.trim(), color: THUMB_COLORS[index] }))
    .filter((line) => line.text.length > 0);
}

function fitFontSize(ctx: CanvasRenderingContext2D, fields: ThumbFields) {
  const lines = getVisibleLines(fields);
  let size = fields.fontSize;
  while (size > 72) {
    ctx.font = `400 ${size}px "Vina Sans", sans-serif`;
    if (lines.every((line) => ctx.measureText(line.text.toLocaleUpperCase('pt-BR')).width <= TEXT_BOX.bottomWidth)) break;
    size -= 2;
  }
  return { lines, size };
}

function drawTintedArrow(ctx: CanvasRenderingContext2D, arrow: HTMLImageElement, x: number, y: number, size: number, color: string) {
  const buffer = document.createElement('canvas');
  buffer.width = size;
  buffer.height = size;
  const bufferContext = buffer.getContext('2d');
  if (!bufferContext) return;
  bufferContext.drawImage(arrow, 0, 0, size, size);
  bufferContext.globalCompositeOperation = 'source-in';
  bufferContext.fillStyle = color;
  bufferContext.fillRect(0, 0, size, size);
  ctx.drawImage(buffer, x, y, size, size);
}

export async function renderThumb(fields: ThumbFields, platform: ThumbPlatform) {
  const format = THUMB_FORMATS[platform];
  const canvas = document.createElement('canvas');
  canvas.width = format.width;
  canvas.height = format.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível.');

  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, format.width, format.height);
  if (fields.imageUrl) {
    const image = await loadImage(fields.imageUrl);
    drawCover(ctx, image, format.width, format.height, platform === 'instagram' ? fields.instagramImage : fields.tiktokImage);
  }

  if (fields.colorOverlayEnabled && fields.colorOverlayOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = fields.colorOverlayOpacity / 100;
    ctx.fillStyle = fields.colorOverlay;
    ctx.fillRect(0, 0, format.width, format.height);
    ctx.restore();
  }
  if (fields.topShadowEnabled) drawGradient(ctx, format.width, format.height, 'top');
  if (fields.bottomShadowEnabled) drawGradient(ctx, format.width, format.height, 'bottom');
  if (fields.noiseEnabled) drawNoise(ctx, format.width, format.height, fields.noiseIntensity, fields.noiseSize);

  await document.fonts.load(`${fields.fontSize}px "Vina Sans"`);
  const { lines, size } = fitFontSize(ctx, fields);
  if (lines.length) {
    const arrow = await loadImage(ARROW_IMAGE);
    const lineHeight = size * 0.8;
    const bottomLineTop = format.height - format.bottomInset - lineHeight;
    const stackTop = bottomLineTop - (lines.length - 1) * (lineHeight + fields.lineGap);
    ctx.font = `400 ${size}px "Vina Sans", sans-serif`;
    ctx.textBaseline = 'middle';

    lines.forEach((line, index) => {
      const isBottom = index === lines.length - 1;
      const lineTop = stackTop + index * (lineHeight + fields.lineGap);
      ctx.fillStyle = line.color;
      ctx.textAlign = isBottom ? 'left' : 'center';
      const x = isBottom ? TEXT_BOX.bottomX : TEXT_BOX.upperX + TEXT_BOX.upperWidth / 2;
      ctx.fillText(line.text.toLocaleUpperCase('pt-BR'), x, lineTop + lineHeight / 2);
      if (isBottom) {
        const arrowSize = ARROW.width * (size / 160);
        const arrowX = TEXT_BOX.bottomX - 10 * (size / 160) - arrowSize;
        drawTintedArrow(ctx, arrow, arrowX, lineTop + ARROW.lineTopOffset * (size / 160), arrowSize, line.color);
      }
    });
  }

  return canvas;
}

export async function renderThumbBlob(fields: ThumbFields, platform: ThumbPlatform): Promise<Blob> {
  const canvas = await renderThumb(fields, platform);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha ao gerar PNG.')), 'image/png');
  });
}

const ThumbCanvas = forwardRef<ThumbCanvasHandle, {
  fields: ThumbFields;
  platform: ThumbPlatform;
  showSafeArea: boolean;
  onError: (message: string) => void;
}>(function ThumbCanvas({ fields, platform, showSafeArea, onError }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const format = THUMB_FORMATS[platform];

  useEffect(() => {
    let cancelled = false;
    renderThumb(fields, platform)
      .then((buffer) => {
        if (cancelled) return;
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (canvas && context) context.drawImage(buffer, 0, 0);
        onError('');
      })
      .catch((error) => { if (!cancelled) onError(error instanceof Error ? error.message : 'Falha ao gerar a prévia.'); });
    return () => { cancelled = true; };
  }, [fields, platform, onError]);

  useImperativeHandle(ref, () => ({ exportPng: () => renderThumbBlob(fields, platform) }), [fields, platform]);

  return (
    <div className={`thumb-preview thumb-preview-${platform}`}>
      <div className="thumb-preview-label"><strong>{format.name}</strong><span>{format.width} × {format.height}</span></div>
      <div className="thumb-canvas-wrap" style={{ aspectRatio: `${format.width}/${format.height}` }}>
        <canvas ref={canvasRef} width={format.width} height={format.height} className="thumb-canvas" aria-label={`Prévia para ${format.name}`} />
        {showSafeArea && (
          <div
            className="thumb-safe-area"
            style={{
              top: `${(format.safeMargin / format.height) * 100}%`,
              right: `${(format.safeMargin / format.width) * 100}%`,
              bottom: `${(format.safeMargin / format.height) * 100}%`,
              left: `${(format.safeMargin / format.width) * 100}%`,
            }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
});

export default ThumbCanvas;
