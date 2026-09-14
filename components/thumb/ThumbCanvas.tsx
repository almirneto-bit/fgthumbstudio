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
    image.onerror = () => reject(new Error(`Não foi possível carregar o asset: ${src}`));
    image.src = src;
  });
}

async function ensureThumbFont(size: number) {
  try {
    if (typeof document !== 'undefined' && document.fonts?.load) {
      await document.fonts.load(`${size}px "Vina Sans"`);
    }
  } catch {
    // O canvas continua usando a fonte de fallback caso a fonte web falhe.
  }
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
    ctx.font = `400 ${size}px "Vina Sans", Impact, sans-serif`;
    if (lines.every((line) => ctx.measureText(line.text.toLocaleUpperCase('pt-BR')).width <= TEXT_BOX.bottomWidth)) break;
    size -= 2;
  }
  return { lines, size };
}

function drawTintedArrow(ctx: CanvasRenderingContext2D, arrow: HTMLImageElement, x: number, y: number, size: number, color: string) {
  const buffer = document.createElement('canvas');
  buffer.width = Math.max(1, Math.round(size));
  buffer.height = Math.max(1, Math.round(size));
  const bufferContext = buffer.getContext('2d');
  if (!bufferContext) return;
  bufferContext.drawImage(arrow, 0, 0, buffer.width, buffer.height);
  bufferContext.globalCompositeOperation = 'source-in';
  bufferContext.fillStyle = color;
  bufferContext.fillRect(0, 0, buffer.width, buffer.height);
  ctx.drawImage(buffer, x, y, size, size);
}

function drawFallbackArrow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(5, size * 0.12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + size * 0.08, y + size * 0.5);
  ctx.lineTo(x + size * 0.8, y + size * 0.5);
  ctx.moveTo(x + size * 0.56, y + size * 0.25);
  ctx.lineTo(x + size * 0.82, y + size * 0.5);
  ctx.lineTo(x + size * 0.56, y + size * 0.75);
  ctx.stroke();
  ctx.restore();
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
    try {
      const image = await loadImage(fields.imageUrl);
      drawCover(ctx, image, format.width, format.height, platform === 'instagram' ? fields.instagramImage : fields.tiktokImage);
    } catch (error) {
      if (fields.imageUrl.startsWith('data:') || fields.imageUrl.startsWith('blob:')) throw error;
      // Se um asset padrão não carregar, preserva o editor funcional com o fundo neutro.
    }
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

  await ensureThumbFont(fields.fontSize);
  const { lines, size } = fitFontSize(ctx, fields);
  if (lines.length) {
    let arrow: HTMLImageElement | null = null;
    if (fields.arrowEnabled) {
      try {
        arrow = await loadImage(ARROW_IMAGE);
      } catch {
        arrow = null;
      }
    }

    const lineHeight = size * 0.8;
    const bottomLineTop = format.height - format.bottomInset - lineHeight;
    const stackTop = bottomLineTop - (lines.length - 1) * (lineHeight + fields.lineGap);
    const textX = format.safeMargin;
    ctx.font = `400 ${size}px "Vina Sans", Impact, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    lines.forEach((line, index) => {
      const isBottom = index === lines.length - 1;
      const lineTop = stackTop + index * (lineHeight + fields.lineGap);
      const renderedText = line.text.toLocaleUpperCase('pt-BR');
      ctx.fillStyle = line.color;
      ctx.fillText(renderedText, textX, lineTop + lineHeight / 2);

      if (isBottom && fields.arrowEnabled) {
        const arrowSize = ARROW.width * (size / 160);
        const textWidth = ctx.measureText(renderedText).width;
        const arrowGap = 10 * (size / 160);
        const maxArrowX = format.width - format.safeMargin - arrowSize;
        const arrowX = Math.min(textX + textWidth + arrowGap, maxArrowX);
        const arrowY = lineTop + ARROW.lineTopOffset * (size / 160);
        if (arrow) drawTintedArrow(ctx, arrow, arrowX, arrowY, arrowSize, line.color);
        else drawFallbackArrow(ctx, arrowX, arrowY, arrowSize, line.color);
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
        if (canvas && context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(buffer, 0, 0);
        }
      })
      .catch((error) => {
        if (!cancelled) onError(error instanceof Error ? error.message : 'Falha ao gerar a prévia.');
      });
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
