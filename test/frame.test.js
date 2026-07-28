import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { Model } from '../src/model.js';
import {
  blankFrame,
  encodeFrame,
  decodeFrame,
  encodeBatch,
  decodeBatch,
  describe,
  mapLink,
  isPaperSafe,
  MAX_BATCH,
  MAX_HOURS_AGO,
} from '../src/frame.js';
import { TEMPLATES, TEMPLATE_BITS, SLOTS, renderTemplate } from '../src/phrasebook.js';
import { DISTRICTS, encodeCoords, decodeCoords, gridResolution, inCoverage } from '../src/geo.js';

function loadModel(t) {
  if (!fs.existsSync('model.bin')) {
    t.skip('model.bin not built yet — run tools/train_model.py');
    return null;
  }
  const file = fs.readFileSync('model.bin');
  return Model.fromBuffer(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
}

function frame(overrides = {}) {
  const base = TEMPLATES[overrides.template] ? blankFrame(overrides.template) : blankFrame(0);
  return { ...base, ...overrides };
}

test('the phrasebook fills its index space exactly', () => {
  assert.equal(TEMPLATES.length, 2 ** TEMPLATE_BITS);
  for (const [id, template] of TEMPLATES.entries()) {
    assert.ok(template.bn && template.en, `template ${id} is missing a language`);
    for (const slot of template.slots) {
      assert.ok(SLOTS[slot], `template ${id} references unknown slot ${slot}`);
    }
    // Every placeholder must have a slot, and every slot a placeholder.
    for (let i = 0; i < template.slots.length; i += 1) {
      assert.ok(template.bn.includes(`{${i}}`), `template ${id} bn is missing {${i}}`);
      assert.ok(template.en.includes(`{${i}}`), `template ${id} en is missing {${i}}`);
    }
    assert.ok(!template.bn.includes(`{${template.slots.length}}`), `template ${id} over-slotted`);
  }
});

test('slot ladders cover their declared bit width', () => {
  assert.equal(2 ** SLOTS.urgency.bits, 4);
  assert.equal(2 ** SLOTS.blood.bits, 8);
  assert.equal(2 ** SLOTS.depth.bits, 8);
  assert.equal(2 ** SLOTS.capacity.bits, 16);
  for (const slot of Object.keys(SLOTS)) {
    // Every reachable value must render, in both languages.
    for (let v = 0; v < 2 ** SLOTS[slot].bits; v += 1) {
      for (const lang of ['bn', 'en']) {
        assert.equal(typeof SLOTS[slot].render(v, lang), 'string', `${slot}=${v} ${lang}`);
      }
    }
  }
});

test('Bangla sentences carry Bangla numerals, never Latin ones', () => {
  for (const [id, template] of TEMPLATES.entries()) {
    const values = template.slots.map((slot) => 2 ** SLOTS[slot].bits - 2);
    const sentence = describe(
      { template: id, values, location: { district: 17 }, hoursAgo: 12, note: '' },
      'bn',
    );
    // Blood groups are Latin by convention everywhere, including in Bangla.
    if (template.slots.includes('blood')) continue;
    assert.doesNotMatch(sentence, /[0-9]/, `template ${id} leaked a Latin digit: ${sentence}`);
  }
});

test('there are exactly 64 districts, so the index is six bits', () => {
  assert.equal(DISTRICTS.length, 64);
  assert.equal(new Set(DISTRICTS.map((d) => d.en)).size, 64);
  assert.equal(new Set(DISTRICTS.map((d) => d.bn)).size, 64);
});

test('the coordinate grid resolves to about ten metres', () => {
  const { latMetres, lonMetres } = gridResolution();
  assert.ok(latMetres < 12 && lonMetres < 12, `grid too coarse: ${latMetres}, ${lonMetres}`);

  // Shahbagh, the corners of the box, and Chattogram all survive the round trip.
  for (const [lat, lon] of [
    [23.7379, 90.3956],
    [20.5, 88.0],
    [26.75, 92.75],
    [22.3569, 91.7832],
  ]) {
    assert.ok(inCoverage(lat, lon));
    const q = encodeCoords(lat, lon);
    const back = decodeCoords(q.lat, q.lon);
    assert.ok(Math.abs(back.lat - lat) < 0.0001, `lat drifted: ${back.lat} vs ${lat}`);
    assert.ok(Math.abs(back.lon - lon) < 0.0001, `lon drifted: ${back.lon} vs ${lon}`);
  }
  assert.equal(inCoverage(51.5, -0.12), false); // London is not in the grid
});

test('a frame round-trips through every template and slot value', () => {
  for (const [id, template] of TEMPLATES.entries()) {
    const values = template.slots.map((slot) => 2 ** SLOTS[slot].bits - 1);
    const original = frame({ template: id, values, location: { district: 63 }, hoursAgo: 31 });
    const back = decodeFrame(encodeFrame(original, null), null);

    assert.equal(back.template, id);
    assert.deepEqual(back.values, values);
    assert.equal(back.location.district, 63);
    assert.equal(back.hoursAgo, 31);
    assert.equal(typeof describe(back, 'bn'), 'string');
    assert.equal(typeof describe(back, 'en'), 'string');
  }
});

test('a frame with no location and no time is under twenty bits', () => {
  const bits = encodeFrame(frame({ template: 15 }), null); // "no electricity"
  assert.ok(bits.length < 20, `expected a tiny frame, got ${bits.length} bits`);
  assert.deepEqual(decodeFrame(bits, null).location, null);
  assert.equal(decodeFrame(bits, null).hoursAgo, null);
});

test('the headline frame — safe, with district and time — fits in 24 bits', () => {
  const safe = frame({ template: 0, values: [2], location: { district: 17 }, hoursAgo: 2 });
  const bits = encodeFrame(safe, null);
  assert.equal(bits.length, 24);

  const back = decodeFrame(bits, null);
  assert.equal(renderTemplate(back.template, back.values, 'en'), '3 of us are safe');
  assert.match(describe(back, 'en'), /Dhaka/);
  assert.match(describe(back, 'bn'), /ঢাকা/);
});

test('precise location survives and produces a map link', () => {
  const here = frame({ template: 2, values: [4], location: { lat: 23.7379, lon: 90.3956 } });
  const back = decodeFrame(encodeFrame(here, null), null);

  assert.equal(back.location.precise, true);
  assert.ok(Math.abs(back.location.lat - 23.7379) < 0.0002);
  assert.match(mapLink(back), /^geo:23\.737/);
  assert.equal(mapLink(frame({ location: { district: 3 } })), null);
});

test('a batch round-trips every frame in order', () => {
  const frames = Array.from({ length: MAX_BATCH }, (_, i) =>
    frame({
      template: i % TEMPLATES.length,
      values: TEMPLATES[i % TEMPLATES.length].slots.map((slot) => i % 2 ** SLOTS[slot].bits),
      location: i % 3 === 0 ? { district: i % 64 } : null,
      hoursAgo: i % 2 === 0 ? i % (MAX_HOURS_AGO + 1) : null,
    }),
  );

  const back = decodeBatch(encodeBatch(frames, null), null);
  assert.equal(back.length, MAX_BATCH);
  for (const [i, decoded] of back.entries()) {
    assert.equal(decoded.template, frames[i].template, `frame ${i} template`);
    assert.deepEqual(decoded.values, frames[i].values, `frame ${i} values`);
    assert.equal(decoded.hoursAgo, frames[i].hoursAgo, `frame ${i} time`);
    assert.deepEqual(
      decoded.location ? decoded.location.district : null,
      frames[i].location ? frames[i].location.district : null,
      `frame ${i} location`,
    );
  }
});

test('a batch costs nothing but its frames', () => {
  // 45 families reporting safe, with district and hours-ago. The batch header
  // is six bits and there is no per-frame overhead at all: frames are
  // self-delimiting because the template index fixes every width after it.
  const roster = Array.from({ length: 45 }, (_, i) =>
    frame({ template: 0, values: [i % 16], location: { district: 17 }, hoursAgo: i % 32 }),
  );
  assert.equal(encodeBatch(roster, null).length, 6 + 45 * 24);
});

test('rejects frames the format cannot represent', () => {
  assert.throws(() => blankFrame(99), RangeError);
  assert.throws(() => encodeFrame(frame({ template: 99 }), null), RangeError);
  assert.throws(() => encodeFrame({ ...frame(), values: [] }, null), RangeError);
  assert.throws(() => encodeFrame(frame({ hoursAgo: 32 }), null), RangeError);
  assert.throws(() => encodeFrame(frame({ location: { district: 64 } }), null), RangeError);
  assert.throws(() => encodeFrame(frame({ location: { lat: 51.5, lon: -0.12 } }), null), RangeError);
  assert.throws(() => encodeBatch([], null), RangeError);
  assert.throws(() => encodeBatch(new Array(MAX_BATCH + 1).fill(frame()), null), RangeError);
});

test('notes need the model, and structured frames do not', () => {
  assert.equal(isPaperSafe([frame(), frame()]), true);
  assert.equal(isPaperSafe([frame(), frame({ note: 'বাবা' })]), false);
  assert.throws(() => encodeFrame(frame({ note: 'বাবা' }), null), /model/);
});

test('notes round-trip inside frames and batches', (t) => {
  const model = loadModel(t);
  if (!model) return;

  const one = frame({ template: 9, note: 'রফিকুল ইসলাম', location: { district: 41 } });
  assert.equal(decodeFrame(encodeFrame(one, model), model).note, 'রফিকুল ইসলাম');

  const names = ['আয়েশা', 'করিম মিয়া', 'সালমা বেগম'];
  const frames = names.map((note, i) => frame({ template: 0, values: [i], note }));
  frames.splice(1, 0, frame({ template: 15 })); // an un-noted frame in the middle

  const back = decodeBatch(encodeBatch(frames, model), model);
  assert.deepEqual(
    back.map((f) => f.note),
    [names[0], '', names[1], names[2]],
  );
});

test('a named status report still costs well under one segment', (t) => {
  const model = loadModel(t);
  if (!model) return;

  const bits = encodeFrame(
    frame({ template: 0, values: [3], location: { district: 17 }, hoursAgo: 1, note: 'আয়েশা' }),
    model,
  );
  assert.ok(bits.length < 90, `named frame grew to ${bits.length} bits`);
});
