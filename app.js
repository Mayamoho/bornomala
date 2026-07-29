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

const el = (id) => document.getElementById(id);

const ui = {
  status: el('status'),
  input: el('input'),
  payload: el('payload'),
  cipher: el('cipher'),
  plain: el('plain'),
  send: el('send'),
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
    ui.send.disabled = true;
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
  ui.send.disabled = false;
  ui.copy.disabled = false;
  ui.composeNote.textContent =
    `${septets} সেপ্টেট / septets · ${((septets * 7) / chars).toFixed(2)} bits per character` +
    (segments === 1 ? ' · এক সেগমেন্টেই যাচ্ছে' : ` · ${segments} সেগমেন্ট`);
}

function refreshDecode() {
  const payload = ui.cipher.value.trim();
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
    ui.decodeNote.textContent = `খোলা গেল না / could not decode: ${error.message}`;
  }
}

function sendBySms() {
  const payload = ui.payload.value;
  if (!payload) return;
  // No recipient: the composer opens with the body filled and the user picks
  // who to send it to. `?body=` is the form Android and iOS both accept.
  window.location.href = `sms:?body=${encodeURIComponent(payload)}`;
}

async function copyPayload() {
  const payload = ui.payload.value;
  if (!payload) return;
  try {
    await navigator.clipboard.writeText(payload);
    ui.composeNote.textContent = 'কপি হয়েছে / copied';
  } catch {
    ui.payload.select();
    ui.composeNote.textContent = 'নিজে কপি করুন / select and copy';
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
      `${district.bn} / ${district.en}`,
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
  if (!emEl.text().value.trim()) missing.push('বার্তা / your message');
  const mode = emEl.loc().value;
  if (mode === '') missing.push('কোথায় / where you are');
  else if (mode === 'gps' && !emGpsFix) missing.push('অবস্থান নিন / tap use my live location');
  if (emEl.hours().value === '') missing.push('কখন / when');
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
    parts.push(renderTemplate(Number(chosen), values, 'bn'));
  }

  const hours = emEl.hours().value;
  parts.push(hours === '0' ? 'এইমাত্র / just now' : `${bnNum(hours)} ঘণ্টা আগে / ${hours}h ago`);

  return [parts.join(' · '), ...locationLines()].join('\n');
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
    label.textContent = `${spec.bn} / ${spec.en}`;

    const select = document.createElement('select');
    select.id = `em-slot-${i}`;
    for (let v = 0; v < 2 ** spec.bits; v += 1) {
      const option = document.createElement('option');
      option.value = String(v);
      option.textContent = `${spec.render(v, 'bn')} / ${spec.render(v, 'en')}`;
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
  el('em-send').disabled = !ready;
  el('em-copy').disabled = !ready;
  el('em-queue').disabled = !ready;
  el('em-note').className = ready ? 'note' : 'note warn';
  el('em-note').textContent = ready
    ? 'সাধারণ লেখা — যে কেউ পড়তে পারবে / plain text, readable by anyone'
    : `বাকি আছে / still needed: ${missing.join(', ')}`;
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
    note.textContent = 'এই ফোনে জিপিএস নেই / no geolocation on this device';
    return;
  }
  note.textContent = 'খোঁজা হচ্ছে… / locating…';
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      emGpsFix = { lat: coords.latitude, lon: coords.longitude };
      note.replaceChildren(
        document.createTextNode('অবস্থান পাওয়া গেছে / location captured — '),
      );
      const open = document.createElement('a');
      open.className = 'maplink';
      open.target = '_blank';
      open.rel = 'noopener';
      open.href = `https://maps.google.com/?q=${coords.latitude.toFixed(5)},${coords.longitude.toFixed(5)}`;
      open.textContent = '📍 মানচিত্রে দেখুন / see on map';
      note.append(open);
      if (!inCoverage(coords.latitude, coords.longitude)) {
        note.append(document.createTextNode(' — বাংলাদেশের বাইরে / outside Bangladesh'));
      }
      refreshEmergency();
    },
    (error) => {
      note.textContent = `পাওয়া গেল না / no fix: ${error.message}`;
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
    remove.textContent = 'বাদ / remove';
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
  el('relay-send').disabled = relay.length === 0;
  el('relay-copy').disabled = relay.length === 0;
  el('relay-note').textContent =
    relay.length === 0
      ? ''
      : `${relay.length} জনের খবর ${ucs2Segments(joined)} সেগমেন্টে / ` +
        `${relay.length} reports in ${ucs2Segments(joined)} segment(s)`;
}

