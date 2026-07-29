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
> enough that the network still standing is enough. It is an installable offline
> app with three tabs.
>
> **Normal — compress and decode.** Type Bangla and live counters show characters,
> compressed segments, what the same text costs today in UCS-2, and the ratio. A
> small Bangla model trained offline drives a deterministic arithmetic coder; the
> bits pack into GSM-7 septets, so the message rides the 160-character lane instead
> of the 70-character one. Send hands it to the phone's own SMS composer. Paste back
> a code — or the whole received SMS — and the Bangla returns.
>
> Benchmarked on 5,000 held-out messages never seen in training: 3.106 bits per
> character against UCS-2's 16.000 — 361 Bangla characters per segment instead of
> 70, 5.15× more, with 100% fitting one segment. gzip -9 does worse than doing
> nothing (21.002 bits per character): a general compressor's dictionary never pays
> for itself at SMS length.
>
> **Emergency — plain text, nothing needed on the other end.** Compression needs
> the app at both ends and a survivor will not have it, so this tab uses none of
> the codec. It refuses to send until the report is useful: what is happening in
> your own words; one of 32 ready sentences in four groups with fill-in values
> (people, urgency, blood group, flood depth, shelter capacity); where you are, from
> 64 districts or live GPS; and when, up to 31 hours ago. Nine official national
> hotlines (999, 1090, 102, 16263, 333, 109, 1098, 16430, 106) are one tap from a
> call or a pre-written SMS. Location travels twice, as a maps link and as bare
> coordinates, because the numbers work when the link cannot load.
>
> **Relay — many reports, one SMS.** A volunteer adds each household's status with
> one tap and sends the batch as a single message, against a counter showing what
> sending them separately would have cost.
>
> It degrades in steps: no internet, an offline PWA; no data, SMS over 2G; no GPS,
> a district instead of coordinates; no network, a QR shown screen to camera.
>
> Fully bilingual. No framework, no dependency, no account. 81 automated checks
> cover codec round trips, every send path, the offline shell and translations.
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
| 0:55–1:30 | Zoom on the stats row: characters, segments, ratio | "Seventy characters would have been one segment. This fits three hundred and sixty-one. 5.15× more Bangla in the same SMS." |
| 1:30–2:00 | Tap Send — **show the phone's SMS composer opening with the message prefilled** | "No server. The phone's own SMS app sends it." |
| 2:00–2:30 | Second phone: paste the code into Decode, original Bangla appears | "On the other side, the same model turns it back into words." |
| 2:30–3:15 | Emergency tab: type situation, pick a ready sentence, location, time; show the plain-text preview | "A survivor will not have this app. So the emergency path sends plain Bangla any phone can read — with the location as a link *and* as bare numbers, because the numbers work with no data." |
| 3:15–3:40 | Tap SMS beside 999 in the hotline list | "Nine official national hotlines, message already written." |
| 3:40–4:10 | Relay tab: two reports queued, sent as one SMS. Then QR toggle, second phone scans it | "One volunteer carries forty households. And with no network at all, the QR moves it screen to camera." |
| 4:10–4:35 | Turn on airplane mode, reload the app — it still opens | "Installed, it runs with no internet at all." |
| 4:35–5:00 | Benchmark table on screen | "Five thousand held-out messages. 3.1 bits per character. Every one fits in a single segment. Gzip does worse than doing nothing. This is what a purpose-built codec buys you." |

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

## 10. Repository housekeeping — five minutes, do this first

The GitHub half of public engagement is 10% of the total score, and the repo currently has no description and no homepage, so a judge landing on it sees nothing.

On https://github.com/Mayamoho/bornomala, click the ⚙ beside **About**:

- **Description:** `Offline Bangla SMS app — compress messages 5.15×, send plain-text emergency reports, relay many households in one SMS. No server, no internet.`
- **Website:** `https://mayamoho.github.io/bornomala/`
- **Topics:** `bangla` `sms` `compression` `arithmetic-coding` `offline-first` `pwa` `crisis-tech` `bangladesh` `gsm7` `disaster-response`

Then pin the repo to your GitHub profile.
