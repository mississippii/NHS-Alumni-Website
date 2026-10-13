/** Phone photos are often 5–10 MB: shrink to ≤1200px JPEG before upload (the server crops it square). */
export async function shrink(file) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, 1200 / Math.max(img.width, img.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((ok, fail) => c.toBlob(b => (b ? ok(b) : fail(new Error('Couldn’t read that photo.'))), 'image/jpeg', 0.9));
}
