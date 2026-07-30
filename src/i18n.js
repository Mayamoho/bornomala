/**
 * Interface language.
 *
 * English by default, Bangla on one tap. The two audiences arrive by different
 * doors — a coordinator or a judge reads the English, the person sending a
 * status report from a shelter reads the Bangla — and bilingual labels served
 * neither, because they doubled the length of every control on a small phone.
 *
 * Message *content* follows the same setting: phrasebook sentences, district
 * names and hour counts each carry their own bn/en pair.
 */

const KEY = 'bornomala.lang';

export const LANGS = ['en', 'bn'];

export const STRINGS = {
  en: {
    tagline: 'Bangla SMS compression that runs with the network down.',

    tabNormal: 'Normal',
    tabEmergency: 'Emergency',
    tabRelay: 'Relay',

    compose: '1. Write',
    composePlaceholder: 'Write in Bangla here…',
    payloadHead: '2. Compressed message',
    decodeHead: '3. Open a message you received',
    decodePlaceholder: 'Paste a compressed message here…',
    statChars: 'characters',
    statSegments: 'SMS segments',
    statUcs2: 'segments today (UCS-2)',
    statRatio: 'vs UCS-2',
    send: 'Send as SMS',
    copy: 'Copy',

    emHead: '1. Your message',
    emRequired: 'A typed message is required',
    emIntro: 'Nothing here is compressed or coded. Anyone can read it — the receiver needs no app.',
    emTextPlaceholder: 'What has happened? Write in your own words…',
    emSentence: '2. Add a ready sentence',
    emSentenceHint: 'Tap one, or pick from the list.',
    emSentenceList: 'Or pick from the list',
    emWhere: '3. Where are you',
    emWhen: '4. When',
    emSend: '5. What gets sent',
    emNumbers: '6. Emergency numbers',
    emNumbersHint:
      'Tap to call, or send this message to them as an SMS. 999 is toll-free. Short codes do not always accept SMS — if it fails, call.',
    chooseOne: 'Choose…',
    myDistrict: 'My district',
    myLocation: 'My live location',
    district: 'District',
    useLocation: 'Use my live location',
    noFix: 'No GPS fix yet',
    locating: 'Locating…',
    locationCaptured: 'Location captured',
    outsideBd: 'outside Bangladesh',
    noGeolocation: 'No geolocation on this device',
    noFixError: (reason) => `No fix: ${reason}`,
    justNow: 'just now',
    hoursAgo: (h) => `${h}h ago`,
    queue: 'Add to relay',
    showQr: 'Show QR',
    hideQr: 'Hide QR',
    qrHint:
      'No network at all? Show this to the phone beside you and let them point a camera. Nothing is transmitted.',
    qrFailed: (reason) => `Cannot build a QR: ${reason}`,
    stillNeeded: (list) => `Still needed: ${list}`,
    plainOk: 'Plain text — readable by anyone, no app needed.',
    yourMessage: 'your message',
    aSentence: 'a ready sentence',
    whereYouAre: 'where you are',
    whenIt: 'when',
    tapLocate: 'tap use my live location',
    call: 'Call',
    smsThem: 'SMS',
    copied: 'Copied',
    copyManually: 'Select and copy',
    desktopHint: 'On a computer nothing will happen — SMS needs a phone. Use Copy instead.',
    sentWith: 'Sent with Bornomala',
    toNumber: 'Send to (phone number) — required',
    toPlaceholder: '01XXXXXXXXX',
    toHint:
      'Required. An SMS link with no number is refused by most phones, so the button stays off until a number is here. 01XXXXXXXXX, or +8801XXXXXXXXX.',
    needNumber: 'a phone number',
    badNumber: 'Check the number — 11 digits starting 01, or +8801 and nine more.',
    updateReady: 'A newer version is ready — close and reopen the app to use it.',

    relayHead: 'Relay — many reports, one SMS',
    relayHint: 'Add messages from the Emergency tab and send them together. Plain text, no coding.',
    relayEmpty: 'Empty — add from the Emergency tab',
    statReports: 'reports',
    statAlone: 'sent separately',
    remove: 'Remove',
    clear: 'Clear all',
    relayNote: (count, segments) => `${count} report(s) in ${segments} segment(s)`,

    footer: 'Everything runs on your phone. No server, no internet, no message leaves the device.',
    modelLoading: 'Loading the language model…',
    modelFailed: (reason) => `No language model (${reason}) — the Emergency tab still works.`,
    compressionFailed: (reason) => `Compression failed: ${reason}`,
    couldNotDecode: (reason) => `Could not decode: ${reason}`,
  },

  bn: {
    tagline: 'বাংলা এসএমএস সংকোচন — ইন্টারনেট ছাড়াই।',

    tabNormal: 'সাধারণ বার্তা',
    tabEmergency: 'জরুরি বার্তা',
    tabRelay: 'রিলে',

    compose: '১. লিখুন',
    composePlaceholder: 'এখানে বাংলায় লিখুন…',
    payloadHead: '২. সংকুচিত বার্তা',
    decodeHead: '৩. পাওয়া বার্তা খুলুন',
    decodePlaceholder: 'প্রাপ্ত সংকুচিত বার্তা এখানে পেস্ট করুন…',
    statChars: 'অক্ষর',
    statSegments: 'এসএমএস সেগমেন্ট',
    statUcs2: 'সেগমেন্ট আজ (UCS-2)',
    statRatio: 'সংকোচন / UCS-2',
    send: 'এসএমএস পাঠান',
    copy: 'কপি করুন',

    emHead: '১. আপনার বার্তা',
    emRequired: 'বার্তা লিখতেই হবে',
    emIntro: 'এই ট্যাবের বার্তা সংকুচিত হয় না। যে কেউ পড়তে পারবে, প্রাপকের অ্যাপ লাগবে না।',
    emTextPlaceholder: 'কী হয়েছে, নিজের ভাষায় লিখুন…',
    emSentence: '২. প্রস্তুত বাক্য যোগ করুন',
    emSentenceHint: 'একটায় চাপ দিন, অথবা তালিকা থেকে বেছে নিন।',
    emSentenceList: 'অথবা তালিকা থেকে',
    emWhere: '৩. আপনি কোথায়',
    emWhen: '৪. কখন',
    emSend: '৫. যা পাঠাবেন',
    emNumbers: '৬. জরুরি নম্বর',
    emNumbersHint:
      'ফোনে চাপ দিলে কল যাবে, অথবা এই বার্তাটাই এসএমএস করুন। ৯৯৯ টোল-ফ্রি। শর্ট কোডে সব সময় এসএমএস যায় না — না গেলে কল করুন।',
    chooseOne: 'বেছে নিন…',
    myDistrict: 'আমার জেলা',
    myLocation: 'আমার সঠিক অবস্থান',
    district: 'জেলা',
    useLocation: 'অবস্থান নিন',
    noFix: 'জিপিএস নেওয়া হয়নি',
    locating: 'খোঁজা হচ্ছে…',
    locationCaptured: 'অবস্থান পাওয়া গেছে',
    outsideBd: 'বাংলাদেশের বাইরে',
    noGeolocation: 'এই ফোনে জিপিএস নেই',
    noFixError: (reason) => `পাওয়া গেল না: ${reason}`,
    justNow: 'এইমাত্র',
    hoursAgo: (h) => `${h} ঘণ্টা আগে`,
    queue: 'রিলেতে যোগ করুন',
    showQr: 'QR দেখান',
    hideQr: 'QR লুকান',
    qrHint: 'নেটওয়ার্ক একেবারেই নেই? পাশের ফোনে এটা দেখান, ওরা ক্যামেরা ধরুক। কিছুই পাঠানো হয় না।',
    qrFailed: (reason) => `QR বানানো গেল না: ${reason}`,
    stillNeeded: (list) => `বাকি আছে: ${list}`,
    plainOk: 'সাধারণ লেখা — যে কেউ পড়তে পারবে, অ্যাপ লাগবে না।',
    yourMessage: 'বার্তা',
    aSentence: 'প্রস্তুত বাক্য',
    whereYouAre: 'কোথায় আছেন',
    whenIt: 'কখন',
    tapLocate: 'অবস্থান নিন চাপুন',
    call: 'কল',
    smsThem: 'এসএমএস',
    copied: 'কপি হয়েছে',
    copyManually: 'নিজে কপি করুন',
    desktopHint: 'কম্পিউটারে কিছুই হবে না — এসএমএস পাঠাতে ফোন লাগে। তখন কপি করুন।',
    sentWith: 'বর্ণমালা অ্যাপ দিয়ে পাঠানো',
    toNumber: 'কাকে পাঠাবেন (মোবাইল নম্বর) — লাগবেই',
    toPlaceholder: '01XXXXXXXXX',
    toHint:
      'নম্বর দিতেই হবে। নম্বর ছাড়া এসএমএস লিংক বেশির ভাগ ফোন নেয় না, তাই নম্বর না দিলে বোতাম বন্ধ থাকে। 01XXXXXXXXX, বা +8801XXXXXXXXX।',
    needNumber: 'মোবাইল নম্বর',
    badNumber: 'নম্বরটা দেখুন — 01 দিয়ে ১১ সংখ্যা, বা +8801 এর পরে আরও নয়টি।',
    updateReady: 'নতুন সংস্করণ তৈরি — অ্যাপটি বন্ধ করে আবার খুলুন।',

    relayHead: 'রিলে — অনেকের খবর, এক এসএমএসে',
    relayHint: 'জরুরি ট্যাব থেকে বার্তা যোগ করুন, একসাথে পাঠান। সাধারণ লেখা, কোনো কোড নেই।',
    relayEmpty: 'খালি — জরুরি ট্যাব থেকে যোগ করুন',
    statReports: 'বার্তা',
    statAlone: 'আলাদা পাঠালে লাগত',
    remove: 'বাদ',
    clear: 'সব মুছুন',
    relayNote: (count, segments) => `${count} জনের খবর ${segments} সেগমেন্টে`,

    footer: 'সব কিছু আপনার ফোনেই চলে — কোনো সার্ভার নেই, বার্তা ফোনের বাইরে যায় না।',
    modelLoading: 'ভাষার মডেল নামছে…',
    modelFailed: (reason) => `মডেল আসেনি (${reason}) — তবু জরুরি ট্যাব কাজ করছে।`,
    compressionFailed: (reason) => `সংকোচন ব্যর্থ: ${reason}`,
    couldNotDecode: (reason) => `খোলা গেল না: ${reason}`,
  },
};

let current = 'en';

/** English by default: the app is opened cold by people who have never seen it. */
export function initLang() {
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGS.includes(saved)) current = saved;
  } catch {
    // Private mode or storage disabled. English it is.
  }
  return current;
}

export function getLang() {
  return current;
}

export function setLang(lang) {
  if (!LANGS.includes(lang)) return current;
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // The choice still holds for this session, which is the one that matters.
  }
  return current;
}

/** Looks up a key in the current language; falls back to English, then the key. */
export function t(key, ...args) {
  const value = STRINGS[current][key] ?? STRINGS.en[key];
  if (value == null) return key;
  return typeof value === 'function' ? value(...args) : value;
}

/** Applies the current language to `data-i18n` text and `data-i18n-placeholder`. */
export function applyLang(root = document) {
  document.documentElement.lang = current;
  for (const node of root.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of root.querySelectorAll('[data-i18n-placeholder]')) {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  }
}
