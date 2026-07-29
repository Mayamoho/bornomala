# বর্ণমালা · Bornomala

**Crisis messaging for the network you have left. A family's status report is
eight characters. Forty-five of them fit in one SMS. And if the phone is dead,
the same message can be read off a printed card by hand.**

In July 2024 the state cut 3G and 4G in Bangladesh. Broadband went dark. What
survived was 2G — voice and SMS. People fell back to text.

But Bangla is not in the GSM-7 alphabet, so every Bangla SMS is forced into
UCS-2: **70 characters per segment instead of English's 160**. Bangla costs 2.3×
more to send, splits into more segments, and fails more often on a congested
network — exactly when SMS is the only channel left.

Bangladesh has fought this fight before. 1952 was the right to speak Bangla.
2024 was the right to speak at all. This is the same fight one layer down, in
the character encoding.

## The thing that is actually different

Most crisis messaging tries to build a new network. Bornomala assumes you
cannot, and makes the message small enough that the broken network you still
have is enough.

That turns out to matter most for the messages people actually send in the
first hours: not prose, but a small closed set of facts. *We are five. We are
safe. We are in Khulna. The water is chest deep. Do not come this way.*

So Bornomala does not compress the sentence. It sends the fact.

| what you send | on the wire | what it costs today |
| --- | --- | ---: |
| "আমরা ৩ জন নিরাপদ আছি, ঢাকা, ২ ঘণ্টা আগে" | `H-428R-H7E` | 37 chars of UCS-2 |
| the same, as compressed free text | 24 characters | — |
| 45 families' status reports | **one SMS segment** | 45 SMS |
| 15 families' reports, with names | **one SMS segment** | 15 SMS |

`H-428R-H7E` is a real payload, not an illustration. `npm test` asserts it.

## Three kinds of message

Every payload announces itself with one leading character, so the receiver
never has to guess.

- **`H` — a crisis frame, hand-decodable.** Five bits pick one of 32 phrasebook
  messages; the rest are typed slots (how many people, how urgent, blood group,
  flood depth, shelter capacity), a location, and how many hours ago. Packed in
  Crockford base-32, which has no `I`, `L`, `O` or `U` to confuse with `1`, `0`
  or `V`.
- **`C` / `D` — the same, packed dense.** 6.95 bits per character instead of 5,
  for when both ends have the app. `D` is a batch of up to 64 frames.
- **`B` — free Bangla prose**, arithmetic-coded against the language model, for
  everything the phrasebook does not cover.

## Graceful degradation, taken literally

The Crisis Tech criteria ask how well a project works with no internet, no
electricity, or on a button phone. Each of those is a separate design decision
here, not a disclaimer.

| what you have | what still works |
| --- | --- |
| No internet | Everything. The app is a PWA; nothing leaves the device. |
| No mobile data, 2G only | Everything. Messages go through the phone's own SMS composer. |
| A slow connection that never finishes | Crisis frames, relay and decoding all work **before `model.bin` arrives**. The shell is 92 kB against the model's 1.7 MB, and the service worker installs without it. |
| No GPS | Location degrades from a 32-bit coordinate (±10 m) to a 6-bit district index, in the same slot, behind one flag bit. |
| **A button phone** | It cannot run the app, but it can carry the message: an `H` payload is plain GSM-7 that any handset can receive, store and forward verbatim. |
| **No phone at all** | An `H` payload decodes by hand from the printed card in the app's last tab. Character values, the 32 messages, the field ladders and all 64 districts fit on one sheet. |
| **No network whatsoever** | Show the QR, let the phone beside you point a camera. No radio, no operator, no pairing. |
| A damaged message | CRC-8 on every payload. It refuses instead of decoding into fluent Bangla nobody wrote. |

That last row is the one that matters most and is easiest to skip. Without a
checksum a message garbled in transit does not fail — it *arrives*, plausible
and wrong, in front of somebody deciding where to send a boat.

## Relay: one person's signal, everyone's message

