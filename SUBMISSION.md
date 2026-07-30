# Bornomala — July Hackathon 2026 submission pack

Everything the submission form asks for, ready to paste. Track A — Crisis Tech. Solo entry.

Deadline: **30 July, 23:59 BST (hard cutoff).** Social engagement window runs 30 July – 1 August.

---

## 1. Project title (limit: 25 words)

> Bornomala — an offline Bangla SMS codec that fits 5× more crisis information
> into every text message, on the network a blackout leaves behind.

*(24 words, limit 25.)*

---

## 2. Track

Track A — Crisis Tech.

---

## 3. Problem statement (limit: 200 words)

> In July 2024 the government shut off mobile internet across Bangladesh.
> Broadband went dark too. What kept working was the oldest part of the phone
> network: voice calls and text messages.
>
> But text messages were never designed for Bangla. SMS uses an old character set
> that only covers English. A single Bangla letter switches the whole message to a
> heavier format: English fits 160 characters, Bangla only 70. Speaking your own
> language costs more than twice as much, and fails more often when towers are
> overloaded — exactly when texting is all anyone has left.
>
> That cost lands on the people least able to carry it. A volunteer checking on
> forty households pays it forty times, out of prepaid balance nobody can top up.
>
> Most crisis apps answer this by building their own network over Bluetooth. That
> only helps if both people installed the app before the disaster and stand within
> about a hundred metres of each other. The people you actually need — family in
> another district, a rescue control room — are nowhere near that. In July, nobody
> could build a network.

*(195 words, limit 200.)*

---

## 4. Solution description (limit: 400 words)

> Bornomala does not build a new network. It uses the one that already reaches
> everybody — ordinary text messages and phone calls — and makes it cheaper. Every
> phone in the country can already receive an SMS: nobody installs anything first,
> nobody has to be nearby, and it works across operators and districts on 2G with
> no internet. That is the difference from a Bluetooth mesh app. A mesh reaches the
> room you are standing in. SMS reaches your mother in another district.
>
> **Normal — make a message smaller.** Type in Bangla and live counters show how
> many messages it would cost to send today, and how many after compressing. A
> small Bangla language model inside the app predicts what letter comes next, and
> the better it predicts, the fewer bits are needed to write it down. The result is
> a short code that fits the cheap 160-character lane. Press Send and your phone's
> own SMS screen opens, filled in. Paste a code you received, and the Bangla comes
> back out.
>
> Tested on 5,000 messages the model had never seen, 361 Bangla characters now fit
> in one SMS instead of 70 — 5.15× more. Ordinary compression like gzip does worse
> than doing nothing, because it has no idea what Bangla looks like.
>
> **Emergency — for people who do not have the app.** Compression needs Bornomala
> on both sides, and someone on a roof will not have it. So this tab sends plain
> Bangla words any phone can display. It asks what is happening in your own words,
> one of 32 ready-made sentences you fill in (how many people, how urgent, blood
> group, water depth, shelter space), where you are — a district or your live
> location — and how long ago. It will not send until those are answered, because a
> report without a place is not a report. Nine official national numbers including
> 999 sit underneath: one tap to call, one to text with the message already written.
> Calls need no internet either.
>
> **Relay — forty families, one message.** A volunteer collects reports and sends
> them together, with a counter showing how many messages that saved.
>
> With no network at all, the message becomes a QR code the next phone can
> photograph. Everything is bilingual, works offline once installed, and never
> sends anything to us — there is no server to send it to.

*(391 words, limit 400.)*

---

## 5. Tech stack and third-party components

**Languages:** JavaScript (ES modules, no framework, no build step), HTML, CSS.
Python 3 for the offline model-training and benchmark tooling.

**Frameworks and libraries: none in the shipped app.** It has zero runtime
dependencies — no React, no jQuery, no CDN, no analytics. The only development
dependency is `jsdom`, used to run the interface test suite headlessly.

**Written from scratch for this project:**

- the Bangla language model (static PPM with backoff, quantised 16-bit integer
  frequencies) and the integer arithmetic coder driving it
- GSM-7 septet packing and segment counting
- the QR encoder — Reed–Solomon over GF(256), all eight masks, no library
- the 32-sentence phrasebook, the 64-district table, and the bilingual interface

**Browser APIs used:** Service Worker and Cache Storage (offline install),
Geolocation (live location), Clipboard, Web Share Target, `sms:` and `tel:` URIs
for handing messages to the phone's own apps.

