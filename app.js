/**
 * Bornomala PWA shell.
 *
 * Loads the model once, then does everything locally: compress on input,
 * hand the payload to the phone's SMS composer through an sms: URI, and
 * decode anything pasted or shared back into the app.
 */

import { Model } from './src/model.js';
import { encode, decode } from './src/codec.js';
import { septetCost, gsm7Segments, ucs2Segments } from './src/gsm7.js';
import {
  TEMPLATES,
  TEMPLATE_GROUPS,
  SLOTS,
  renderTemplate,
  templateLabel,
  bnNum,
} from './src/phrasebook.js';
import { DISTRICTS, inCoverage } from './src/geo.js';
import { encodeQr, toSvg } from './src/qr.js';
import { initLang, getLang, setLang, applyLang, t } from './src/i18n.js';

const el = (id) => document.getElementById(id);

const ui = {
  status: el('status'),
  input: el('input'),
  payload: el('payload'),
  cipher: el('cipher'),
  plain: el('plain'),
  send: el('send'),
  to: el('to'),
  copy: el('copy'),
  composeNote: el('compose-note'),
  decodeNote: el('decode-note'),
  chars: el('stat-chars'),
  segments: el('stat-segments'),
  ucs2: el('stat-ucs2'),
  ratio: el('stat-ratio'),
};

let model = null;

async function loadModel() {
  // Opened straight off disk, the browser blocks both module scripts and
  // fetch, and nothing below this line ever runs. Say so plainly.
  if (window.location.protocol === 'file:') {
    throw new Error(
      'ফাইল থেকে খোলা যাবে না — সার্ভার লাগবে / ' +
        'cannot run from file://, serve the folder over http (python3 -m http.server 8765)',
    );
  }
  const response = await fetch('model.bin', { cache: 'force-cache' });
  if (!response.ok) throw new Error(`model.bin: HTTP ${response.status}`);
  return Model.fromBuffer(await response.arrayBuffer());
}

function refreshCompose() {
  const text = ui.input.value;
  const chars = [...text].length;
  ui.chars.textContent = chars;

  if (!model || chars === 0) {
    ui.payload.value = '';
    ui.segments.textContent = '0';
    ui.ucs2.textContent = '0';
    ui.ratio.textContent = '—';
    setSendLink('send', '');
    ui.copy.disabled = true;
    ui.composeNote.textContent = '';
    return;
  }

  let payload;
  try {
    payload = encode(text, model);
  } catch (error) {
    ui.composeNote.textContent = `সংকোচন ব্যর্থ / compression failed: ${error.message}`;
    return;
  }

  const septets = septetCost(payload);
  const segments = gsm7Segments(payload);
  const today = ucs2Segments(text);

  ui.payload.value = payload;
  ui.segments.textContent = segments;
  ui.ucs2.textContent = today;
  // Segment counts both round up, so on short messages they hide the gain.
  // Compare the bits instead: UCS-2 spends 16 per character, we spend what we
  // spend, and that ratio is honest at every length.
  ui.ratio.textContent = `${((chars * 16) / (septets * 7)).toFixed(1)}×`;
  const number = validNumber(ui.to.value);
  setSendLink('send', number ? withAttribution(payload) : '', number);
  ui.copy.disabled = false;
  const stats =
    `${septets} সেপ্টেট / septets · ${((septets * 7) / chars).toFixed(2)} bits per character` +
    (segments === 1 ? ' · এক সেগমেন্টেই যাচ্ছে' : ` · ${segments} সেগমেন্ট`);
  // Copy still works without a number; only the SMS link needs one.
  ui.composeNote.textContent = number
    ? stats
    : `${stats} · ${ui.to.value.trim() === '' ? t('stillNeeded', t('needNumber')) : t('badNumber')}`;
}

