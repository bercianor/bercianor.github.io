import { readFileSync } from 'node:fs';

export const photoCount = (JSON.parse(readFileSync(
  new URL('../src/data/photos.generated.json', import.meta.url), 'utf8',
)) as { photos: unknown[] }).photos.length;
