# Bornomala — Banglish demo script (5 minutes)

---

## Video niye du'ta kotha — age porun

**1. Video ta 5 minute 15 second (315.44s).** Metadata theke mepe dekhechi.
Limit jodi 5 minute hoy, tahole **15 second kaatte hobe** — noyto submission e
somossa hote pare. Shob theke shohoj cut: shurur dike home screen e je khali
somoy ache, oi tuku.

**2. Ami video ta dekhte pari ni — sotti kotha bolchi.** Ei machine e H.264
decoder nei; GStreamer eo nei, bundled ffmpeg eo nei. Headless Chrome diye frame
ber korar cheshta korechi, kintu prottek timestamp e ekdom same frame ashe —
mane seek kaj korchhe na. Tai **ei script ta apni je order likhe diyechen shei
order dhore lekha**, video dekhe na.

Timing gulo tai **suggestion**. Video ta dekhe ekbar miliye niben, othoba amake
bolun kon second e ki ache ("0:40 e emergency tab") — ami retime kore debo.

Chaile `! sudo apt install ffmpeg` run korun (ei machine e candidate 7:6.1.1
ache) — tarpor ami frame ber kore **apnar video er actual timing** boshiye dite
parbo.

---

## Bolar niyom

- **727 shobdo ≈ 5:16** (~138 shobdo/minute). `[optional]` baad dile **5:00**.
- `[optional]` mark kora line gulo somoy kombe hole baad diben.
- Bold shobdo gulo te ektu jor diben.
- Screen e ja dekha jachhe seta **bolben na** — video nijei dekhachhe. Apni khali **keno** ta bolben.

---

## Script

