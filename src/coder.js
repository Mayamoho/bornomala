/**
 * Deterministic integer arithmetic coder (Witten-Neal-Cleary, 32-bit registers).
 *
 * Every value held in a register is an integer below 2**32, and the only
 * multiplication is `range * cumFreq` with range < 2**32 and cumFreq <= 2**16.
 * That product is at most 2**48, which a double represents exactly, so the
 * coder produces bit-identical output on every JS engine. No floats, no
 * bitwise operators (those would truncate to 32-bit signed and corrupt
 * values above 2**31).
 */

const TOP = 2 ** 32;
const HALF = 2 ** 31;
const QUARTER = 2 ** 30;
const THREE_QUARTER = 3 * QUARTER;

/** Model frequency totals must stay below this or `range` can underflow. */
export const MAX_TOTAL = 2 ** 16;

export class BitWriter {
  constructor() {
    this.bits = [];
  }

  write(bit) {
    this.bits.push(bit);
  }

  /** Bits, most-significant-first, as an array of 0/1. */
  toBits() {
    return this.bits;
  }
}

export class BitReader {
  constructor(bits) {
    this.bits = bits;
    this.pos = 0;
  }

  /** Reads past the end return 0, which the decoder treats as padding. */
  read() {
    return this.pos < this.bits.length ? this.bits[this.pos++] : 0;
  }
}

export class Encoder {
  constructor() {
    this.low = 0;
    this.high = TOP - 1;
    this.pending = 0;
    this.writer = new BitWriter();
  }

  /** Encode one symbol occupying [cumLow, cumHigh) of `total`. */
  encode(cumLow, cumHigh, total) {
    assertInterval(cumLow, cumHigh, total);

    const range = this.high - this.low + 1;
    this.high = this.low + Math.floor((range * cumHigh) / total) - 1;
    this.low = this.low + Math.floor((range * cumLow) / total);

    for (;;) {
      if (this.high < HALF) {
        this.#emit(0);
      } else if (this.low >= HALF) {
        this.#emit(1);
        this.low -= HALF;
        this.high -= HALF;
      } else if (this.low >= QUARTER && this.high < THREE_QUARTER) {
        // Straddling the midpoint: defer the bit, remember we owe its opposite.
        this.pending += 1;
        this.low -= QUARTER;
        this.high -= QUARTER;
      } else {
        break;
      }
      this.low = this.low * 2;
      this.high = this.high * 2 + 1;
    }
  }

  #emit(bit) {
    this.writer.write(bit);
    while (this.pending > 0) {
      this.writer.write(1 - bit);
      this.pending -= 1;
    }
  }

  /** Flush the register. Returns the full bit array. */
  finish() {
    this.pending += 1;
    this.#emit(this.low < QUARTER ? 0 : 1);
    return this.writer.toBits();
  }
}

export class Decoder {
  constructor(bits) {
    this.reader = new BitReader(bits);
    this.low = 0;
    this.high = TOP - 1;
    this.value = 0;
    for (let i = 0; i < 32; i += 1) {
      this.value = this.value * 2 + this.reader.read();
    }
  }

  /**
   * Scaled position of the coder inside the current interval. The caller maps
   * it back to a symbol, then calls `update` with that symbol's range.
   */
  target(total) {
    if (!(Number.isInteger(total) && total > 0 && total <= MAX_TOTAL)) {
      throw new RangeError(`total out of range: ${total}`);
    }
    const range = this.high - this.low + 1;
    const t = Math.floor(((this.value - this.low + 1) * total - 1) / range);
    // Clamp: a truncated or padded bitstream can push t to total.
    return t >= total ? total - 1 : t;
  }

  update(cumLow, cumHigh, total) {
    assertInterval(cumLow, cumHigh, total);

    const range = this.high - this.low + 1;
    this.high = this.low + Math.floor((range * cumHigh) / total) - 1;
    this.low = this.low + Math.floor((range * cumLow) / total);

    for (;;) {
      if (this.high < HALF) {
        // interval already in the low half, nothing to strip
      } else if (this.low >= HALF) {
        this.low -= HALF;
        this.high -= HALF;
        this.value -= HALF;
      } else if (this.low >= QUARTER && this.high < THREE_QUARTER) {
        this.low -= QUARTER;
        this.high -= QUARTER;
        this.value -= QUARTER;
      } else {
        break;
      }
      this.low = this.low * 2;
      this.high = this.high * 2 + 1;
      this.value = this.value * 2 + this.reader.read();
    }
  }
}

function assertInterval(cumLow, cumHigh, total) {
  if (!(Number.isInteger(total) && total > 0 && total <= MAX_TOTAL)) {
    throw new RangeError(`total out of range: ${total}`);
  }
  if (!(Number.isInteger(cumLow) && Number.isInteger(cumHigh))) {
    throw new RangeError('cumulative frequencies must be integers');
  }
  if (!(cumLow >= 0 && cumLow < cumHigh && cumHigh <= total)) {
    throw new RangeError(`bad interval [${cumLow}, ${cumHigh}) of ${total}`);
  }
}