function buildEmergencyControls() {
  const templates = emEl.template();
  const none = document.createElement('option');
  none.value = '';
  none.selected = true;
  none.textContent = 'কোনোটি নয় / none';
  templates.append(none);

  // Grouped, and with slot placeholders shown as blanks: `{0}` is markup for
  // the renderer, not something to put in front of a person.
  for (const group of TEMPLATE_GROUPS) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.key
      .replace('groupStatus', 'আমরা… / we are…')
      .replace('groupNeed', 'দরকার… / we need…')
      .replace('groupDanger', 'বিপদ / danger here')
      .replace('groupHelp', 'সাহায্য আছে / help is here');
    for (const id of group.ids) {
      const option = document.createElement('option');
      option.value = String(id);
      option.textContent = `${templateLabel(id, 'bn')} — ${templateLabel(id, 'en')}`;
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
    label.textContent = templateLabel(id, 'bn');
    button.append(glyph, label);
    button.addEventListener('click', () => {
      // Tapping the active one clears it: the sentence is optional.
      templates.value = templates.value === String(id) ? '' : String(id);
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
    option.textContent = `${district.bn} — ${district.en}`;
    districts.append(option);
  });
  districts.value = '17'; // Dhaka, the likeliest single answer

  const hours = emEl.hours();
  for (let h = 0; h <= MAX_HOURS; h += 1) {
    const option = document.createElement('option');
    option.value = String(h);
    option.textContent = h === 0 ? 'এইমাত্র / just now' : `${h} ঘণ্টা আগে / ${h}h ago`;
    hours.append(option);
  }
  hours.value = ''; // nothing preselected
}

function wireEmergency() {
  for (const tab of document.querySelectorAll('[role="tab"]')) {
    tab.addEventListener('click', () => selectTab(tab.id.replace('tab-', '')));
  }

  emEl.text().addEventListener('input', refreshEmergency);
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

  el('em-send').addEventListener('click', () => smsWith(emergencyMessage()));
  el('em-copy').addEventListener('click', () => copyPlain(emergencyMessage(), 'em-note'));
  el('em-queue').addEventListener('click', () => {
    const message = emergencyMessage();
    if (!message) return;
    relay.push(message);
    emEl.text().value = '';
    emEl.template().value = '';
    renderEmergencySlots();
    markQuick();
    refreshEmergency();
    refreshRelay();
    selectTab('relay');
  });

  el('relay-send').addEventListener('click', () => smsWith(el('relay-payload').value));
  el('relay-copy').addEventListener('click', () => copyPlain(el('relay-payload').value, 'relay-note'));
  el('relay-clear').addEventListener('click', () => {
    relay.length = 0;
    refreshRelay();
  });
}

function smsWith(body) {
  if (!body) return;
  window.location.href = `sms:?body=${encodeURIComponent(body)}`;
}

async function copyPlain(text, noteId) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    el(noteId).textContent = 'কপি হয়েছে / copied';
  } catch {
    el(noteId).textContent = 'নিজে কপি করুন / select and copy';
  }
}

async function main() {
  buildEmergencyControls();
  renderEmergencySlots();
  markQuick();
  wireEmergency();
  refreshEmergency();
  refreshRelay();

  ui.input.addEventListener('input', refreshCompose);
  ui.cipher.addEventListener('input', refreshDecode);
  ui.send.addEventListener('click', sendBySms);
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
