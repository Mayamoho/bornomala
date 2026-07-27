/**
 * Runtime reader for the BRNM1 model file written by tools/train_model.py.
 *
 * The file holds nothing but integers: a symbol alphabet, a complete order-0
 * frequency table, and sparse context tables for orders 1..maxOrder. Each
 * context lists its most frequent symbols plus an escape frequency; every
 * distribution sums to exactly `quantTotal`, which the arithmetic coder uses
 * as its frequency total.
 *
 * Layout (little-endian):
 *   magic "BRNM1" | u8 maxOrder | u16 quantTotal | u16 alphabetLen
 *   u32 alphabetByteLen | alphabet (UTF-8)
 *   (alphabetLen + 1) x u16          order-0 frequencies, LITERAL last
 *   per order 1..maxOrder:
 *     u32 contextCount
 *     contextCount x { order x u8 context ids | u8 entryCount
 *                      | entryCount x (u8 symbol, u16 freq) | u16 escapeFreq }
 */

const MAGIC = 'BRNM1';

export class Model {
  constructor(fields) {
    Object.assign(this, fields);
  }

  static fromBuffer(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let at = 0;

    const magic = String.fromCharCode(...bytes.subarray(0, MAGIC.length));
    if (magic !== MAGIC) throw new Error(`not a Bornomala model (magic ${JSON.stringify(magic)})`);
    at += MAGIC.length;

    const maxOrder = view.getUint8(at);
    at += 1;
    const quantTotal = view.getUint16(at, true);
    at += 2;
    const alphabetLen = view.getUint16(at, true);
    at += 2;

    const alphabetBytes = view.getUint32(at, true);
    at += 4;
    const alphabet = [...new TextDecoder().decode(bytes.subarray(at, at + alphabetBytes))];
    at += alphabetBytes;
    if (alphabet.length !== alphabetLen) {
      throw new Error(`alphabet length mismatch: ${alphabet.length} vs ${alphabetLen}`);
    }
    if (alphabet[0] !== '\n') {
      throw new Error('alphabet must start with the end-of-message symbol');
    }

    const literalId = alphabetLen;
    const order0 = new Uint16Array(alphabetLen + 1);
    for (let i = 0; i <= alphabetLen; i += 1) {
      order0[i] = view.getUint16(at, true);
      at += 2;
    }

    const tables = [];
    for (let order = 1; order <= maxOrder; order += 1) {
      const count = view.getUint32(at, true);
      at += 4;
      const table = new Map();
      for (let c = 0; c < count; c += 1) {
        const key = contextKey(bytes.subarray(at, at + order));
        at += order;
        const entries = view.getUint8(at);
        at += 1;
        const syms = new Uint8Array(entries);
        const freqs = new Uint16Array(entries);
        for (let e = 0; e < entries; e += 1) {
          syms[e] = view.getUint8(at);
          at += 1;
          freqs[e] = view.getUint16(at, true);
          at += 2;
        }
        const escape = view.getUint16(at, true);
        at += 2;
        table.set(key, { syms, freqs, escape });
      }
      tables[order] = table;
    }

    const index = new Map(alphabet.map((c, i) => [c, i]));
    const model = new Model({
      maxOrder,
      quantTotal,
      alphabet,
      index,
      literalId,
      order0,
      tables,
      bytesRead: at,
    });
    model.validate();
    return model;
  }

  /** Context table for these ids, or undefined if the context was not stored. */
  lookup(ids, order) {
    const table = this.tables[order];
    if (!table) return undefined;
    return table.get(contextKey(ids.slice(ids.length - order)));
  }

  /** Cumulative bounds for the complete order-0 distribution. */
  order0Bounds() {
    if (!this.order0Cum) {
      const cum = new Uint32Array(this.order0.length + 1);
      for (let i = 0; i < this.order0.length; i += 1) cum[i + 1] = cum[i] + this.order0[i];
      this.order0Cum = cum;
    }
    return this.order0Cum;
  }

  /** Every distribution must sum to quantTotal, or the coder desynchronises. */
  validate() {
    const zeroFree = (freqs) => freqs.every((f) => f > 0);

    const order0Sum = this.order0.reduce((a, b) => a + b, 0);
    if (order0Sum !== this.quantTotal) {
      throw new Error(`order-0 table sums to ${order0Sum}, expected ${this.quantTotal}`);
    }
    if (!zeroFree(this.order0)) throw new Error('order-0 table has a zero frequency');

    for (let order = 1; order <= this.maxOrder; order += 1) {
      for (const [key, { freqs, escape }] of this.tables[order]) {
        const sum = freqs.reduce((a, b) => a + b, 0) + escape;
        if (sum !== this.quantTotal) {
          throw new Error(`order-${order} context ${JSON.stringify(key)} sums to ${sum}`);
        }
        if (escape <= 0 || !zeroFree(freqs)) {
          throw new Error(`order-${order} context ${JSON.stringify(key)} has a zero frequency`);
        }
      }
    }
  }

  /** Contexts held per order — used by the benchmark report. */
  contextCounts() {
    const counts = {};
    for (let order = 1; order <= this.maxOrder; order += 1) {
      counts[order] = this.tables[order].size;
    }
    return counts;
  }
}

function contextKey(ids) {
  let key = '';
  for (const id of ids) key += String.fromCharCode(id);
  return key;
}