function refreshDecode() {
  const payload = sanitizePayload(ui.cipher.value);
  if (!model || payload === '') {
    ui.plain.value = '';
    ui.decodeNote.textContent = '';
    return;
  }
  try {
    ui.plain.value = decode(payload, model);
    ui.decodeNote.textContent = '';
  } catch (error) {
    ui.plain.value = '';
    ui.decodeNote.textContent = t('couldNotDecode', error.message);
  }
}

function sendBySms() {
  const number = validNumber(ui.to.value);
  if (!number) return;
  smsWith(withAttribution(ui.payload.value), number);
}

async function copyPayload() {
  const payload = withAttribution(ui.payload.value);
  if (!payload) return;
  try {
    await navigator.clipboard.writeText(payload);
    ui.composeNote.textContent = t('copied');
  } catch {
    ui.payload.select();
    ui.composeNote.textContent = t('copyManually');
  }
}

/** Text shared into the app (Web Share Target, GET form) lands in decode. */
function consumeSharedText() {
  const shared = new URLSearchParams(window.location.search).get('shared');
  if (!shared) return;
  ui.cipher.value = shared.trim();
  history.replaceState(null, '', window.location.pathname);
  refreshDecode();
}


/* ══════════════════════ emergency: plain text only ══════════════════════ */

/**
 * Nothing in this section touches the codec, the model, or a single bit.
 *
 * An emergency message is words. It goes out as the sender typed them, plus
 * whatever they chose to attach, and it lands readable on any phone in the
 * country — including one whose owner has never heard of this app. That costs
 * more SMS segments than the coded tab, and it is worth it for a message that
 * has to be understood by whoever picks up the phone.
 */

const MAX_HOURS = 31;

/**
 * Official national short codes.
 *
 * 999 is the one that matters and the one that is toll-free; the rest are for
 * when the caller already knows which service they need. Short codes do not
 * reliably accept SMS, so calling is offered first and stated plainly.
 */
const HOTLINES = [
  { number: '999', bn: 'জাতীয় জরুরি সেবা — পুলিশ, ফায়ার, অ্যাম্বুলেন্স', en: 'National emergency — police, fire, ambulance', icon: '🚨' },
  { number: '1090', bn: 'দুর্যোগের আগাম বার্তা', en: 'Disaster warning', icon: '🌀' },
  { number: '102', bn: 'ফায়ার সার্ভিস ও সিভিল ডিফেন্স', en: 'Fire Service & Civil Defence', icon: '🚒' },
  { number: '16263', bn: 'স্বাস্থ্য বাতায়ন', en: 'DGHS health helpline', icon: '🏥' },
  { number: '333', bn: 'সরকারি তথ্য ও সেবা', en: 'Government information & services', icon: 'ℹ️' },
  { number: '109', bn: 'নারী ও শিশু নির্যাতন প্রতিরোধ', en: 'Violence against women and children', icon: '🛡️' },
  { number: '1098', bn: 'শিশু সহায়তা', en: 'Child helpline', icon: '🧒' },
  { number: '16430', bn: 'জাতীয় আইনগত সহায়তা', en: 'National legal aid', icon: '⚖️' },
  { number: '106', bn: 'দুর্নীতি দমন কমিশন', en: 'Anti-Corruption Commission', icon: '📋' },
];

/** The six a volunteer reaches for first. The icon carries the meaning. */
const QUICK = [
  { id: 0, icon: '✅' },
  { id: 1, icon: '🆘' },
  { id: 2, icon: '⚠️' },
  { id: 3, icon: '🚑' },
  { id: 4, icon: '💧' },
  { id: 20, icon: '🏃' },
];
let emGpsFix = null;
const relay = [];

const emEl = {
  text: () => el('em-text'),
  template: () => el('em-template'),
  slots: () => el('em-slots'),
  loc: () => el('em-loc'),
  district: () => el('em-district'),
  hours: () => el('em-hours'),
  preview: () => el('em-preview'),
};

function selectTab(name) {
  for (const tab of document.querySelectorAll('[role="tab"]')) {
    const active = tab.id === `tab-${name}`;
    tab.setAttribute('aria-selected', String(active));
    el(tab.getAttribute('aria-controls')).hidden = !active;
  }
}