**Pre-trained models: none.** The language model is trained from scratch, by us,
on public Bangla text. No third-party model weights are used or redistributed.

**Training data:** OpenSubtitles Bangla and a Bangla Wikipedia dump, both
publicly available. Cleaning scripts are in `corpus/tools/`; the corpora
themselves are not redistributed here (554 MB).

**Emergency numbers** are Bangladesh's official public short codes (999, 1090,
102, 16263, 333, 109, 1098, 16430, 106), verified against
[999.gov.bd](https://www.999.gov.bd/) and
[police.gov.bd](https://www.police.gov.bd/en/hot_line_number).

**Hosting:** GitHub Pages (static files only). **Licence:** MIT.

---

## 6. AI tools used

**Disclosure:** Claude (Anthropic) was used as a coding assistant throughout the
72-hour sprint — writing and refactoring application code, the test suites, this
submission pack and the slide deck, and reviewing the project for claims that did
not match the code.

All architectural decisions, the compression approach, the product direction and
every accepted change were the author's. The language model shipped in the app is
**not** an AI-tool artefact: it is trained from scratch by the tooling in
`tools/train_model.py`, and no generative model runs inside the app or is called
at runtime. The app makes no network requests of any kind.

---

## 7. Tech stack, short form (if the form wants one line)

- **App:** offline-first installable PWA — vanilla JavaScript ES modules, no framework, no runtime dependencies, service worker precaching the full shell.
- **Codec:** Bangla context model trained offline from a crisis-message corpus, exported as integer probability tables (`model.bin`, 1.7 MB); deterministic integer arithmetic coder in JavaScript; GSM-7 septet packing.
- **Transport:** `sms:` URI handing the message to the device's own SMS composer. No backend, no API, no third-party service.
- **Extras:** QR encoder written from scratch (no library), Geolocation API for coordinates, `localStorage` for language choice only.
- **Testing:** jsdom-driven headless suite (`check.mjs`), reproducible benchmark harness (`benchmark.json`), model training tools in `tools/`.
- **Hosting:** GitHub Pages (static). **License:** MIT.

---

## 8. Links

**How a judge runs it, in one minute:** open
https://mayamoho.github.io/bornomala/ in Chrome on Android → **⋮** menu →
**Install** → a `ব` icon appears on the home screen. Turn mobile data off and it
still opens. Tested on two Android handsets; screenshots are in
[`image/`](image/), step-by-step instructions in the README.

| Item | URL |
|---|---|
| Live app | https://mayamoho.github.io/bornomala/ |
| Slide deck | https://mayamoho.github.io/bornomala/slides.html |
| Repository | https://github.com/Mayamoho/bornomala |
| Demo video | *(paste the link once uploaded — unlisted YouTube is fine)* |
| Facebook post | *(paste after posting)* |

---

## 9. Team

Solo entry — Md. Abu Kawser. Role: ML/AI. Responsible for the language model, codec, app, and benchmark.

---

## 10. Demo video — shot list (5 minutes maximum)

Record on a real phone where possible. Judges reward seeing the SMS composer actually open.

| Time | Shot | Say |
|---|---|---|
| 0:00–0:25 | Black screen, then the July 2024 blackout line | "In July 2024 the network was cut. What survived was SMS. And Bangla costs 2.3× more to send than English, because it is not in the GSM-7 alphabet." |
| 0:25–0:55 | App open on the phone, type a Bangla status in the Write tab | "This is a real status report. Watch the counter." |
| 0:55–1:30 | Zoom on the stats row: characters, segments, ratio | "Seventy characters would have been one segment. This fits three hundred and sixty-one. 5.15× more Bangla in the same SMS." |
| 1:30–2:00 | Tap Send — **show the phone's SMS composer opening with the message prefilled** | "No server. The phone's own SMS app sends it." |
| 2:00–2:30 | Second phone: paste the code into Decode, original Bangla appears | "On the other side, the same model turns it back into words." |
| 2:30–3:15 | Emergency tab: type situation, pick a ready sentence, location, time; show the plain-text preview | "A survivor will not have this app. So the emergency path sends plain Bangla any phone can read — with the location as a link *and* as bare numbers, because the numbers work with no data." |
| 3:15–3:40 | Tap SMS beside 999 in the hotline list | "Nine official national hotlines, message already written." |
| 3:40–4:10 | Relay tab: two reports queued, sent as one SMS. Then QR toggle, second phone scans it | "One volunteer carries forty households. And with no network at all, the QR moves it screen to camera." |
| 4:10–4:35 | Install from Chrome's ⋮ menu, then turn on airplane mode and open it from the home screen | "It installs from the browser — no Play Store, no APK. And once installed it runs with no internet at all." |
| 4:35–5:00 | Benchmark table on screen | "Five thousand held-out messages. 3.1 bits per character. Every one fits in a single segment. Gzip does worse than doing nothing. This is what a purpose-built codec buys you." |

---

## 11. Facebook post (copy-paste)

> In July 2024 the state cut 3G and 4G. What survived was 2G — voice and SMS.
>
> Here is something most people do not know: Bangla is not in the GSM-7 alphabet
> that SMS was built on. So every Bangla text is forced into UCS-2 — 70 characters
> per message instead of English's 160. It costs about 2.3× more to be Bangla in a
> crisis.
>
> I spent this weekend building বর্ণমালা · Bornomala, an offline app that fixes
> that at the encoding layer. A small Bangla language model plus an arithmetic
> coder compresses a message before it is sent.
>
> Measured over 5,000 held-out messages: **361 Bangla characters in a single SMS
> segment instead of 70. 5.15× more.** Every test message fit in one segment. gzip
> actually does *worse* than sending raw.
>
> It also has an emergency mode that sends plain Bangla any phone can read, with
> nine national hotlines (999, 1090, 102, 333…) one tap away, your location as a
> map link *and* as bare coordinates for when there is no data, and a QR handoff
> for when there is no network at all.
>
> No server. No internet. Nothing leaves your phone. Works on a cheap Android.
> Open source, MIT.
>
> 1952 was the right to speak Bangla. 2024 was the right to speak at all. This is
> the same fight one layer down — in the character encoding.
>
> 🔗 Try it: https://mayamoho.github.io/bornomala/
> ⭐ Code: https://github.com/Mayamoho/bornomala
>
> #JulyHackathon2026 #CrisisTech #Bangla #OpenSource

**Attach:** the demo video (upload natively to Facebook — native video outreaches a YouTube link), or failing that a screen recording of the stats row.

**Do not** buy reactions, boost the post, or use farm accounts — the rules disqualify that entire scoring component.

---

## 12. Notes for the judges

**What is honest about the numbers.** The 5.15× figure is free-text compression
measured on 5,000 held-out messages — every 50th corpus line, never seen in
training (`npm run bench`). It applies to the **Normal** tab only. The Emergency
and Relay tabs deliberately send uncompressed plain text, so a stranger's phone
can read them, and they claim no compression at all.

**Known limitations.**

- Compression needs the app on both ends. That is why the emergency path exists,
  and why the pitch is that volunteers and coordinators install it rather than
  survivors.
- Relay's saving comes from sending one message instead of many, not from
  compression. Two reports go out as 6 segments instead of 8; the gain scales
  with the number of reports, not with clever encoding.
- Short codes such as 999 do not reliably accept SMS. The app says so plainly and
  offers Call first.
- The Send buttons do nothing on a desktop browser — a computer has no SMS app.
  Copy works there instead. This is stated in the interface.
- The 1.7 MB model downloads once on first open. Until it arrives, the Emergency
  and Relay tabs work but the Normal tab cannot compress.
- Location accuracy depends on the phone's GPS; without a fix the app falls back
  to a district, which is coarse but always available.

**What I would do next.** Batch the relay queue into the compressed format when
both ends are known to have the app, which would turn the current 6-segment batch
into roughly one. Add a receipt path so a coordinator can confirm a report was
read. Widen the phrasebook past 32 sentences, which is a deliberate version
boundary rather than an oversight.

**Before you open the repo.** `README.md` is the long technical write-up.
`SUBMISSION.md` is this file. `npm test`, `npm run check` and `npm run audit` run
the three suites — 81 checks, no network needed. `npm run bench` reproduces the
compression table from the held-out set.

---

## 13. Repository housekeeping — five minutes, do this first

The GitHub half of public engagement is 10% of the total score, and the repo currently has no description and no homepage, so a judge landing on it sees nothing.

On https://github.com/Mayamoho/bornomala, click the ⚙ beside **About**:

- **Description:** `Offline Bangla SMS app — compress messages 5.15×, send plain-text emergency reports, relay many households in one SMS. No server, no internet.`
- **Website:** `https://mayamoho.github.io/bornomala/`
- **Topics:** `bangla` `sms` `compression` `arithmetic-coding` `offline-first` `pwa` `crisis-tech` `bangladesh` `gsm7` `disaster-response`

Then pin the repo to your GitHub profile.
