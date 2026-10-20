export const sectionMetadata = [
  { id: 'photography', path: '/fotografia/', title: 'Fotografía · Rubén Berciano', description: 'Galería de fotografías de Rubén Berciano. Una selección de imágenes para recorrer y ver en detalle.', label: 'Fotografía', enabled: true },
  { id: 'cv', path: '/cv/', title: 'Currículum · Rubén Berciano', description: 'Currículum de Rubén Berciano: formación, experiencia y competencias. Consulta el documento y descarga la versión en PDF.', label: 'CV', enabled: true },
] as const;

export type SectionId = (typeof sectionMetadata)[number]['id'];

export function validateHome(
  value: string,
  sections: readonly { id: string; enabled: boolean }[] = sectionMetadata,
): SectionId {
  if (!sections.some(section => section.id === value && section.enabled)) {
    throw new Error(`Invalid home section: ${value}. Choose an implemented, enabled section.`);
  }
  return value as SectionId;
}

export const siteConfig: { home: SectionId; url: string; cv: string; photos: { albumUrl: string } } = {
  home: 'photography',
  cv: 'cv_advo.md',
  url: 'https://bercianor.es',
  photos: { albumUrl: 'https://photos.app.goo.gl/kG3kw3SFNUTg9WBQ8' },
};