/** A tappable position, and the bare numbers beside it for a phone with no data. */
function locationLines() {
  const mode = emEl.loc().value;
  if (mode === 'district') {
    const district = DISTRICTS[Number(emEl.district().value)];
    if (!district) return [];
    return [
      getLang() === 'bn' ? district.bn : district.en,
      `https://maps.google.com/?q=${encodeURIComponent(`${district.en}, Bangladesh`)}`,
    ];
  }
  if (mode === 'gps' && emGpsFix) {
    const lat = emGpsFix.lat.toFixed(5);
    const lon = emGpsFix.lon.toFixed(5);
    // The link needs data to open; the numbers do not. Both travel.
    return [`${lat}, ${lon}`, `https://maps.google.com/?q=${lat},${lon}`];
  }
  return [];
}

/** The whole message, exactly as it will leave the phone. */
function missingFields() {
  const missing = [];
  if (!emEl.text().value.trim()) missing.push(t('yourMessage'));
  if (emEl.template().value === '') missing.push(t('aSentence'));
  const mode = emEl.loc().value;
  if (mode === '') missing.push(t('whereYouAre'));
  else if (mode === 'gps' && !emGpsFix) missing.push(t('tapLocate'));
  if (emEl.hours().value === '') missing.push(t('whenIt'));
  return missing;
}

function emergencyMessage() {
  const typed = emEl.text().value.trim();
  if (missingFields().length > 0) return '';

  const parts = [typed];

  const chosen = emEl.template().value;
  if (chosen !== '') {
    const template = TEMPLATES[Number(chosen)];
    const values = template.slots.map((slot, i) => Number(el(`em-slot-${i}`)?.value ?? 0));
    parts.push(renderTemplate(Number(chosen), values, getLang()));
  }

  const hours = emEl.hours().value;
  parts.push(hours === '0' ? t('justNow') : t('hoursAgo', getLang() === 'bn' ? bnNum(hours) : hours));

  return withAttribution([parts.join(' · '), ...locationLines()].join('\n'));
}

function renderEmergencySlots() {
  const host = emEl.slots();
  host.replaceChildren();
  const chosen = emEl.template().value;
  if (chosen === '') return;

  TEMPLATES[Number(chosen)].slots.forEach((slot, i) => {
    const spec = SLOTS[slot];
    const label = document.createElement('label');
    label.htmlFor = `em-slot-${i}`;
    label.textContent = getLang() === 'bn' ? spec.bn : spec.en;

    const select = document.createElement('select');
    select.id = `em-slot-${i}`;
    for (let v = 0; v < 2 ** spec.bits; v += 1) {
      const option = document.createElement('option');
      option.value = String(v);
      option.textContent = spec.render(v, getLang());
      select.append(option);
    }
    select.addEventListener('change', refreshEmergency);

    const wrap = document.createElement('div');
    wrap.append(label, select);
    host.append(wrap);
  });
}

function refreshEmergency() {
  const missing = missingFields();
  const message = emergencyMessage();

  el('em-required').hidden = emEl.text().value.trim() !== '';
  emEl.preview().textContent = message || '—';
  el('em-chars').textContent = String([...message].length);
  el('em-segments').textContent = String(message ? ucs2Segments(message) : 0);

  const ready = message !== '';
  // The hotline rows carry their own numbers and stay live; only the personal
  // send needs a recipient, so a missing number never blocks calling 999.
  const number = validNumber(el('em-to').value);
  setSendLink('em-send', ready && number ? message : '', number);
  el('em-copy').disabled = !ready;
  el('em-queue').disabled = !ready;
  const typedNumber = el('em-to').value.trim() !== '';
  el('em-note').className = ready && number ? 'note' : 'note warn';
  if (!ready) el('em-note').textContent = t('stillNeeded', missing.join(', '));
  else if (!number && typedNumber) el('em-note').textContent = t('badNumber');
  else if (!number) el('em-note').textContent = t('stillNeeded', t('needNumber'));
  else el('em-note').textContent = t('plainOk');
  for (const link of document.querySelectorAll('.hotline-sms')) {
    const uri = smsUri(message, link.dataset.number);
    if (uri) {
      link.href = uri;
      link.setAttribute('aria-disabled', 'false');
    } else {
      link.removeAttribute('href');
      link.setAttribute('aria-disabled', 'true');
    }
  }
  refreshQr('em-qr', message);
}

