/**
 * Bornomala PWA shell.
 *
 * The ordering here is deliberate. Structured crisis messages need no
 * language model at all, so the crisis, relay and decode paths are wired up
 * and usable before `model.bin` has finished arriving — on a 2G connection
 * that is the difference between an app and a spinner. Only free text and
 * free-text notes wait for the model, and only those stay disabled until it
 * lands.
 */

import { Model } from './src/model.js';
import { encodeText, encodeCrisis, encodeRelay, decodeMessage, describe } from './src/message.js';
import { blankFrame, isPaperSafe, mapLink, MAX_BATCH, MAX_HOURS_AGO } from './src/frame.js';
import { TEMPLATES, SLOTS, URGENCY, BLOOD, DEPTH, CAPACITY } from './src/phrasebook.js';
import { DISTRICTS, inCoverage } from './src/geo.js';
import { ALPHABETS, septetCost, gsm7Segments, ucs2Segments, group } from './src/gsm7.js';

const el = (id) => document.getElementById(id);

/** The six a volunteer reaches for first. */
const QUICK = [0, 1, 2, 3, 4, 20];

let model = null;
let lang = 'bn';
let gpsFix = null;
let crisisPayload = '';
const relay = [];

/* ────────────────────────────── tabs ────────────────────────────── */

function selectTab(name) {
  for (const tab of document.querySelectorAll('[role="tab"]')) {
    const active = tab.id === `tab-${name}`;
    tab.setAttribute('aria-selected', String(active));
    el(tab.getAttribute('aria-controls')).hidden = !active;
  }
}

/* ─────────────────────────── crisis frame ───────────────────────── */

/** Reads the whole crisis form into a frame. */
function currentFrame() {
  const template = Number(el('template').value);
  const frame = blankFrame(template);

  frame.values = TEMPLATES[template].slots.map((slot, i) => {
    const control = el(`slot-${i}`);
    return control ? Number(control.value) : 0;
  });

  const mode = el('loc-mode').value;
  if (mode === 'district') {
    frame.location = { district: Number(el('district').value) };
  } else if (mode === 'gps' && gpsFix) {
    frame.location = gpsFix;
  }

  const hours = el('hours').value;
  frame.hoursAgo = hours === '' ? null : Number(hours);
  frame.note = el('note').value.trim();
  return frame;
}

function renderSlots() {
  const template = Number(el('template').value);
  const host = el('slots');
  host.replaceChildren();

  TEMPLATES[template].slots.forEach((slot, i) => {
    const spec = SLOTS[slot];
    const label = document.createElement('label');
    label.htmlFor = `slot-${i}`;
    label.textContent = `${spec.bn} — ${spec.en}`;

    const select = document.createElement('select');
    select.id = `slot-${i}`;
    for (let v = 0; v < 2 ** spec.bits; v += 1) {
      const option = document.createElement('option');
      option.value = String(v);
      option.textContent =
        slot === 'count' || slot === 'capacity' || slot === 'blood'
          ? spec.render(v, 'en')
          : `${spec.render(v, 'bn')} / ${spec.render(v, 'en')}`;
      select.append(option);
    }
    select.addEventListener('change', refreshCrisis);

    const wrap = document.createElement('div');
    wrap.append(label, select);
    host.append(wrap);
  });
}

function setCrisisButtons(on) {
  el('crisis-send').disabled = !on;
  el('crisis-copy').disabled = !on;
  el('crisis-queue').disabled = !on || relay.length >= MAX_BATCH;
}

function refreshCrisis() {
  const paperBox = el('paper');
  const frame = currentFrame();

  // A note cannot travel in the hand-decodable profile: say so, do not fail.
  const paperPossible = isPaperSafe([frame]);
  paperBox.disabled = !paperPossible;
  const paper = paperPossible && paperBox.checked;

  if (frame.note && !model) {
    el('crisis-code').textContent = '—';
    el('crisis-note').textContent =
      'নোট লিখতে মডেল লাগে, লোড হচ্ছে / a note needs the model, still loading';
    setCrisisButtons(false);
    return;
  }

  let payload;
  try {
    payload = encodeCrisis(frame, model, { paper });
  } catch (error) {
    el('crisis-code').textContent = '—';
    el('crisis-note').textContent = `পাঠানো যাচ্ছে না / cannot encode: ${error.message}`;
    setCrisisButtons(false);
    return;
  }

  crisisPayload = payload;
  const septets = septetCost(payload);
  const sentence = describe(frame, 'bn');
  const today = [...sentence].length;

  el('crisis-code').textContent = paper ? group(payload) : payload;
  el('c-chars').textContent = String([...payload].length);
  el('c-segments').textContent = String(gsm7Segments(payload));
  el('c-ucs2').textContent = String(today);
  el('c-ratio').textContent = `${((today * 16) / (septets * 7)).toFixed(1)}×`;
  el('crisis-plain').textContent = `${sentence}\n${describe(frame, 'en')}`;

  if (!paperPossible) {
    el('crisis-note').textContent =
      'নোট আছে, তাই কাগজে পড়া যাবে না / carries a note, so the paper path is off';
  } else if (paper) {
    el('crisis-note').textContent =
      'কাগজ থেকেও পড়া যাবে / can be decoded by hand from the printed card';
  } else {
    el('crisis-note').textContent = 'অ্যাপ লাগবে, কিন্তু ছোট / needs the app, but shorter';
  }
  setCrisisButtons(true);
}

