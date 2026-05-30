import { state } from '../state/state.js';
import { FRAME_INSETS } from '../state/presets.js';
import { el } from '../ui/elements.js';
import { drawBackground } from './background.js';
import { drawShadow, drawBorder } from './shadow.js';
import { drawDeviceFrame } from './frames.js';
import { drawAnnotations } from './annotations.js';
import { drawRedactions } from './redactions.js';
import { drawSpotlight } from './spotlight.js';
import { drawTextOverlay, drawWatermark } from './overlays.js';
import { renderAutoLayout } from './autolayout.js';
import { drawSceneBackground } from './scenes.js';
import { renderExtraImages } from '../features/extra-images.js';
import { renderMinimap } from '../features/zoom-pan.js';
import { getAnimationState } from '../features/animation.js';

function getFrameInsets() {
  const t = state.deviceFrame.type;
  if (!t || !FRAME_INSETS[t]) return { top: 0, bottom: 0, left: 0, right: 0 };
  return FRAME_INSETS[t];
}

export function render(forExport) {
  if (!state.image) return;
  const canvas = el.previewCanvas;
  const ctx = canvas.getContext('2d');
  canvas.width = state.canvas.width;
  canvas.height = state.canvas.height;

  drawBackground(ctx, canvas, forExport);

  // Auto-layout takes over if active
  if (state.autoLayout.pattern !== 'free') {
    renderAutoLayout(ctx, canvas);
    drawTextOverlay(ctx, canvas);
    drawWatermark(ctx, canvas);
    if (!forExport) renderMinimap();
    return;
  }

  const scaleFactor = state.scale / 100;
  const padding = state.padding * 2;
  const frameInsets = getFrameInsets();
  const titleBarHeight = frameInsets.top;
  const bottomPad = frameInsets.bottom;
  const sidePad = frameInsets.left;

  const availableWidth = canvas.width - padding - sidePad * 2;
  const availableHeight = canvas.height - padding - titleBarHeight - bottomPad;

  let imgWidth = state.image.width * scaleFactor;
  let imgHeight = state.image.height * scaleFactor;
  if (imgWidth <= 0 || imgHeight <= 0 || availableWidth <= 0 || availableHeight <= 0) return;

  const imgRatio = imgWidth / imgHeight;
  const availableRatio = availableWidth / availableHeight;
  if (imgRatio > availableRatio) {
    if (imgWidth > availableWidth) { imgWidth = availableWidth; imgHeight = imgWidth / imgRatio; }
  } else {
    if (imgHeight > availableHeight) { imgHeight = availableHeight; imgWidth = imgHeight * imgRatio; }
  }

  let x = (canvas.width - imgWidth) / 2;
  let y = (canvas.height - imgHeight - titleBarHeight - bottomPad) / 2 + titleBarHeight;

  if (state.scene && state.scene.id) {
    const sceneOut = drawSceneBackground(ctx, canvas);
    if (sceneOut && sceneOut.rect) {
      x = sceneOut.rect.x; y = sceneOut.rect.y;
      imgWidth = sceneOut.rect.w; imgHeight = sceneOut.rect.h;
    }
  }

  state.lastImageRect = { x, y, w: imgWidth, h: imgHeight };

  if (state.shadow.opacity > 0) drawShadow(ctx, canvas, x, y, imgWidth, imgHeight);

  const animState = getAnimationState();
  if (animState) {
    ctx.save();
    const cx = x + imgWidth / 2;
    const cy = y + imgHeight / 2;
    if (animState.opacity !== undefined) ctx.globalAlpha = animState.opacity;
    if (animState.translateX || animState.translateY || animState.scale !== undefined || animState.rotate) {
      ctx.translate(cx, cy);
      if (animState.rotate) ctx.rotate((animState.rotate * Math.PI) / 180);
      if (animState.scale !== undefined) ctx.scale(animState.scale, animState.scale);
      ctx.translate(-cx + (animState.translateX || 0), -cy + (animState.translateY || 0));
    }
  }

  drawImageContent(ctx, x, y, imgWidth, imgHeight);

  if (state.showBorder) drawBorder(ctx, x, y, imgWidth, imgHeight);

  if (state.deviceFrame.type) {
    drawDeviceFrame(ctx, x, y - titleBarHeight, imgWidth, imgHeight + titleBarHeight + bottomPad);
  }

  drawRedactions(ctx, canvas);
  drawSpotlight(ctx, canvas);
  drawAnnotations(ctx);
  renderExtraImages(ctx, canvas);
  if (animState) ctx.restore();

  drawTextOverlay(ctx, canvas);
  drawWatermark(ctx, canvas);

  if (!forExport) renderMinimap();
}

function drawImageContent(ctx, x, y, imgWidth, imgHeight) {
  ctx.save();
  const radius = state.borderRadius;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + imgWidth - radius, y);
  ctx.quadraticCurveTo(x + imgWidth, y, x + imgWidth, y + radius);
  ctx.lineTo(x + imgWidth, y + imgHeight - radius);
  ctx.quadraticCurveTo(x + imgWidth, y + imgHeight, x + imgWidth - radius, y + imgHeight);
  ctx.lineTo(x + radius, y + imgHeight);
  ctx.quadraticCurveTo(x, y + imgHeight, x, y + imgHeight - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.clip();

  const centerX = x + imgWidth / 2;
  const centerY = y + imgHeight / 2;
  ctx.translate(centerX, centerY);
  if (state.imageTransform.rotation !== 0) {
    ctx.rotate((state.imageTransform.rotation * Math.PI) / 180);
  }
  ctx.scale(state.imageTransform.flipH ? -1 : 1, state.imageTransform.flipV ? -1 : 1);

  const filters = [];
  const f = state.imageFilters;
  if (f.brightness !== 100) filters.push(`brightness(${f.brightness}%)`);
  if (f.contrast !== 100)   filters.push(`contrast(${f.contrast}%)`);
  if (f.saturation !== 100) filters.push(`saturate(${f.saturation}%)`);
  if (f.blur > 0)           filters.push(`blur(${f.blur}px)`);
  if (f.grayscale > 0)      filters.push(`grayscale(${f.grayscale}%)`);
  if (f.sepia > 0)          filters.push(`sepia(${f.sepia}%)`);
  if (filters.length) ctx.filter = filters.join(' ');

  let drawWidth = imgWidth, drawHeight = imgHeight;
  if (state.imageTransform.rotation === 90 || state.imageTransform.rotation === 270) {
    drawWidth = imgHeight; drawHeight = imgWidth;
  }
  ctx.drawImage(state.image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}