| Somoy | Screen e | Ja bolben |
| --- | --- | --- |
| 0:00–0:20 | Home screen, `ব` icon | July 2024. Sara desh e mobile internet bondho, broadband o bondho. Facebook, WhatsApp, Messenger — shob off. Kintu **call ar SMS cholechhilo** — oi channel ta shob theke purono ar chhoto bole. |
| 0:20–0:40 | Install hochhe | Ei je app ta — Bornomala. **Play Store lagbe na, APK o na.** Browser theke ek tap e install. |
| | App khulchhe | Ar ekbar install korle **internet chhara o khule** — ei dekhen, data off. Karon disaster er din e download shesh naao hote pare. |
| 0:40–1:20 | Normal tab, Bangla type, counter nordche | Ekhon **segment** ta bujhi. Network er kachhe ekta SMS mane ekta box. English e ek box e **160 character** — SMS toiri hoyechilo English er jonno. |
| | Counter er dike | Bangla oi alphabet e nei. Ekta Bangla okkhor likhlei puro message **bhari format** e chole jay — ek box e dhore matro **70 character**. Ekei phone, ekei tower, ekei daam, sudhu nijer bhashay lekhar karone **ordhek er o kom jayga**. |
| | Boro message paste, counter 11 | Tai koyek line Bangla mane **egaro ta SMS**. |
| 1:20–1:50 | Compressed code, counter 3 | App er bhitore ekta chhoto Bangla **language model** ache. Se onek Bangla porechhe, tai **porer okkhor guess korte pare**. Trick ta — **khoroch mane surprise**. Je okkhor shohoje guess kora jay, seta likhte prai kichhui khoroch hoy na. |
| | Counter er dike | Tai **egaro ta message neme ashlo tin te**. Model age dekhe ni emon panch hazar message e mepe dekha gechhe — **ek SMS e ekhon 361 ta Bangla okkhor dhore, jekhane ajker phone e dhore 70. Panch gun beshi.** |
| 1:50–2:15 | Ekhono Normal tab | Blackout er somoy eta keno matter kore — tin ta karon. |
| | | **Ek, reliability.** Tukro kora message **tokhoni** pouchay jokhon **protita tukro** pouchay. Jam howa tower e ekta tukro harale puro khobor gayeb. **Ek segment er message er harabar moto tukroi nei.** |
| | | **Dui, khoroch.** Disaster e recharge er dokan khola thake na — ekei taka y panch gun beshi kotha. |
| | | `[optional]` **Tin, tower er upor chap.** Apni je segment gulo pathachhen na, seta onner message er jonno jayga khali rakhe. |
| 2:15–2:35 | Compressed code er dike | Ekta pashapashi labh o ache — **privacy**. Majhkhane keu chokh bulale tar kachhe eta shudhu gibberish. Normal message e **dui pashei app lagbe**, karon ek i model diye lekha ar ek i model diye pora. |
| | | Tobe sposhto kore boli — **eta encryption na.** Jar kachhe app ache se porte parbe, ar app ta public. **Privacy by default, security na.** |
| 2:35–3:00 | Number, Send as SMS, phone er SMS app khulchhe | App nijei kichhu pathay na — message ta **apnar nijer SMS app e** tule dey. Tai permission lage na, server o nei. |
| | Onno phone e code paste, Bangla ber hochhe | Opashe **ekei model ulto dike chole**, ar okkhore okkhore Bangla ta fire ashe. |
| | Copy button | `[optional]` Ar **Copy** — SMS na kore WhatsApp ba onno jekono jaygay pathate chaile ek tap e clipboard e. |
| 3:00–3:40 | Emergency tab | Ekhon shob theke joruri part. **Compression kaj kore tokhoni jokhon dui phone eii app ache** — kintu chhad e atke thaka manush er kachhe app thakbe na. |
| | Bangla te khobor type | Tai ei tab e compression **use i hoy na** — eta pathay **shadharon Bangla lekha**, je kono phone e, kichhu install chhara pora jay. |
| | Panch ta field purron hochhe | Ar **panch ta jinish** na dile pathatei debe na — karon shudhu "help lagbe" likhle rescue team er kaje ashe na. |
| | | **Ek, ki hoyeche** nijer bhashay. **Dui, ekta ready sentence** — 32 tar moddhe theke, jate atonker somoy bakko sajate na hoy. **Tin, apni kothay.** **Char, kotokkhon age.** **Panch, kar kachhe pathaben** — number ta. |
| | Live location / district | **Jayga chhara khobor kono khobor i na.** GPS thakle exact position, na thakle district — kintu ekta lagbei. |
| 3:40–4:00 | Pathano message onno phone e | Opashe ki gelo dekhen — **puro ta shadharon Bangla lekha**. Receiver er app lage na, smartphone o na. |
| | Coordinates highlight | Ar location ta gechhe **du bhabe** — map link, ar pashei **khali number gulo**. Jar data nei se link khulte parbe na, kintu **number dekhe jayga ta ber kora jabe**. |
| 4:00–4:15 | Emergency numbers, Call chapa | Nichey **noy ta sarkari joruri number**, 999 shob ager, toll-free. Ek tap e call. **Call er jonno internet lage na.** |
| 4:15–4:45 | Add to relay, tarpor Relay tab | **Relay** — eta ashroykendrer volunteer er jonno. Tar khatay chollish poribar er khobor, hate ek dag network. |
| | Relay list, counter | Alada pathale seta chollish ta message, chollish bar taka kata, chollish bar cheshta. Tar bodole **ek tap e add kore ek bar e pathay**. |
| | Counter er dike | Counter dekhachhe **ek shathe koto laglo**, ar **ekta ekta kore pathale koto lagto**. Blackout e oi difference tai asol — **ekta message pouche jawa, chollish ta atke thakar cheye bhalo**. |
| 4:45–4:55 | Show QR, onno phone camera | Ar network jodi **ekebarei na thake** — tower i bondho — tokhon message ta **QR code** hoye jay, pasher phone camera diye pore ney. Kichhui transmit hoy na, shudhu alo. |
| 4:55–5:00 | App / repo | Shob kichhu phone eii chole. Server nei, account nei, amar kachhe kichhu jay na. Open source, MIT license. **Dhonnobad.** |

---

## Somoy beshi hole ei order e kaatben

1. `[optional]` mark kora dui line (tower er chap, Copy button) — **~20 second**
2. Relay er "alada kore pathale…" line — counter nijei dekhachhe — **~10 second**
3. Privacy er part ta puro baad — **kintu half kore bolben na.** Hoy dui line
   ekshathe (labh + "encryption na"), noy to kichhui na.

**Kokhono baad deben na:** 160 vs 70 · 361 vs 70 (panch gun) · "emergency tab e
receiver er app lage na" · bare coordinates keno pathano hoy.

---

## Tin ta shotorkota — judge dhorte pare

1. **Privacy ke encryption bolben na.** Bollei prosno ashbe "ki algorithm, ki
   key?" — ar uttor nei, karon eta compression. Script e jevabe lekha ache —
   "privacy by default, security na" — thik oi vabei bolben.
2. **999 e Call chapben, SMS na.** Short code gulor beshir bhag inbound SMS ney
   na. App er SMS button ta fallback, ar chhoto kore ek segment e pathay.
3. **Relay compression kore na.** Relay **send** bachay, bit na — chollish tar
   bodole ekta message ar ekta signature. Eta i sotti, ar eta i jothesto.
