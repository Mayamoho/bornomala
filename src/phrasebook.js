/**
 * The crisis phrasebook.
 *
 * Free text compresses to about 3.1 bits per character. That is a good number,
 * and it is still the wrong unit of work for the messages that actually move
 * in the first hours of a disaster. Those messages are not prose. They are a
 * small, closed set of facts: I am alive, we are this many, we are here, we
 * need water, do not come this way.
 *
 * So do not compress the sentence. Send the fact. A template index plus its
 * slots is twenty-odd bits — five characters — where the same sentence in
 * UCS-2 is fifty characters and in compressed free text is fifteen. The
 * phrasebook is also why the app works for someone who cannot type Bangla on a
 * phone keyboard, or cannot read: the sender taps, and the receiver reads the
 * sentence rendered in their own language.
 *
 * The table is append-only. Index is the wire value; reordering it would
 * silently change the meaning of every message already in flight.
 */

/** Slot ladders. Index is the wire value; the width follows from the length. */
export const URGENCY = [
  { bn: 'জরুরি নয়', en: 'not urgent' },
  { bn: 'মাঝারি', en: 'moderate' },
  { bn: 'জরুরি', en: 'urgent' },
  { bn: 'প্রাণসংশয়', en: 'life-threatening' },
];

export const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const DEPTH = [
  { bn: 'গোড়ালি', en: 'ankle deep' },
  { bn: 'হাঁটু', en: 'knee deep' },
  { bn: 'কোমর', en: 'waist deep' },
  { bn: 'বুক', en: 'chest deep' },
  { bn: 'মাথার উপরে', en: 'over head height' },
  { bn: 'একতলা ডুবেছে', en: 'ground floor submerged' },
  { bn: 'দোতলা ডুবেছে', en: 'first floor submerged' },
  { bn: 'বাড়ছে', en: 'rising fast' },
];

export const CAPACITY = [
  10, 25, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000,
];

/**
 * Bangla numerals.
 *
 * A message that reads "আমরা 4 জন নিরাপদ আছি" is the tell of a tool built for
 * someone else. Numbers rendered in Bangla go into the Bangla sentence and
 * Latin ones into the English sentence; the wire format is unaffected either
 * way, since only the slot index travels.
 */
const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';

export function bnNum(value) {
  return String(value).replace(/\d/g, (d) => BANGLA_DIGITS[Number(d)]);
}

const num = (value, lang) => (lang === 'bn' ? bnNum(value) : String(value));

export const SLOTS = {
  count: {
    bits: 4,
    bn: 'কতজন',
    en: 'how many people',
    // Stored as value-1, so the ladder runs 1..16 and 16 reads as "16 or more".
    render: (v, lang) => (v === 15 ? (lang === 'bn' ? '১৬+' : '16+') : num(v + 1, lang)),
  },
  urgency: {
    bits: 2,
    bn: 'কতটা জরুরি',
    en: 'urgency',
    render: (v, lang) => URGENCY[v][lang],
  },
  blood: {
    bits: 3,
    bn: 'রক্তের গ্রুপ',
    en: 'blood group',
    render: (v) => BLOOD[v],
  },
  depth: {
    bits: 3,
    bn: 'পানির উচ্চতা',
    en: 'water depth',
    render: (v, lang) => DEPTH[v][lang],
  },
  capacity: {
    bits: 4,
    bn: 'কতজনের জায়গা',
    en: 'capacity',
    render: (v, lang) => num(CAPACITY[v], lang),
  },
};

/**
 * 32 templates, so the index is exactly five bits.
 *
 * `bn` and `en` are sentence patterns; `{0}`, `{1}` … are replaced by the
 * rendered slot values in the order `slots` lists them.
 */
