import assert from 'node:assert/strict';
import fs from 'node:fs';

import fetchUrlHandler from '../api/fetch-url.js';
import { state } from '../src/state/state.js';
import { serializeFull } from '../src/state/serialize.js';
import { applyDesignToState } from '../src/features/document.js';

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    send(payload) { this.body = payload; return this; },
    end() { this.ended = true; return this; }
  };
}

async function testFetchUrlRejectsPrivateHostsBeforeFetch() {
  let fetchCalled = false;
  const originalFetch = global.fetch;
  global.fetch = async () => {
    fetchCalled = true;
    return new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'image/png' } });
  };
  try {
    const res = mockRes();
    await fetchUrlHandler({ method: 'GET', query: { url: 'http://127.0.0.1/secret.png' } }, res);
    assert.equal(fetchCalled, false, 'private URL must be rejected before fetch()');
    assert.equal(res.statusCode, 422);
  } finally {
    global.fetch = originalFetch;
  }
}

async function testFetchUrlUsesManualRedirects() {
  let redirectMode = null;
  const originalFetch = global.fetch;
  global.fetch = async (_url, options = {}) => {
    redirectMode = options.redirect;
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'image/png' }
    });
  };
  try {
    const res = mockRes();
    await fetchUrlHandler({ method: 'GET', query: { url: 'http://93.184.216.34/image.png' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(redirectMode, 'manual', 'media proxy must validate redirects before following them');
  } finally {
    global.fetch = originalFetch;
  }
}

function testColorMapPersistsInProjects() {
  state.image = null;
  state.colorMap = { mode: 'gradient', intensity: 73, steps: 5 };
  state.colorPalettes = {
    active: 'pal_test',
    library: { pal_test: { name: 'Test', swatches: ['#000000', '#ffffff'] } }
  };

  const payload = serializeFull();
  assert.deepEqual(payload.design.colorMap, state.colorMap);
  assert.deepEqual(payload.design.colorPalettes, state.colorPalettes);
}

async function testFailedProjectImageDecodeClearsPreviousImage() {
  const originalImage = global.Image;
  state.image = { stale: true };

  class FailingImage {
    set src(_value) {
      queueMicrotask(() => this.onerror && this.onerror(new Error('decode failed')));
    }
  }
  global.Image = FailingImage;

  try {
    await applyDesignToState({ schemaVersion: 19, design: {}, image: 'data:image/png;base64,bad' });
    assert.equal(state.image, null, 'failed project image decode must not leave the previous image active');
  } finally {
    global.Image = originalImage;
  }
}

function testGalleryTemplateApplySnapshotsHistory() {
  const source = fs.readFileSync('src/features/gallery.js', 'utf8');
  assert.match(source, /import\s+\{\s*saveStateToHistory\s*\}\s+from\s+['"]\.\.\/state\/history\.js['"]/);
  assert.match(
    source,
    /else\s*\{[\s\S]*saveStateToHistory\(\);[\s\S]*Object\.assign\(state,\s*data\.payload\)/,
    'gallery template apply should snapshot before mutating state'
  );
}

const tests = [
  testFetchUrlRejectsPrivateHostsBeforeFetch,
  testFetchUrlUsesManualRedirects,
  testColorMapPersistsInProjects,
  testFailedProjectImageDecodeClearsPreviousImage,
  testGalleryTemplateApplySnapshotsHistory
];

for (const test of tests) {
  await test();
  console.log(`ok ${test.name}`);
}