Frames are small enough that batching stops being a micro-optimisation and
becomes the product. A volunteer at a shelter collects status from the families
around them and spends one SMS on all of it.

```
45 reports  →  159 septets  →  1 segment
46 reports  →  162 septets  →  2 segments
```

Both numbers are asserted in `test/message.test.js`, so the claim in this
README breaks the build if it ever stops being true.

## The last transport: QR

When there is no network at all — no data, no SMS, the tower itself down — two
phones in the same room can still hand a message across. One shows a QR, the
other points its ordinary camera app.

The symbol encodes a link back to the app with the payload in `?shared=`, so
scanning opens the decode tab directly. Nothing is fetched: the URL names a
page the service worker already holds, which is why this works with the radio
switched off entirely. A status report needs a version-1 symbol; a full 45-name
relay batch still fits comfortably.

`src/qr.js` is a complete encoder — Reed-Solomon over GF(256), all eight masks
scored by the standard's penalty rules, error correction level M. Its output is
verified against `zbarimg`, an outside decoder, in `test/qr.test.js`: whatever
went in has to come back out, or the build fails.

## Using it, step by step

Open **https://mayamoho.github.io/bornomala/**. Nothing to sign up for, nothing
to install first, no permissions asked until you ask for a location.

**Install it before you need it.** On Android Chrome, the three-dot menu →
*Add to Home screen*. On iPhone, in Safari, the share icon → *Add to Home
Screen*. On a desktop, the install icon at the right of the address bar. After
that first visit the app runs with the network off. Doing this on a calm day is
the entire point; on the day of, the download may not finish.

**Choose your language.** English and বাংলা sit at the top of the page. English
is the default. The choice is remembered.

**Send a status report — the Crisis tab.**

1. **Tap what happened.** Six icons cover the common cases: ✅ we are safe,
   🆘 need help, ⚠️ trapped, 🚑 injured, 💧 water needed, 🏃 evacuate. For
   anything else, the dropdown below holds all 32, grouped under *We are… /
   We need… / Danger here / Help is here*. A blank like `____` in an option is
   a value you are about to fill in.
2. **Fill the boxes that appear.** How many people, how urgent, how deep the
   water — whatever that message needs. They are dropdowns, never typing.
3. **Say where.** *My district* is one tap and costs almost nothing to send.
   *My exact position* asks the phone for GPS and is worth it when a boat has
   to find you. *Do not send my location* is a real choice.
4. **Say when**, in hours ago, up to 31. Leave it on *just now* if it is now.
5. **Add a name or note** only if you need to — it is optional, it needs the
   text model to have finished downloading, and it stops the message from being
   readable off paper.
6. **Read the big sentence** under *What they will read*. That is what arrives
   on the other phone. Under it, *What actually gets sent* shows the short code
   that travels, with what it costs and what the same message would have cost
   as ordinary Bangla SMS.
7. **Press Send as SMS.** Your normal messaging app opens with the code already
   written. Pick who it goes to and send it. *Copy* puts it on the clipboard
   instead, for any app you like.

**Carry other people's reports — the Relay tab.** Instead of sending, press
*Add to relay*, then build the next report. Up to 64. Open the Relay tab and
send once: everyone's status in a single SMS. This is the tab for a shelter
volunteer with one bar of signal and a notebook full of families.

**Read a message you were sent — the Decode tab.** Paste the code in. The
sentence appears in your language. A message sent with GPS gives you a map
link. If the code arrived damaged, the app says so and refuses — it will not
invent a sentence nobody wrote.

**When there is no network at all — the QR button.** Press *Show QR*, hold the
screen up, and let the other phone's camera read it. Nothing is transmitted:
no tower, no Bluetooth, no pairing, no permission.

**When there is no phone at all — the Paper card tab.** Press *Print* and keep
the sheet. A code that begins with `H` can be decoded by hand from those
tables, with no device and no power. It is slow — a minute or two per message —
and it is the floor under everything else.

## Results

Free-text compression, measured on 5,000 held-out messages — every 50th corpus
line, excluded from training and never read by the model (`npm run bench`):

