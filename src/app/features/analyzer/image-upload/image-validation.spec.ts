import { validateImage } from './image-validation';

describe('validateImage', () => {
  it('accepts supported images at or below 5 MB', () => {
    expect(validateImage(new File(['data'], 'stone.webp', { type: 'image/webp' }))).toBeNull();
    const fiveMb = new File([new Uint8Array(5 * 1024 * 1024)], 'stone.png', { type: 'image/png' });
    expect(validateImage(fiveMb)).toBeNull();
  });

  it('rejects unsupported formats and images above 5 MB', () => {
    expect(validateImage(new File(['data'], 'stone.gif', { type: 'image/gif' }))).toContain('JPEG');
    const tooLarge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'stone.jpg', { type: 'image/jpeg' });
    expect(validateImage(tooLarge)).toContain('5 MB');
  });
});
