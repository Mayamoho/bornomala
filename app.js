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
import { encodeQr, toSvg } from './src/qr.js';
import { initLang, getLang, setLang, applyLang, t } from './src/i18n.js';

const el = (id) => document.getElementById(id);

/** The six a volunteer reaches for first. */
const QUICK = [0, 1, 2, 3, 4, 20];

/** Message content carries its own bn/en pair; pick the side the UI is on. */
const inLang = (pair) => (getLang() === 'bn' ? pair.bn : pair.en);

let model = null;
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
    label.textContent = inLang(spec);

    const select = document.createElement('select');
    select.id = `slot-${i}`;
    for (let v = 0; v < 2 ** spec.bits; v += 1) {
      const option = document.createElement('option');
      option.value = String(v);
      // Numbers and blood groups read the same either way; the rest translate.
      option.textContent =
        slot === 'count' || slot === 'capacity' || slot === 'blood'
          ? spec.render(v, 'en')
          : spec.render(v, getLang());
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
    el('crisis-note').textContent = t('noteNeedsModel');
    setCrisisButtons(false);
    return;
  }

  let payload;
  try {
    payload = encodeCrisis(frame, model, { paper });
  } catch (error) {
    el('crisis-code').textContent = '—';
    el('crisis-note').textContent = t('cannotEncode', error.message);
    setCrisisButtons(false);
    return;
  }

  crisisPayload = payload;
  const septets = septetCost(payload);
  // The baseline is always the Bangla sentence: that is what someone would
  // have typed today, whatever language the interface happens to be in.
  const today = [...describe(frame, 'bn')].length;

  el('crisis-code').textContent = paper ? group(payload) : payload;
  el('c-chars').textContent = String([...payload].length);
  el('c-segments').textContent = String(gsm7Segments(payload));
  el('c-ucs2').textContent = String(today);
  el('c-ratio').textContent = `${((today * 16) / (septets * 7)).toFixed(1)}×`;
  el('crisis-plain').textContent = describe(frame, getLang());

  if (!paperPossible) {
    el('crisis-note').textContent = t('carriesNote');
  } else if (paper) {
    el('crisis-note').textContent = t('paperOk');
  } else {
    el('crisis-note').textContent = t('appNeeded');
  }
  setCrisisButtons(true);
  refreshQr('crisis-qr', payload);
}

function useLocation() {
  if (!navigator.geolocation) {
    el('gps-note').textContent = t('noGeolocation');
    return;
  }
  el('gps-note').textContent = t('locating');
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      if (!inCoverage(coords.latitude, coords.longitude)) {
        el('gps-note').textContent = t('outsideGrid');
        gpsFix = null;
      } else {
        gpsFix = { lat: coords.latitude, lon: coords.longitude };
        el('gps-note').textContent = t(
          'fix',
          coords.latitude.toFixed(4),
          coords.longitude.toFixed(4),
        );
      }
      refreshCrisis();
    },
    (error) => {
      el('gps-note').textContent = t('noFixError', error.message);
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
    text.textContent = describe(frame, getLang());

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
    el('relay-qr-toggle').disabled = true;
    el('relay-qr').hidden = true;
    el('relay-note').textContent = '';
    return;
  }

  let payload;
  try {
    payload = encodeRelay(relay, model, { paper: isPaperSafe(relay) });
  } catch (error) {
    el('relay-note').textContent = t('cannotEncode', error.message);
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
  el('relay-qr-toggle').disabled = false;
  refreshQr('relay-qr', payload);
  el('relay-note').textContent = t('relayNote', relay.length, segments, alone);
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
    el('compose-note').textContent = model ? '' : t('waitingModel');
    return;
  }

  let payload;
  try {
    payload = encodeText(text, model);
  } catch (error) {
    el('compose-note').textContent = t('compressionFailed', error.message);
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
  el('compose-note').textContent = t(
    'composeNote',
    septets,
    ((septets * 7) / chars).toFixed(2),
    segments,
  );
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
    el('decode-note').textContent = t('couldNotDecode', error.message);
    return;
  }

  el('decode-note').className = 'note';
  el('decode-note').textContent =
    message.kind === 'batch' ? t('batchCount', message.frames.length) : '';

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
    text.textContent = describe(frame, getLang());
    item.append(text);

    const link = mapLink(frame);
    if (link) {
      const open = document.createElement('a');
      open.href = link;
      open.textContent = t('map');
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
  // Rebuilt whenever the language changes, so the hosts are cleared first.
  for (const id of ['card-base32', 'card-templates', 'card-slots', 'card-districts']) {
    el(id).replaceChildren();
  }

  el('card-base32').append(
    table(
      ['#', t('colChar'), '#', t('colChar')],
      Array.from({ length: 16 }, (_, i) => [
        String(i),
        ALPHABETS.base32[i],
        String(i + 16),
        ALPHABETS.base32[i + 16],
      ]),
    ),
  );

  // Card rows stay bilingual whatever the interface is set to: the sheet gets
  // printed once and then read by whoever is holding it.
  el('card-templates').append(
    table(
      ['#', t('colMessage'), t('colFields')],
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
      ['#', t('colDistrict')],
      DISTRICTS.map((district, i) => [String(i), `${district.bn} — ${district.en}`]),
    ),
  );
}

/* ─────────────────────────── QR handoff ─────────────────────────── */

