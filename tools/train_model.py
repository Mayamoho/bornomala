#!/usr/bin/env python3
"""Train the Bornomala context model and export it as integer tables.

The codec has to decode bit-identically on every device, so nothing float
ever reaches the decoder: this script does the floating-point work offline
and emits quantised 16-bit frequencies.

Model shape — static PPM with backoff, no runtime adaptation:

    order 3 -> order 2 -> order 1 -> order 0 -> literal

Each stored context lists its most frequent symbols plus an escape frequency.
Decoding a symbol that is not listed costs one escape and drops to the next
lower order. Order 0 is always complete over the alphabet, so decoding always
terminates; a character outside the alphabet is coded as the LITERAL symbol
followed by its raw code point.

    python3 tools/train_model.py corpus/clean/*.txt -o web/model.bin

Memory: contexts are counted as packed int64 keys in numpy arrays, merged
chunk by chunk, so peak usage stays a few hundred MB rather than the tens of
GB a dict of Python strings would need.
"""

from __future__ import annotations

import argparse
import collections
import json
import struct
import sys
import unicodedata
from pathlib import Path

import numpy as np

MAGIC = b"BRNM1"
CHUNK_TOKENS = 4_000_000


def parse_args(argv):
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("corpus", nargs="+", type=Path, help="cleaned UTF-8 text, one line per message")
    p.add_argument("-o", "--out", type=Path, default=Path("web/model.bin"))
    p.add_argument("--max-chars", type=int, default=40_000_000, help="cap on characters per file")
    p.add_argument("--coverage", type=float, default=0.9995, help="share of characters covered")
    p.add_argument("--max-alphabet", type=int, default=250)
    p.add_argument("--top-entries", type=int, default=24, help="symbols kept per context")
    p.add_argument("--contexts-order3", type=int, default=60_000)
    p.add_argument("--contexts-order2", type=int, default=40_000)
    p.add_argument("--contexts-order1", type=int, default=4_000)
    p.add_argument("--quant-total", type=int, default=16_384, help="frequency total per context")
    p.add_argument("--min-count", type=int, default=4, help="ignore contexts rarer than this")
    return p.parse_args(argv)


def read_lines(paths, max_chars):
    """Yield NFC-normalised non-empty lines, at most max_chars per file."""
    for path in paths:
        seen = 0
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = unicodedata.normalize("NFC", line.rstrip("\n"))
                if not line:
                    continue
                seen += len(line) + 1
                if seen > max_chars:
                    break
                yield line


def build_alphabet(lines, coverage, max_alphabet):
    """Pick the symbol set. Newline is always id 0 — it doubles as end-of-message."""
    counts = collections.Counter()
    total = 0
    for line in lines:
        counts.update(line)
        total += len(line) + 1
    counts["\n"] += len(lines)

    grand = sum(counts.values())
    ranked = [c for c, _ in counts.most_common() if c != "\n"]
    kept = ["\n"]
    running = counts["\n"]
    for char in ranked:
        if len(kept) >= max_alphabet:
            break
        kept.append(char)
        running += counts[char]
        if running / grand >= coverage:
            break
    return kept, counts, grand, total


class _SymbolTable(dict):
    """str.translate table that folds every unknown character to LITERAL."""

    def __init__(self, index, literal_id):
        super().__init__({ord(c): chr(i) for c, i in index.items()})
        self._literal = chr(literal_id)

    def __missing__(self, _codepoint):
        return self._literal


def encode_sequence(lines, index, max_order, literal_id):
    """Flatten the corpus into symbol ids plus a mask of predictable positions.

    Each line is preceded by `max_order` newline pads (start of message) and
    followed by one newline (end of message). Pads are never predicted, so no
    context ever spans two messages.

    The mapping runs through str.translate and a latin-1 encode rather than a
    Python loop: a list of 50M ints would cost ~800MB, the uint8 array costs 50.
    """
    pad = "\n" * max_order
    text = "".join(f"{pad}{line}\n" for line in lines)
    seq = np.frombuffer(
        text.translate(_SymbolTable(index, literal_id)).encode("latin-1"), dtype=np.uint8
    )

    lengths = np.fromiter((len(line) for line in lines), dtype=np.int64, count=len(lines))
    starts = np.concatenate([[0], np.cumsum(lengths + max_order + 1)[:-1]])

    predict = np.ones(seq.size, dtype=bool)
    predict[(starts[:, None] + np.arange(max_order)).ravel()] = False
    return seq, predict


