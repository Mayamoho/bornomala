import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { Model } from '../src/model.js';
import {
  encodeText,
  encodeCrisis,
  encodeRelay,
  decodeMessage,
  describeMessage,
} from '../src/message.js';
import { blankFrame } from '../src/frame.js';
import { crc8, appendCrc, verifyCrc } from '../src/crc.js';
import { ALPHABETS, septetCost, gsm7Segments, ucs2Segments, group } from '../src/gsm7.js';

function loadModel(t) {
  if (!fs.existsSync('model.bin')) {
    t.skip('model.bin not built yet — run tools/train_model.py');
    return null;
  }
  const file = fs.readFileSync('model.bin');
  return Model.fromBuffer(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
}

const safeInDhaka = () => ({
  ...blankFrame(0),
  values: [2],
  location: { district: 17 },
  hoursAgo: 2,
});

const roster = (n) =>
  Array.from({ length: n }, (_, i) => ({
    ...blankFrame(0),
    values: [i % 16],
    location: { district: 17 },
    hoursAgo: i % 32,
  }));

test('the checksum catches damage instead of decoding it', () => {
  const bits = [1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 1];
  assert.deepEqual(verifyCrc(appendCrc(bits)), bits);

  // Every single-bit flip in the body must be caught.
  for (let i = 0; i < bits.length; i += 1) {
    const damaged = appendCrc(bits);
    damaged[i] = 1 - damaged[i];
    assert.throws(() => verifyCrc(damaged), /damaged/, `flip at ${i} slipped through`);
  }
  // Trailing zeros are what the transport actually adds, so length is folded in.
  assert.notEqual(crc8(bits), crc8([...bits, 0]));
  assert.throws(() => verifyCrc([1, 0, 1]), RangeError);
});

test('a damaged payload refuses rather than inventing Bangla', (t) => {
  const model = loadModel(t);
  if (!model) return;

  const payload = encodeText('আমরা নিরাপদ আছি', model);
  const alphabet = ALPHABETS.full;

  let caught = 0;
  for (let i = 1; i < payload.length; i += 1) {
    const swap = alphabet[(alphabet.indexOf(payload[i]) + 1) % alphabet.length];
    const damaged = payload.slice(0, i) + swap + payload.slice(i + 1);
    try {
      decodeMessage(damaged, model);
    } catch {
      caught += 1;
    }
  }
  // CRC-8 lets through about 1 in 256; on a payload this short, none should.
  assert.equal(caught, payload.length - 1, 'a corrupted payload decoded silently');
});

test('free text round-trips through the message layer', (t) => {
  const model = loadModel(t);
  if (!model) return;

  const text = 'গুলিস্তান মোড়ে আটকে আছি, বাসায় যেতে পারছি না।';
  const message = decodeMessage(encodeText(text, model), model);
  assert.equal(message.kind, 'text');
  assert.equal(message.text, text);
  assert.equal(describeMessage(message), text);
});

test('a crisis frame decodes on a phone that never got the model', () => {
  const message = decodeMessage(encodeCrisis(safeInDhaka(), null), null); // no model at all

  assert.equal(message.kind, 'crisis');
  assert.equal(describeMessage(message, 'en'), '3 of us are safe · Dhaka · 2h ago');
  assert.match(describeMessage(message, 'bn'), /ঢাকা/);
});

test('the headline claim: a full status report in a handful of characters', () => {
  const payload = encodeCrisis(safeInDhaka(), null, { paper: true });

  // The README prints this payload. If the format shifts under it, that claim
  // becomes a lie, so pin the exact bytes rather than just their length.
  assert.equal(payload, 'H428RH7E');
  assert.equal(group(payload), 'H-428R-H7E');
  assert.equal(describeMessage(decodeMessage(payload, null), 'en'), '3 of us are safe · Dhaka · 2h ago');

  // The same sentence, sent the way a phone sends Bangla today.
  const sentence = 'আমরা ৩ জন নিরাপদ আছি, ঢাকা, ২ ঘণ্টা আগে';
  assert.equal(ucs2Segments(sentence), 1);
  const ratio = ([...sentence].length * 16) / (septetCost(payload) * 7);
  assert.ok(ratio > 10, `expected better than 10x versus UCS-2, got ${ratio.toFixed(1)}x`);
});

test('the paper profile survives being written down and read back', () => {
  const payload = encodeCrisis(safeInDhaka(), null, { paper: true });
  assert.equal(payload[0], 'H');

  // Crockford base-32: no I, L, O or U to confuse with 1, 0 or V.
  assert.ok(!/[ILOU]/.test(payload.slice(1)), `ambiguous character in ${payload}`);

  // However a human writes it down, it decodes to the same thing.
  const written = group(payload);
  assert.ok(written.includes('-'));
  for (const form of [payload, written, ` ${written} `, [...payload].join(' ')]) {
    const message = decodeMessage(form, null);
    assert.equal(describeMessage(message, 'en'), '3 of us are safe · Dhaka · 2h ago');
  }
});

test('paper mode refuses what it cannot represent', () => {
  const withNote = { ...safeInDhaka(), note: 'আয়েশা' };
  assert.throws(() => encodeCrisis(withNote, null, { paper: true }), /hand-decodable/);
  assert.throws(() => encodeRelay([withNote], null, { paper: true }), /hand-decodable/);
});

test('one SMS segment relays forty-five families', () => {
  const payload = encodeRelay(roster(45), null);
  assert.equal(gsm7Segments(payload), 1, `45 frames spilled to ${septetCost(payload)} septets`);

  const back = decodeMessage(payload, null);
  assert.equal(back.kind, 'batch');
  assert.equal(back.frames.length, 45);
  assert.equal(back.frames[44].values[0], 44 % 16);
  assert.equal(back.frames[44].location.district, 17);

  // And the next one does not fit, so the number in the README is the real one.
  assert.equal(gsm7Segments(encodeRelay(roster(46), null)), 2);
});

test('relaying beats sending the same reports one at a time', () => {
  // Forty-five separate messages need forty-five segments, at best.
  assert.equal(gsm7Segments(encodeRelay(roster(45), null)), 1);
  assert.equal(
    roster(45).reduce((n, frame) => n + gsm7Segments(encodeCrisis(frame, null)), 0),
    45,
  );
});

test('a relay batch carries names when the model is present', (t) => {
  const model = loadModel(t);
  if (!model) return;

  const names = ['আয়েশা খাতুন', 'করিম মিয়া', 'সালমা বেগম', 'রফিকুল ইসলাম'];
  const frames = names.map((note) => ({
    ...blankFrame(0),
    values: [0],
    location: { district: 34 },
    note,
  }));

  const payload = encodeRelay(frames, model);
  assert.equal(gsm7Segments(payload), 1);

  const back = decodeMessage(payload, model);
  assert.deepEqual(
    back.frames.map((f) => f.note),
    names,
  );
});

test('rejects payloads it cannot trust', () => {
  assert.throws(() => decodeMessage('', null), RangeError);
  assert.throws(() => decodeMessage('Zzzz', null), RangeError); // unknown marker
  assert.throws(() => decodeMessage(`${encodeCrisis(safeInDhaka(), null)}x`, null), /damaged/);
});
