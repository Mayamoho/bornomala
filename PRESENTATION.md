# Bornomala — the talk, and everything behind it

Three things in one file:

1. **[The five-minute speech](#part-1--the-five-minute-speech)** — read it aloud, it times out at about five minutes.
2. **[Every technical word, explained plainly](#part-2--every-technical-word-explained-plainly)** — so no judge's question catches you out.
3. **[The app, step by step](#part-3--the-app-step-by-step)** — including exactly what Relay and the QR are for, and when to reach for each.

---

# Part 1 — the five-minute speech

> Timings are for a calm speaking pace. Anything in *(brackets)* is a stage
> direction, not something to read out.

### 0:00 – 0:40 · The night the network went

> In July 2024, the government switched off mobile internet across Bangladesh.
> Broadband went dark as well. Facebook, WhatsApp, Messenger, Imo — everything
> people actually talk on — gone, at the same moment, for everybody.
>
> One thing kept working. The oldest part of the phone network: **voice calls
> and text messages.** Not because anybody planned it that way, but because SMS
> runs on a channel so old and so small that it survives when everything modern
> falls over.
>
> So people fell back to texting. And that is where they hit a wall almost
> nobody in this room has ever noticed.

### 0:40 – 1:30 · The wall: it costs more to be Bangla

> Text messaging was invented in the 1980s, for English. It was given a small
> alphabet — English letters, digits, a few symbols. In that alphabet, **one text
> message holds 160 characters.**
>
> Bangla is not in that alphabet. Neither is Hindi, or Arabic, or an emoji. So
> the moment you type a single Bangla letter, your phone silently switches the
> whole message to a bigger, heavier format — and in that format **one message
> holds only 70 characters.**
>
> *(pause)*
>
> Same phone. Same tower. Same price per message. **Less than half the room, just
> for writing in your own language.**
>
> Write four lines of Bangla and your phone quietly splits it into three or four
> separate messages. You are billed for three or four. And here is the part that
> matters in a disaster: a split message only arrives if **every** piece arrives.
> Lose one piece on a congested tower and the whole thing is gone.

### 1:30 – 2:15 · Why not just build a mesh app?

> The obvious answer is to build your own network — Bluetooth, phone to phone.
> Many good projects do exactly that, and I want to be fair to them.
>
> But a Bluetooth mesh has three conditions. Both people must have installed the
> same app **before** the disaster. Both must be within about a hundred metres.
> And to travel further, enough strangers in between must also have installed it
> and left their phones on.
>
> In a flood, the person you need is not in the room. She is your mother in
> another district. Or a control room in Dhaka. **Bluetooth will never reach
> her.** No amount of engineering turns a hundred metres into forty kilometres.
>
> Text messages already reach every handset in this country. No install. Across
> operators. On 2G. With the mobile internet switched off.
>
> So Bornomala does not build a network. **It uses the one that already reaches
> everybody, and makes it cheaper.**

### 2:15 – 3:15 · What it actually does

> *(open the app on the Normal tab)*
>
> Bornomala carries a small Bangla language model inside it — about one and a
> half megabytes, downloaded once, then it lives on your phone forever.
>
> That model has read a great deal of Bangla, so it can guess what letter is
> likely to come next. And here is the trick: **the better you can guess
> something, the less it costs to write it down.** If I can already guess the next
> letter, I barely need to spend anything recording it. Only surprises cost.
>
> So the app turns your sentence into a short code, written in characters that
> SMS considers cheap English.
>
> *(type a Bangla message, point at the counters)*
>
> Watch this. This message would cost eleven text messages sent normally. Through
> Bornomala it goes as three.
>
> Measured properly — five thousand messages the model had never seen before —
> **361 Bangla characters now fit in a single text, where a phone today fits 70.
> That is 5.15 times more Bangla in every message.**
>
> And for comparison: ordinary compression, the kind that makes a ZIP file, does
> *worse* than sending it raw. It has no idea what Bangla looks like, and a
> message this short never repays the overhead. That gap is the whole reason this
> had to be built specifically.

### 3:15 – 4:15 · The honest problem, and the two answers

> Now the obvious objection, and I would rather say it myself than have you find
> it.
>
> **Compression only works if both phones have the app.** A survivor on a roof
> will not have it. So the app has a second path that needs nothing at all from
> the person receiving it.
>
> *(switch to the Emergency tab)*
>
> This tab sends **plain Bangla words**. No code. Any handset in the country can
> read it. It asks four things — what is happening, in your own words; one of 32
> ready sentences with a blank to fill; where you are, by district or live
> location; and how long ago. It refuses to send until you answer them, because a
> report with no place in it is not a report.
>
> Underneath sit the nine national numbers, 999 first, one tap to call.
>
> *(switch to the Relay tab)*
>
> And this is for the volunteer at the shelter. She has forty families' status in
> a notebook and one bar of signal. She adds each report with one tap and sends
> **one message instead of forty.** On a tower that is already choking, one
> message that gets through beats forty stuck in a queue.
>
> *(show the QR)*
>
> And if there is no network at all — no data, no SMS, the tower itself down —
> the message becomes a QR code. The phone beside you points its camera and reads
> it straight off the screen. Nothing is transmitted. No tower, no Bluetooth, no
> pairing, no permission.

### 4:15 – 5:00 · Close

> Everything you have seen runs on the phone. There is no server. There is no
> account. Nothing is sent to me, because there is nowhere to send it to. Install
> it once and it works with the internet switched off — I have tested that on two
> Android handsets.
>
> It is open source, MIT licensed, and the benchmark is in the repository, so you
> can re-run the numbers yourself.
>
> *(pause)*
>
> In 1952 people died for the right to speak Bangla. In 2024 the fight was for
> the right to speak at all.
>
> This is the same fight, one layer down — in the character encoding. And it
> comes down to one number: **five times more Bangla in every message, on the
> network a blackout leaves behind.**
>
> Thank you.

---

# Part 2 — every technical word, explained plainly

Read this once and no judge's question will surprise you.

### What is an "SMS segment"?

A **segment** is one text message as the network counts it — one billed unit.

You think of "a message" as whatever you typed. The network thinks in fixed-size
boxes. Your text is poured into boxes, and **you pay per box.**

- Write in English: **one box holds 160 characters.**
- Write in Bangla: **one box holds 70 characters.**

Type 200 Bangla characters and it does not travel as one long message. It travels
as **three boxes**, billed as three, stitched back together on the other phone.

The counters in the app say "SMS segments" — that means "how many boxes this
will take", which is the same as "how many messages you are paying for."

### Why does Bangla only get 70?

Because of the alphabet the box is measured in.

**GSM-7** is the original SMS alphabet from the 1980s. 128 characters: English
letters, digits, punctuation. Each costs **7 bits** of space. A box holds 1,120
bits, so 1,120 ÷ 7 = **160 characters.**

Bangla is not in that list. Neither is Hindi, Chinese, Arabic, or 😀. When a
message contains even one character outside GSM-7, the phone switches the
**entire message** to a different alphabet.

**UCS-2** is that fallback. It covers nearly every writing system on earth, but
every character costs **16 bits** instead of 7. Same 1,120-bit box, bigger
characters: 1,120 ÷ 16 = **70 characters.**

So the "Bangla tax" is 160 ÷ 70 ≈ **2.3×**. Nothing is broken; SMS was designed
before anyone thought about Bangla, and that decision is still being paid for
forty years later.

> **If a judge asks "can't you just use Unicode?"** — UCS-2 *is* Unicode. That is
> exactly what makes it expensive. The problem is not that Bangla is unsupported;
> it is that supporting it costs 16 bits per character.

### What is a "bit", and what does "3.1 bits per character" mean?

A **bit** is the smallest unit of information — a single yes/no.

- UCS-2 spends a flat **16 bits** on every Bangla character. Always. Whether that
  character was obvious or surprising.
- Bornomala spends **3.106 bits on average**. Common letters cost far less than
  one bit; rare ones cost more.

16 ÷ 3.106 ≈ **5.15×**. That single division is where the headline number comes
from, and it is the most defensible figure you have, because it does not depend
on how things round into boxes.

### How can a letter cost less than one bit?

This is the part worth understanding, because it is the whole idea.

Suppose I ask you to guess the next letter and you are almost certain it is `া`.
When I confirm you were right, I have told you **almost nothing you did not
already know** — so recording it should cost almost nothing.

Now suppose the next letter is genuinely surprising. Confirming it tells you a
lot, so it costs a lot.

**Cost = surprise.** That is the entire principle. (Its formal name is *entropy
coding*; the specific method here is an *arithmetic coder*.)

Bornomala ships a **language model** — a table built by reading millions of lines
of ordinary Bangla — that knows, at any point in a sentence, which letters are
likely to come next. Good guesses make Bangla cheap to write down. The receiving
app runs the identical model in reverse and rebuilds the sentence letter for
letter.

> **Why it must be exact:** both phones must compute *identical* numbers or the
> message decodes to garbage. That is why the model uses whole numbers only —
> decimals can round differently on different phones.

### Why does gzip do worse than sending nothing?

gzip (the ZIP-file kind of compression) works by spotting repetition — "this
chunk appeared earlier, point back at it." That needs a long document to pay off.

An SMS is 30 to 200 characters. Nothing has repeated yet, and gzip still attaches
its own header, so it **finishes bigger than the original**: 21 bits per
character against raw UCS-2's 16.

This is a strong point for you: it proves a general-purpose tool cannot solve
this, and that a Bangla-specific model was genuinely necessary.

### What is "GSM-7 packing"?

After compression you have a pile of bits. You cannot put raw bits into a text
message; you must send *characters*.

So the app writes those bits using **only characters from that cheap
160-per-box alphabet** — which is why a compressed message looks like line noise
(`Bù8P9*+=!¤1+1j`). It is not encryption and it is not random. It is your Bangla
sentence, written in the alphabet SMS charges least for.

That is why a compressed message rides the 160-character lane instead of the
70-character one — a second, separate win on top of the compression itself.

### Is it encryption? (Judges ask this.)

**No.** Encryption hides meaning from anyone without a key. This hides nothing —
anyone with the app can read it, and the app is public and open source. It is
compression: the same meaning, written shorter. Say this clearly, because "crisis
app that encrypts messages" invites questions you do not want.

### Why does any of this matter in a blackout?

Four separate reasons. Know all four — judges probe here.

1. **Cost.** Prepaid balance cannot be topped up when shops are shut and mobile
   money is down. Five times more per message is five times more you can say
   before the balance runs out.

2. **Congestion.** After a cyclone, everybody texts at once and a tower can only
   carry so much. Every segment you *don't* send is capacity left for someone
   else's message — and for yours to get through.

3. **All-or-nothing delivery.** The one people miss. A 3-segment message is not
   "mostly delivered" when 2 arrive — the phone waits for all three, and if one is
   dropped the message is lost or arrives mangled. **A 1-segment message has no
   pieces to lose.** Getting a report down to one segment does not only make it
   cheaper, it makes it *more likely to arrive at all*.

4. **Battery and time.** Fewer sends, fewer retries, less radio time. On a phone
   at 8% with no way to charge, that is not a rounding error.

### The two phrases judges will test you on

**Offline-first / PWA.** "PWA" means Progressive Web App — a website that
installs to your home screen and then runs like an app, with no Play Store and no
APK. "Offline-first" means it assumes there is no internet: the files are stored
on the phone the first time you visit, and every later open works with the radio
off.

**Graceful degradation.** As conditions get worse the app keeps working with
less, instead of failing: no internet → still opens; no mobile data → SMS over
2G; no GPS → pick a district; no network at all → QR, screen to camera.

---

# Part 3 — the app, step by step

## Installing it (one minute, once)

1. Open **https://mayamoho.github.io/bornomala/** in Chrome on Android.
2. Wait a few seconds — the language model downloads once, about 1.7 MB.
3. Tap the **⋮** menu at the top right → **Install**.
4. A `ব` icon appears on your home screen.
5. **Test it now, on a calm day:** switch off mobile data and open it again. It
   still works. Doing this before you need it is the whole point — during a
   disaster the download may not finish.

## The three tabs, and which one you actually want

| You want to… | Use | Does the other person need the app? |
| --- | --- | --- |
| Text someone who also has Bornomala, cheaply | **Normal** | **Yes** |
| Report an emergency to anyone at all | **Emergency** | **No** |
| Send many people's reports at once | **Relay** | **No** |
| Hand a message over with no network at all | **QR** (a button, not a tab) | They need a camera |

---

## Tab 1 — Normal: cheap messages between two people who both have the app

**Use it when:** you are texting family or a colleague who also installed
Bornomala, and you want to say more for less.

1. Type your message in Bangla.
2. Watch the four counters:
   - **characters** — how much you typed.
   - **SMS segments** — how many messages this costs *through Bornomala*.
   - **segments today (UCS-2)** — what the same text would cost *without* it.
   - **vs UCS-2** — how many times better that is.
3. Enter the recipient's phone number. **Required** — a text link with no number
   is silently refused by most phones, so the button stays off rather than
   pretending to work.
4. Tap **Send as SMS**. Your normal messaging app opens with the number and
   message already filled in. Press send there. *(The app never sends anything
   itself — it hands the message to your phone. That is why it needs no
   permissions.)*
5. **To read one you were sent:** copy the whole text message you received and
   paste it into *Open a message you received* at the bottom of the same tab. The
   Bangla appears. Paste it exactly as it arrived — the app ignores the signature
   line and any map link automatically.

> **If the other person does not have the app,** they will see the code and it
> will look like nonsense. That is what the Emergency tab is for.

---

## Tab 2 — Emergency: plain words, for anyone

**Use it when:** you need help, or you are reporting a situation to someone who
may not have the app — a relative, a coordinator, a rescue office, 999.

Nothing here is compressed. It sends ordinary Bangla words that **any phone in
the country can read**, with nothing installed.

The app will not let you send until four things are answered, because a report
that says "help" with no place and no time wastes the responder's time:

1. **Your message** — what is happening, in your own words.
2. **A ready sentence** — tap one of the six icons, or pick from the list of 32.
   Each has a blank to fill: how many people, how urgent, blood group, water
   depth, shelter space. These exist so you are not composing sentences while
   panicking, and so the wording is already clear and checked.
3. **Where you are** — pick your district, or tap *use my live location*. Your
   location always travels **twice**: as a map link *and* as plain numbers, so it
   still makes sense on a phone that cannot open links.
4. **When** — just now, or up to 31 hours ago.

Then send it to a phone number, or scroll to **Emergency numbers**.

> **About the nine national numbers:** these are call centres on short codes.
> **Calling is the reliable path** — 999 is toll-free and works with no internet.
> The SMS button beside each is a fallback, not a guarantee: most short codes do
> not accept incoming SMS at all. The app sends them a shortened, one-segment
> version with no link, because short codes drop long messages. Say this honestly
> if asked — it is a limitation of the national system, not of the app.

---

## Tab 3 — Relay: what it is really for

**This is the tab people find confusing, so here is the picture.**

### The situation

A cyclone shelter. One volunteer. Forty families around her, each wanting to tell
relatives elsewhere that they are alive, or that they need medicine, or that the
water is rising.

Each family's report is short. But sent separately that is **forty text
messages** — forty sends, forty charges against her prepaid balance, forty
attempts on a tower that is already overloaded. It might take an hour. Many will
fail.

### What Relay does

She collects the reports **into one message** and sends it once.

1. On the **Emergency** tab she fills in the first family's report as normal.
2. Instead of **Send**, she taps **Add to relay**.
3. The form clears. She does the next family. Add to relay. And the next.
4. When the notebook is done she opens the **Relay** tab. Every report is listed,
   each removable if she made a mistake.
5. She enters one number — a district coordinator, a relative in Dhaka, a
   volunteer with a working connection — and sends **once**.

### What the counters tell her

- **reports** — how many households are in this batch.
- **characters** — total size.
- **SMS segments** — what the batch costs to send.
- **sent separately** — what those same reports would have cost one by one.

That last number is the point. Two reports go out as **5 segments instead of 6**.
Forty reports save roughly one send per report, plus thirty-nine separate
attempts on a choking tower.

### When to use Relay, and when not to

**Use it when** one person is speaking for many: a shelter volunteer, a union
council office, a ward coordinator, someone collecting status for a whole street
or building.

**Do not use it** for your own single message — that is just the Emergency tab.

> **Be precise about the saving:** Relay saves *sends*, not bits. These go out as
> plain readable words on purpose. The gain is one message and one signature
> instead of forty of each. That is an honest claim and it is enough — do not
> oversell it as compression.

---

## The QR code: when there is no network at all

**Use it when:** there is no signal whatsoever. The tower is down, or you are in
a dead zone, or the network is switched off entirely. SMS cannot help you,
because SMS still needs a tower.

But the person you need is **standing next to you.**

### How it works

1. Build your message as normal (Emergency tab, or the Relay batch).
2. Tap **Show QR**. The message becomes a square black-and-white pattern.
3. The other person opens their ordinary camera app and points it at your screen.
4. It reads.

**Nothing is transmitted.** No tower, no Bluetooth, no wifi, no pairing, no
permissions, no accounts. It is light going from your screen into their camera —
which is why it works when every radio is dead.

### When you would actually reach for it

- Passing a report to a **rescue team or an army unit** that has arrived on the
  ground with a working satellite link, when your own phone has no signal.
- Handing a relay batch to **someone leaving the area** who will hit coverage
  before you do — they carry forty families' status out in their pocket.
- **Two phones in the same shelter** with no tower between them.
- Moving a message to a phone with **more battery** than yours.

### Its limits, stated plainly

The other person must be physically in front of you. QR is a *handoff*, not a
transmission. Its job is to get your message onto a phone with a better chance of
reaching the outside world than yours has.

---

## What to say if a judge asks "when should I *not* use this?"

Answer straight — it builds more trust than a dodge:

> One short message, to one person, on a network that is working normally? Send
> it normally. Bornomala adds nothing there. This is built for the case where SMS
> is the only channel left and it is overloaded — and for the volunteer who has
> forty reports and one bar of signal.
