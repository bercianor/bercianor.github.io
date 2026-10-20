import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://bercianor.es',
  output: 'static',
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' https://lh3.googleusercontent.com",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-src 'none'",
        "connect-src 'none'",
      ],
    },
  },
  trailingSlash: 'always',
  build: { format: 'directory' },
});
