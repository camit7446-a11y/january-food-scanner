// January accepts request bodies up to 5 MB, and ~1,024 px on the shorter side is plenty.
// Resizing in the browser keeps uploads small and fast.

function loadBitmap(file) {
  if (window.createImageBitmap) {
    return createImageBitmap(file).catch(() => loadWithImageTag(file));
  }
  return loadWithImageTag(file);
}

function loadWithImageTag(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}

function drawScaled(source, longSide, quality) {
  const w = source.width;
  const h = source.height;
  const scale = Math.min(1, longSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Returns { dataUri, thumb }. Throws a readable Error if the browser cannot decode the file. */
export async function prepareImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file (JPG, PNG or WebP).');
  let bitmap;
  try {
    bitmap = await loadBitmap(file);
  } catch {
    throw new Error('This browser could not read that photo. HEIC photos often fail; use JPG or PNG instead.');
  }
  return {
    dataUri: drawScaled(bitmap, 1600, 0.86),
    thumb: drawScaled(bitmap, 120, 0.7),
  };
}
