/**
 * A QR encoder, because sometimes there is no network at all.
 *
 * Two phones in the same room, both offline, no Bluetooth pairing and no
 * mesh: one shows a code, the other points its camera. That is the last
 * transport below SMS, and it needs no radio, no operator and no permission.
 *
 * Scope is deliberately narrow — error correction level M, versions 1 to 20,
 * alphanumeric and byte modes. That covers every payload this app produces
 * with room to spare, and keeps the capacity tables small enough to read and
 * check by hand. ISO/IEC 18004.
 *
 * Level M corrects about 15% of the symbol. On a cracked screen in daylight,
 * held by someone whose hands are not steady, that is the level worth paying
 * for.
 */

/* ─────────────────────────── capacity tables ────────────────────────── */

/**
 * Per version at level M: [ecCodewordsPerBlock, group1Blocks, group1Data,
 * group2Blocks, group2Data].
 *
 * `TOTAL_CODEWORDS` is the independent figure from the standard; the two must
 * agree, which is what makes a typo here a test failure rather than an
 * unscannable code.
 */
export const EC_LEVEL_M = [
  null,
  [10, 1, 16, 0, 0],
  [16, 1, 28, 0, 0],
  [26, 1, 44, 0, 0],
  [18, 2, 32, 0, 0],
  [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0],
  [18, 4, 31, 0, 0],
  [22, 2, 38, 2, 39],
  [22, 3, 36, 2, 37],
  [26, 4, 43, 1, 44],
  [30, 1, 50, 4, 51],
  [22, 6, 36, 2, 37],
  [22, 8, 37, 1, 38],
  [24, 4, 40, 5, 41],
  [24, 5, 41, 5, 42],
  [28, 7, 45, 3, 46],
  [28, 10, 46, 1, 47],
  [26, 9, 43, 4, 44],
  [26, 3, 44, 11, 45],
  [26, 3, 41, 13, 42],
];

export const TOTAL_CODEWORDS = [
  0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655, 733, 815, 901, 991,
  1085,
];

/** Row and column centres of the alignment patterns, per version. */
const ALIGNMENT = [
  null,
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
];

export const MAX_VERSION = 20;

const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

/* ──────────────────────────── GF(256) and RS ────────────────────────── */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

for (let i = 0, x = 1; i < 255; i += 1) {
  EXP[i] = x;
  LOG[x] = i;
  x *= 2;
  if (x >= 256) x ^= 0x11d; // the QR primitive polynomial
}
for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];

const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Generator polynomial for `degree` error-correction codewords. */
function generator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function remainder(data, degree) {
  const gen = generator(degree);
  const out = new Array(degree).fill(0);

  for (const byte of data) {
    const factor = byte ^ out[0];
    out.shift();
    out.push(0);
    for (let i = 0; i < degree; i += 1) out[i] ^= mul(gen[i + 1], factor);
  }
  return out;
}

/* ──────────────────────────── bit assembly ──────────────────────────── */

class Bits {
  constructor() {
    this.bits = [];
  }

  push(value, width) {
    for (let shift = width - 1; shift >= 0; shift -= 1) {
      this.bits.push(Math.floor(value / 2 ** shift) % 2);
    }
  }

  get length() {
    return this.bits.length;
  }
}

const isAlnum = (text) => [...text].every((c) => ALNUM.includes(c));

function countBits(mode, version) {
  if (mode === 'byte') return version <= 9 ? 8 : 16;
  return version <= 9 ? 9 : 11; // alphanumeric
}

function dataCodewords(version) {
  const [, blocks1, data1, blocks2, data2] = EC_LEVEL_M[version];
  return blocks1 * data1 + blocks2 * data2;
}

function payloadBits(mode, bytes, length, version) {
  const header = 4 + countBits(mode, version);
  return mode === 'byte'
    ? header + bytes.length * 8
    : header + Math.floor(length / 2) * 11 + (length % 2 ? 6 : 0);
}

