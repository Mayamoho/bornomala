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

> In July 2024 the state cut 3G and 4G across Bangladesh. Broadband went dark.
> What survived was 2G — voice and SMS — and people fell back to text.
>
> But Bangla is not in the GSM-7 alphabet. Every Bangla SMS is forced into UCS-2
> encoding, which fits 70 characters per segment where English fits 160. Bangla
> costs roughly 2.3× more to send, splits into more segments, and fails more often
> on a congested network — exactly when SMS is the only channel left.
>
> The cost is not abstract. In the first hours of a flood or a blackout, the
> messages people send are short, urgent, and repeated by thousands at once: we
> are five, we are safe, the water is chest deep, do not come this way. Every one
> of those pays the Bangla penalty. A relay volunteer coordinating forty
> households pays it forty times, on a prepaid balance that does not refill and a
> tower that is already saturated.
>
> Almost every crisis-communication project responds by building a new network —
> mesh, Bluetooth, Wi-Fi Direct. That requires both phones to run the same app,
> in range, with battery. In July, nobody could build a network.

*(195 words, limit 200.)*

---

## 4. Solution description (limit: 400 words)

> Bornomala does not try to replace the broken network. It makes the message small
> enough that the network still standing is enough.
>
> A small statistical Bangla language model, trained offline and shipped as
> integer probability tables, drives a deterministic integer arithmetic coder. The
> output is packed into GSM-7 septets, so a compressed Bangla message travels in
> the 160-character lane instead of the 70-character one. Everything runs on the
> phone: no server, no internet, no message ever leaves the device.
>
> Benchmarked over 4,000 crisis-style Bangla messages: 3.12 bits per character
> against UCS-2's 16, which is 359 Bangla characters per SMS segment instead of
> 70 — 5.1× more. All 4,000 test messages fit in a single segment. gzip -9 scores
> worse than doing nothing (21.06 bits per character), because a general
> compressor's dictionary never pays for itself at SMS length. That gap is the
> whole argument for a purpose-built codec.
>
> Compression needs the app at both ends, and a survivor will not have it. So
> Bornomala ships a second path that requires nothing of the receiver. The
> Emergency tab sends plain Bangla text — readable on any phone in the country —
> built from what a responder actually needs: what is happening, where you are,
> when it happened. Nine official national hotlines (999, 1090, 102, 333 and
> others) are one tap from a call or a pre-written SMS. Location travels as a maps
> link *and* as bare coordinates beside it, because the numbers still work when
> the link cannot load. A relay mode lets one volunteer carry many households'
> reports in a single SMS. A QR handoff moves a message phone-to-phone with no
> network at all. Coordinators and volunteers install the app; survivors never
> have to.
>
> It degrades all the way down. No internet: an installable offline PWA with a
> precached shell. No data: SMS over 2G. No network: QR, screen to camera. No
> phone: the coded string is printable and can be decoded off a card by hand.
>
> The interface is fully bilingual, Bangla and English, switchable mid-message.
> There is no framework, no dependency, no analytics, and no account. 57
> automated checks cover codec round trips, every send path, the offline shell,
> and translation parity.
>
> 1952 was the right to speak Bangla. 2024 was the right to speak at all. This is
> the same fight one layer down, in the character encoding.

*(391 words, limit 400.)*

---

## 5. Tech stack

- **App:** offline-first installable PWA — vanilla JavaScript ES modules, no framework, no runtime dependencies, service worker precaching the full shell.
- **Codec:** Bangla context model trained offline from a crisis-message corpus, exported as integer probability tables (`model.bin`, 1.7 MB); deterministic integer arithmetic coder in JavaScript; GSM-7 septet packing.
- **Transport:** `sms:` URI handing the message to the device's own SMS composer. No backend, no API, no third-party service.
- **Extras:** QR encoder written from scratch (no library), Geolocation API for coordinates, `localStorage` for language choice only.
- **Testing:** jsdom-driven headless suite (`check.mjs`), reproducible benchmark harness (`benchmark.json`), model training tools in `tools/`.
- **Hosting:** GitHub Pages (static). **License:** MIT.

---

## 6. Links

| Item | URL |
|---|---|
| Live app | https://mayamoho.github.io/bornomala/ |
| Slide deck | https://mayamoho.github.io/bornomala/slides.html |
| Repository | https://github.com/Mayamoho/bornomala |
| Demo video | *(paste the link once uploaded — unlisted YouTube is fine)* |
| Facebook post | *(paste after posting)* |

---

## 7. Team

Solo entry — Md. Abu Kawser. Role: ML/AI. Responsible for the language model, codec, app, and benchmark.

---

## 8. Demo video — shot list (5 minutes maximum)

Record on a real phone where possible. Judges reward seeing the SMS composer actually open.

| Time | Shot | Say |
|---|---|---|
| 0:00–0:25 | Black screen, then the July 2024 blackout line | "In July 2024 the network was cut. What survived was SMS. And Bangla costs 2.3× more to send than English, because it is not in the GSM-7 alphabet." |
| 0:25–0:55 | App open on the phone, type a Bangla status in the Write tab | "This is a real status report. Watch the counter." |
| 0:55–1:30 | Zoom on the stats row: characters, segments, ratio | "Seventy characters would have been one segment. This fits three hundred and fifty-nine. 5.1× more Bangla in the same SMS." |
| 1:30–2:00 | Tap Send — **show the phone's SMS composer opening with the message prefilled** | "No server. The phone's own SMS app sends it." |
| 2:00–2:30 | Second phone: paste the code into Decode, original Bangla appears | "On the other side, the same model turns it back into words." |
| 2:30–3:15 | Emergency tab: type situation, pick a ready sentence, location, time; show the plain-text preview | "A survivor will not have this app. So the emergency path sends plain Bangla any phone can read — with the location as a link *and* as bare numbers, because the numbers work with no data." |
| 3:15–3:40 | Tap SMS beside 999 in the hotline list | "Nine official national hotlines, message already written." |
| 3:40–4:10 | Relay tab: two reports queued, sent as one SMS. Then QR toggle, second phone scans it | "One volunteer carries forty households. And with no network at all, the QR moves it screen to camera." |
| 4:10–4:35 | Turn on airplane mode, reload the app — it still opens | "Installed, it runs with no internet at all." |
| 4:35–5:00 | Benchmark table on screen | "Four thousand messages. 3.12 bits per character. Every one fits in a single segment. Gzip does worse than doing nothing. This is what a purpose-built codec buys you." |

---

## 9. Facebook post (copy-paste)

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
> Measured over 4,000 crisis messages: **359 Bangla characters in a single SMS
> segment instead of 70. 5.1× more.** Every test message fit in one segment. gzip
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

## 10. Repository housekeeping — five minutes, do this first

The GitHub half of public engagement is 10% of the total score, and the repo currently has no description and no homepage, so a judge landing on it sees nothing.

On https://github.com/Mayamoho/bornomala, click the ⚙ beside **About**:

- **Description:** `Offline Bangla SMS compression codec — 5.1× more Bangla per text message. Built for the network a blackout leaves behind.`
- **Website:** `https://mayamoho.github.io/bornomala/`
- **Topics:** `bangla` `sms` `compression` `arithmetic-coding` `offline-first` `pwa` `crisis-tech` `bangladesh` `gsm7` `disaster-response`

Then pin the repo to your GitHub profile.
