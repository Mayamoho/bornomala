/**
 * Bornomala message codec: Bangla text <-> one GSM-7 SMS segment.
 *
 * Coding follows the model's backoff chain, order 3 down to order 0. At each
 * stored context the symbol is coded directly if the context lists it,
 * otherwise an escape is coded and the next lower order tries. A context that
 * was pruned from the model costs nothing — encoder and decoder both see it is
 * absent and skip that order. Order 0 is complete, so it always resolves.
 *
 * Characters outside the model alphabet are coded as the LITERAL symbol
 * followed by 21 raw bits of code point, which covers every Unicode plane.
 *
 * The newline symbol (id 0) marks end of message, so no length field is sent.
 */

import { Encoder, Decoder } from './coder.js';
import { packBits, unpackBits } from './gsm7.js';

const CODE_POINT_BITS = 21;
const EOM = 0;

/** Guards a corrupt payload from spinning forever in the decode loop. */
const MAX_DECODED_SYMBOLS = 10_000;

export function encode(text, model, { profile = 'full' } = {}) {
  return packBits(encodeToBits(text, model), profile);
}

export function decode(payload, model) {
  return decodeFromBits(unpackBits(payload).bits, model);
}

export function encodeToBits(text, model) {
  const encoder = new Encoder();
  writeText(encoder, model, text);
  return encoder.finish();
}

export function decodeFromBits(bits, model) {
  return readText(new Decoder(bits), model);
}

/**
 * Writes one end-of-message-terminated string into an open arithmetic stream.
 *
 * Exposed so structured frames (src/frame.js) can append several notes to a
 * single stream. Each string carries its own terminator, so the reader
 * recovers them one after another without a length field.
 */
export function writeText(encoder, model, text) {
  const history = new Array(model.maxOrder).fill(EOM);

  for (const char of text.normalize('NFC')) {
    const id = model.index.has(char) ? model.index.get(char) : model.literalId;
    if (id === EOM) continue; // a literal newline would truncate the message
    encodeSymbol(encoder, model, history, id);
    if (id === model.literalId) {
      encodeRaw(encoder, char.codePointAt(0), CODE_POINT_BITS);
    }
    pushHistory(history, id, model.maxOrder);
  }

  encodeSymbol(encoder, model, history, EOM);
}

/** Reads back one string written by `writeText`. */
export function readText(decoder, model) {
  const history = new Array(model.maxOrder).fill(EOM);
  const out = [];

  for (let i = 0; i < MAX_DECODED_SYMBOLS; i += 1) {
    const id = decodeSymbol(decoder, model, history);
    if (id === EOM) return out.join('');
    if (id === model.literalId) {
      out.push(String.fromCodePoint(decodeRaw(decoder, CODE_POINT_BITS)));
    } else {
      out.push(model.alphabet[id]);
    }
    pushHistory(history, id, model.maxOrder);
  }
  throw new Error('payload never reached end of message');
}

function pushHistory(history, id, maxOrder) {
  history.push(id);
  if (history.length > maxOrder) history.shift();
}

function encodeSymbol(encoder, model, history, symbol) {
  const total = model.quantTotal;

  for (let order = model.maxOrder; order >= 1; order -= 1) {
    const context = model.lookup(history, order);
    if (!context) continue;

    const { syms, freqs, escape } = context;
    let cum = 0;
    let found = -1;
    for (let i = 0; i < syms.length; i += 1) {
      if (syms[i] === symbol) {
        found = i;
        break;
      }
      cum += freqs[i];
    }
    if (found >= 0) {
      encoder.encode(cum, cum + freqs[found], total);
      return;
    }
    encoder.encode(total - escape, total, total); // escape occupies the top slot
  }

  const bounds = model.order0Bounds();
  encoder.encode(bounds[symbol], bounds[symbol + 1], total);
}

function decodeSymbol(decoder, model, history) {
  const total = model.quantTotal;

  for (let order = model.maxOrder; order >= 1; order -= 1) {
    const context = model.lookup(history, order);
    if (!context) continue;

    const { syms, freqs, escape } = context;
    const target = decoder.target(total);
    if (target >= total - escape) {
      decoder.update(total - escape, total, total);
      continue;
    }
    let cum = 0;
    for (let i = 0; i < syms.length; i += 1) {
      if (target < cum + freqs[i]) {
        decoder.update(cum, cum + freqs[i], total);
        return syms[i];
      }
      cum += freqs[i];
    }
    throw new Error('context table does not cover its own frequency total');
  }

  const bounds = model.order0Bounds();
  const target = decoder.target(total);
  let lo = 0;
  let hi = bounds.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (bounds[mid] <= target) lo = mid;
    else hi = mid;
  }
  decoder.update(bounds[lo], bounds[lo + 1], total);
  return lo;
}

function encodeRaw(encoder, value, bits) {
  for (let shift = bits - 1; shift >= 0; shift -= 1) {
    const bit = Math.floor(value / 2 ** shift) % 2;
    encoder.encode(bit, bit + 1, 2);
  }
}

function decodeRaw(decoder, bits) {
  let value = 0;
  for (let i = 0; i < bits; i += 1) {
    const bit = decoder.target(2);
    decoder.update(bit, bit + 1, 2);
    value = value * 2 + bit;
  }
  return value;
}
