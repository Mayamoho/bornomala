# Bornomala — demo video script

**বাংলা স্ক্রিপ্ট: [PRESENTATION-BN.md](PRESENTATION-BN.md)**

**One five-minute script.** Left column is what the camera shows, right column is
what you say. Record the screen, speak over it.

- **Spoken length:** 747 words — about **5:09** at a normal speaking pace (145 words a minute), or **4:59** if you move briskly. That leaves room for the pauses.
- **Bold** = press harder on that word. *(Brackets)* = an action, never read aloud.
- Do the action on screen **first**, let it land, then speak the line.

**Before you record:** install the app on the phone, open the Normal tab, clear
every box, have the second phone ready with the SMS thread open, and have one
long Bangla message ready to paste so the counters jump instantly.

---

## 0:00 – 0:30 · The blackout

| On screen | Say |
| --- | --- |
| Black, or the home screen with the `ব` icon. | In July 2024 the government switched off mobile internet across Bangladesh. Broadband went dark too. Facebook, WhatsApp, Messenger — all of it gone, at once, for everybody. |
| Hold. | One thing kept working: **voice calls and text messages.** SMS runs on a channel so old and small it survives when everything modern falls over. |
| Hold. | So people fell back to texting — and hit a wall almost nobody notices. |

---

## 0:30 – 1:10 · Why Bangla costs double

| On screen | Say |
| --- | --- |
| Open the app, Normal tab, empty. | Texting was invented in the eighties, for English. In that alphabet **one message holds 160 characters.** |
| Type a few Bangla words. Counters move. | Bangla is not in it. Type one Bangla letter and the phone switches the whole message to a heavier format — where **one message holds 70.** |
| *(pause on the counters)* | Same phone. Same tower. Same price. **Less than half the room, for writing in your own language.** |
| Paste the long message. The counter jumps to 11. | A "segment" is one billed message. A few lines of Bangla become **eleven** of them. |
| Point at that number. | And a message cut into pieces only arrives if **every** piece arrives. Lose one on a jammed tower and the whole report is gone. |

---

## 1:10 – 1:40 · Why not a Bluetooth mesh?

| On screen | Say |
| --- | --- |
| Stay on the app, or cut to the mesh slide. | The obvious answer is your own network over Bluetooth. Good projects do that. |
| Hold. | But a mesh needs both people to have installed it **before** the disaster, within about a hundred metres. In a flood the person you need is not in the room — she is your mother in another district. **Bluetooth will never reach her.** |
| Hold. | Text messages already reach every handset — no install, any operator, on 2G, internet off. So this builds no network. **It uses the one that already reaches everybody, and makes it cheaper.** |

---

## 1:40 – 2:30 · Normal tab — the compression

| On screen | Say |
| --- | --- |
| Long message on screen, counters visible. | The app carries a small Bangla language model — downloaded once, then it lives on the phone. |
| Point at the compressed code. | It has read a lot of Bangla, so it guesses what letter comes next. The trick: **cost equals surprise.** An easy guess costs almost nothing to record. Only surprises cost. |
| Point at the counters, slowly. | So eleven text messages become **three**. |
| Hold on the ratio. | Measured on five thousand messages the model had never seen: **361 Bangla characters fit in one text, where a phone today fits 70. Five times more.** |
| Hold. | Ordinary ZIP-style compression does *worse* than sending it raw — it has no idea what Bangla looks like. |
| Type the number, tap **Send as SMS**. The phone's SMS app opens, filled in. | The app never sends anything itself — it hands the message to your own SMS app. No permissions, no server. |
| Second phone: paste the code in, Bangla appears. | On the other side the same model runs backwards, and the sentence returns letter for letter. |

---

## 2:30 – 3:15 · Emergency tab — for people without the app

| On screen | Say |
| --- | --- |
| Switch to the Emergency tab. | Now the objection, and I would rather say it myself. **Compression only works if both phones have the app.** Someone on a roof will not. |
| Type the report in Bangla. | So this tab uses none of it. It sends **plain Bangla words** any handset can read, with nothing installed. |
| Tap a ready sentence, fill the blank. | It asks four things. What is happening, in your own words. Then one of 32 ready sentences with a blank to fill, so you are not composing while panicking. |
| Pick a district or tap live location. | Where you are — sent twice, as a map link **and** plain numbers, because numbers still work on a phone that cannot open links. |
| Choose the time. Preview appears. | And how long ago. It **refuses to send** until those are answered, because a report with no place in it is not a report. |
| Scroll to the hotlines. Tap **Call** beside 999. | Underneath, nine national numbers. 999 first, toll-free — **and calling needs no internet.** |