function useLocation() {
  if (!navigator.geolocation) {
    el('gps-note').textContent = 'এই ফোনে জিপিএস নেই / no geolocation on this device';
    return;
  }
  el('gps-note').textContent = 'খোঁজা হচ্ছে… / locating…';
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      if (!inCoverage(coords.latitude, coords.longitude)) {
        el('gps-note').textContent =
          'বাংলাদেশের বাইরে — জেলা বেছে নিন / outside the grid, pick a district instead';
        gpsFix = null;
      } else {
        gpsFix = { lat: coords.latitude, lon: coords.longitude };
        el('gps-note').textContent =
          `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)} — ±১০ মিটার / ±10 m`;
      }
      refreshCrisis();
    },
    (error) => {
      el('gps-note').textContent = `পাওয়া গেল না / no fix: ${error.message}`;
    },
    { enableHighAccuracy: true, timeout: 10_000 },
  );
}

/* ──────────────────────────────── relay ─────────────────────────── */

function refreshRelay() {
  const list = el('relay-list');
  list.replaceChildren();

  relay.forEach((frame, i) => {
    const item = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = describe(frame, lang);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'small';
    remove.textContent = 'বাদ';
    remove.addEventListener('click', () => {
      relay.splice(i, 1);
      refreshRelay();
    });

    item.append(text, remove);
    list.append(item);
  });

  el('relay-empty').hidden = relay.length > 0;
  el('relay-count').textContent = relay.length > 0 ? `(${relay.length})` : '';
  el('r-count').textContent = String(relay.length);

  if (relay.length === 0) {
    el('relay-payload').value = '';
    el('r-chars').textContent = '0';
    el('r-segments').textContent = '0';
    el('r-alone').textContent = '0';
    el('relay-send').disabled = true;
    el('relay-copy').disabled = true;
    el('relay-note').textContent = '';
    return;
  }

  let payload;
  try {
    payload = encodeRelay(relay, model, { paper: isPaperSafe(relay) });
  } catch (error) {
    el('relay-note').textContent = `পাঠানো যাচ্ছে না / cannot encode: ${error.message}`;
    return;
  }

  // What the same reports would cost sent one at a time — the honest baseline.
  const alone = relay.reduce(
    (n, frame) => n + gsm7Segments(encodeCrisis(frame, model, { paper: isPaperSafe([frame]) })),
    0,
  );
  const segments = gsm7Segments(payload);

  el('relay-payload').value = payload;
  el('r-chars').textContent = String([...payload].length);
  el('r-segments').textContent = String(segments);
  el('r-alone').textContent = String(alone);
  el('relay-send').disabled = false;
  el('relay-copy').disabled = false;
  el('relay-note').textContent =
    `${relay.length} জনের খবর ${segments} সেগমেন্টে — ` +
    `${relay.length} reports in ${segments} segment(s) instead of ${alone}`;
}

/* ─────────────────────────────── free text ──────────────────────── */

function refreshCompose() {
  const text = el('input').value;
  const chars = [...text].length;
  el('stat-chars').textContent = String(chars);

  if (!model || chars === 0) {
    el('payload').value = '';
    el('stat-segments').textContent = '0';
    el('stat-ucs2').textContent = '0';
    el('stat-ratio').textContent = '—';
    el('send').disabled = true;
    el('copy').disabled = true;
    el('compose-note').textContent = model
      ? ''
      : 'মডেল লোড হচ্ছে / waiting for the model — জরুরি বার্তা এখনই কাজ করে';
    return;
  }

  let payload;
  try {
    payload = encodeText(text, model);
  } catch (error) {
    el('compose-note').textContent = `সংকোচন ব্যর্থ / compression failed: ${error.message}`;
    return;
  }

  const septets = septetCost(payload);
  const segments = gsm7Segments(payload);

  el('payload').value = payload;
  el('stat-segments').textContent = String(segments);
  el('stat-ucs2').textContent = String(ucs2Segments(text));
  // Segment counts both round up, so on short messages they hide the gain.
  // Compare the bits instead: UCS-2 spends 16 per character, we spend what we
  // spend, and that ratio is honest at every length.
  el('stat-ratio').textContent = `${((chars * 16) / (septets * 7)).toFixed(1)}×`;
  el('send').disabled = false;
  el('copy').disabled = false;
  el('compose-note').textContent =
    `${septets} সেপ্টেট / septets · ${((septets * 7) / chars).toFixed(2)} bits per character` +
    (segments === 1 ? ' · এক সেগমেন্টেই যাচ্ছে' : ` · ${segments} সেগমেন্ট`);
}

