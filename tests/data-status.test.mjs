import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

async function loadWith(fetchResult) {
  const elements = new Map();
  const element = (selector) => {
    if (!elements.has(selector)) {
      elements.set(selector, {
        hidden: selector === '#dataStatus',
        style: { setProperty() {} },
        addEventListener() {},
      });
    }
    return elements.get(selector);
  };
  const document = {
    querySelector: element,
    querySelectorAll: () => [],
  };
  vm.runInNewContext(source, { document, fetch: () => fetchResult, navigator: {} });
  await new Promise((resolve) => setImmediate(resolve));
  return element;
}

test('failed color-list request announces the limited built-in data', async () => {
  const element = await loadWith(Promise.resolve({ ok: false, text: () => Promise.resolve('') }));
  assert.equal(element('#dataStatus').hidden, false);
  assert.match(element('#count').textContent, / names$/);
  assert.match(element('#colorGrid').innerHTML, /AliceBlue/);
});

test('empty color-list response also announces the fallback', async () => {
  const element = await loadWith(Promise.resolve({ ok: true, text: () => Promise.resolve('name,hex\n') }));
  assert.equal(element('#dataStatus').hidden, false);
});

test('network failure announces the fallback', async () => {
  const element = await loadWith(Promise.reject(new Error('offline')));
  assert.equal(element('#dataStatus').hidden, false);
});

test('valid color-list response keeps the warning hidden', async () => {
  const element = await loadWith(Promise.resolve({ ok: true, text: () => Promise.resolve('name,hex,good name\nCustom,#123456,\n') }));
  assert.equal(element('#dataStatus').hidden, true);
  assert.match(element('#colorGrid').innerHTML, /AliceBlue/);
});
