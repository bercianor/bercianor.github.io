import { JsonPhotoProvider } from './json-provider.ts';
import type { PhotoProvider } from './types.ts';
export type { PhotoProvider, PortfolioPhoto } from './types.ts';
export { JsonPhotoProvider } from './json-provider.ts';

export function getPhotoProvider(): PhotoProvider {
  return new JsonPhotoProvider();
}
