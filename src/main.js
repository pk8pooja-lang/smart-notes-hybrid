import { runTask } from './ai.js';
import { wordCount } from './local.js';
import { createModels } from './firebase.js';

const STORAGE_KEY = 'smart-notes-hybrid-v1';
const PREF_KEY = 'smart-notes-ai-mode';

const SOURCE_LABEL = {
  device: 'On-device · Gemini Nano',
  cloud: 'Cloud · Gemini',
  unknown: 'AI',
  local: 'Local fallback',
};

let models = null;
try {
  models = createModels();
} catch (err) {
  console.warn('Firebase AI Logic could not start, running in demo mode:', err);
  models = null;
}

let notes = [];
try {
  notes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
} catch (e) {
  notes = [];
}
let preference = 'auto';
try {
  preference = localStorage.getItem(PREF_KEY) || 'auto';
} catch (e) {
  preference = 'auto';
}

const busy = {}; // `${id}:${task}` -> true
const progress = {}; // note id -> 0..1 while the on-device model downloads

const $ = (id) => document.getElementById(id);
const form = $('note-form');
const titleEl = $('title');
const bodyEl = $('body');
const errorEl = $('error');
const searchEl = $('search');
const listEl = $('notes');
const emptyEl = $('empty');
const countEl = $('count');
const statusEl = $('status');
const modeEl = $('ai-mode');

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    /* storage may be blocked, the app still works for this session */
  }
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = !msg;
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function resultBox(kind, label, r) {
  const box = el('div', 'result');
  box.setAttribute('data-testid', kind);
  box.appendChild(el('strong', null, label + ' '));
  box.appendChild(el('span', 'result-text', r.text));
  const badge = el('span', 'badge badge-' + r.source, SOURCE_LABEL[r.source] || 'AI');
  badge.setAttribute('data-testid', 'source');
  box.appendChild(badge);
  if (r.warning) {
    box.appendChild(el('div', 'warn', 'AI was unavailable (' + r.warning + '). Used the local fallback.'));
  }
  return box;
}

function render() {
  const q = searchEl.value.trim().toLowerCase();
  const shown = notes.filter(
    (n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
  );
  listEl.innerHTML = '';
  shown.forEach((n) => {
    const li = el('li');
    li.setAttribute('data-note-id', n.id);
    li.appendChild(el('h3', 'title', n.title));
    li.appendChild(el('p', 'body', n.body));
    const wc = wordCount(n.body);
    li.appendChild(el('div', 'meta', wc + (wc === 1 ? ' word' : ' words')));

    const actions = el('div', 'actions');
    const sBusy = busy[n.id + ':summary'];
    const aBusy = busy[n.id + ':actions'];

    const sBtn = el('button', 'ghost', sBusy ? 'Summarizing…' : 'Summarize');
    sBtn.type = 'button';
    sBtn.disabled = Boolean(sBusy);
    sBtn.addEventListener('click', () => run(n, 'summary'));

    const aBtn = el('button', 'ghost', aBusy ? 'Working…' : 'Action items');
    aBtn.type = 'button';
    aBtn.disabled = Boolean(aBusy);
    aBtn.addEventListener('click', () => run(n, 'actions'));

    const dBtn = el('button', 'danger', 'Delete');
    dBtn.type = 'button';
    dBtn.addEventListener('click', () => {
      notes = notes.filter((x) => x.id !== n.id);
      persist();
      render();
    });
    actions.append(sBtn, aBtn, dBtn);
    li.appendChild(actions);

    if (progress[n.id] != null && progress[n.id] < 1) {
      li.appendChild(
        el('div', 'busy', 'Downloading the on-device model… ' + Math.round(progress[n.id] * 100) + '% (cloud answers meanwhile)')
      );
    }
    if (n.summary) li.appendChild(resultBox('summary', 'Summary:', n.summary));
    if (n.actionItems) li.appendChild(resultBox('actions', 'Action items:', n.actionItems));
    listEl.appendChild(li);
  });

  countEl.textContent = notes.length + (notes.length === 1 ? ' note' : ' notes');
  if (notes.length === 0) {
    emptyEl.textContent = 'No notes yet';
    emptyEl.hidden = false;
  } else if (shown.length === 0) {
    emptyEl.textContent = 'No matching notes';
    emptyEl.hidden = false;
  } else {
    emptyEl.hidden = true;
  }
}

async function run(note, task) {
  const key = note.id + ':' + task;
  busy[key] = true;
  render();
  const result = await runTask({
    task,
    text: note.body,
    preference,
    models,
    onProgress: (value) => {
      progress[note.id] = value;
      render();
    },
  });
  busy[key] = false;
  if (task === 'summary') note.summary = result;
  else note.actionItems = result;
  persist();
  render();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = titleEl.value.trim();
  const body = bodyEl.value.trim();
  if (!title) return showError('Title is required');
  if (!body) return showError('Note body is required');
  showError('');
  notes.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title,
    body,
    summary: null,
    actionItems: null,
  });
  persist();
  titleEl.value = '';
  bodyEl.value = '';
  render();
});

searchEl.addEventListener('input', render);

modeEl.value = preference;
modeEl.addEventListener('change', () => {
  preference = modeEl.value;
  try {
    localStorage.setItem(PREF_KEY, preference);
  } catch (e) {
    /* ignore */
  }
});

statusEl.textContent = models
  ? 'Firebase AI Logic is connected. Short notes use on-device Gemini Nano when Chrome has it, long notes use the cloud.'
  : 'Demo mode: Firebase is not configured yet, so summaries use a local fallback.';
statusEl.className = models ? 'status ok' : 'status demo';

render();
