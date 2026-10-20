import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionMetadata, validateHome, siteConfig } from '../../src/config/site.ts';

test('enabled sections expose stable routes and photography is the default home', () => {
  assert.deepEqual(
    sectionMetadata.filter(section => section.enabled).map(({ id, path }) => ({ id, path })),
    [
      { id:'photography', path:'/fotografia/' },
      { id:'cv', path:'/cv/' },
    ],
  );
  assert.equal(siteConfig.home, 'photography');
  assert.equal(validateHome(siteConfig.home), 'photography');
  assert.equal(validateHome('cv'), 'cv');
});

test('invalid or disabled home configuration fails with a readable error', () => {
  assert.throws(() => validateHome('missing'), /Invalid home section: missing/);
  assert.throws(() => validateHome('cv', [{ id:'cv', enabled:false }]), /Invalid home section: cv/);
});