export const TEMPLATES = [
  { slots: ['count'], bn: 'আমরা {0} জন নিরাপদ আছি', en: '{0} of us are safe' },
  { slots: ['urgency'], bn: 'সাহায্য দরকার ({0})', en: 'need help ({0})' },
  { slots: ['count'], bn: '{0} জন আটকে আছি', en: '{0} people trapped' },
  { slots: ['count', 'urgency'], bn: '{0} জন আহত ({1})', en: '{0} injured ({1})' },
  { slots: ['count'], bn: '{0} জনের খাবার পানি দরকার', en: 'drinking water needed for {0}' },
  { slots: ['count'], bn: '{0} জনের খাবার দরকার', en: 'food needed for {0}' },
  { slots: ['urgency'], bn: 'ওষুধ দরকার ({0})', en: 'medicine needed ({0})' },
  { slots: ['count'], bn: '{0} জনের আশ্রয় দরকার', en: 'shelter needed for {0}' },
  { slots: ['blood', 'urgency'], bn: '{0} রক্ত দরকার ({1})', en: '{0} blood needed ({1})' },
  { slots: [], bn: 'একজন নিখোঁজ', en: 'someone is missing' },
  { slots: ['count'], bn: '{0} জন উদ্ধার হয়েছে', en: '{0} people rescued' },
  { slots: [], bn: 'রাস্তা বন্ধ, যাওয়া যাচ্ছে না', en: 'road impassable' },
  { slots: ['depth'], bn: 'পানি উঠেছে — {0}', en: 'flood water here — {0}' },
  { slots: ['urgency'], bn: 'আগুন লেগেছে ({0})', en: 'fire ({0})' },
  { slots: ['count'], bn: 'ভবন ধসে পড়েছে, {0} জন ভিতরে', en: 'building collapsed, {0} inside' },
  { slots: [], bn: 'বিদ্যুৎ নেই', en: 'no electricity' },
  { slots: [], bn: 'মোবাইল নেটওয়ার্ক নেই', en: 'no mobile network' },
  {
    slots: ['capacity'],
    bn: 'আশ্রয়কেন্দ্র খোলা আছে, {0} জনের জায়গা',
    en: 'shelter open here, capacity {0}',
  },
  { slots: [], bn: 'এখানে চিকিৎসা কেন্দ্র আছে', en: 'medical post here' },
  { slots: [], bn: 'ত্রাণ পৌঁছেছে', en: 'relief has arrived' },
  { slots: ['urgency'], bn: 'এলাকা ছাড়ুন ({0})', en: 'evacuate this area ({0})' },
  { slots: [], bn: 'এটাই আমার অবস্থান', en: 'this is my location' },
  { slots: [], bn: 'আমাকে ফোন করুন', en: 'call me back' },
  { slots: ['count'], bn: 'নৌকা দরকার, {0} জন', en: 'boat needed for {0}' },
  { slots: ['count'], bn: 'শিশু ও বয়স্ক আছে, {0} জন', en: '{0} children and elderly here' },
  { slots: [], bn: 'বিশুদ্ধ পানি নেই', en: 'no safe drinking water' },
  {
    slots: ['count'],
    bn: 'জ্বর/ডায়রিয়া ছড়াচ্ছে, {0} জন',
    en: 'fever/diarrhoea spreading, {0} cases',
  },
  { slots: [], bn: 'জ্বালানি নেই', en: 'no fuel' },
  { slots: [], bn: 'নিরাপদ পথ এদিক দিয়ে', en: 'safe route this way' },
  { slots: ['urgency'], bn: 'এদিকে আসবেন না ({0})', en: 'do not come this way ({0})' },
  { slots: [], bn: 'আমি ঠিক আছি, চিন্তা কোরো না', en: "I'm okay, don't worry" },
  { slots: [], bn: 'জরুরি বার্তা', en: 'urgent message' },
];

export const TEMPLATE_BITS = 5;

if (TEMPLATES.length !== 2 ** TEMPLATE_BITS) {
  throw new Error(`phrasebook must hold exactly ${2 ** TEMPLATE_BITS} templates`);
}

/** Fills a template's sentence pattern with its rendered slot values. */
export function renderTemplate(id, values, lang = 'bn') {
  const template = TEMPLATES[id];
  if (!template) throw new RangeError(`no template ${id}`);
  return template.slots.reduce(
    (text, slot, i) => text.replaceAll(`{${i}}`, SLOTS[slot].render(values[i], lang)),
    template[lang],
  );
}

/**
 * The sentence as a menu entry, before anything has been chosen.
 *
 * `{0}` is a slot placeholder, and showing it raw in a dropdown is the sort of
 * thing that reads fine to whoever wrote the file and as line noise to
 * everyone else. A blank does what a blank does on a paper form.
 */
export function templateLabel(id, lang = 'bn') {
  const template = TEMPLATES[id];
  if (!template) throw new RangeError(`no template ${id}`);
  return template[lang].replace(/\{\d+\}/g, '____');
}

/**
 * Display grouping for the picker. Thirty-two flat options is a wall; four
 * headings is a decision. Wire values are untouched — this only decides what
 * sits under which heading, and every id appears exactly once.
 */
export const TEMPLATE_GROUPS = [
  { key: 'groupStatus', ids: [0, 30, 21, 22, 9, 10, 24, 31] },
  { key: 'groupNeed', ids: [1, 2, 3, 4, 5, 6, 7, 8, 23] },
  { key: 'groupDanger', ids: [11, 12, 13, 14, 15, 16, 20, 25, 26, 27, 29] },
  { key: 'groupHelp', ids: [17, 18, 19, 28] },
];

/** Total bits the slots of one template occupy. */
export function slotBits(id) {
  return TEMPLATES[id].slots.reduce((n, slot) => n + SLOTS[slot].bits, 0);
}