| codec | bits/char | Bangla chars per segment | fits in one segment |
| --- | ---: | ---: | ---: |
| **Bornomala** | **3.106** | **361** | 100.0% |
| gzip -9 | 21.002 | 53 | 99.5% |
| raw UCS-2 (what phones send today) | 16.000 | 70 | 98.2% |

**5.15× the Bangla per segment versus UCS-2.** gzip is worse than sending the raw
text on messages this short — its window never gets a chance to learn, and the
header alone outweighs the message.

Structured frames go further, because they are not compressing text at all:
**11× versus UCS-2** on the same sentence, and **3× versus our own free-text
compression**.

## How it works

- **`src/coder.js`** — a deterministic integer arithmetic coder (Witten-Neal-Cleary,
  32-bit registers). Every product stays under 2⁴⁸, which a double holds exactly,
  so the output is bit-identical on every JS engine. This is the load-bearing
  constraint: a float model would decode differently on different phones and the
  message would arrive as garbage.
- **`src/model.js`** — a static PPM model with backoff, order 3 → 2 → 1 → 0,
  stored as quantised 16-bit integer frequencies. Order 0 is complete, so
  decoding always terminates; characters outside the alphabet fall through to a
  21-bit literal.
- **`src/phrasebook.js`** — the 32 messages and their slot ladders. Append-only:
  the index *is* the wire value, so reordering it would silently change the
  meaning of every message already in flight.
- **`src/frame.js`** — fixed-width bit fields, deliberately *not* run through the
  arithmetic coder. That is what makes a frame decodable by hand. Notes are the
  exception and are arithmetic-coded onto the tail, which is why a frame with a
  note cannot use the paper profile — the app says so rather than failing.
- **`src/geo.js`** — the two location precisions, and the 64 districts.
- **`src/crc.js`** — CRC-8/ATM, with the payload length folded in so the trailing
  zero bits the transport is free to add or drop cannot pass unnoticed.
- **`src/qr.js`** — a self-contained QR encoder for the no-network handoff,
  checked against an outside decoder rather than trusted.
- **`src/gsm7.js`** — packs the bitstream into GSM 03.38 basic characters,
  excluding ESC, CR, LF and space (which composers mangle or trim). Three
  profiles: `full` (124 symbols, 6.95 bits each), `ascii` for gateways that
  transliterate, and `base32` for the paper path.
- **`index.html` / `app.js` / `sw.js`** — an installable offline PWA. Sending goes
  through an `sms:` URI so the phone's own composer transmits; receiving uses the
  Web Share Target API, with paste as the fallback.

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
npm test          # coder, GSM-7, frames, checksum, relay and codec round trips
npm run bench     # held-out comparison against gzip and UCS-2

