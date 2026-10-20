import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
import PhotographySection from '../sections/PhotographySection.astro';
import CvSection from '../sections/CvSection.astro';
import { sectionMetadata, siteConfig, validateHome, type SectionId } from './site';

const components = {
  photography: PhotographySection,
  cv: CvSection,
} satisfies Record<SectionId, AstroComponentFactory>;

export const sections = sectionMetadata.map(metadata => ({
  ...metadata,
  component: components[metadata.id],
}));

// Executed during static rendering; invalid or disabled home IDs stop the build.
export const homeSection = sections.find(section => section.id === validateHome(siteConfig.home, sections))!;