def count_order(seq, predict, order):
    """Count (context, symbol) pairs for one order.

    Keys pack context and symbol into one int64:
        key = ctx[0]<<8k | ... | ctx[k-1]<<8 | symbol
    """
    positions = np.flatnonzero(predict)
    positions = positions[positions >= order]

    keys_acc = np.empty(0, dtype=np.int64)
    counts_acc = np.empty(0, dtype=np.int64)

    for start in range(0, positions.size, CHUNK_TOKENS):
        block = positions[start : start + CHUNK_TOKENS]
        keys = np.zeros(block.size, dtype=np.int64)
        for offset in range(order, 0, -1):
            keys = (keys << 8) | seq[block - offset].astype(np.int64)
        keys = (keys << 8) | seq[block].astype(np.int64)

        uniq, cnt = np.unique(keys, return_counts=True)
        del keys
        if keys_acc.size == 0:
            keys_acc, counts_acc = uniq, cnt.astype(np.int64)
        else:
            merged = np.concatenate([keys_acc, uniq])
            weights = np.concatenate([counts_acc, cnt.astype(np.int64)])
            order_idx = np.argsort(merged, kind="stable")
            merged = merged[order_idx]
            weights = weights[order_idx]
            starts = np.flatnonzero(np.concatenate([[True], merged[1:] != merged[:-1]]))
            keys_acc = merged[starts]
            counts_acc = np.add.reduceat(weights, starts)

    return keys_acc, counts_acc


def group_contexts(keys, counts, order, min_count, max_contexts):
    """Split packed keys into per-context symbol tables, keeping the busiest."""
    ctx_keys = keys >> 8
    symbols = (keys & 0xFF).astype(np.uint8)

    order_idx = np.argsort(ctx_keys, kind="stable")
    ctx_keys = ctx_keys[order_idx]
    symbols = symbols[order_idx]
    counts = counts[order_idx]

    starts = np.flatnonzero(np.concatenate([[True], ctx_keys[1:] != ctx_keys[:-1]]))
    totals = np.add.reduceat(counts, starts)

    keep = np.flatnonzero(totals >= min_count)
    if keep.size > max_contexts:
        keep = keep[np.argsort(totals[keep], kind="stable")[::-1][:max_contexts]]
        keep = np.sort(keep)

    ends = np.append(starts, ctx_keys.size)
    contexts = []
    for i in keep:
        lo, hi = starts[i], ends[i + 1]
        ctx = int(ctx_keys[lo])
        ctx_symbols = [(ctx >> (8 * (order - 1 - j))) & 0xFF for j in range(order)]
        contexts.append(
            {
                "context": ctx_symbols,
                "symbols": symbols[lo:hi].tolist(),
                "counts": counts[lo:hi].tolist(),
            }
        )
    return contexts