function markQuick() {
  const current = emEl.template().value;
  el('em-quick')
    .querySelectorAll('button')
    .forEach((button, i) => button.setAttribute('aria-pressed', String(String(QUICK[i].id) === current)));
}

function useEmergencyLocation() {
  const note = el('em-gps-note');
  if (!navigator.geolocation) {
    note.textContent = t('noGeolocation');
    return;
  }
  note.textContent = t('locating');
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      emGpsFix = { lat: coords.latitude, lon: coords.longitude };
      note.replaceChildren(
        document.createTextNode(`${t('locationCaptured')} — `),
      );
      const open = document.createElement('a');
      open.className = 'maplink';
      open.target = '_blank';
      open.rel = 'noopener';
      open.href = `https://maps.google.com/?q=${coords.latitude.toFixed(5)},${coords.longitude.toFixed(5)}`;
      open.textContent = '📍 ' + (getLang() === 'bn' ? 'মানচিত্রে দেখুন' : 'See on map');
      note.append(open);
      if (!inCoverage(coords.latitude, coords.longitude)) {
        note.append(document.createTextNode(` — ${t('outsideBd')}`));
      }
      refreshEmergency();
    },
    (error) => {
      note.textContent = t('noFixError', error.message);
    },
    { enableHighAccuracy: true, timeout: 10_000 },
  );
}

/* ──────────────────────────────── relay ─────────────────────────────── */

function refreshRelay() {
  const list = el('relay-list');
  list.replaceChildren();

  relay.forEach((message, i) => {
    const item = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = message;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'small';
    remove.textContent = t('remove');
    remove.addEventListener('click', () => {
      relay.splice(i, 1);
      refreshRelay();
    });

    item.append(text, remove);
    list.append(item);
  });

  const joined = relay.join('\n———\n');
  el('relay-empty').hidden = relay.length > 0;
  el('relay-count').textContent = relay.length > 0 ? `(${relay.length})` : '';
  el('r-count').textContent = String(relay.length);
  el('r-chars').textContent = String([...joined].length);
  el('r-segments').textContent = String(joined ? ucs2Segments(joined) : 0);
  // Sent one at a time, each report costs its own segments.
  el('r-alone').textContent = String(relay.reduce((n, m) => n + ucs2Segments(m), 0));
  el('relay-payload').value = joined;
  const number = validNumber(el('relay-to').value);
  setSendLink('relay-send', number ? joined : '', number);
  el('relay-copy').disabled = relay.length === 0;
  refreshQr('relay-qr', joined);
  el('relay-qr-toggle').disabled = relay.length === 0;
  el('relay-note').textContent =
    relay.length === 0
      ? ''
      : `${t('relayNote', relay.length, ucs2Segments(joined))}` +
        (number
          ? ''
          : ` · ${el('relay-to').value.trim() === '' ? t('stillNeeded', t('needNumber')) : t('badNumber')}`);
}

function markLangButtons() {
  for (const code of ['en', 'bn']) {
    el(`lang-${code}`).className = `small${getLang() === code ? ' primary' : ''}`;
    el(`lang-${code}`).setAttribute('aria-pressed', String(getLang() === code));
  }
}

