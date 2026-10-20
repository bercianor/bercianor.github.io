# Development guidance

- Keep this personal site small: Astro static output, strict TypeScript and native CSS.
- Preserve existing content and the 30 ordered photo URLs unless a change is explicitly requested.
- Sections are implemented once, reused on their stable route and the configurable home page.
- Photo providers own URL normalization; gallery components consume the photo contract.
- CV Markdown lives in `src/content/cv/`; `siteConfig.cv` selects a filename. Discover files automatically and render the same unfiltered Markdown body on CV/home. Build every PDF automatically; `/cv.pdf` uses the selected document, and the page download filename is `cv_ruben_berciano.pdf`. Do not add content-specific hiding/filtering.
- Do not add frameworks, services, tracking, documentation or process artifacts without agreement.
- Keep planning notes, PRDs, reports and generated screenshots out of commits.
- Preserve public identity files, the signature and custom-domain configuration.
- Do not commit, rewrite history, push or deploy without explicit authorization for that action.

## Checks

Use pnpm 12 with Node.js >=22.22. Declare major/minor version ranges, not exact dependency/tool versions or action commit pins. Keep the 72-hour release-age policy in `pnpm-workspace.yaml`; do not add exceptions or disable it. Keep resolved dependency versions in `pnpm-lock.yaml` for reproducible installs.

```sh
pnpm run check
pnpm test
pnpm run build
pnpm run verify:routes
pnpm run test:home
pnpm run test:e2e
```

Tests assert observable behavior. Do not add tests asserting removed code remains absent.
Browser tests cover current content, navigation, gallery controls and responsive layout; generated test results remain ignored.
Local and CI ordinary browser tests, alternate-home checks and PDF generation use Playwright's bundled Chromium headless shell. Only the native BFCache test uses full Chromium, identically locally and in CI. Install both locally with `pnpm exec playwright install chromium`; CI uses `pnpm exec playwright install --with-deps chromium`. The locked Playwright version selects matching bundled browser revisions. `CHROMIUM_PATH` explicitly overrides the executable for all launches; there is no implicit system-browser fallback. The isolated CV/PDF checks also require `pdftotext` (Poppler), installed in CI; they compare extracted PDF text with rendered Markdown.
Playwright owns a foreground Astro preview using `--ignore-lock`; leave port 4321 free before running end-to-end tests.
