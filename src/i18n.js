/**
 * Interface language.
 *
 * The app ships in English and switches to Bangla on one tap, because the two
 * audiences arrive by different doors: a judge, a relief coordinator or a
 * developer reads the English, and the person actually sending a status report
 * from a shelter reads the Bangla. Bilingual labels served neither well — they
 * doubled the length of every button on a 360px phone.
 *
 * What never switches is the *message content*: district names, phrasebook
 * entries and decoded frames carry their own bn/en pair through
 * `phrasebook.js` and `geo.js`, and follow the same setting.
 *
 * Values are either plain strings or functions of the interpolated parts, so a
 * translation is free to reorder them. Markup is allowed only where the key
 * name ends in `Html`, and only ever with our own text in it.
 */

const KEY = 'bornomala.lang';

export const LANGS = ['en', 'bn'];

export const STRINGS = {
  en: {
    tagline: 'Crisis messaging for the network you have left.',

    tabCrisis: 'Crisis',
    tabRelay: 'Relay',
    tabText: 'Write',
    tabDecode: 'Decode',
    tabCard: 'Paper card',

    crisisWhat: '1. What has happened',
    quickHint: 'Tap one. These are the six most common.',
    allMessages: 'Or choose from all 32 messages',
    groupStatus: 'We are…',
    groupNeed: 'We need…',
    groupDanger: 'Danger here',
    groupHelp: 'Help is here',
    where: 'Where are you',
    locNone: 'Do not send my location',
    locDistrict: 'My district',
    locGps: 'My exact position',
    locHint: 'A district costs 6 bits. An exact position costs 32.',
    district: 'District',
    useLocation: 'Use my location',
    noFix: 'No GPS fix yet',
    when: 'When did it happen',
    noTime: 'No time',
    justNow: 'Just now',
    hoursAgo: (h) => `${h}h ago`,
    noteHead: 'Name or note',
    optional: '(optional)',
    notePlaceholder: 'e.g. Ayesha Khatun',
    noteHelp:
      'A note needs the app at the other end. Without one, the message can be read off paper.',
    paperCheck: 'Hand-decodable code (base-32)',

    crisisMessage: '2. The message',
    willRead: 'What they will read',
    codeLabel: 'What actually gets sent',
    statChars: 'Characters',
    statSegments: 'SMS segments',
    statUcs2Today: 'Cost today (UCS-2)',
    statSaving: 'Saving',
    statReports: 'Reports',
    statAlone: 'Sent separately',
    statCompression: 'vs UCS-2',
    statUcs2Segments: 'Segments today (UCS-2)',

    send: 'Send as SMS',
    copy: 'Copy',
    queue: 'Add to relay',
    clear: 'Clear all',
    print: 'Print',
    showQr: 'Show QR',
    remove: 'Remove',
    map: 'Map',

    noNetworkHead: 'No network at all?',
    noNetworkHelp:
      'Show the QR to the phone beside you and let them point a camera. No radio, no operator, no permission.',
    qrLinkCheck: 'Scanning opens the app',

    relayHead: 'Relay — one SMS for many people',
    relayHelp: "One person with a bar of signal carries forty-five people's status in a single SMS.",
    relayEmpty: 'Empty — add reports from the Crisis tab',

    textHead: 'Write freely in Bangla',
    textPlaceholder: 'Type in Bangla here…',
    payloadHead: 'Compressed payload',

    decodeHead: 'Open a message you received',
    decodePlaceholder: 'Paste the code you received…  H-428R-H7E',

    cardHead: 'The paper decode card',
    cardHelpHtml:
      'Print this and pin it up. A code beginning with <code>H</code> can be decoded by hand from this card, with no phone and no power.',
    cardHowHead: 'How to read a code by hand',
    cardStep1Html: 'Drop the hyphens. A leading <code>H</code> means hand-decodable.',
    cardStep2: 'Convert each remaining character to its number below, and write each as 5 bits.',
    cardStep3: 'Drop the first bit (sentinel) and the last 8 bits (checksum).',
    cardStep4:
      "Then read left to right: 5 bits message number · 1 bit has-location · if set, 1 bit mode (0 = district, then 6 bits district number) · 1 bit has-time · if set, 5 bits hours ago · then the message's own fields · a final bit saying whether a note follows.",
    cardBase32Head: 'Character values (Crockford base-32)',
    cardMessagesHead: 'Messages (5 bits)',
    cardFieldsHead: 'Field values',
    cardDistrictsHead: 'Districts (6 bits)',
    colChar: 'char',
    colMessage: 'message',
    colFields: 'fields',
    colDistrict: 'district',

    footer: 'Everything runs on your phone. No server, no internet, no message leaves the device.',

    statusReady: 'Crisis messages ready, loading the text model…',
    statusNoModel: (reason) => `No text model (${reason}) — structured crisis messages still work.`,
    noteNeedsModel: 'A note needs the model, still loading.',
    cannotEncode: (reason) => `Cannot encode: ${reason}`,
    carriesNote: 'Carries a note, so the paper path is off.',
    paperOk: 'Can be decoded by hand from the printed card.',
    appNeeded: 'Needs the app at the other end, but shorter.',
    noGeolocation: 'No geolocation on this device.',
    locating: 'Locating…',
    outsideGrid: 'Outside the Bangladesh grid — pick a district instead.',
    fix: (lat, lon) => `${lat}, ${lon} — ±10 m`,
    noFixError: (reason) => `No fix: ${reason}`,
    relayNote: (count, segments, alone) =>
      `${count} report(s) in ${segments} segment(s) instead of ${alone}.`,
    waitingModel: 'Waiting for the model — crisis messages already work.',
    compressionFailed: (reason) => `Compression failed: ${reason}`,
    composeNote: (septets, bits, segments) =>
      `${septets} septets · ${bits} bits per character · ${segments} segment(s)`,
    couldNotDecode: (reason) => `Could not decode: ${reason}`,
    batchCount: (n) => `${n} reports in one SMS`,
    copied: 'Copied.',
    copyManually: 'Select and copy.',
    qrFailed: (reason) => `Cannot build a QR: ${reason}`,
  },

  bn: {
    tagline: 'নেটওয়ার্ক ভেঙে পড়লে যে বার্তাটা যায়।',

    tabCrisis: 'জরুরি বার্তা',
    tabRelay: 'রিলে',
    tabText: 'লিখুন',
    tabDecode: 'খুলুন',
    tabCard: 'কাগজের কার্ড',

    crisisWhat: '১. কী হয়েছে',
    quickHint: 'একটায় চাপ দিন। সবচেয়ে বেশি লাগে এই ছয়টা।',
    allMessages: 'অথবা ৩২টি বার্তা থেকে বেছে নিন',
    groupStatus: 'আমরা…',
    groupNeed: 'আমাদের দরকার…',
    groupDanger: 'এখানে বিপদ',
    groupHelp: 'এখানে সাহায্য আছে',
    where: 'আপনি কোথায়',
    locNone: 'অবস্থান পাঠাব না',
    locDistrict: 'আমার জেলা',
    locGps: 'আমার সঠিক অবস্থান',
    locHint: 'জেলা লাগে ৬ বিট। সঠিক অবস্থান লাগে ৩২ বিট।',
    district: 'জেলা',
    useLocation: 'অবস্থান নিন',
    noFix: 'জিপিএস নেওয়া হয়নি',
    when: 'কখন ঘটেছে',
    noTime: 'সময় নেই',
    justNow: 'এইমাত্র',
    hoursAgo: (h) => `${h} ঘণ্টা আগে`,
    noteHead: 'নাম বা নোট',
    optional: '(ঐচ্ছিক)',
    notePlaceholder: 'যেমন: আয়েশা খাতুন',
    noteHelp: 'নোট থাকলে প্রাপকের অ্যাপ লাগবে। নোট ছাড়া বার্তা কাগজেও পড়া যায়।',
    paperCheck: 'কাগজে পড়া যায় এমন কোড (বেস-৩২)',

    crisisMessage: '২. যা পাঠাবেন',
    willRead: 'ওরা যা পড়বে',
    codeLabel: 'যা আসলে যাচ্ছে',
    statChars: 'অক্ষর',
    statSegments: 'এসএমএস সেগমেন্ট',
    statUcs2Today: 'আজ লাগত (UCS-2)',
    statSaving: 'সাশ্রয়',
    statReports: 'বার্তা',
    statAlone: 'আলাদা পাঠালে লাগত',
    statCompression: 'সংকোচন / UCS-2',
    statUcs2Segments: 'সেগমেন্ট আজ (UCS-2)',

    send: 'এসএমএস পাঠান',
    copy: 'কপি',
    queue: 'রিলেতে যোগ করুন',
    clear: 'সব মুছুন',
    print: 'ছাপান',
    showQr: 'QR দেখান',
    remove: 'বাদ',
    map: 'মানচিত্র',

    noNetworkHead: 'নেটওয়ার্ক একেবারেই নেই?',
    noNetworkHelp: 'পাশের ফোনে QR দেখান, ওরা ক্যামেরা ধরুক। কোনো রেডিও, অপারেটর বা অনুমতি লাগে না।',
    qrLinkCheck: 'স্ক্যান করলে অ্যাপ খুলবে',

    relayHead: 'রিলে — একটি এসএমএসে অনেকের খবর',
    relayHelp: 'একজনের হাতে নেটওয়ার্ক থাকলেই হয়। ৪৫ জনের খবর একটাই এসএমএসে যায়।',
    relayEmpty: 'খালি — «জরুরি বার্তা» ট্যাব থেকে যোগ করুন',

    textHead: 'বাংলায় লিখুন',
    textPlaceholder: 'এখানে বাংলায় লিখুন…',
    payloadHead: 'সংকুচিত বার্তা',

    decodeHead: 'পাওয়া বার্তা খুলুন',
    decodePlaceholder: 'প্রাপ্ত কোড এখানে পেস্ট করুন…  H-428R-H7E',

    cardHead: 'কাগজের কার্ড',
    cardHelpHtml:
      'ছাপিয়ে আশ্রয়কেন্দ্রে রাখুন। ফোন বা বিদ্যুৎ ছাড়াই <code>H</code> দিয়ে শুরু হওয়া কোড এই কার্ড দেখে হাতে খোলা যায়।',
    cardHowHead: 'কীভাবে পড়বেন',
    cardStep1Html: 'হাইফেন বাদ দিন। প্রথম অক্ষর <code>H</code> মানে হাতে-পড়ার কোড।',
    cardStep2: 'বাকি অক্ষরগুলো নিচের তালিকা থেকে সংখ্যায় বদলান, প্রতিটির ৫ বিট পাশাপাশি লিখুন।',
    cardStep3: 'প্রথম ১ বিট বাদ দিন (সেন্টিনেল), শেষ ৮ বিট বাদ দিন (চেকসাম)।',
    cardStep4:
      'এবার শুরু থেকে: ৫ বিট = বার্তা নম্বর · ১ বিট অবস্থান আছে কি না · থাকলে ১ বিট ধরন (০ = জেলা, তারপর ৬ বিট জেলা নম্বর) · ১ বিট সময় আছে কি না · থাকলে ৫ বিট = কত ঘণ্টা আগে · তারপর বার্তার নিজস্ব ঘরগুলো · শেষ ১ বিট নোট আছে কি না।',
    cardBase32Head: 'অক্ষর → সংখ্যা (Crockford base-32)',
    cardMessagesHead: 'বার্তা (৫ বিট)',
    cardFieldsHead: 'ঘরের মান',
    cardDistrictsHead: 'জেলা (৬ বিট)',
    colChar: 'অক্ষর',
    colMessage: 'বার্তা',
    colFields: 'ঘর',
    colDistrict: 'জেলা',

    footer: 'সব কিছু আপনার ফোনেই চলে — কোনো সার্ভার নেই, বার্তা ফোনের বাইরে যায় না।',

    statusReady: 'জরুরি বার্তা চালু — বাংলা লেখার মডেল নামছে…',
    statusNoModel: (reason) => `মডেল আসেনি (${reason}) — তবু জরুরি বার্তা কাজ করছে।`,
    noteNeedsModel: 'নোট লিখতে মডেল লাগে, লোড হচ্ছে।',
    cannotEncode: (reason) => `পাঠানো যাচ্ছে না: ${reason}`,
    carriesNote: 'নোট আছে, তাই কাগজে পড়া যাবে না।',
    paperOk: 'কাগজ থেকেও হাতে পড়া যাবে।',
    appNeeded: 'প্রাপকের অ্যাপ লাগবে, কিন্তু কোডটা ছোট।',
    noGeolocation: 'এই ফোনে জিপিএস নেই।',
    locating: 'খোঁজা হচ্ছে…',
    outsideGrid: 'বাংলাদেশের বাইরে — জেলা বেছে নিন।',
    fix: (lat, lon) => `${lat}, ${lon} — ±১০ মিটার`,
    noFixError: (reason) => `পাওয়া গেল না: ${reason}`,
    relayNote: (count, segments, alone) =>
      `${count} জনের খবর ${segments} সেগমেন্টে — আলাদা পাঠালে লাগত ${alone}।`,
    waitingModel: 'মডেল লোড হচ্ছে — জরুরি বার্তা এখনই কাজ করে।',
    compressionFailed: (reason) => `সংকোচন ব্যর্থ: ${reason}`,
    composeNote: (septets, bits, segments) =>
      `${septets} সেপ্টেট · অক্ষরপ্রতি ${bits} বিট · ${segments} সেগমেন্ট`,
    couldNotDecode: (reason) => `খোলা গেল না: ${reason}`,
    batchCount: (n) => `${n}টি বার্তা এক এসএমএসে`,
    copied: 'কপি হয়েছে।',
    copyManually: 'নিজে কপি করুন।',
    qrFailed: (reason) => `QR বানানো গেল না: ${reason}`,
  },
};

let current = 'en';

/**
 * English by default, deliberately: the app is opened cold by people who have
 * never seen it, and a stored preference only exists once someone has chosen.
 */
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
    // The choice still holds for this session, which is the session that matters.
  }
  return current;
}

/** Looks up a key in the current language; falls back to English, then the key. */
export function t(key, ...args) {
  const value = STRINGS[current][key] ?? STRINGS.en[key];
  if (value == null) return key;
  return typeof value === 'function' ? value(...args) : value;
}

/**
 * Applies the current language to every element carrying `data-i18n`, and to
 * `data-i18n-placeholder` on inputs. A key ending in `Html` is inserted as
 * markup — those values are ours, never anything a user typed.
 */
export function applyLang(root = document) {
  document.documentElement.lang = current;

  for (const node of root.querySelectorAll('[data-i18n]')) {
    const key = node.dataset.i18n;
    const value = t(key);
    if (key.endsWith('Html')) node.innerHTML = value;
    else node.textContent = value;
  }

  for (const node of root.querySelectorAll('[data-i18n-placeholder]')) {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  }
}
