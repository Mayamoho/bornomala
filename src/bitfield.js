/**
 * Fixed-width bit fields.
 *
 * Structured crisis frames are written as plain fields, not through the
 * arithmetic coder. That costs a fraction of a character and buys the property
 * the arithmetic coder can never have: a human holding a printed card can
 * decode the frame by hand, with no phone and no power. See docs/decode-card.md.
 *
 * Bits are most-significant-first, as arrays of 0/1, matching src/coder.js so
 * the two streams concatenate without a conversion layer.
 */

export class FieldWriter {
  constructor() {
    this.bits = [];
  }

  /** Writes `value` in exactly `width` bits. */
  write(value, width) {
    if (!Number.isInteger(value) || value < 0 || value >= 2 ** width) {
      throw new RangeError(`${value} does not fit in ${width} bits`);
    }
    for (let shift = width - 1; shift >= 0; shift -= 1) {
      this.bits.push(Math.floor(value / 2 ** shift) % 2);
    }
  }

  flag(on) {
    this.bits.push(on ? 1 : 0);
  }

  concat(bits) {
    for (const bit of bits) this.bits.push(bit);
  }

  toBits() {
    return this.bits;
  }
}

export class FieldReader {
  constructor(bits) {
    this.bits = bits;
    this.pos = 0;
  }

  read(width) {
    if (this.pos + width > this.bits.length) {
      throw new RangeError('payload ended mid-field');
    }
    let value = 0;
    for (let i = 0; i < width; i += 1) {
      value = value * 2 + this.bits[this.pos + i];
    }
    this.pos += width;
    return value;
  }

  flag() {
    return this.read(1) === 1;
  }

  /** Everything not yet consumed — where an arithmetic-coded tail begins. */
  rest() {
    return this.bits.slice(this.pos);
  }

  get remaining() {
    return this.bits.length - this.pos;
  }
}
