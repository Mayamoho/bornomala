#!/usr/bin/env python3
"""Size the Bornomala alphabet and estimate the achievable bit rate.

Answers the two questions the codec design hangs on:
  1. How many distinct symbols must the model cover, and where does the
     coverage curve flatten out?
  2. What is the conditional entropy at orders 0-3, i.e. how many bits per
     Bangla character an arithmetic coder driven by that model can reach?

    python3 corpus_stats.py clean/opensubtitles-bn.txt [clean/wiki-bn.txt ...]

Entropy here is measured on the training text itself, so it is a floor, not a
promise: a real order-3 model pays for escapes, quantisation and table pruning.
Treat these numbers as the ceiling on compression, then budget downward.
"""

import collections
import math
import sys
import unicodedata

SEGMENT_BITS = 1120          # 160 septets x 7 bits in one GSM-7 SMS segment
HEADER_BITS = 12             # version + model id, reserved
UCS2_CHARS_PER_SEGMENT = 70  # what Bangla gets today


def read_lines(paths):
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = unicodedata.normalize("NFC", line.rstrip("\n"))
                if line:
                    yield line


def entropy(counts):
    """Shannon entropy in bits of a symbol->count mapping."""
    total = sum(counts.values())
    if total == 0:
        return 0.0
    return -sum((c / total) * math.log2(c / total) for c in counts.values())


def conditional_entropy(contexts):
    """Weighted mean entropy over per-context symbol distributions."""
    total = sum(sum(c.values()) for c in contexts.values())
    if total == 0:
        return 0.0
    return sum(sum(c.values()) / total * entropy(c) for c in contexts.values())


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2

    unigrams = collections.Counter()
    orders = {k: collections.defaultdict(collections.Counter) for k in (1, 2, 3)}
    nlines = 0

    for line in read_lines(sys.argv[1:]):
        nlines += 1
        text = line + "\n"          # newline doubles as end-of-message symbol
        unigrams.update(text)
        for k in orders:
            padded = "\n" * k + text
            for i in range(k, len(padded)):
                orders[k][padded[i - k:i]][padded[i]] += 1

    total_chars = sum(unigrams.values())
    print(f"lines            {nlines:,}")
    print(f"characters       {total_chars:,}")
    print(f"distinct symbols {len(unigrams):,}")

    print("\ncoverage curve (symbols needed for N% of all characters)")
    ranked = unigrams.most_common()
    running = 0
    targets = [0.90, 0.99, 0.999, 0.9999, 1.0]
    t = 0
    for rank, (_sym, count) in enumerate(ranked, start=1):
        running += count
        while t < len(targets) and running / total_chars >= targets[t]:
            print(f"  {targets[t] * 100:8.2f}%  {rank:5,} symbols")
            t += 1

    print("\nentropy (bits per character, training-set floor)")
    rates = {0: entropy(unigrams)}
    for k in sorted(orders):
        rates[k] = conditional_entropy(orders[k])
    for k, bits in rates.items():
        print(f"  order {k}   {bits:6.3f} bits/char")

    print(f"\ncapacity in one segment ({SEGMENT_BITS} bits, {HEADER_BITS} reserved)")
    usable = SEGMENT_BITS - HEADER_BITS
    for k, bits in rates.items():
        print(f"  order {k}   {usable / bits:6.0f} Bangla chars")
    print(f"  UCS-2 today  {UCS2_CHARS_PER_SEGMENT:4d} Bangla chars")

    print("\ntail symbols (rarest 20 — candidates for the escape path)")
    print("  " + " ".join(repr(s) for s, _ in ranked[-20:]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
