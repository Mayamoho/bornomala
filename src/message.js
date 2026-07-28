/**
 * The message layer: what actually goes into an SMS, and what comes out.
 *
 * Three kinds travel over the same transport, distinguished by the marker
 * character the receiver reads first:
 *
 *   text   — free Bangla prose against the language model
 *   crisis — one structured phrasebook frame
 *   batch  — up to 64 frames relayed together
 *
 * Every kind carries a CRC-8. The alternative is not "no checksum", it is a
 * damaged message decoding into fluent Bangla that nobody wrote, arriving at
 * someone deciding where to send a boat. Refusing is the only safe failure.
 */

import { encodeToBits, decodeFromBits } from './codec.js';
import {
  encodeFrame,
  decodeFrame,
  encodeBatch,
  decodeBatch,
  isPaperSafe,
  describe,
} from './frame.js';
import { appendCrc, verifyCrc } from './crc.js';
import { packBits, unpackBits, septetCost, gsm7Segments } from './gsm7.js';

export { describe };

function pack(bits, profile, kind) {
  return packBits(appendCrc(bits), profile, kind);
}

export function encodeText(text, model, { profile = 'full' } = {}) {
  return pack(encodeToBits(text, model), profile, 'text');
}

/**
 * One crisis frame.
 *
 * `paper: true` selects the base-32 profile, which a volunteer can decode from
 * the printed card with no device at all. It costs about 40% more characters
 * and cannot carry a free-text note, so it is offered, never forced.
 */
export function encodeCrisis(frame, model, { paper = false, profile = 'full' } = {}) {
  if (paper && !isPaperSafe([frame])) {
    throw new RangeError('a frame with a note cannot travel in the hand-decodable profile');
  }
  return pack(encodeFrame(frame, model), paper ? 'base32' : profile, 'crisis');
}

/**
 * A relay batch: many people's status in one message.
 *
 * This is the point of making a frame small. A shelter volunteer with one bar
 * of signal collects sixty families' status and spends a single SMS on all of
 * them, instead of sixty SMS that a congested cell will not carry.
 */
export function encodeRelay(frames, model, { paper = false, profile = 'full' } = {}) {
  if (paper && !isPaperSafe(frames)) {
    throw new RangeError('frames with notes cannot travel in the hand-decodable profile');
  }
  return pack(encodeBatch(frames, model), paper ? 'base32' : profile, 'batch');
}

/**
 * Decodes any Bornomala payload. The model is only needed for prose and for
 * frames carrying notes, so a structured message still opens on a phone whose
 * model download never finished.
 */
export function decodeMessage(payload, model = null) {
  const { bits, profile, kind, version } = unpackBits(payload.trim());
  const body = verifyCrc(bits);

  if (kind === 'text') {
    if (!model) throw new Error('free text needs the language model');
    return { kind, profile, version, text: decodeFromBits(body, model) };
  }
  const frames = kind === 'batch' ? decodeBatch(body, model) : [decodeFrame(body, model)];
  return { kind, profile, version, frames };
}

/** One line per frame, or the prose itself. */
export function describeMessage(message, lang = 'bn') {
  if (message.kind === 'text') return message.text;
  return message.frames.map((frame) => describe(frame, lang)).join('\n');
}

/** Transport cost of a payload, for the UI meters. */
export function cost(payload) {
  return {
    characters: [...payload].length,
    septets: septetCost(payload),
    segments: gsm7Segments(payload),
  };
}
