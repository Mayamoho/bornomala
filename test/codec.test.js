import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { Model } from '../src/model.js';
import { encode, decode, encodeToBits, decodeFromBits } from '../src/codec.js';
import { septetCost, gsm7Segments } from '../src/gsm7.js';

const QUANT_TOTAL = 4096;

/**
 * Serialise a BRNM1 model from plain JS structures — same layout as
 * tools/train_model.py, so the parser is checked against an independent writer.
 */
function buildModel({ alphabet, order0, tables, quantTotal = QUANT_TOTAL }) {
  const bytes = [];
  const u8 = (v) => bytes.push(v & 0xff);
  const u16 = (v) => {
    bytes.push(v & 0xff, (v >> 8) & 0xff);
  };
  const u32 = (v) => {
    bytes.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);
  };

  for (const c of 'BRNM1') u8(c.charCodeAt(0));
  const maxOrder = Math.max(...Object.keys(tables).map(Number), 0);
  u8(maxOrder);
  u16(quantTotal);
  u16(alphabet.length);

  const alphabetBytes = new TextEncoder().encode(alphabet.join(''));
  u32(alphabetBytes.length);
  for (const b of alphabetBytes) u8(b);

  for (const freq of order0) u16(freq);

  for (let order = 1; order <= maxOrder; order += 1) {
    const contexts = tables[order] ?? [];
    u32(contexts.length);
    for (const { context, entries, escape } of contexts) {
      for (const id of context) u8(id);
      u8(entries.length);
      for (const [symbol, freq] of entries) {
        u8(symbol);
        u16(freq);
      }
      u16(escape);
    }
  }
  return new Uint8Array(bytes).buffer;
}

/** Spread `total` over `n` slots, every slot at least 1. */
function flatFrequencies(n, total) {
  const freqs = new Array(n).fill(Math.floor(total / n));
  let assigned = freqs.reduce((a, b) => a + b, 0);
  let i = 0;
  while (assigned < total) {
    freqs[i % n] += 1;
    assigned += 1;
    i += 1;
  }
  assert.ok(freqs.every((f) => f > 0));
  return freqs;
}

/** A small but realistic model: Bangla letters, a few stored contexts. */
function tinyModel() {
  const alphabet = ['\n', ...'অআইকখগতনমরলসহািীুেো ।,?১২৩'];
  const order0 = flatFrequencies(alphabet.length + 1, QUANT_TOTAL);

  const id = (char) => alphabet.indexOf(char);
  const tables = {
    1: [
      // After 'ক', 'ম' and the vowel sign are likely; everything else escapes.
      {
        context: [id('ক')],
        entries: [
          [id('ম'), 2000],
          [id('া'), 1500],
        ],
        escape: 596,
      },
    ],
    2: [{ context: [id('ক'), id('ম')], entries: [[id('ে'), 3800]], escape: 296 }],
    3: [{ context: [id('ক'), id('ম'), id('ে')], entries: [[id('ন'), 4000]], escape: 96 }],
  };
  return Model.fromBuffer(buildModel({ alphabet, order0, tables }));
}

const SAMPLES = [
  '',
  'ক',
  'কমেন',
  'আমার সোনার বাংলা',
  'কমেন কমেন কমেন',
  'অ১২৩, আই?',
  'ক‍ম', // zero-width joiner: outside the tiny alphabet, takes the literal path
  'ok 👍',
];

test('parses a model and reads it to the last byte', () => {
  const model = tinyModel();
  assert.equal(model.maxOrder, 3);
  assert.equal(model.quantTotal, QUANT_TOTAL);
  assert.equal(model.alphabet[0], '\n');
  assert.deepEqual(model.contextCounts(), { 1: 1, 2: 1, 3: 1 });
});

test('round-trips text through bits', () => {
  const model = tinyModel();
  for (const sample of SAMPLES) {
    const bits = encodeToBits(sample, model);
    assert.equal(decodeFromBits(bits, model), sample, `sample ${JSON.stringify(sample)}`);
  }
});

test('round-trips text through a GSM-7 payload', () => {
  const model = tinyModel();
  for (const sample of SAMPLES) {
    for (const profile of ['full', 'ascii']) {
      const payload = encode(sample, model, { profile });
      assert.equal(septetCost(payload), [...payload].length, 'payload left the GSM-7 alphabet');
      assert.equal(decode(payload, model), sample, `${JSON.stringify(sample)} / ${profile}`);
    }
  }
});

test('encoding is deterministic', () => {
  const model = tinyModel();
  const text = 'কমেন আমার সোনার বাংলা ১২৩';
  const first = encode(text, model);
  for (let i = 0; i < 5; i += 1) assert.equal(encode(text, model), first);
  // A freshly parsed model must produce the identical payload, byte for byte.
  assert.equal(encode(text, tinyModel()), first);
});

test('uses the high-order context when it is stored', () => {
  const model = tinyModel();
  // 'ন' after 'কমে' holds 4000/4096 of the order-3 context, so it is near free,
  // while an unlisted symbol has to escape all the way down.
  const cheap = encodeToBits('কমেন', model).length;
  const dear = encodeToBits('কমেস', model).length;
  assert.ok(cheap < dear, `expected the predicted symbol to be cheaper: ${cheap} vs ${dear}`);
});

test('literal path survives characters outside the alphabet', () => {
  const model = tinyModel();
  const text = '👍🇧🇩ﬀ';
  assert.equal(decode(encode(text, model), model), text);
});

test('a newline in the input is dropped, not sent as end of message', () => {
  const model = tinyModel();
  assert.equal(decode(encode('কম\nেন', model), model), 'কমেন');
});

test('rejects a model whose distributions do not sum to the total', () => {
  const alphabet = ['\n', 'ক'];
  const order0 = flatFrequencies(alphabet.length + 1, QUANT_TOTAL);
  const broken = buildModel({
    alphabet,
    order0,
    tables: { 1: [{ context: [1], entries: [[1, 10]], escape: 5 }] },
  });
  assert.throws(() => Model.fromBuffer(broken), /sums to 15/);
});

test('rejects a file that is not a model', () => {
  assert.throws(
    () => Model.fromBuffer(new TextEncoder().encode('not a model at all').buffer),
    /magic/,
  );
});

test('compresses real Bangla into one segment with the shipped model', (t) => {
  if (!fs.existsSync('model.bin')) {
    t.skip('model.bin not built yet — run tools/train_model.py');
    return;
  }
  const file = fs.readFileSync('model.bin');
  const model = Model.fromBuffer(
    file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
  );

  const messages = [
    'ইন্টারনেট বন্ধ, সবাই নিরাপদে থাকুন। বাসায় ফিরে যাও এখনই।',
    'জরুরি রক্ত লাগবে ও নেগেটিভ, ঢাকা মেডিকেল কলেজ হাসপাতালে যোগাযোগ করুন।',
    'আমি ভালো আছি, চিন্তা করো না। কাল সকালে ফোন দেব।',
  ];
  for (const message of messages) {
    const payload = encode(message, model);
    assert.equal(decode(payload, model), message);
    assert.equal(gsm7Segments(payload), 1, `${message} spilled past one segment`);
  }

  const long = messages.join(' ').slice(0, 200);
  const payload = encode(long, model);
  assert.equal(decode(payload, model), long);
  const bitsPerChar = (septetCost(payload) * 7) / [...long].length;
  assert.ok(bitsPerChar < 5.5, `${bitsPerChar.toFixed(2)} bits/char leaves no room for 200 chars`);
});