/** Everything that carries language: markup, options, hotlines, live output. */
function switchLang(code) {
  if (code === getLang()) return;
  const kept = {
    text: emEl.text().value,
    template: emEl.template().value,
    slots: [...emEl.slots().querySelectorAll('select')].map((sel) => sel.value),
    loc: emEl.loc().value,
    district: emEl.district().value,
    hours: emEl.hours().value,
  };

  setLang(code);
  applyLang();
  markLangButtons();

  emEl.template().replaceChildren();
  emEl.district().replaceChildren();
  emEl.hours().replaceChildren();
  buildEmergencyControls();
  buildHotlines();

  emEl.text().value = kept.text;
  emEl.template().value = kept.template;
  renderEmergencySlots();
  kept.slots.forEach((value, i) => {
    const control = el(`em-slot-${i}`);
    if (control) control.value = value;
  });
  emEl.loc().value = kept.loc;
  emEl.district().value = kept.district;
  emEl.hours().value = kept.hours;

  markQuick();
  refreshEmergency();
  refreshRelay();
  refreshCompose();
  refreshDecode();
}

function buildHotlines() {
  const host = el('hotlines');
  host.replaceChildren();

  for (const line of HOTLINES) {
    const item = document.createElement('li');

    const label = document.createElement('span');
    label.textContent = `${line.icon}  ${line.number} — ${getLang() === 'bn' ? line.bn : line.en}`;

    const call = document.createElement('a');
    call.href = `tel:${line.number}`;
    call.className = 'maplink';
    call.textContent = `📞 ${t('call')}`;

    const sms = document.createElement('a');
    sms.className = 'maplink hotline-sms';
    sms.dataset.number = line.number;
    sms.textContent = t('smsThem');
    sms.setAttribute('aria-disabled', 'true');

    item.append(label, call, sms);
    host.append(item);
  }
}

function buildEmergencyControls() {
  const templates = emEl.template();
  const none = document.createElement('option');
  none.value = '';
  none.selected = true;
  none.textContent = t('chooseOne');
  templates.append(none);

  // Grouped, and with slot placeholders shown as blanks: `{0}` is markup for
  // the renderer, not something to put in front of a person.
  for (const group of TEMPLATE_GROUPS) {
    const optgroup = document.createElement('optgroup');
    const groupNames = {
      groupStatus: { bn: 'আমরা…', en: 'We are…' },
      groupNeed: { bn: 'দরকার…', en: 'We need…' },
      groupDanger: { bn: 'বিপদ', en: 'Danger here' },
      groupHelp: { bn: 'সাহায্য আছে', en: 'Help is here' },
    }[group.key];
    optgroup.label = getLang() === 'bn' ? groupNames.bn : groupNames.en;
    for (const id of group.ids) {
      const option = document.createElement('option');
      option.value = String(id);
      option.textContent = templateLabel(id, getLang());
      optgroup.append(option);
    }
    templates.append(optgroup);
  }

  const quick = el('em-quick');
  quick.replaceChildren();
  for (const { id, icon } of QUICK) {
    const button = document.createElement('button');
    button.type = 'button';
    const glyph = document.createElement('span');
    glyph.className = 'icon';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = icon;
    const label = document.createElement('span');
    label.textContent = templateLabel(id, getLang());
    button.append(glyph, label);
    button.addEventListener('click', () => {
      templates.value = String(id);
      renderEmergencySlots();
      markQuick();
      refreshEmergency();
    });
    quick.append(button);
  }

  const districts = emEl.district();
  DISTRICTS.forEach((district, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = getLang() === 'bn' ? district.bn : district.en;
    districts.append(option);
  });
  districts.value = '17'; // Dhaka, the likeliest single answer

  const hours = emEl.hours();
  for (let h = 0; h <= MAX_HOURS; h += 1) {
    const option = document.createElement('option');
    option.value = String(h);
    option.textContent = h === 0 ? t('justNow') : t('hoursAgo', getLang() === 'bn' ? bnNum(h) : h);
    hours.append(option);
  }
  hours.value = ''; // nothing preselected
}

