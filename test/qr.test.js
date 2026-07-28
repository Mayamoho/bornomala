import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

import { encodeQr, toSvg, EC_LEVEL_M, TOTAL_CODEWORDS, MAX_VERSION } from '../src/qr.js';
import { encodeCrisis, encodeRelay } from '../src/message.js';
import { blankFrame } from '../src/frame.js';

/** The eight level-M format strings from the standard, indexed by mask. */
const FORMAT_M = [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0];

const hasZbar = (() => {
  try {
    execFileSync('zbarimg', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

/* ─────────────────────────── a minimal PNG ──────────────────────────── */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Greyscale PNG of a symbol, so an outside decoder has something to read. */
function toPng({ size, modules }, scale = 8, quiet = 4) {
  const side = (size + quiet * 2) * scale;
  const stride = side + 1;
  const raw = Buffer.alloc(stride * side, 0xff);
  for (let y = 0; y < side; y += 1) raw[y * stride] = 0; // filter: none

  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j < size; j += 1) {
      if (modules[i][j] !== 1) continue;
      for (let dy = 0; dy < scale; dy += 1) {
        const start = ((i + quiet) * scale + dy) * stride + 1 + (j + quiet) * scale;
        raw.fill(0, start, start + scale);
      }
    }
  }

  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(side, 0);
  ihdr.writeUInt32BE(side, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function scan(text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bornomala-qr-'));
  try {
    const file = path.join(dir, 'code.png');
    fs.writeFileSync(file, toPng(encodeQr(text)));
    return execFileSync('zbarimg', ['--quiet', '--raw', '-Sdisable', '-Sqrcode.enable', file], {
      encoding: 'utf8',
    }).replace(/\n$/, '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/* ──────────────────────────────── tests ─────────────────────────────── */

test('the capacity table agrees with the standard codeword counts', () => {
  // Two independent figures from ISO 18004. A mistyped digit in either one
  // stops them matching, which is why both are written down.
  for (let version = 1; version <= MAX_VERSION; version += 1) {
    const [ecPerBlock, blocks1, data1, blocks2, data2] = EC_LEVEL_M[version];
    const blocks = blocks1 + blocks2;
    const total = blocks * ecPerBlock + blocks1 * data1 + blocks2 * data2;
    assert.equal(total, TOTAL_CODEWORDS[version], `version ${version} codeword total`);

    // Two groups only, and the second is always one data codeword larger.
    if (blocks2 > 0) assert.equal(data2, data1 + 1, `version ${version} group sizes`);
  }
});

test('every symbol carries the function patterns a scanner looks for', () => {
  for (const text of ['H428RH7E', 'HELLO WORLD', 'x'.repeat(300)]) {
    const qr = encodeQr(text);
    const m = qr.modules;
    assert.equal(qr.size, 17 + 4 * qr.version);

    for (const [row, col] of [
      [0, 0],
      [0, qr.size - 7],
      [qr.size - 7, 0],
    ]) {
      assert.equal(m[row][col], 1, 'finder outer ring');
      assert.equal(m[row + 1][col + 1], 0, 'finder inner ring');
      assert.equal(m[row + 3][col + 3], 1, 'finder core');
    }

    for (let i = 8; i < qr.size - 8; i += 1) {
      assert.equal(m[6][i], i % 2 === 0 ? 1 : 0, `horizontal timing at ${i}`);
      assert.equal(m[i][6], i % 2 === 0 ? 1 : 0, `vertical timing at ${i}`);
    }

    assert.equal(m[qr.size - 8][8], 1, 'the dark module must always be set');
  }
});

test('both copies of the format information are placed and agree', () => {
  for (const text of ['H428RH7E', 'x'.repeat(120)]) {
    const { modules: m, size, mask } = encodeQr(text);

    const first = [
      ...[0, 1, 2, 3, 4, 5].map((i) => m[i][8]),
      m[7][8],
      m[8][8],
      m[8][7],
      ...[9, 10, 11, 12, 13, 14].map((i) => m[8][14 - i]),
    ];
    const second = [
      ...Array.from({ length: 8 }, (_, i) => m[8][size - 1 - i]),
      ...Array.from({ length: 7 }, (_, k) => m[size - 15 + (k + 8)][8]),
    ];

    assert.deepEqual(second, first, 'the two format copies disagree');

    const value = first.reduce((acc, bit, i) => acc + bit * 2 ** i, 0);
    assert.equal(value, FORMAT_M[mask], `format bits for mask ${mask}`);
  }
});

test('version selection is the smallest that fits, and byte mode is the fallback', () => {
  assert.equal(encodeQr('H428RH7E').mode, 'alnum');
  assert.equal(encodeQr('H-428R-H7E').mode, 'alnum'); // hyphen is alphanumeric
  assert.equal(encodeQr('Cx').mode, 'byte'); // lowercase is not
  assert.equal(encodeQr('H428RH7E').version, 1);

  let previous = 0;
  for (const length of [10, 50, 100, 200, 400, 800]) {
    const { version } = encodeQr('A'.repeat(length));
    assert.ok(version >= previous, 'version must not shrink as data grows');
    previous = version;
  }
  assert.throws(() => encodeQr('A'.repeat(5000)), RangeError);
  assert.throws(() => encodeQr(''), RangeError);
});

test('the SVG covers every dark module and nothing else', () => {
  const qr = encodeQr('H428RH7E');
  const svg = toSvg(qr, { scale: 3, quiet: 4 });
  const side = (qr.size + 8) * 3;

  assert.match(svg, new RegExp(`width="${side}"`));
  let dark = 0;
  for (const row of qr.modules) for (const cell of row) dark += cell;
  assert.equal((svg.match(/M\d+ \d+h3v3h-3z/g) || []).length, dark);
});

test('an outside decoder reads back exactly what went in', (t) => {
  if (!hasZbar) {
    t.skip('zbarimg not installed — install zbar-tools to run the round trip');
    return;
  }

  const cases = [
    'H428RH7E',
    'H-428R-H7E',
    'HELLO WORLD',
    'http://192.168.0.5:8765/?shared=H428RH7E',
    `C${'x'.repeat(60)}`,
    'a1B2c3'.repeat(26),
    'Q'.repeat(300),
  ];
  for (const text of cases) {
    assert.equal(scan(text), text, `round trip failed for ${text.slice(0, 24)}…`);
  }
});

test('real payloads survive the handoff', (t) => {
  if (!hasZbar) {
    t.skip('zbarimg not installed');
    return;
  }

  const frame = { ...blankFrame(0), values: [2], location: { district: 17 }, hoursAgo: 2 };
  const paper = encodeCrisis(frame, null, { paper: true });
  assert.equal(scan(paper), paper);
  assert.equal(encodeQr(paper).version, 1, 'a status report should need only a version-1 symbol');

  // A full relay batch is the largest thing the app hands over this way.
  const roster = Array.from({ length: 45 }, (_, i) => ({
    ...blankFrame(0),
    values: [i % 16],
    location: { district: 17 },
    hoursAgo: i % 32,
  }));
  const batch = encodeRelay(roster, null);
  assert.equal(scan(batch), batch);
});
