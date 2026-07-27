import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GSM7_BASIC,
  ALPHABETS,
  packBits,
  unpackBits,
  septetCost,
  gsm7Segments,
  ucs2Segments,
} from '../src/gsm7.js';

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

test('the basic table holds exactly 128 distinct septets', () => {
  const chars = [...GSM7_BASIC];
  assert.equal(chars.length, 128);
  assert.equal(new Set(chars).size, 128);
  assert.equal(GSM7_BASIC[27], '\x1b');
  assert.equal(GSM7_BASIC[10], '\n');
  assert.equal(GSM7_BASIC[13], '\r');
});

test('alphabets exclude fragile characters and stay in the basic table', () => {
  assert.equal(ALPHABETS.full.length, 124); // 128 minus ESC, LF, CR, SP
  for (const char of [...ALPHABETS.full, ...ALPHABETS.ascii]) {
    assert.ok(GSM7_BASIC.includes(char), `${JSON.stringify(char)} is not GSM-7 basic`);
    assert.ok(!' \n\r\x1b'.includes(char), `${JSON.stringify(char)} is fragile`);
  }
  assert.ok(ALPHABETS.ascii.every((c) => c.codePointAt(0) < 128));
  // ASCII printables present in GSM-7 basic, minus space: 85 -> 6.41 bits each.
  assert.equal(ALPHABETS.ascii.length, 85);
});

test('packed payloads are GSM-7 encodable, one septet per character', () => {
  const bits = Array.from({ length: 800 }, (_, i) => (i % 3 === 0 ? 1 : 0));
  for (const profile of ['full', 'ascii']) {
    const text = packBits(bits, profile);
    assert.equal(septetCost(text), [...text].length);
  }
});

test('round-trips bits including leading zeros', () => {
  const cases = [[0], [1], [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0], []];
  for (const bits of cases) {
    for (const profile of ['full', 'ascii']) {
      const { bits: out, profile: p } = unpackBits(packBits(bits, profile));
      assert.deepEqual(out, bits, `profile ${profile}, bits ${bits.join('')}`);
      assert.equal(p, profile);
    }
  }
});

test('round-trips random bit strings', () => {
  const rand = mulberry32(11);
  for (let trial = 0; trial < 200; trial += 1) {
    const n = Math.floor(rand() * 1200);
    const bits = Array.from({ length: n }, () => (rand() < 0.5 ? 0 : 1));
    const profile = rand() < 0.5 ? 'full' : 'ascii';
    const { bits: out } = unpackBits(packBits(bits, profile));
    assert.deepEqual(out, bits, `trial ${trial} (n=${n}, ${profile})`);
  }
});

test('a full segment carries the advertised bit budget', () => {
  // 159 digits after the marker fill one 160-septet segment.
  const capacity = Math.floor(159 * Math.log2(ALPHABETS.full.length));
  assert.ok(capacity >= 1100, `expected >=1100 usable bits, got ${capacity}`);

  const bits = Array.from({ length: capacity }, (_, i) => ((i * 7) % 5 === 0 ? 1 : 0));
  const text = packBits(bits, 'full');
  assert.ok([...text].length <= 160, `payload spilled to ${[...text].length} septets`);
  assert.equal(gsm7Segments(text), 1);
  assert.deepEqual(unpackBits(text).bits, bits);
});

test('rejects corrupt payloads', () => {
  assert.throws(() => unpackBits(''), RangeError);
  assert.throws(() => unpackBits('Zabc'), RangeError); // bad marker
  assert.throws(() => unpackBits('B abc'), RangeError); // space is not a digit
  assert.throws(() => unpackBits('Bঅ'), RangeError); // Bangla is not a digit
  assert.throws(() => packBits([2]), RangeError);
  assert.throws(() => packBits([0], 'nope'), RangeError);
});

test('segment maths matches the SMS rules the pitch cites', () => {
  const bangla = 'অ'.repeat(70);
  assert.equal(ucs2Segments(bangla), 1);
  assert.equal(ucs2Segments('অ'.repeat(71)), 2);
  assert.equal(ucs2Segments('অ'.repeat(200)), 3);
  assert.equal(septetCost('Hello'), 5);
  assert.equal(septetCost(bangla), null); // Bangla has no GSM-7 representation
});
