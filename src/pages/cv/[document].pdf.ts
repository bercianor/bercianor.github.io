import type { APIRoute, GetStaticPaths } from 'astro';
import { cvDocuments } from '../../cv/documents';
import { renderCvPdf } from '../../cv/pdf';

export const getStaticPaths = (() => Array.from(cvDocuments.keys()).map(filename => ({
  params: { document: filename.slice(0, -3) },
  props: { filename },
}))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => new Response(await renderCvPdf(props.filename), {
  headers: { 'Content-Type': 'application/pdf' },
});
