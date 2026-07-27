# বর্ণমালা · Bornomala

**Offline Bangla SMS compression. Around 350 Bangla characters in one SMS segment, on a phone with no internet.**

In July 2024 the state cut 3G and 4G in Bangladesh. Broadband went dark. What
survived was 2G — voice and SMS. People fell back to text.

But Bangla is not in the GSM-7 alphabet, so every Bangla SMS is forced into
UCS-2: **70 characters per segment instead of English's 160**. Bangla costs 2.3×
more to send, splits into more segments, and fails more often on a congested
network — exactly when SMS is the only channel left.

Bangladesh has fought this fight before. 1952 was the right to speak Bangla.
2024 was the right to speak at all. This is the same fight one layer down, in
the character encoding.

## What it does

Type Bangla. Bornomala compresses it into characters that are all in the GSM-7
basic alphabet, so the phone sends it as a **7-bit** message instead of UCS-2.
The recipient pastes it back (or shares it into the app) and gets the original
text, character for character.

No server. No internet. No message leaves the device.

## Results

Measured on 4,000 held-out messages — every 50th corpus line, excluded from
training and never read by the model (`npm run bench`):

| codec | bits/char | Bangla chars per segment | fits in one segment |
| --- | ---: | ---: | ---: |
| **Bornomala** | **3.12** | **359** | 100.0% |
| gzip -9 | 21.07 | 53 | 99.5% |
| raw UCS-2 (what phones send today) | 16.00 | 70 | 98.3% |

**5.1× the Bangla per segment versus UCS-2.** gzip is worse than sending the raw
text on messages this short — its window never gets a chance to learn, and the
header alone outweighs the message.

The model is 1.7 MB, loads in ~50 ms, and compresses a message in under a
millisecond in a desktop browser.

## How it works

Four pieces, each doing one job:

- **`src/coder.js`** — a deterministic integer arithmetic coder (Witten-Neal-Cleary,
  32-bit registers). Every product stays under 2⁴⁸, which a double holds exactly,
  so the output is bit-identical on every JS engine. This is the load-bearing
  constraint: a float model would decode differently on different phones and the
  message would arrive as garbage.
- **`src/model.js`** — a static PPM model with backoff, order 3 → 2 → 1 → 0,
  stored as quantised 16-bit integer frequencies. Each context lists its most
  likely symbols plus an escape. Order 0 is complete, so decoding always
  terminates; characters outside the alphabet fall through to a 21-bit literal.
- **`src/gsm7.js`** — packs the bitstream into GSM 03.38 basic characters,
  excluding ESC, CR, LF and space (which composers mangle or trim). 124 symbols
  in the `full` profile, 6.95 bits each; an 85-symbol `ascii` profile is
  available for gateways that transliterate.
- **`index.html` / `app.js` / `sw.js`** — an installable offline PWA. Sending
  goes through an `sms:` URI so the phone's own composer does the transmitting;
  receiving uses the Web Share Target API, with paste as the fallback. The
  service worker precaches everything, model included.

### What the corpus taught us

Corpus *register* mattered more than model size. Subtitles are conversational —
the register an SMS is actually written in. Wikipedia adds vocabulary and
spelling that subtitles never use, but letting it dominate cost about 5%
compression on conversational text, while a subtitles-only model lost more than
that on everything else. The shipped mix is all the subtitles plus a capped 8M
characters of Wikipedia.

Raising the context budget past ~70k contexts changed nothing: the binding
constraint was the minimum count a context needs to be kept, not the cap.

## Build it yourself

```bash
# 1. Clean the corpora (streams the .bz2, never unpacks it to disk)
python3 corpus/tools/clean_wiki.py \
    corpus/raw/bnwiki-pages-articles.xml.bz2 corpus/clean/wiki-bn.txt

# 2. Train the model — about a minute, a few hundred MB of RAM
python3 tools/train_model.py \
    corpus/clean/opensubtitles-bn.txt corpus/clean/wiki-bn.txt:8000000

# 3. Verify
npm test          # coder, GSM-7, model and codec round trips
npm run bench     # held-out comparison against gzip and UCS-2

# 4. Run the app
python3 -m http.server 8765
```

The corpora themselves are not in the repo — they are 554 MB. `corpus/tools/`
holds the scripts that clean them.

## Limitations, honestly

- **The recipient needs the app.** A compressed message is unreadable without
  it. This is a tool for a network under stress, not a replacement for SMS.
- **The model must match.** Sender and receiver need the same `model.bin`. The
  payload carries a version marker so a mismatch fails loudly instead of
  producing wrong text.
- **One segment is not guaranteed.** 359 characters is the average; a message
  full of out-of-alphabet characters will run longer. The app shows the real
  segment count as you type.
- **Some SMS gateways transliterate.** The `ascii` profile exists for that case
  and costs about 7% capacity.

## Related work

Bangla text compression has been studied for decades — dictionary methods,
Huffman variants over conjunct clusters, and PPM applied to Indic scripts. What
is different here is the target: not the smallest possible file, but the
**160-septet SMS segment boundary**, with a decoder that has to be bit-exact on
a low-end phone with no network.

---

Built for the July Hackathon 2026 (Crisis Tech), JRA Foundation. Licensed MIT.
