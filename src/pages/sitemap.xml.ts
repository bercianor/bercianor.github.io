import type { APIRoute } from 'astro';
import { sections } from '../config/sections';
import { siteConfig } from '../config/site';

export const GET: APIRoute = () => {
  const paths = ['/', ...sections.filter(section => section.enabled && section.id !== siteConfig.home).map(section => section.path), '/politica_cookies/'];
  const urls = paths.map(path => `<url><loc>${new URL(path, siteConfig.url).href}</loc></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
