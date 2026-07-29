import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const html = readFileSync('/home/asus/Documents/bornomala/index.html', 'utf8');
const dom = new JSDOM(html, { url: 'https://mayamoho.github.io/bornomala/', runScripts: 'outside-only' });
const { window } = dom;

global.window = window;
global.document = window.document;
Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true });
global.localStorage = window.localStorage;
global.history = window.history;
global.Response = window.Response ?? class {};
// Model fetch fails on purpose: this is the exact state the user reported.
global.fetch = () => Promise.reject(new Error('NetworkError'));

await import('/home/asus/Documents/bornomala/app.js');
await new Promise((r) => setTimeout(r, 200));

const el = (id) => window.document.getElementById(id);
const fire = (node, type) => node.dispatchEvent(new window.Event(type, { bubbles: true }));
const results = [];
const check = (name, cond, detail) => results.push({ name, pass: !!cond, detail });

// 1. Default state, no note, coded
check('default coded payload', /^[^ ]{3,}$/.test(el('crisis-code').textContent), el('crisis-code').textContent);

// 2. Type a note with NO model loaded, coded mode
el('note').value = 'আমাদের ছাদ ভেঙে গেছে';
fire(el('note'), 'input');
check('note without model shows dash in coded mode', el('crisis-code').textContent === '—', el('crisis-code').textContent);

// 3. Now tick plain text — must show the sentence, model or not
el('crisis-plaintext').checked = true;
fire(el('crisis-plaintext'), 'change');
const plain = el('crisis-code').textContent;
check('plain text shows the sentence, not a code', plain.includes('ছাদ'), plain.slice(0, 90));
check('heading says plain text', el('code-label').textContent.includes('plain'), el('code-label').textContent);
check('send button enabled in plain text', el('crisis-send').disabled === false, `disabled=${el('crisis-send').disabled}`);
check('stats show 1.0x in plain text', el('c-ratio').textContent === '1.0×', el('c-ratio').textContent);

// 4. Untick — must return to a code
el('crisis-plaintext').checked = false;
fire(el('crisis-plaintext'), 'change');
check('back to coded shows dash (no model, has note)', el('crisis-code').textContent === '—', el('crisis-code').textContent);
check('heading says coded', el('code-label').textContent.includes('coded'), el('code-label').textContent);

// 5. Clear note, coded must produce a real payload
el('note').value = '';
fire(el('note'), 'input');
const coded = el('crisis-code').textContent;
check('coded payload without note', coded !== '—' && coded.length > 2, coded);

// 6. Plain text with location
el('crisis-plaintext').checked = true;
fire(el('crisis-plaintext'), 'change');
check('plain text carries a map link', el('crisis-code').textContent.includes('https://maps.google.com'), el('crisis-code').textContent.split('\n')[1]);

// 7. Language switch keeps working
el('lang-bn').dispatchEvent(new window.Event('click', { bubbles: true }));
check('bangla switch applied', window.document.documentElement.lang === 'bn', window.document.documentElement.lang);

for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}\n        ${r.detail}`);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
