export interface GalleryFrame {
  index: number;
  fading: boolean;
  error: boolean;
}

export interface GalleryOptions {
  count: number;
  reducedMotion: boolean;
  random: () => number;
  schedule: (callback: () => void, delay: number) => number;
  cancel: (id: number) => void;
  render: (frame: GalleryFrame, retry?: boolean) => void;
  scrollTop: () => void;
}

export function createGalleryController(options: GalleryOptions) {
  const { count, schedule, cancel, render } = options;
  let reducedMotion = options.reducedMotion;
  let destroyed = false;
  let manual = false;
  let rotation: number | undefined;
  let fade: number | undefined;
  let pendingIndex: number | undefined;
  const randomIndex = (length: number) => Math.min(length - 1, Math.max(0, Math.floor(options.random() * length)));
  let frame: GalleryFrame = { index: count ? randomIndex(count) : -1, fading: false, error: false };

  function publish(retry = false) { render({ ...frame }, retry); }
  function clearRotation() {
    if (rotation !== undefined) cancel(rotation);
    rotation = undefined;
  }
  function clearFade() {
    if (fade !== undefined) cancel(fade);
    fade = undefined;
    pendingIndex = undefined;
  }
  function change(index: number) {
    clearFade();
    if (index === frame.index && frame.error) {
      publish(true);
      return;
    }
    frame = { ...frame, fading: false, error: false };
    if (reducedMotion || index === frame.index) {
      frame.index = index;
      publish();
      return;
    }
    pendingIndex = index;
    frame.fading = true;
    publish();
    fade = schedule(() => {
      fade = undefined;
      pendingIndex = undefined;
      frame = { index, fading: false, error: false };
      publish();
    }, 1000);
  }
  function startRotation() {
    if (destroyed || manual || reducedMotion || frame.error || count < 2) return;
    rotation = schedule(() => {
      rotation = undefined;
      const candidate = randomIndex(count - 1);
      change(candidate >= frame.index ? candidate + 1 : candidate);
      startRotation();
    }, 5000);
  }

  if (count) publish();
  startRotation();
  return {
    select(index: number) {
      if (destroyed || !Number.isInteger(index) || index < 0 || index >= count) return;
      manual = true;
      clearRotation();
      change(index);
      options.scrollTop();
    },
    imageError() {
      if (destroyed) return;
      clearRotation();
      clearFade();
      frame = { ...frame, fading: false, error: true };
      publish();
    },
    imageLoaded() {
      if (destroyed || !frame.error) return;
      frame.error = false;
      publish();
    },
    setReducedMotion(value: boolean) {
      if (destroyed) return;
      reducedMotion = value;
      clearRotation();
      const target = pendingIndex;
      clearFade();
      if (target !== undefined) frame = { index: target, fading: false, error: false };
      frame.fading = false;
      publish();
      startRotation();
    },
    destroy() {
      destroyed = true;
      clearRotation();
      clearFade();
    },
  };
}
