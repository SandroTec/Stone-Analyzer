export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validateImage(file: File): string | null {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) return 'Bitte wähle ein JPEG-, PNG- oder WebP-Bild aus.';
  if (file.size > MAX_IMAGE_BYTES) return 'Das Bild darf höchstens 5 MB groß sein.';
  return null;
}
