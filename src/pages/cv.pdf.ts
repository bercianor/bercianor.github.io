import type { APIRoute } from 'astro';
import { siteConfig } from '../config/site';
import { renderCvPdf } from '../cv/pdf';

export const GET: APIRoute = async () => new Response(await renderCvPdf(siteConfig.cv), {
  headers: { 'Content-Type': 'application/pdf' },
});
