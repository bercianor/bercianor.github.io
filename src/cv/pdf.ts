import { experimental_AstroContainer } from 'astro/container';
import { chromium } from '@playwright/test';
import { getCvDocument } from './documents';
import printStyles from '../styles/cv-print.css?raw';

export async function renderCvPdf(filename: string) {
  const { Content } = await getCvDocument(filename);
  const container = await experimental_AstroContainer.create();
  const content = await container.renderToString(Content);
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const page = await browser.newPage({ javaScriptEnabled: false });
    await page.route('**/*', route => route.abort());
    await page.setContent(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>CV · Rubén Berciano</title><style>${printStyles}</style></head><body>${content}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    return new Uint8Array(await page.pdf({
      format: 'A4',
      margin: { top: '16mm', right: '16mm', bottom: '16mm', left: '16mm' },
      printBackground: true,
      tagged: true,
    }));
  } finally {
    await browser.close();
  }
}