function wireEmergency() {
  for (const tab of document.querySelectorAll('[role="tab"]')) {
    tab.addEventListener('click', () => selectTab(tab.id.replace('tab-', '')));
  }

  emEl.text().addEventListener('input', refreshEmergency);
  el('em-to').addEventListener('input', refreshEmergency);
  el('relay-to').addEventListener('input', refreshRelay);
  emEl.template().addEventListener('change', () => {
    renderEmergencySlots();
    markQuick();
    refreshEmergency();
  });
  emEl.district().addEventListener('change', refreshEmergency);
  emEl.hours().addEventListener('change', refreshEmergency);
  emEl.loc().addEventListener('change', () => {
    const mode = emEl.loc().value;
    el('em-district-wrap').hidden = mode !== 'district';
    el('em-gps-wrap').hidden = mode !== 'gps';
    refreshEmergency();
  });
  el('em-locate').addEventListener('click', useEmergencyLocation);
  el('em-qr-toggle').addEventListener('click', () =>
    toggleQr('em-qr', emergencyMessage(), 'em-qr-toggle', 'em-note'),
  );
  el('relay-qr-toggle').addEventListener('click', () =>
    toggleQr('relay-qr', el('relay-payload').value, 'relay-qr-toggle', 'relay-note'),
  );

  for (const code of ['en', 'bn']) {
    el(`lang-${code}`).addEventListener('click', () => switchLang(code));
  }

  el('em-copy').addEventListener('click', () => copyPlain(emergencyMessage(), 'em-note'));
  el('em-queue').addEventListener('click', () => {
    const message = emergencyMessage();
    if (!message) return;
    relay.push(message);
    emEl.text().value = '';
    refreshEmergency();
    refreshRelay();
    selectTab('relay');
  });

  el('relay-copy').addEventListener('click', () => copyPlain(el('relay-payload').value, 'relay-note'));
  el('relay-clear').addEventListener('click', () => {
    relay.length = 0;
    refreshRelay();
  });
}

/**
 * Hands a URI to the phone. The indirection exists so a test can watch what
 * would have been opened: a headless DOM cannot navigate, and "does the send
 * button actually carry the whole message" is worth being able to assert.
 */
function openUri(uri) {
  if (typeof window.__openUri === 'function') window.__openUri(uri);
  else window.location.href = uri;
}

/* ────────────────────────────── QR handoff ──────────────────────────── */

/**
 * The message as a symbol on the glass.
 *
 * Nothing is transmitted: the other phone reads light off a screen. It is the
 * last transport left when there is no tower, no operator and no pairing — and
 * because an emergency message is plain text, whatever camera app they already
 * have will show it to them.
 */
function renderQr(hostId, text, noteId) {
  const host = el(hostId);
  if (!text) {
    host.hidden = true;
    host.replaceChildren();
    return;
  }
  try {
    host.innerHTML = toSvg(encodeQr(text), { scale: 4, quiet: 4 });
    host.hidden = false;
  } catch (error) {
    host.hidden = true;
    if (noteId) el(noteId).textContent = t('qrFailed', error.message);
  }
}

/** Redraws a QR that is already on screen, so it tracks the message. */
function refreshQr(hostId, text) {
  if (!el(hostId).hidden) renderQr(hostId, text, hostId === 'em-qr' ? 'em-note' : 'relay-note');
}

function toggleQr(hostId, text, toggleId, noteId) {
  const host = el(hostId);
  if (!text) {
    // Silently doing nothing is how a button teaches someone it is broken.
    if (noteId) el(noteId).textContent = t('stillNeeded', missingFields().join(', '));
    return;
  }
  if (host.hidden) renderQr(hostId, text, noteId);
  else host.hidden = true;
  el(toggleId).textContent = host.hidden ? t('showQr') : t('hideQr');
}

/* ──────────────────────────────── sending ───────────────────────────── */

/**
 * The line every outgoing message carries.
 *
 * Not proof of anything — nothing here signs a message, and it should not be
 * read as authentication. It tells a receiver holding an unfamiliar string
 * what it is and where to go to read it, which is the difference between a
 * coded payload being acted on and being deleted as spam.
 */
