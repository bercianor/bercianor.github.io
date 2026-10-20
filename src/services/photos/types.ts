export interface PortfolioPhoto {
  id: string;
  fullUrl: string;
  thumbnailUrl: string;
  alt: string;
  order: number;
  width?: number;
  height?: number;
}

export interface PhotoProvider {
  getPhotos(collectionId: string): Promise<readonly PortfolioPhoto[]>;
}
