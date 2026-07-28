/**
 * CRC-8/ATM (polynomial 0x07) over a bit array.
 *
 * An SMS crossing a congested 2G network can arrive with characters dropped,
 * doubled or transliterated. Without a check, a mangled payload decodes to
 * *plausible Bangla that nobody sent* — the worst possible failure for a
 * message about where someone is trapped. Eight bits costs a little over one
 * character and turns silent corruption into a visible refusal.
 */

const TABLE = (() => {
  const table = new Uint8Array(256);
  for (let byte = 0; byte < 256; byte += 1) {
    let crc = byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc >= 128 ? ((crc - 128) * 2) ^ 0x07 : crc * 2;
    }
    table[byte] = crc;
  }
  return table;
})();

/** CRC-8 of a bit array, zero-padded on the right to a byte boundary. */
export function crc8(bits) {
  let crc = 0;
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) {
      byte = byte * 2 + (i + j < bits.length ? bits[i + j] : 0);
    }
    crc = TABLE[crc ^ byte];
  }
  // Fold the length in as well. Otherwise trailing zero bits — which the
  // transport is free to add or drop as padding — would not change the sum.
  return TABLE[crc ^ (bits.length % 256)];
}

export function appendCrc(bits) {
  const crc = crc8(bits);
  const out = bits.slice();
  for (let shift = 7; shift >= 0; shift -= 1) {
    out.push(Math.floor(crc / 2 ** shift) % 2);
  }
  return out;
}

/** Strips and verifies the trailing checksum. Throws if it does not match. */
export function verifyCrc(bits) {
  if (bits.length < 8) throw new RangeError('payload too short to carry a checksum');
  const body = bits.slice(0, bits.length - 8);
  let found = 0;
  for (let i = bits.length - 8; i < bits.length; i += 1) found = found * 2 + bits[i];
  if (found !== crc8(body)) {
    throw new RangeError('checksum failed — the message was damaged in transit');
  }
  return body;
}
