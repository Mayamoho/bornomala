/**
 * Structured crisis frames, and batches of them.
 *
 * A frame is a fact, not a sentence: which phrasebook entry, its slot values,
 * where, how long ago, and optionally a short free-text note. Everything
 * except the note is fixed-width, written directly as bit fields rather than
 * through the arithmetic coder — that is what makes a frame decodable by hand
 * from a printed card, with no phone and no power.
 *
 *   [5] template
 *   [1] has location
 *       [1] mode: 0 district (+6 bits), 1 precise (+16 lat, +16 lon)
 *   [1] has time
 *       [5] hours ago, 0-31
 *   [n] slot values, widths from the template's slot list
 *   [1] has note
 *
 * Notes are arithmetic-coded against the Bangla model and appended after every
 * frame's fixed part, in frame order. A batch therefore parses in two passes:
 * read all the fixed parts, count the notes owed, then pull that many
 * end-of-message-terminated strings off the tail. Frames stay self-delimiting
 * because the template index fixes the width of everything that follows it.
 */

import { Encoder, Decoder } from './coder.js';
import { writeText, readText } from './codec.js';
import { FieldWriter, FieldReader } from './bitfield.js';
import { TEMPLATES, TEMPLATE_BITS, SLOTS, renderTemplate, bnNum } from './phrasebook.js';
import { DISTRICTS, encodeCoords, decodeCoords, inCoverage, districtName } from './geo.js';

const HOURS_BITS = 5;
const DISTRICT_BITS = 6;
const COORD_BITS = 16;
const BATCH_COUNT_BITS = 6; // 1..64 frames in one batch

export const MAX_BATCH = 2 ** BATCH_COUNT_BITS;
export const MAX_HOURS_AGO = 2 ** HOURS_BITS - 1;

/** Empty frame with the slot values a template needs, for the UI to fill in. */
export function blankFrame(template = 0) {
  if (!TEMPLATES[template]) throw new RangeError(`no template ${template}`);
  return {
    template,
    values: TEMPLATES[template].slots.map(() => 0),
    location: null,
    hoursAgo: null,
    note: '',
  };
}

function validate(frame) {
  const template = TEMPLATES[frame.template];
  if (!template) throw new RangeError(`no template ${frame.template}`);
  if (frame.values.length !== template.slots.length) {
    throw new RangeError(
      `template ${frame.template} takes ${template.slots.length} slot values, ` +
        `got ${frame.values.length}`,
    );
  }
  if (frame.hoursAgo != null && (frame.hoursAgo < 0 || frame.hoursAgo > MAX_HOURS_AGO)) {
    throw new RangeError(`hoursAgo must be 0..${MAX_HOURS_AGO}`);
  }
  return template;
}

function writeFixed(writer, frame) {
  const template = validate(frame);

  writer.write(frame.template, TEMPLATE_BITS);

  const { location } = frame;
  writer.flag(location != null);
  if (location != null) {
    if (location.district != null) {
      if (!(location.district >= 0 && location.district < DISTRICTS.length)) {
        throw new RangeError(`no district ${location.district}`);
      }
      writer.flag(false);
      writer.write(location.district, DISTRICT_BITS);
    } else {
      if (!inCoverage(location.lat, location.lon)) {
        throw new RangeError('coordinates fall outside the Bangladesh grid');
      }
      const { lat, lon } = encodeCoords(location.lat, location.lon);
      writer.flag(true);
      writer.write(lat, COORD_BITS);
      writer.write(lon, COORD_BITS);
    }
  }

  writer.flag(frame.hoursAgo != null);
  if (frame.hoursAgo != null) writer.write(frame.hoursAgo, HOURS_BITS);

  template.slots.forEach((slot, i) => writer.write(frame.values[i], SLOTS[slot].bits));

  writer.flag(Boolean(frame.note));
}

function readFixed(reader) {
  const template = reader.read(TEMPLATE_BITS);
  const spec = TEMPLATES[template];

  let location = null;
  if (reader.flag()) {
    if (reader.flag()) {
      const lat = reader.read(COORD_BITS);
      const lon = reader.read(COORD_BITS);
      location = { ...decodeCoords(lat, lon), precise: true };
    } else {
      location = { district: reader.read(DISTRICT_BITS), precise: false };
    }
  }

  const hoursAgo = reader.flag() ? reader.read(HOURS_BITS) : null;
  const values = spec.slots.map((slot) => reader.read(SLOTS[slot].bits));
  const hasNote = reader.flag();

  return { frame: { template, values, location, hoursAgo, note: '' }, hasNote };
}

/** Frames -> bits. `withCount` writes the batch header; a lone frame omits it. */
function encodeFrames(frames, model, { withCount }) {
  if (frames.length === 0) throw new RangeError('nothing to encode');
  if (frames.length > MAX_BATCH) throw new RangeError(`at most ${MAX_BATCH} frames per batch`);

  const writer = new FieldWriter();
  if (withCount) writer.write(frames.length - 1, BATCH_COUNT_BITS);
  for (const frame of frames) writeFixed(writer, frame);

  const noted = frames.filter((frame) => frame.note);
  if (noted.length > 0) {
    if (!model) throw new Error('notes need the language model');
    const encoder = new Encoder();
    for (const frame of noted) writeText(encoder, model, frame.note);
    writer.concat(encoder.finish());
  }
  return writer.toBits();
}

function decodeFrames(bits, model, { withCount }) {
  const reader = new FieldReader(bits);
  const count = withCount ? reader.read(BATCH_COUNT_BITS) + 1 : 1;

  const frames = [];
  const owed = [];
  for (let i = 0; i < count; i += 1) {
    const { frame, hasNote } = readFixed(reader);
    frames.push(frame);
    if (hasNote) owed.push(frame);
  }

  if (owed.length > 0) {
    if (!model) throw new Error('this message carries notes and needs the language model');
    const decoder = new Decoder(reader.rest());
    for (const frame of owed) frame.note = readText(decoder, model);
  }
  return frames;
}

export const encodeFrame = (frame, model) => encodeFrames([frame], model, { withCount: false });
export const decodeFrame = (bits, model) => decodeFrames(bits, model, { withCount: false })[0];
export const encodeBatch = (frames, model) => encodeFrames(frames, model, { withCount: true });
export const decodeBatch = (bits, model) => decodeFrames(bits, model, { withCount: true });

/** true when the frames can travel in the hand-decodable base-32 profile. */
export function isPaperSafe(frames) {
  return frames.every((frame) => !frame.note);
}

/** Human sentence for a decoded frame, in `bn` or `en`. */
export function describe(frame, lang = 'bn') {
  const parts = [renderTemplate(frame.template, frame.values, lang)];

  if (frame.location) {
    if (frame.location.precise) {
      const { lat, lon } = frame.location;
      parts.push(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    } else {
      parts.push(districtName(frame.location.district, lang));
    }
  }

  if (frame.hoursAgo != null) {
    if (lang === 'bn') {
      parts.push(frame.hoursAgo === 0 ? 'এইমাত্র' : `${bnNum(frame.hoursAgo)} ঘণ্টা আগে`);
    } else {
      parts.push(frame.hoursAgo === 0 ? 'just now' : `${frame.hoursAgo}h ago`);
    }
  }

  if (frame.note) parts.push(`“${frame.note}”`);
  return parts.join(' · ');
}

/** Geo URI for a precise frame, so the map app can take over. Null otherwise. */
export function mapLink(frame) {
  if (!frame.location || !frame.location.precise) return null;
  const { lat, lon } = frame.location;
  return `geo:${lat.toFixed(5)},${lon.toFixed(5)}`;
}
