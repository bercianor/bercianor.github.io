import type { MarkdownInstance } from 'astro';

const modules = import.meta.glob<MarkdownInstance<Record<string, unknown>>>('../content/cv/*.md');

export const cvDocuments = new Map(
  Object.entries(modules).map(([path, load]) => [path.split('/').at(-1)!, load]),
);

export async function getCvDocument(filename: string) {
  const load = cvDocuments.get(filename);
  if (!load) throw new Error(`Unknown CV document: ${filename}. Add a Markdown file to src/content/cv/.`);
  return load();
}
