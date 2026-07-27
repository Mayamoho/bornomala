/**
 * Benchmark Bornomala against the two things a Bangla SMS can be today:
 * raw UCS-2 (what phones actually send) and gzip (the obvious generic
 * alternative). Runs on held-out corpus lines the model never saw.
 *
 *   node tools/benchmark.js [--lines 5000] [--skip 400000] [--json web/benchmark.json]
 *
 * Reported per codec:
 *   bits/char        payload bits divided by input characters
 *   chars/segment    how much Bangla fits in one 160-septet SMS segment
 *   one segment      share of messages that fit in a single segment
 */

import fs from 'node:fs';
import zlib from 'node:zlib';

import { Model } from '../src/model.js';
import { encode, decode } from '../src/codec.js';
import { septetCost, gsm7Segments, ucs2Segments } from '../src/gsm7.js';

const DEFAULTS = {
  model: 'model.bin',
  corpus: ['corpus/clean/opensubtitles-bn.txt'],
  lines: 5000,
  // Mirror of --holdout-every in tools/train_model.py: these lines were
  // skipped during training, so the model has never read them.
  holdout: 50,
  json: null,
};

function parseArgs(argv) {
  const options = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    const value = argv[i + 1];
    if (key === 'corpus') options.corpus = value.split(',');
    else if (key in options) options[key] = Number.isNaN(Number(value)) ? value : Number(value);
    else throw new Error(`unknown option: ${argv[i]}`);
  }
  return options;
}

function readModel(path) {
  const file = fs.readFileSync(path);
  return Model.fromBuffer(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
}

/**
 * Held-out lines, streamed. Corpus files run to gigabytes, well past the
 * length V8 allows a single string, so the file is read in chunks and split
 * on newlines as it goes.
 */
function* heldOutLines(paths, holdout, limit) {
  let taken = 0;
  for (const path of paths) {
    let lineno = 0;
    let pending = '';
    const fd = fs.openSync(path, 'r');
    const buffer = Buffer.alloc(1 << 20);
    const decoder = new TextDecoder('utf-8');

    try {
      for (;;) {
        const read = fs.readSync(fd, buffer, 0, buffer.length, null);
        const done = read === 0;
        pending += done
          ? decoder.decode()
          : decoder.decode(buffer.subarray(0, read), { stream: true });

        const parts = pending.split('\n');
        pending = done ? '' : parts.pop();

        for (const raw of parts) {
          lineno += 1;
          if (holdout && lineno % holdout !== 0) continue; // trained-on line
          const line = raw.normalize('NFC').trim();
          if (line.length < 12) continue;
          yield line;
          taken += 1;
          if (taken >= limit) return;
        }
        if (done) break;
      }
    } finally {
      fs.closeSync(fd);
    }
  }
}

function summarise(name, rows) {
  const chars = rows.reduce((a, r) => a + r.chars, 0);
  const bits = rows.reduce((a, r) => a + r.bits, 0);
  const oneSegment = rows.filter((r) => r.segments === 1).length;
  return {
    codec: name,
    messages: rows.length,
    bits_per_char: bits / chars,
    chars_per_segment: 1120 / (bits / chars),
    one_segment_share: oneSegment / rows.length,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const model = readModel(options.model);
  const messages = [...heldOutLines(options.corpus, options.holdout, options.lines)];
  if (messages.length === 0) throw new Error('no held-out lines found');

  const bornomala = [];
  const gzip = [];
  const ucs2 = [];

  for (const message of messages) {
    const chars = [...message].length;

    const payload = encode(message, model);
    if (decode(payload, model) !== message) {
      throw new Error(`round trip failed on: ${message}`);
    }
    bornomala.push({
      chars,
      bits: septetCost(payload) * 7,
      segments: gsm7Segments(payload),
    });

    const deflated = zlib.gzipSync(Buffer.from(message, 'utf8'), { level: 9 });
    gzip.push({
      chars,
      bits: deflated.length * 8,
      segments: Math.ceil((deflated.length * 8) / 1120),
    });

    ucs2.push({
      chars,
      bits: chars * 16,
      segments: ucs2Segments(message),
    });
  }

  const results = [
    summarise('bornomala', bornomala),
    summarise('gzip -9', gzip),
    summarise('raw UCS-2', ucs2),
  ];

  const modelBytes = fs.statSync(options.model).size;
  console.log(
    `model ${(modelBytes / 1024).toFixed(0)} KiB, ` +
      `alphabet ${model.alphabet.length}, contexts ${JSON.stringify(model.contextCounts())}`,
  );
  console.log(`held-out messages ${messages.length}\n`);
  console.log('codec         bits/char   chars/segment   fits one segment');
  for (const r of results) {
    console.log(
      `${r.codec.padEnd(12)}  ${r.bits_per_char.toFixed(3).padStart(9)}   ` +
        `${r.chars_per_segment.toFixed(0).padStart(13)}   ` +
        `${(r.one_segment_share * 100).toFixed(1).padStart(15)}%`,
    );
  }

  const versus = results[2].bits_per_char / results[0].bits_per_char;
  console.log(`\nbornomala carries ${versus.toFixed(2)}x the Bangla of raw UCS-2 per segment`);

  if (options.json) {
    fs.writeFileSync(
      options.json,
      `${JSON.stringify({ model_bytes: modelBytes, messages: messages.length, results }, null, 2)}\n`,
    );
    console.log(`wrote ${options.json}`);
  }
}

main();
