// Фото гравців. Зараз — стискання до квадрата 320×320 у JPEG (data URL).
// На кроці 6: збереження в IndexedDB і «вклеювання» шаблону у файл.

export const PHOTO_SIZE = 320;

/** Квадратне фото по центру, стиснене. Повертає data URL. */
export async function squarePhoto(file, size = PHOTO_SIZE) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  canvas.getContext('2d').drawImage(
    bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size,
  );
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.82);
}