/**
 * What to put in the symbol.
 *
 * A link is worth the extra modules: the receiver's ordinary camera app opens
 * it, the service worker serves the page from cache, and `?shared=` drops the
 * payload straight into the decode tab. No network is involved at any point —
 * the URL is a name for a cached page, not a request. Off a file:// origin
 * there is nothing to link to, so send the raw payload instead.
 */
function qrContent(payload) {
  const asLink = el('qr-link').checked && window.location.protocol.startsWith('http');
  if (!asLink) return payload;
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?shared=${encodeURIComponent(payload)}`;
}

function renderQr(hostId, payload) {
  const host = el(hostId);
  if (!payload) {
    host.hidden = true;
    return;
  }
  try {
    const qr = encodeQr(qrContent(payload));
    // The SVG is built entirely from our own numbers — the payload travels in
    // the symbol's modules, never into the markup.
    host.innerHTML = toSvg(qr, { scale: 4, quiet: 4 });
    host.hidden = false;
  } catch (error) {
    host.hidden = true;
    el(hostId === 'crisis-qr' ? 'crisis-note' : 'relay-note').textContent = t(
      'qrFailed',
      error.message,
    );
  }
}

/** Rebuilds a QR that is already on screen, so it tracks the message. */
function refreshQr(hostId, payload) {
  if (!el(hostId).hidden) renderQr(hostId, payload);
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
    el(noteId).textContent = t('copied');
  } catch {
    el(noteId).textContent = t('copyManually');
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

/**
 * Every control whose labels come from JS rather than markup. Rebuilt from
 * scratch on a language switch, so it restores whatever was already selected
 * instead of resetting a form someone was halfway through.
 */
function buildStaticControls() {
  const templates = el('template');
  const chosenTemplate = templates.value;
  templates.replaceChildren();
  TEMPLATES.forEach((template, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = inLang(template);
    templates.append(option);
  });
  templates.value = chosenTemplate || '0';

  const quick = el('quick');
  quick.replaceChildren();
  for (const id of QUICK) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = inLang(TEMPLATES[id]);
    button.addEventListener('click', () => {
      templates.value = String(id);
      renderSlots();
      markQuick();
      refreshCrisis();
    });
    quick.append(button);
  }

  const districts = el('district');
  const chosenDistrict = districts.value;
  districts.replaceChildren();
  DISTRICTS.forEach((district, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = inLang(district);
    districts.append(option);
  });
  districts.value = chosenDistrict || '17'; // Dhaka, the likeliest single answer

  const hours = el('hours');
  const chosenHours = hours.value;
  hours.replaceChildren();
  const noTime = document.createElement('option');
  noTime.value = '';
  noTime.textContent = t('noTime');
  hours.append(noTime);
  for (let h = 0; h <= MAX_HOURS_AGO; h += 1) {
    const option = document.createElement('option');
    option.value = String(h);
    option.textContent = h === 0 ? t('justNow') : t('hoursAgo', h);
    hours.append(option);
  }
  hours.value = chosenHours || '0';
}

/* ─────────────────────────────── language ───────────────────────── */

/** What the crisis form holds right now, so a rebuild can put it back. */
function formState() {
  const template = Number(el('template').value);
  return {
    template: el('template').value,
    slots: TEMPLATES[template].slots.map((_, i) => el(`slot-${i}`)?.value ?? '0'),
    mode: el('loc-mode').value,
    district: el('district').value,
    hours: el('hours').value,
    note: el('note').value,
  };
}

function restoreForm(state) {
  el('template').value = state.template;
  renderSlots();
  state.slots.forEach((value, i) => {
    const control = el(`slot-${i}`);
    if (control) control.value = value;
  });
  el('loc-mode').value = state.mode;
  el('district').value = state.district;
  el('hours').value = state.hours;
  el('note').value = state.note;
}

function markLangButtons() {
  for (const code of ['en', 'bn']) {
    const button = el(`lang-${code}`);
    button.className = `small${getLang() === code ? ' primary' : ''}`;
    button.setAttribute('aria-pressed', String(getLang() === code));
  }
}

/** Everything that carries language: markup labels, options, card, output. */
function switchLang(code) {
  if (code === getLang()) return;
  const state = formState();

  setLang(code);
  applyLang();
  markLangButtons();
  buildStaticControls();
  restoreForm(state);
  markQuick();
  renderCard();

  refreshCrisis();
  refreshRelay();
  refreshCompose();
  refreshDecode();
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

  el('crisis-qr-toggle').addEventListener('click', () => {
    const host = el('crisis-qr');
    if (host.hidden) renderQr('crisis-qr', crisisPayload);
    else host.hidden = true;
  });
  el('relay-qr-toggle').addEventListener('click', () => {
    const host = el('relay-qr');
    if (host.hidden) renderQr('relay-qr', el('relay-payload').value);
    else host.hidden = true;
  });
  el('qr-link').addEventListener('change', () => {
    refreshQr('crisis-qr', crisisPayload);
    refreshQr('relay-qr', el('relay-payload').value);
  });

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
  for (const code of ['en', 'bn']) {
    el(`lang-${code}`).addEventListener('click', () => switchLang(code));
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
  initLang();
  applyLang();
  markLangButtons();
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

  el('status').textContent = t('statusReady');

  loadModel().then(
    (loaded) => {
      model = loaded;
      el('status').hidden = true;
      refreshCompose();
      refreshCrisis();
      refreshDecode();
    },
    (error) => {
      el('status').textContent = t('statusNoModel', error.message);
    },
  );

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Offline caching is a bonus; the app still works for this session.
    });
  }
}

main();
