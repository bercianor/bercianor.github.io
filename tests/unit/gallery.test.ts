import test from 'node:test';
import assert from 'node:assert/strict';
import { createGalleryController } from '../../src/scripts/gallery-controller.ts';

function setup(count = 30, reducedMotion = false, random = () => 0.5) {
  let now = 0;
  let id = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const frames: { index: number; fading: boolean; error: boolean }[] = [];
  let scrolls = 0;
  const controller = createGalleryController({ count, reducedMotion, random,
    schedule(callback, delay) { timers.set(++id, { at: now + delay, callback }); return id; },
    cancel(id) { timers.delete(id); },
    render(frame) { frames.push({ ...frame }); },
    scrollTop() { scrolls++; },
  });
  function advance(ms: number) {
    const end = now + ms;
    while (true) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      now = next[1].at; timers.delete(next[0]); next[1].callback();
    }
    now = end;
  }
  return { controller, timers, frames, advance, scrolls: () => scrolls, last: () => frames.at(-1)! };
}

test('random initial photo, 5 second rotation without repeats, one second fade', () => {
  const s = setup();
  assert.deepEqual(s.last(), { index: 15, fading: false, error: false });
  s.advance(4999); assert.equal(s.frames.length, 1);
  s.advance(1); assert.equal(s.last().fading, true);
  s.advance(1000); assert.notEqual(s.last().index, 15); assert.equal(s.last().fading, false);
  s.controller.destroy(); assert.equal(s.timers.size, 0);
});

test('rapid manual input cancels pending fade, stops autoplay and scrolls', () => {
  const s = setup(); s.advance(5000); s.controller.select(2); s.controller.select(7);
  s.advance(1000); assert.deepEqual(s.last(), { index: 7, fading: false, error: false });
  assert.equal(s.scrolls(), 2); assert.equal(s.timers.size, 0);
  s.advance(20000); assert.equal(s.last().index, 7);
});

test('image failure clears timers and remains recoverable by manual selection', () => {
  const s = setup(); s.advance(5000); s.controller.imageError();
  assert.equal(s.last().error, true); assert.equal(s.last().fading, false); assert.equal(s.timers.size, 0);
  s.controller.select(3); s.advance(1000); assert.equal(s.last().index, 3); assert.equal(s.last().error, false);
});

test('reduced motion disables all timers and transitions, including preference changes', () => {
  const s = setup(30, true); assert.equal(s.timers.size, 0);
  s.controller.select(4); assert.equal(s.last().index, 4); assert.equal(s.last().fading, false);
  const active = setup(); active.advance(5000); active.controller.setReducedMotion(true);
  assert.equal(active.timers.size, 0); assert.equal(active.last().fading, false);
});

test('motion changes commit the pending manual selection without restarting autoplay', () => {
  for (const preference of [true, false]) {
    const s = setup();
    s.controller.select(4);
    s.controller.setReducedMotion(preference);
    assert.deepEqual(s.last(), { index: 4, fading: false, error: false });
    assert.equal(s.scrolls(), 1);
    assert.equal(s.timers.size, 0);
    s.advance(20000);
    assert.equal(s.last().index, 4);
  }
});

test('empty, singleton, invalid selection and teardown remain safe', () => {
  for (const count of [0, 1]) { const s = setup(count); assert.equal(s.timers.size, 0); s.controller.destroy(); }
  const s = setup(); const frame = s.last(); s.controller.select(-1); s.controller.select(30);
  assert.deepEqual(s.last(), frame); assert.equal(s.scrolls(), 0);
  s.controller.destroy(); s.controller.select(2); s.advance(30000); assert.deepEqual(s.last(), frame);
});