---

## 3:15 – 4:00 · Relay — one volunteer, many families

| On screen | Say |
| --- | --- |
| On Emergency, tap **Add to relay**. Fill a second report, add it too. | This tab is for the volunteer at the shelter — forty families' status in a notebook, one bar of signal. |
| Open the Relay tab — both listed. | Separately that is forty messages, forty charges on a prepaid balance nobody can top up, forty attempts on an overloaded tower. |
| Point at segments, against sent separately. | Instead she adds each with a tap and sends **once** — the counter shows the batch against sending them one by one. |
| Enter a number, show the send. | On a tower that is choking, **one message that gets through beats forty in a queue.** |

---

## 4:00 – 4:30 · QR, and offline

| On screen | Say |
| --- | --- |
| Tap **Show QR**. Second phone reads it with its camera. | With no network at all — no data, no SMS, the tower down — the message becomes a QR code, read straight off the screen. |
| Hold on the scan. | Nothing is transmitted — light from one screen into another camera. That is why it works when every radio is dead. |
| Airplane mode on. Close the app. Reopen from the home screen. It loads. | And here it is with the internet off. Installed once, it opens with nothing behind it. |

---

## 4:30 – 5:00 · Close

| On screen | Say |
| --- | --- |
| The app, or the repository page. | Everything runs on the phone. No server, no account, nothing sent to me — there is nowhere to send it. |
| Hold. | Open source, MIT licensed, benchmark in the repo — re-run the numbers yourself. |
| *(pause)* | In 1952 people died for the right to speak Bangla. In 2024 the fight was for the right to speak at all. |
| Final frame: the app, or the 5.15× figure. | Same fight, one layer down — in the character encoding. And it comes to one number: **five times more Bangla in every message, on the network a blackout leaves behind.** |
| Hold, then end. | Thank you. |

---

# If a judge asks — answers to have ready

Not part of the five minutes. Read once before you present.

**"What exactly is a segment?"**
One text message as the network counts and bills it. Your text is poured into
fixed boxes: 160 characters a box in English, 70 in Bangla. Type 200 Bangla
characters and you are paying for three boxes.

**"Why does Bangla only get 70?"**
GSM-7, the original SMS alphabet, spends 7 bits a character, and a box holds
1,120 bits — so 160 fit. Bangla is not in that alphabet, so the whole message
switches to UCS-2 at 16 bits a character. 1,120 ÷ 16 = 70. The tax is 160 ÷ 70,
about 2.3×.

**"Can't you just use Unicode?"**
UCS-2 *is* Unicode. That is exactly what makes it expensive. Bangla is not
unsupported — supporting it costs 16 bits per character.

**"How can a letter cost less than one bit?"**
Cost equals surprise. If the model is almost certain the next letter is `া`,
confirming it tells you almost nothing you did not already know, so recording it
costs almost nothing. Surprises cost more. UCS-2 spends a flat 16 bits whether
the character was obvious or not; we average 3.106. 16 ÷ 3.106 ≈ 5.15×.

**"Is it encrypted?"**
No. Encryption hides meaning from anyone without a key. This hides nothing —
anyone with the app can read it, and the app is public and open source. It is
compression: the same meaning, written shorter.

**"Why does smaller matter so much in a blackout?"**
Four reasons. Cost, on a prepaid balance nobody can top up. Congestion — every
segment you don't send is capacity left for someone else. All-or-nothing delivery
— a three-segment message is lost if one piece is dropped, and a one-segment
message has no pieces to lose. And battery: fewer sends, less radio time.

**"What is a PWA / offline-first?"**
A website that installs to the home screen and then runs like an app, with no
Play Store and no APK. Offline-first means it assumes there is no internet — the
files live on the phone after the first visit, and every later open works with
the radio off.

**"Do the SMS buttons on 999 work?"**
Calling is the reliable path. Those are call centres on short codes and most
accept no incoming SMS at all — a limit of the national system, not of the app.
The SMS button is a fallback, and it sends a shortened one-segment version,
because short codes drop long messages.

**"Does Relay compress?"**
No, and I would not claim it does. Relay saves *sends*, not bits — one message
and one signature instead of forty of each. The reports travel as plain readable
words on purpose, so the receiver needs no app.

**"When should someone *not* use this?"**
One short message, to one person, on a network that is working normally — send it
normally. This is for when SMS is the only channel left and it is overloaded, and
for the volunteer with forty reports and one bar of signal.