function chooseVersion(mode, bytes, length) {
  for (let version = 1; version <= MAX_VERSION; version += 1) {
    if (payloadBits(mode, bytes, length, version) <= dataCodewords(version) * 8) return version;
  }
  throw new RangeError('too much data for a version-20 QR code');
}

function encodeData(text, mode, version) {
  const bits = new Bits();
  const bytes = new TextEncoder().encode(text);
  const chars = [...text];

  bits.push(mode === 'byte' ? 0b0100 : 0b0010, 4);
  bits.push(mode === 'byte' ? bytes.length : chars.length, countBits(mode, version));

  if (mode === 'byte') {
    for (const byte of bytes) bits.push(byte, 8);
  } else {
    for (let i = 0; i + 1 < chars.length; i += 2) {
      bits.push(ALNUM.indexOf(chars[i]) * 45 + ALNUM.indexOf(chars[i + 1]), 11);
    }
    if (chars.length % 2) bits.push(ALNUM.indexOf(chars[chars.length - 1]), 6);
  }

  const capacity = dataCodewords(version) * 8;
  bits.push(0, Math.min(4, capacity - bits.length)); // terminator
  while (bits.length % 8 !== 0) bits.push(0, 1);

  const codewords = [];
  for (let i = 0; i < bits.bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = byte * 2 + bits.bits[i + j];
    codewords.push(byte);
  }
  // Pad alternately with the two bytes the standard names, which keep the
  // symbol from developing large blank regions.
  for (let i = 0; codewords.length < dataCodewords(version); i += 1) {
    codewords.push(i % 2 === 0 ? 0xec : 0x11);
  }
  return codewords;
}

/** Splits into blocks, computes error correction, and interleaves both. */
function interleave(codewords, version) {
  const [ecPerBlock, blocks1, data1, blocks2, data2] = EC_LEVEL_M[version];

  const blocks = [];
  let offset = 0;
  for (let i = 0; i < blocks1 + blocks2; i += 1) {
    const size = i < blocks1 ? data1 : data2;
    const data = codewords.slice(offset, offset + size);
    offset += size;
    blocks.push({ data, ec: remainder(data, ecPerBlock) });
  }

  const out = [];
  for (let i = 0; i < Math.max(data1, data2); i += 1) {
    for (const block of blocks) if (i < block.data.length) out.push(block.data[i]);
  }
  for (let i = 0; i < ecPerBlock; i += 1) {
    for (const block of blocks) out.push(block.ec[i]);
  }
  return out;
}

/* ────────────────────────────── the matrix ──────────────────────────── */

/**
 * A symbol is two parallel grids: the modules themselves, and a map of which
 * cells belong to function patterns.
 *
 * Keeping them separate is not tidiness. Once the finders and timing patterns
 * are written they are indistinguishable from data by value alone, and both
 * the data placement and the mask have to skip them — a mask applied over a
 * finder pattern produces a symbol no scanner will look at twice.
 */
function newSymbol(size) {
  return {
    size,
    modules: Array.from({ length: size }, () => new Uint8Array(size)),
    reserved: Array.from({ length: size }, () => new Uint8Array(size)),
  };
}

function set(symbol, row, col, value) {
  symbol.modules[row][col] = value;
  symbol.reserved[row][col] = 1;
}

/** The finder pattern plus the separator strip around it. */
function placeFinder(symbol, row, col) {
  const { size } = symbol;
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
      const inner = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const ring = inner && (r === 0 || r === 6 || c === 0 || c === 6);
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      set(symbol, rr, cc, ring || core ? 1 : 0);
    }
  }
}

function placeAlignment(symbol, version) {
  const centres = ALIGNMENT[version];
  const last = symbol.size - 1;

  for (const row of centres) {
    for (const col of centres) {
      // The three finder corners already occupy these positions.
      const atFinder =
        (row === 6 && col === 6) ||
        (row === 6 && col === last - 6) ||
        (row === last - 6 && col === 6);
      if (atFinder) continue;

      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) {
          const ring = Math.max(Math.abs(r), Math.abs(c));
          set(symbol, row + r, col + c, ring === 1 ? 0 : 1);
        }
      }
    }
  }
}

