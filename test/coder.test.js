import test from 'node:test';
import assert from 'node:assert/strict';

import { Encoder, Decoder, MAX_TOTAL } from '../src/coder.js';

/** Deterministic PRNG so a failing case is always reproducible. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn per-symbol frequencies into cumulative bounds. */
function cumulative(freqs) {
  const bounds = [];
  let acc = 0;
  for (const f of freqs) {
    bounds.push([acc, acc + f]);
    acc += f;
  }
  return { bounds, total: acc };
}

function roundTrip(freqs, symbols) {
  const { bounds, total } = cumulative(freqs);

  const encoder = new Encoder();
  for (const s of symbols) {
    encoder.encode(bounds[s][0], bounds[s][1], total);
  }
  const bits = encoder.finish();

  const decoder = new Decoder(bits);
  const out = [];
  for (let i = 0; i < symbols.length; i += 1) {
    const t = decoder.target(total);
    const s = bounds.findIndex(([lo, hi]) => t >= lo && t < hi);
    assert.notEqual(s, -1, 'target fell outside every symbol range');
    decoder.update(bounds[s][0], bounds[s][1], total);
    out.push(s);
  }
  return { out, bits };
}

test('round-trips a uniform alphabet', () => {
  const freqs = new Array(64).fill(1);
  const rand = mulberry32(1);
  const symbols = Array.from({ length: 500 }, () => Math.floor(rand() * 64));
  const { out } = roundTrip(freqs, symbols);
  assert.deepEqual(out, symbols);
});

test('round-trips a single-symbol alphabet without emitting much', () => {
  const { out, bits } = roundTrip([1], new Array(200).fill(0));
  assert.deepEqual(out, new Array(200).fill(0));
  assert.ok(bits.length <= 64, `expected a near-empty stream, got ${bits.length} bits`);
});

test('round-trips heavily skewed distributions', () => {
  const freqs = new Array(200).fill(1);
  freqs[7] = MAX_TOTAL - 200; // one symbol takes almost the whole range
  const rand = mulberry32(2);
  const symbols = Array.from({ length: 400 }, () =>
    rand() < 0.98 ? 7 : Math.floor(rand() * 200),
  );
  const { out } = roundTrip(freqs, symbols);
  assert.deepEqual(out, symbols);
});

test('round-trips random tables at randomised sizes', () => {
  const rand = mulberry32(3);
  for (let trial = 0; trial < 60; trial += 1) {
    const n = 2 + Math.floor(rand() * 180);
    const freqs = Array.from({ length: n }, () => 1 + Math.floor(rand() * 50));
    const total = freqs.reduce((a, b) => a + b, 0);
    if (total > MAX_TOTAL) continue;
    const symbols = Array.from({ length: 1 + Math.floor(rand() * 300) }, () =>
      Math.floor(rand() * n),
    );
    const { out } = roundTrip(freqs, symbols);
    assert.deepEqual(out, symbols, `trial ${trial} (n=${n})`);
  }
});

test('stays within a few bits of the Shannon cost', () => {
  const freqs = [90, 5, 3, 1, 1];
  const total = freqs.reduce((a, b) => a + b, 0);
  const rand = mulberry32(4);
  const symbols = [];
  for (let i = 0; i < 2000; i += 1) {
    let r = Math.floor(rand() * total);
    let s = 0;
    while (r >= freqs[s]) {
      r -= freqs[s];
      s += 1;
    }
    symbols.push(s);
  }
  const { out, bits } = roundTrip(freqs, symbols);
  assert.deepEqual(out, symbols);

  const ideal = symbols.reduce((acc, s) => acc - Math.log2(freqs[s] / total), 0);
  assert.ok(
    bits.length < ideal + 32,
    `coder used ${bits.length} bits vs ideal ${ideal.toFixed(1)}`,
  );
});

test('rejects malformed intervals', () => {
  const encoder = new Encoder();
  assert.throws(() => encoder.encode(0, 0, 10), RangeError); // empty range
  assert.throws(() => encoder.encode(5, 3, 10), RangeError); // inverted
  assert.throws(() => encoder.encode(0, 11, 10), RangeError); // past total
  assert.throws(() => encoder.encode(0, 1, MAX_TOTAL + 1), RangeError);
  assert.throws(() => encoder.encode(0, 1.5, 10), RangeError); // non-integer
});