/* ─────────────────────────────── decode ─────────────────────────── */

function refreshDecode() {
  const payload = el('cipher').value.trim();
  const list = el('decoded');
  list.replaceChildren();

  if (payload === '') {
    el('decode-note').textContent = '';
    return;
  }

  let message;
  try {
    message = decodeMessage(payload, model);
  } catch (error) {
    el('decode-note').className = 'note alarm';
    el('decode-note').textContent = `খোলা গেল না / could not decode: ${error.message}`;
    return;
  }

  el('decode-note').className = 'note';
  el('decode-note').textContent =
    message.kind === 'batch'
      ? `${message.frames.length}টি বার্তা এক এসএমএসে / ${message.frames.length} reports in one SMS`
      : '';

  if (message.kind === 'text') {
    const item = document.createElement('li');
    const text = document.createElement('span');
    text.lang = 'bn';
    text.textContent = message.text;
    item.append(text);
    list.append(item);
    return;
  }

  for (const frame of message.frames) {
    const item = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = describe(frame, lang);
    item.append(text);

    const link = mapLink(frame);
    if (link) {
      const open = document.createElement('a');
      open.href = link;
      open.textContent = 'মানচিত্র';
      open.className = 'note';
      item.append(open);
    }
    list.append(item);
  }
}

/* ───────────────────────────── paper card ───────────────────────── */

function table(head, rows) {
  const element = document.createElement('table');
  const headRow = element.createTHead().insertRow();
  for (const cell of head) {
    const th = document.createElement('th');
    th.textContent = cell;
    headRow.append(th);
  }
  const body = element.createTBody();
  for (const row of rows) {
    const tr = body.insertRow();
    row.forEach((cell, i) => {
      const td = tr.insertCell();
      td.textContent = cell;
      if (i === 0) td.className = 'k';
    });
  }
  return element;
}

function renderCard() {
  el('card-base32').append(
    table(
      ['#', 'অক্ষর', '#', 'অক্ষর'],
      Array.from({ length: 16 }, (_, i) => [
        String(i),
        ALPHABETS.base32[i],
        String(i + 16),
        ALPHABETS.base32[i + 16],
      ]),
    ),
  );

  el('card-templates').append(
    table(
      ['#', 'বার্তা / message', 'ঘর / fields'],
      TEMPLATES.map((template, i) => [
        String(i),
        `${template.bn} — ${template.en}`,
        template.slots.map((slot) => `${slot} (${SLOTS[slot].bits}b)`).join(', ') || '—',
      ]),
    ),
  );

  const ladders = [
    ['urgency (2 bits)', URGENCY.map((u, i) => [String(i), `${u.bn} / ${u.en}`])],
    ['blood (3 bits)', BLOOD.map((b, i) => [String(i), b])],
    ['depth (3 bits)', DEPTH.map((d, i) => [String(i), `${d.bn} / ${d.en}`])],
    ['capacity (4 bits)', CAPACITY.map((c, i) => [String(i), String(c)])],
    [
      'count (4 bits)',
      [
        ['0', '1'],
        ['1', '2'],
        ['…', '…'],
        ['15', '16 or more'],
      ],
    ],
  ];
  for (const [title, rows] of ladders) {
    el('card-slots').append(table(['#', title], rows));
  }

  el('card-districts').append(
    table(
      ['#', 'জেলা / district'],
      DISTRICTS.map((district, i) => [String(i), `${district.bn} — ${district.en}`]),
    ),
  );
}

/* ──────────────────────────────── glue ──────────────────────────── */

function sendBySms(payload) {
  if (!payload) return;
  // No recipient: the composer opens with the body filled and the user picks
  // who to send it to. `?body=` is the form Android and iOS both accept.
  window.location.href = `sms:?body=${encodeURIComponent(payload)}`;
}

async function copyText(text, noteId) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    el(noteId).textContent = 'কপি হয়েছে / copied';
  } catch {
    el(noteId).textContent = 'নিজে কপি করুন / select and copy';
  }
}

