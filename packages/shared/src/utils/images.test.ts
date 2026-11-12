import { describe, expect, it } from 'vitest';
import { storageImageUrl } from './images';

describe('storageImageUrl', () => {
  it('baut die öffentliche Storage-URL aus einem Pfad', () => {
    expect(storageImageUrl('https://abc.supabase.co/', 'offer-images', 'loc-1/Bild 1.jpg')).toBe(
      'https://abc.supabase.co/storage/v1/object/public/offer-images/loc-1/Bild%201.jpg',
    );
  });

  it('lässt absolute URLs unverändert (Seed-Platzhalter)', () => {
    const url = 'https://picsum.photos/seed/pasta/800/600';
    expect(storageImageUrl('https://abc.supabase.co', 'offer-images', url)).toBe(url);
  });
});
