import { createGalleryController, type GalleryFrame } from './gallery-controller';

export function initializeGalleries() {
  document.querySelectorAll<HTMLElement>('[data-gallery]').forEach(root => {
    const image = root.querySelector<HTMLImageElement>('[data-featured]');
    const status = root.querySelector<HTMLElement>('[data-gallery-status]');
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-photo-index]')];
    if (!image || !status || !buttons.length) return;
    const listeners = new AbortController();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let latestFrame: GalleryFrame | undefined;
    let waitingForImage = false;
    let requestVersion = 0;
    const updateVisibility = () => image.parentElement?.classList.toggle('is-fading', waitingForImage || !!latestFrame?.fading);
    const controller = createGalleryController({
      count: buttons.length,
      reducedMotion: motion.matches,
      random: Math.random,
      schedule: (callback, delay) => window.setTimeout(callback, delay),
      cancel: id => window.clearTimeout(id),
      scrollTop: () => window.scrollTo({
        top: Math.max(0, window.scrollY + image.getBoundingClientRect().top - 8),
        behavior: 'instant',
      }),
      render(frame, retry) {
        const selected = buttons[frame.index];
        if (!selected) return;
        const url = selected.dataset.fullUrl!;
        latestFrame = frame;
        if (retry || image.getAttribute('src') !== url) {
          requestVersion++;
          waitingForImage = true;
          image.src = url;
        }
        updateVisibility();
        status.textContent = frame.error ? 'No se ha podido cargar esta fotografía. Puedes seleccionar otra.' : '';
        buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === frame.index)));
      },
    });
    buttons.forEach((button, index) => button.addEventListener('click', () => controller.select(index), { signal: listeners.signal }));
    function imageFailed() {
      requestVersion++;
      waitingForImage = false;
      controller.imageError();
    }
    const imageReady = async () => {
      if (!image.complete || image.naturalWidth === 0) return;
      const version = requestVersion;
      try {
        await image.decode();
      } catch {
        if (version === requestVersion && !listeners.signal.aborted) imageFailed();
        return;
      }
      if (version !== requestVersion || listeners.signal.aborted) return;
      waitingForImage = false;
      controller.imageLoaded();
      updateVisibility();
    };
    image.addEventListener('error', () => {
      if (image.complete && image.naturalWidth === 0) imageFailed();
    }, { signal: listeners.signal });
    image.addEventListener('load', () => { void imageReady(); }, { signal: listeners.signal });
    if (image.complete) {
      if (image.naturalWidth === 0) imageFailed();
      else void imageReady();
    }
    motion.addEventListener('change', event => controller.setReducedMotion(event.matches), { signal: listeners.signal });
    window.addEventListener('pagehide', event => {
      if (event.persisted) return;
      controller.destroy();
      listeners.abort();
    }, { signal: listeners.signal });
  });
}