# 4. Run the app
python3 -m http.server 8765
```

The corpora themselves are not in the repo — they are 554 MB. `corpus/tools/`
holds the scripts that clean them.

## Limitations, honestly

- **A free-text message needs the app at the other end.** A crisis frame does
  not need the *model*, and an `H` frame does not need a *device*, but prose
  needs both. This is a tool for a network under stress, not a replacement for
  SMS.
- **The model must match.** Sender and receiver need the same `model.bin` for
  prose and for notes. The payload carries a version marker so a mismatch fails
  loudly instead of producing wrong text.
- **The phrasebook is a guess.** 32 messages chosen from what a network
  blackout and a flood season actually produce. It is append-only by design,
  but the right list comes from people who have run a shelter, not from me.
- **Hand-decoding is slow.** Realistically a minute or two per message with the
  card, and it only covers frames without notes. It is a floor, not a workflow.
- **The district index assumes Bangladesh.** The 32-bit coordinate grid covers
  the national bounding box only; outside it the app tells you to pick a
  district rather than sending a wrong position.
- **Some SMS gateways transliterate.** The `ascii` profile exists for that case
  and costs about 7% capacity.

## Development timeline, disclosed

The commit log shows work on 27 July, a day before the sprint window opened.
That is stated here rather than left for a judge to find. All times are
Bangladesh Standard Time (UTC+6).

**27 July — registration day, before the sprint window.** Five commits building
the compression core: the arithmetic coder and GSM-7 transport, the PPM model
and its trainer, the message codec, the offline PWA shell, the benchmark
harness, and a first README. This was written after registration on the same
day, as a working prototype of the compression idea. It is outside the 28–30
July window and is not claimed as sprint work.

**29 July — inside the sprint window.** Six commits, and everything that makes
this a crisis-tech entry rather than a compression demo: the crisis phrasebook
and structured frames, CRC-8 integrity, the paper profile, relay batching, the
crisis/relay/paper-card UI, graceful degradation when the model will not load,
the QR handoff for when there is no network at all, and this README.

**Repository and push times.** The work was developed in a local git repository
from the start. The public GitHub repository was created on **29 July at
14:05:43**, and commits were pushed from **14:15** onward on the same day, in
batches. So every push timestamp is 29 July even where a commit's author date
is 27 July — the repository was published once the entry was ready to be seen,
not incrementally as it was written.

**Nothing has been backdated or rewritten to fit the window.** Commit dates are
the real ones. The only history rewrite in this repository corrected a
placeholder git identity (`Your Name <you@example.com>`) to the author's actual
name and email; timestamps were left untouched by that rewrite.

This disclosure is submitted with the entry. Whether the 27 July commits affect
eligibility is the organisers' call, not a claim made here.

## Why a phrasebook beats a translation

Translators without Borders built a glossary for the Cox's Bazar response
because humanitarian terminology in Bangladesh was getting people hurt. Their
clearest example: in Bangla, **ঝড় (*jhor*)** means a storm with wind, and is
used for a cyclone. In Rohingya, *jhor* means rain — no wind, no real storm. A
Bangla cyclone warning broadcast into a Rohingya camp reads as *it will rain*,
in a place where word of mouth is the main channel and the wind is about to
take the roofs off.

Bornomala cannot make that mistake, because it never transmits the word. What
travels is **template index 12** and its slot values. The sentence is rendered
on the receiver's phone, from that receiver's own phrasebook, in that
receiver's own language. Translation happens once, at the edge, against a fixed
list of 32 facts a native speaker can check — not per message, under time
pressure, by whoever is holding the radio.

That also makes the wire format language-neutral by construction. A frame
contains no text: five bits of template, a few bits of slot values, an optional
district or coordinate, an optional hour count. Adding Hindi, Nepali, Burmese
or Rohingya is a render-layer change — one more field per phrasebook entry —
and it costs **zero bits on the wire**. A message composed in Bangla decodes
into Hindi on the other end. Only free prose is language-bound, because only
free prose needs the trained model.

And the person this is built for already exists in an org chart. The Cyclone
Preparedness Programme has run since 1972 on roughly 43,000 trained volunteers
and about 160 full-time staff, carrying Bangladesh Met Department warnings into
coastal communities with a three-flag signalling system. That volunteer, with
one bar of signal and sixty families' status in a notebook, is exactly who the
relay tab is for: sixty reports, one SMS, instead of sixty SMS a congested cell
will not carry.

Sources: [TWB glossaries](https://translatorswithoutborders.org/twb-glossaries/) ·
[TWB's Rohingya language tool](https://reliefweb.int/report/bangladesh/translators-without-borders-launches-language-tool-rohingya-humanitarian-response) ·
[Cyclone Preparedness Programme, BDRCS](https://bdrcs.org/cyclone-preparedness-programm-cpp/)

## Related work

Bangla text compression has been studied for decades — dictionary methods,
Huffman variants over conjunct clusters, and PPM applied to Indic scripts. What
is different here is the target: not the smallest possible file, but the
**160-septet SMS segment boundary**, with a decoder that has to be bit-exact on
a low-end phone with no network — and a fallback that assumes no phone at all.

---

Built for the July Hackathon 2026 (Crisis Tech), JRA Foundation. Licensed MIT.

Built with AI assistance (Claude Code), disclosed per the hackathon rules.