function placeFunctionPatterns(symbol, version) {
  const { size } = symbol;

  placeFinder(symbol, 0, 0);
  placeFinder(symbol, 0, size - 7);
  placeFinder(symbol, size - 7, 0);

  for (let i = 8; i < size - 8; i += 1) {
    set(symbol, 6, i, i % 2 === 0 ? 1 : 0);
    set(symbol, i, 6, i % 2 === 0 ? 1 : 0);
  }

  placeAlignment(symbol, version);

  set(symbol, size - 8, 8, 1); // the dark module, always set

  // Reserve both copies of the format area. Values arrive once a mask is
  // chosen; until then these cells only need to be off-limits.
  for (let i = 0; i <= 8; i += 1) {
    symbol.reserved[8][i] = 1;
    symbol.reserved[i][8] = 1;
  }
  for (let i = 0; i < 8; i += 1) {
    symbol.reserved[8][size - 1 - i] = 1;
    symbol.reserved[size - 1 - i][8] = 1;
  }

  if (version >= 7) {
    for (let i = 0; i < 18; i += 1) {
      const row = Math.floor(i / 3);
      const col = size - 11 + (i % 3);
      symbol.reserved[row][col] = 1;
      symbol.reserved[col][row] = 1;
    }
  }
}

function placeData(symbol, codewords) {
  const { size } = symbol;
  const bits = [];
  for (const byte of codewords) {
    for (let shift = 7; shift >= 0; shift -= 1) bits.push(Math.floor(byte / 2 ** shift) % 2);
  }

  let index = 0;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1; // the vertical timing pattern is never data
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (symbol.reserved[row][col]) continue;
        symbol.modules[row][col] = index < bits.length ? bits[index] : 0;
        index += 1;
      }
    }
    upward = !upward;
  }
}

const MASKS = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
];

