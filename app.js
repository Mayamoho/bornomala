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

async function main() {
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
    ui.status.textContent = `মডেল লোড হয়নি / model failed to load: ${error.message}`;
    return;
  }

  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('sw.js');
    } catch {
      // Offline caching is a bonus; the app still works for this session.
    }
  }
}

main();
