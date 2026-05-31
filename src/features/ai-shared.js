// v9.1 — shared helpers for the cloud-AI features (vision + image editing).

export function imageToDataUrl(img, type = 'image/png') {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  return c.toDataURL(type);
}

export function dataUrlToBase64(url) {
  const i = url.indexOf(',');
  return i >= 0 ? url.slice(i + 1) : url;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function canvasToBlob(canvas, type = 'image/png') {
  return new Promise((res) => canvas.toBlob(res, type));
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(dataUrlToBase64(String(r.result)));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// gpt-image-2 accepts a fixed set of sizes; pick the closest to a target aspect.
export function nearestGptImageSize(w, h) {
  const ar = w / h;
  if (ar > 1.25) return '1536x1024';
  if (ar < 0.8) return '1024x1536';
  return '1024x1024';
}
