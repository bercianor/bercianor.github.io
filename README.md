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

Builds also generate the CV PDFs. Install the bundled browsers locally with `pnpm exec playwright install chromium` (CI uses `pnpm exec playwright install --with-deps chromium`). Both environments use Playwright's minimal Chromium headless shell for ordinary browser tests, alternate-home checks and PDFs. Only the native BFCache test needs full Chromium, in both environments. The locked Playwright version selects matching bundled browser revisions; `CHROMIUM_PATH` explicitly overrides the executable at every launch site, with no system-browser fallback.

To build and preview:

```sh
pnpm run build
pnpm run preview --host 127.0.0.1 --port 4321 --ignore-lock
```

Run checks with `pnpm run check` and `pnpm test`. After building, run browser tests with `pnpm run test:e2e`.

## Customize

- **Home page:** set `siteConfig.home` in `src/config/site.ts` to `photography` or `cv`. The selected section renders at `/`, its canonical URL.
- **Sections:** photography uses `/fotografia/` and the CV `/cv/`. The selected home section's route redirects to `/` with an immediate HTML refresh on the static site; the other section renders at its own route. Navigation and the sitemap use only the canonical URLs.
- **CV:** add Markdown files to `src/content/cv/` and set `siteConfig.cv` to the filename (default: `cv_advo.md`). No registration is needed. The selected Markdown renders unchanged on the CV page and, when selected, the home page. Its download button serves `/cv.pdf` as `cv_ruben_berciano.pdf`. All variants are generated at `/cv/<filename-without-md>.pdf`.
- **Photographs:** set `siteConfig.photos.albumUrl` in `src/config/site.ts` to a shared Google Photos album. `pnpm run build` and `pnpm run dev` fetch its photographs once into the ignored `src/data/photos.generated.json`; `pnpm run photos:sync` refreshes that snapshot explicitly. The provider reads the JSON at build time, preserves the returned order and creates the image size variants. Visitors only request image files, never album metadata. Videos are excluded. Extraction errors or empty/invalid results stop the build without replacing the previous snapshot; a failed validation prevents deployment. Google Photos extraction uses an unofficial library and its image URLs may change. Gallery buttons have numbered accessible names; images use empty alternatives, so their visual content is not described to screen readers.
- **Social links:** edit `src/data/social-links.ts`.

Build/preview uses Astro's native CSP with script/style hashes and a no-referrer meta policy; GitHub Pages does not support custom HTTP security headers.

GitHub Pages publishes the generated `dist/` directory. The custom domain is configured in `public/CNAME`.

The `Validate` workflow checks pull requests or runs manually without deploying. `Validate and deploy Pages` reuses the same checks before publishing on pushes to `master` or manual deployment runs.
