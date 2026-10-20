import test from 'node:test';
import assert from 'node:assert/strict';
import { getUttarakhandBounds } from './geo.js';

test('getUttarakhandBounds returns correct Leaflet bounds for default Uttarakhand bbox', () => {
  const bounds = getUttarakhandBounds();
  assert.deepEqual(bounds, [[28.7, 77.6], [31.5, 81.1]]);
});

test('getUttarakhandBounds handles custom valid bbox [west, south, east, north]', () => {
  const custom = [78.0, 29.0, 80.0, 31.0];
  const bounds = getUttarakhandBounds(custom);
  assert.deepEqual(bounds, [[29.0, 78.0], [31.0, 80.0]]);
});

test('getUttarakhandBounds falls back on invalid inputs', () => {
  assert.deepEqual(getUttarakhandBounds(null), [[28.7, 77.6], [31.5, 81.1]]);
  assert.deepEqual(getUttarakhandBounds([]), [[28.7, 77.6], [31.5, 81.1]]);
  assert.deepEqual(getUttarakhandBounds([77.6, 'bad', 81.1, 31.5]), [[28.7, 77.6], [31.5, 81.1]]);
});