/** Text shared into the app (Web Share Target, GET form) lands in decode. */
function consumeSharedText() {
  const shared = new URLSearchParams(window.location.search).get('shared');
  if (!shared) return;
  el('cipher').value = shared.trim();
  history.replaceState(null, '', window.location.pathname);
  selectTab('decode');
  refreshDecode();
}

function markQuick() {
  const current = Number(el('template').value);
  el('quick')
    .querySelectorAll('button')
    .forEach((button, i) => button.setAttribute('aria-pressed', String(QUICK[i] === current)));
}

function buildStaticControls() {
  const templates = el('template');
  TEMPLATES.forEach((template, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `${template.bn} — ${template.en}`;
    templates.append(option);
  });

  const quick = el('quick');
  for (const id of QUICK) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${TEMPLATES[id].bn}\n${TEMPLATES[id].en}`;
    button.style.whiteSpace = 'pre-line';
    button.addEventListener('click', () => {
      templates.value = String(id);
      renderSlots();
      markQuick();
      refreshCrisis();
    });
    quick.append(button);
  }

  const districts = el('district');
  DISTRICTS.forEach((district, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `${district.bn} — ${district.en}`;
    districts.append(option);
  });
  districts.value = '17'; // Dhaka, the likeliest single answer

  const hours = el('hours');
  for (let h = 0; h <= MAX_HOURS_AGO; h += 1) {
    const option = document.createElement('option');
    option.value = String(h);
    option.textContent = h === 0 ? 'এইমাত্র / just now' : `${h} ঘণ্টা আগে / ${h}h ago`;
    hours.append(option);
  }
  hours.value = '0';
}

function wire() {
  for (const tab of document.querySelectorAll('[role="tab"]')) {
    tab.addEventListener('click', () => selectTab(tab.id.replace('tab-', '')));
  }

  el('template').addEventListener('change', () => {
    renderSlots();
    markQuick();
    refreshCrisis();
  });
  el('district').addEventListener('change', refreshCrisis);
  el('hours').addEventListener('change', refreshCrisis);
  el('paper').addEventListener('change', refreshCrisis);
  el('note').addEventListener('input', refreshCrisis);
  el('loc-mode').addEventListener('change', () => {
    const mode = el('loc-mode').value;
    el('district-wrap').hidden = mode !== 'district';
    el('gps-wrap').hidden = mode !== 'gps';
    refreshCrisis();
  });
  el('locate').addEventListener('click', useLocation);

  el('crisis-send').addEventListener('click', () => sendBySms(crisisPayload));
  el('crisis-copy').addEventListener('click', () => copyText(crisisPayload, 'crisis-note'));
  el('crisis-queue').addEventListener('click', () => {
    if (relay.length >= MAX_BATCH) return;
    relay.push(currentFrame());
    el('note').value = '';
    refreshCrisis();
    refreshRelay();
    selectTab('relay');
  });

  el('relay-send').addEventListener('click', () => sendBySms(el('relay-payload').value));
  el('relay-copy').addEventListener('click', () =>
    copyText(el('relay-payload').value, 'relay-note'),
  );
  el('relay-clear').addEventListener('click', () => {
    relay.length = 0;
    refreshRelay();
    refreshCrisis();
  });

  el('input').addEventListener('input', refreshCompose);
  el('send').addEventListener('click', () => sendBySms(el('payload').value));
  el('copy').addEventListener('click', () => copyText(el('payload').value, 'compose-note'));

  el('cipher').addEventListener('input', refreshDecode);
  for (const code of ['bn', 'en']) {
    el(`lang-${code}`).addEventListener('click', () => {
      lang = code;
      el('lang-bn').className = `small${code === 'bn' ? ' primary' : ''}`;
      el('lang-en').className = `small${code === 'en' ? ' primary' : ''}`;
      refreshDecode();
      refreshRelay();
    });
  }

  el('print').addEventListener('click', () => window.print());
}

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

function main() {
  buildStaticControls();
  renderSlots();
  markQuick();
  renderCard();
  wire();

  // Everything structured already works. The model only unlocks free text.
  window.__bornomalaReady = true;
  refreshCrisis();
  refreshRelay();
  consumeSharedText();

  el('status').textContent =
    'জরুরি বার্তা চালু — বাংলা লেখার মডেল নামছে / crisis messages ready, loading the text model…';

  loadModel().then(
    (loaded) => {
      model = loaded;
      el('status').hidden = true;
      refreshCompose();
      refreshCrisis();
      refreshDecode();
    },
    (error) => {
      el('status').textContent =
        `মডেল আসেনি, তবু জরুরি বার্তা কাজ করছে / no text model (${error.message}) — ` +
        'structured crisis messages still work';
    },
  );

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Offline caching is a bonus; the app still works for this session.
    });
  }
}

main();