function attributionLine() {
  const { origin, pathname } = window.location;
  const url = origin && origin !== 'null' ? `${origin}${pathname}` : 'mayamoho.github.io/bornomala/';
  return `— ${t('sentWith')}: ${url}`;
}

function withAttribution(text) {
  return text ? `${text}\n${attributionLine()}` : text;
}

/**
 * Strips anything wrapped around a code before decoding: our own attribution,
 * map links, blank lines. Without it, pasting a whole received SMS fails on
 * text this app put there itself.
 */
function sanitizePayload(text) {
  const lines = (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line !== '' &&
        !line.startsWith('http') &&
        !line.startsWith('—') &&
        !line.includes('Bornomala') &&
        !line.includes('বর্ণমালা'),
    );
  return lines.length > 0 ? lines[0] : (text ?? '').trim();
}

function cleanNumber(raw) {
  return (raw ?? '').replace(/[^\d+]/g, '');
}

/**
 * A recipient is required, because `sms:?body=…` with no number is refused by
 * most composers — the send button looked alive and did nothing, which in an
 * emergency is worse than a button that is plainly off.
 *
 * Bangladesh mobiles are 01 plus nine digits, written locally as 01XXXXXXXXX
 * and internationally as +8801XXXXXXXXX. Any other country code is accepted at
 * face value: a relay volunteer may well be texting abroad.
 */
function validNumber(raw) {
  const n = cleanNumber(raw);
  if (/^01\d{9}$/.test(n)) return n;
  if (/^\+?8801\d{9}$/.test(n)) return n.startsWith('+') ? n : `+${n}`;
  if (/^\+\d{8,15}$/.test(n)) return n;
  return '';
}

function smsUri(body, number = '') {
  if (!body) return '';
  // iOS separates the number from the body with `&`, everything else with `?`.
  // A wrong separator opens the composer empty, or does nothing at all — which
  // is exactly how the hotline buttons failed.
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent ?? '');
  const separator = number && ios ? '&' : '?';
  return `sms:${number}${separator}body=${encodeURIComponent(body)}`;
}

function smsWith(body, number = '') {
  const uri = smsUri(body, number);
  if (uri) openUri(uri);
}

/** Points a send anchor at the current message, or disables it. */
function setSendLink(id, body, number = '') {
  const link = el(id);
  if (!link) return;
  const uri = smsUri(body, number);
  if (uri) {
    link.href = uri;
    link.setAttribute('aria-disabled', 'false');
  } else {
    link.removeAttribute('href');
    link.setAttribute('aria-disabled', 'true');
  }
}

async function copyPlain(text, noteId) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    el(noteId).textContent = t('copied');
  } catch {
    el(noteId).textContent = t('copyManually');
  }
}

async function main() {
  initLang();
  applyLang();
  markLangButtons();
  const stamp = el('build');
  if (stamp) stamp.textContent = 'v24';

  buildEmergencyControls();
  buildHotlines();
  renderEmergencySlots();
  markQuick();
  wireEmergency();
  refreshEmergency();
  refreshRelay();

  ui.input.addEventListener('input', refreshCompose);
  ui.to.addEventListener('input', refreshCompose);
  ui.cipher.addEventListener('input', refreshDecode);
  ui.copy.addEventListener('click', copyPayload);

  try {
    model = await loadModel();
    window.__bornomalaReady = true; // tells the watchdog in index.html to stand down
    ui.status.hidden = true;
    refreshCompose();
    consumeSharedText();
  } catch (error) {
    ui.status.textContent =
      `মডেল লোড হয়নি, তবু জরুরি ট্যাব কাজ করছে / no model (${error.message}) — ` +
      'the Emergency tab still works';
  }

  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
    } catch {
      // Offline caching is a bonus; the app still works for this session.
    }
  }
}

main();
