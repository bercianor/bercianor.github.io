# bercianor.es

Personal website of Rubén Berciano: photography and CV.

Built with [Astro](https://astro.build/), TypeScript and native CSS. Published as a static site at [bercianor.es](https://bercianor.es/).

## Run locally

Requires Node.js 22.22 or later and pnpm 12. With [just](https://just.systems/) installed, run `just preview` to validate, build and serve the production site at http://127.0.0.1:4321 (Ctrl+C to stop). Run `just check` for the full test suite.

Dependency versions use compatible major/minor ranges. pnpm waits 72 hours before accepting new releases; `pnpm-lock.yaml` records the resolved versions for reproducible installs.

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

PDF generation needs Chromium: install it with `pnpm exec playwright install chromium`, or use an existing installation via `CHROMIUM_PATH`.

To build and preview:

```sh
pnpm run build
pnpm run preview --host 127.0.0.1 --port 4321 --ignore-lock
```

Run checks with `pnpm run check` and `pnpm test`. After building, run browser tests with `pnpm run test:e2e`.

## Customize

- **Home page:** set `siteConfig.home` in `src/config/site.ts` to `photography` or `cv`.
- **Sections:** photography lives at `/fotografia/` and the CV at `/cv/`, regardless of the home page.
- **CV:** add Markdown files to `src/content/cv/` and set `siteConfig.cv` to the filename (default: `cv_advo.md`). No registration is needed. Builds generate every CV at `/cv/<filename-without-md>.pdf`; the page downloads the selected one as `cv_ruben_berciano.pdf`.
  Wrap the contact line in `<span class="cv-contact">…<br /></span>` to keep it in the PDF while hiding it on the web. PDFs remain public.
- **Photographs:** edit the catalog in `src/data/photos.ts`.
- **Social links:** edit `src/data/social-links.ts`.

GitHub Pages publishes the generated `dist/` directory. The custom domain is configured in `public/CNAME`.

The `Validate` workflow checks pull requests or runs manually without deploying. `Validate and deploy Pages` reuses the same checks before publishing on pushes to `master` or manual deployment runs.
