/**
 * GSM-7 transport layer.
 *
 * The codec never writes raw septets onto the air interface — the phone's own
 * SMS composer does that. Our job is to hand the composer a *text string* it
 * will encode as GSM-7 rather than falling back to UCS-2. So the output
 * alphabet is drawn from the GSM 03.38 basic table, minus everything that is
 * fragile in transit:
 *
 *   - ESC (0x1B)      starts an extension sequence, never a standalone char
 *   - LF / CR         normalised, stripped, or turned into segment breaks
 *   - SP (0x20)       leading/trailing spaces get trimmed by composers
 *
 * Extension-table characters (^ { } \ [ ~ ] | €) never appear: they are not in
 * the basic table at all, and cost two septets each.
 *
 * Two profiles are supported. `full` uses all 124 surviving basic characters
 * (6.954 bits each). `ascii` restricts to the subset that also survives
 * transliterating gateways and non-Latin-1 keyboards, at ~7% less capacity.
 * Profile and format version travel in one marker character at the head.
 */

/** GSM 03.38 basic alphabet, index = septet value. */
export const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅå' +
  'Δ_ΦΓΛΩΠΨΣΘΞÆæßÉ' +
  ' !"#¤%&\'()*+,-./' +
  '0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNO' +
  'PQRSTUVWXYZÄÖÑÜ§' +
  '¿abcdefghijklmno' +
  'pqrstuvwxyzäöñüà';

/** Characters that are in the basic table but do not survive a round trip. */
const FRAGILE = new Set(['\n', '\r', '', ' ']);

const FULL = [...GSM7_BASIC].filter((c) => !FRAGILE.has(c));
const ASCII = FULL.filter((c) => c.codePointAt(0) < 128);

/**
 * Crockford base-32: digits and capitals with I, L, O and U removed, so no
 * pair of characters can be confused when a message is read off a printed
 * card, copied by hand, or dictated over a voice call. Five bits a character
 * instead of 6.95 — about 40% more characters — which is a real cost, and
 * worth it for the only profile a human can decode without a phone.
 */
const BASE32 = [...'0123456789ABCDEFGHJKMNPQRSTVWXYZ'];

export const ALPHABETS = { full: FULL, ascii: ASCII, base32: BASE32 };

/** Separators tolerated inside a base-32 payload, so it can be written in groups. */
const GROUP_SEPARATORS = /[\s-]+/g;

/**
 * Marker characters: each encodes (version, profile, kind). Digits follow the
 * marker, so a marker may also appear in the digit alphabet without ambiguity.
 *
 *   text   — free Bangla prose, arithmetic-coded against the model
 *   crisis — one structured phrasebook frame
 *   batch  — up to 64 frames relayed in a single message
 */
const MARKERS = [
  { char: 'B', version: 1, profile: 'full', kind: 'text' },
  { char: 'b', version: 1, profile: 'ascii', kind: 'text' },
  { char: 'C', version: 1, profile: 'full', kind: 'crisis' },
  { char: 'c', version: 1, profile: 'ascii', kind: 'crisis' },
  { char: 'H', version: 1, profile: 'base32', kind: 'crisis' },
  { char: 'D', version: 1, profile: 'full', kind: 'batch' },
  { char: 'd', version: 1, profile: 'ascii', kind: 'batch' },
  { char: 'J', version: 1, profile: 'base32', kind: 'batch' },
];

const MARKER_BY_CHAR = new Map(MARKERS.map((m) => [m.char, m]));

function alphabetFor(profile) {
  const alphabet = ALPHABETS[profile];
  if (!alphabet) throw new RangeError(`unknown profile: ${profile}`);
  return alphabet;
}

/**
 * Bits (array of 0/1, most significant first) -> transmittable text.
 *
 * A sentinel 1 bit is prepended before the base conversion so leading zeros
 * survive the round trip and the exact bit count stays recoverable.
 */
export function packBits(bits, profile = 'full', kind = 'text') {
  const alphabet = alphabetFor(profile);
  const marker = MARKERS.find(
    (m) => m.profile === profile && m.kind === kind && m.version === 1,
  );
  if (!marker) throw new RangeError(`no marker for ${kind} in the ${profile} profile`);

  const base = BigInt(alphabet.length);
  let value = 1n; // sentinel
  for (const bit of bits) {
    if (bit !== 0 && bit !== 1) throw new RangeError(`not a bit: ${bit}`);
    value = value * 2n + BigInt(bit);
  }

  const digits = [];
  while (value > 0n) {
    digits.push(alphabet[Number(value % base)]);
    value /= base;
  }
  digits.reverse();

  return marker.char + digits.join('');
}

/** Transmittable text -> { bits, profile, version, kind }. */
export function unpackBits(text) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new RangeError('empty payload');
  }
  const marker = MARKER_BY_CHAR.get(text[0]);
  if (!marker) throw new RangeError(`unrecognised marker: ${JSON.stringify(text[0])}`);

  const alphabet = alphabetFor(marker.profile);
  const index = new Map(alphabet.map((c, i) => [c, i]));
  const base = BigInt(alphabet.length);

  // Base-32 payloads are meant to be written down and read back, so accept the
  // grouping a human will have added. Other profiles use every character in
  // the alphabet as data and cannot afford to reserve separators.
  const body =
    marker.profile === 'base32'
      ? [...text].slice(1).join('').replace(GROUP_SEPARATORS, '')
      : [...text].slice(1).join('');

  let value = 0n;
  for (const char of body) {
    const digit = index.get(char);
    if (digit === undefined) {
      throw new RangeError(
        `character outside the ${marker.profile} alphabet: ${JSON.stringify(char)}`,
      );
    }
    value = value * base + BigInt(digit);
  }

  const binary = value.toString(2);
  if (binary === '0') throw new RangeError('payload carries no sentinel');
  const bits = [...binary].slice(1).map(Number); // drop the sentinel
  return { bits, profile: marker.profile, version: marker.version, kind: marker.kind };
}

/**
 * Breaks a base-32 payload into four-character groups.
 *
 * Purely presentational: `unpackBits` strips the separators again. Anyone
 * copying a code onto a form, or reading it down a phone line, loses their
 * place in an undifferentiated run of characters.
 */
export function group(text, size = 4) {
  const [marker, ...rest] = [...text];
  const chunks = [];
  for (let i = 0; i < rest.length; i += size) chunks.push(rest.slice(i, i + size).join(''));
  return [marker, ...chunks].join('-');
}

/** Septets a GSM-7 text costs; null if the text is not GSM-7 encodable. */
export function septetCost(text) {
  let cost = 0;
  for (const char of text) {
    if (!GSM7_BASIC.includes(char)) return null;
    cost += 1;
  }
  return cost;
}

/** Segments a packed GSM-7 payload needs (153 septets each once concatenated). */
export function gsm7Segments(text) {
  const cost = septetCost(text);
  if (cost === null) return null;
  return cost <= 160 ? 1 : Math.ceil(cost / 153);
}

/** Segments the same text needs as raw UCS-2 — what Bangla gets today. */
export function ucs2Segments(text) {
  const units = [...text].reduce((n, c) => n + (c.codePointAt(0) > 0xffff ? 2 : 1), 0);
  return units <= 70 ? 1 : Math.ceil(units / 67);
}