def quantise(symbol_counts, total_target, top_entries):
    """Quantise counts to integer frequencies summing exactly to total_target.

    Returns (entries, escape_freq). Escape mass covers both the symbols pruned
    from this context and a PPM-C novelty estimate (one unit per distinct
    symbol observed), so unseen symbols always remain codable.
    """
    ranked = sorted(symbol_counts.items(), key=lambda kv: (-kv[1], kv[0]))
    kept = ranked[:top_entries]
    pruned = ranked[top_entries:]

    kept_total = sum(c for _, c in kept)
    pruned_total = sum(c for _, c in pruned)
    novelty = max(1, len(ranked))
    escape_weight = pruned_total + novelty
    grand = kept_total + escape_weight

    slots = len(kept) + 1  # every slot needs at least frequency 1
    if total_target < slots:
        raise ValueError("quant total too small for this context")

    budget = total_target - slots
    freqs = [[symbol, 1 + (count * budget) // grand] for symbol, count in kept]
    escape = 1 + (escape_weight * budget) // grand

    assigned = sum(f for _, f in freqs) + escape
    if assigned < total_target:  # hand the remainder to the most frequent symbol
        if freqs:
            freqs[0][1] += total_target - assigned
        else:
            escape += total_target - assigned

    return [(s, f) for s, f in freqs], escape


def quantise_order0(counts, alphabet, literal_id, total_target):
    """Complete distribution over the alphabet plus the literal symbol."""
    symbol_counts = {i: counts.get(c, 0) for i, c in enumerate(alphabet)}
    symbol_counts[literal_id] = max(1, sum(counts.values()) // 100_000)

    slots = len(symbol_counts)
    budget = total_target - slots
    grand = sum(symbol_counts.values())
    freqs = [1 + (c * budget) // grand for _, c in sorted(symbol_counts.items())]

    assigned = sum(freqs)
    if assigned < total_target:
        freqs[int(np.argmax(freqs))] += total_target - assigned
    return freqs


def write_model(path, alphabet, order0, tables, quant_total):
    """Serialise to the BRNM1 binary format (little-endian throughout)."""
    out = bytearray()
    out += MAGIC
    out += struct.pack("<B", max(tables) if tables else 0)
    out += struct.pack("<H", quant_total)
    out += struct.pack("<H", len(alphabet))

    alphabet_bytes = "".join(alphabet).encode("utf-8")
    out += struct.pack("<I", len(alphabet_bytes))
    out += alphabet_bytes

    out += struct.pack(f"<{len(order0)}H", *order0)

    for order in sorted(tables):
        contexts = tables[order]
        out += struct.pack("<I", len(contexts))
        for ctx, entries, escape in contexts:
            out += bytes(ctx)
            out += struct.pack("<B", len(entries))
            for symbol, freq in entries:
                out += struct.pack("<BH", symbol, freq)
            out += struct.pack("<H", escape)

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(bytes(out))
    return len(out)


def main(argv=None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])

    print("reading corpus…", file=sys.stderr)
    lines = list(read_lines(args.corpus, args.max_chars))
    if not lines:
        print("no input lines", file=sys.stderr)
        return 1

    alphabet, char_counts, grand, total_chars = build_alphabet(
        lines, args.coverage, args.max_alphabet
    )
    index = {c: i for i, c in enumerate(alphabet)}
    literal_id = len(alphabet)
    covered = sum(char_counts[c] for c in alphabet) / grand
    print(
        f"lines {len(lines):,}  chars {total_chars:,}  "
        f"alphabet {len(alphabet)} (+literal) covering {covered * 100:.3f}%",
        file=sys.stderr,
    )

    max_order = 3
    seq, predict = encode_sequence(lines, index, max_order, literal_id)
    del lines
    print(f"sequence {seq.size:,} symbols", file=sys.stderr)

    caps = {1: args.contexts_order1, 2: args.contexts_order2, 3: args.contexts_order3}
    tables = {}
    stats_contexts = {}

    for order in (1, 2, 3):
        keys, counts = count_order(seq, predict, order)
        min_count = 1 if order == 1 else args.min_count
        contexts = group_contexts(keys, counts, order, min_count, caps[order])
        del keys, counts

        packed = []
        for ctx in contexts:
            symbol_counts = dict(zip(ctx["symbols"], ctx["counts"]))
            entries, escape = quantise(symbol_counts, args.quant_total, args.top_entries)
            packed.append((ctx["context"], entries, escape))
        packed.sort(key=lambda item: item[0])
        tables[order] = packed
        stats_contexts[order] = len(packed)
        print(f"order {order}: {len(packed):,} contexts", file=sys.stderr)

    order0 = quantise_order0(char_counts, alphabet, literal_id, args.quant_total)

    size = write_model(args.out, alphabet, order0, tables, args.quant_total)
    stats = {
        "alphabet_size": len(alphabet),
        "coverage": covered,
        "quant_total": args.quant_total,
        "contexts": stats_contexts,
        "model_bytes": size,
        "training_chars": total_chars,
    }
    args.out.with_suffix(".stats.json").write_text(
        json.dumps(stats, indent=2, ensure_ascii=False)
    )
    print(f"wrote {args.out} ({size / 1024:.0f} KiB)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