/** Penalty rules 1-4 from the standard; the lowest total wins. */
function penalty(matrix) {
  const size = matrix.length;
  let score = 0;

  const runScore = (line) => {
    let total = 0;
    let run = 1;
    for (let i = 1; i < size; i += 1) {
      if (line[i] === line[i - 1]) {
        run += 1;
      } else {
        if (run >= 5) total += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) total += 3 + (run - 5);
    return total;
  };

  const columns = [];
  for (let j = 0; j < size; j += 1) columns.push(matrix.map((row) => row[j]));

  for (let i = 0; i < size; i += 1) {
    score += runScore(matrix[i]);
    score += runScore(columns[i]);
  }

  for (let i = 0; i < size - 1; i += 1) {
    for (let j = 0; j < size - 1; j += 1) {
      const a = matrix[i][j];
      if (a === matrix[i][j + 1] && a === matrix[i + 1][j] && a === matrix[i + 1][j + 1]) score += 3;
    }
  }

  const FINDER = [1, 0, 1, 1, 1, 0, 1];
  const looksLikeFinder = (line, at) => {
    for (let k = 0; k < 7; k += 1) if (line[at + k] !== FINDER[k]) return false;
    const clear = (run) => run.length === 4 && run.every((v) => v === 0);
    return clear(line.slice(Math.max(0, at - 4), at)) || clear(line.slice(at + 7, at + 11));
  };

  for (let i = 0; i < size; i += 1) {
    const row = [...matrix[i]];
    const col = columns[i];
    for (let j = 0; j + 7 <= size; j += 1) {
      if (looksLikeFinder(row, j)) score += 40;
      if (looksLikeFinder(col, j)) score += 40;
    }
  }

  let dark = 0;
  for (const row of matrix) for (const cell of row) dark += cell;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

/** BCH-protected format bits for level M and the chosen mask. */
function formatBits(mask) {
  const data = 0b00 * 8 + mask; // level M is 00
  let value = data * 2 ** 10;
  for (let i = 14; i >= 10; i -= 1) {
    if (Math.floor(value / 2 ** i) % 2) value ^= 0b10100110111 * 2 ** (i - 10);
  }
  return (data * 2 ** 10 + value) ^ 0b101010000010010;
}

function versionBits(version) {
  let value = version * 2 ** 12;
  for (let i = 17; i >= 12; i -= 1) {
    if (Math.floor(value / 2 ** i) % 2) value ^= 0b1111100100101 * 2 ** (i - 12);
  }
  return version * 2 ** 12 + value;
}

function writeFormat(matrix, mask) {
  const size = matrix.length;
  const bits = formatBits(mask);
  const bit = (i) => Math.floor(bits / 2 ** i) % 2;

  // First copy, wrapped around the top-left finder: down column 8, then back
  // along row 8. Note which index is the row — the two strips are not
  // symmetric, and transposing them yields a symbol that looks perfectly
  // well-formed and decodes in nothing.
  for (let i = 0; i <= 5; i += 1) matrix[i][8] = bit(i);
  matrix[7][8] = bit(6);
  matrix[8][8] = bit(7);
  matrix[8][7] = bit(8);
  for (let i = 9; i <= 14; i += 1) matrix[8][14 - i] = bit(i);

  // Second copy: bits 0-7 along row 8 from the right edge, bits 8-14 up
  // column 8 from the bottom. It stops at row size-7, because (size-8, 8) is
  // the dark module and is not format information.
  for (let i = 0; i <= 7; i += 1) matrix[8][size - 1 - i] = bit(i);
  for (let i = 8; i <= 14; i += 1) matrix[size - 15 + i][8] = bit(i);
  matrix[size - 8][8] = 1;
}

function writeVersion(matrix, version) {
  if (version < 7) return;
  const size = matrix.length;
  const bits = versionBits(version);

  for (let i = 0; i < 18; i += 1) {
    const value = Math.floor(bits / 2 ** i) % 2;
    const row = Math.floor(i / 3);
    const col = size - 11 + (i % 3);
    matrix[row][col] = value;
    matrix[col][row] = value;
  }
}

/* ──────────────────────────────── public ───────────────────────────── */

/**
 * Encodes `text` into a QR symbol.
 *
 * Returns the module matrix as rows of 0/1, where 1 is dark. The caller adds
 * the quiet zone — `toSvg` does.
 */
export function encodeQr(text) {
  if (typeof text !== 'string' || text.length === 0) throw new RangeError('nothing to encode');

  const bytes = new TextEncoder().encode(text);
  const mode = isAlnum(text) ? 'alnum' : 'byte';
  const version = chooseVersion(mode, bytes, [...text].length);

  const codewords = interleave(encodeData(text, mode, version), version);
  const size = 17 + 4 * version;

  const symbol = newSymbol(size);
  placeFunctionPatterns(symbol, version);
  placeData(symbol, codewords);

  let best = null;
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = symbol.modules.map((row) => Uint8Array.from(row));
    for (let i = 0; i < size; i += 1) {
      for (let j = 0; j < size; j += 1) {
        // Function patterns are never masked, whatever their value happens
        // to be — that is the whole reason `reserved` is tracked separately.
        if (!symbol.reserved[i][j] && MASKS[mask](i, j)) candidate[i][j] ^= 1;
      }
    }
    writeFormat(candidate, mask);
    writeVersion(candidate, version);

    const score = penalty(candidate);
    if (!best || score < best.score) best = { score, mask, modules: candidate };
  }

  return { version, size, mask: best.mask, mode, modules: best.modules };
}

/** The symbol as a standalone SVG string, quiet zone included. */
export function toSvg(
  { size, modules },
  { scale = 4, quiet = 4, dark = '#000', light = '#fff' } = {},
) {
  const side = (size + quiet * 2) * scale;
  const path = [];

  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j < size; j += 1) {
      if (modules[i][j] === 1) {
        path.push(`M${(j + quiet) * scale} ${(i + quiet) * scale}h${scale}v${scale}h-${scale}z`);
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" ` +
    `viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges">` +
    `<rect width="${side}" height="${side}" fill="${light}"/>` +
    `<path fill="${dark}" d="${path.join('')}"/></svg>`
  );
}
