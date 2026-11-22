import { localSummary, localActionItems } from './local.js';

// Notes up to this many characters are routed to the on-device model.
// Longer notes go to the cloud model, which handles big inputs better.
export const LONG_NOTE_CHARS = 600;

export const TOO_SHORT = 'Too short to summarize. Add at least 2 sentences.';
export const NO_ACTIONS = 'No action items.';

export function buildPrompt(task, text) {
  if (task === 'actions') {
    return (
      'List the action items in this note as short lines that each start with "- ". ' +
      'If there are none, reply exactly: ' + NO_ACTIONS + '\n\nNote:\n' + text
    );
  }
  return (
    'Summarize the following note in 1 to 3 short sentences. ' +
    'Reply with the summary only.\n\nNote:\n' + text
  );
}

// preference: 'auto' | 'device' | 'cloud'
export function pickRoute(text, preference = 'auto') {
  if (preference === 'cloud') return 'cloud';
  if (preference === 'device') return 'device';
  return text.length > LONG_NOTE_CHARS ? 'cloud' : 'device';
}

// The SDK reports inferenceSource as 'on_device' or 'in_cloud'.
export function normalizeSource(raw, route) {
  if (raw == null) return route === 'cloud' ? 'cloud' : 'unknown';
  const s = String(raw).toUpperCase();
  if (s.includes('DEVICE')) return 'device';
  if (s.includes('CLOUD')) return 'cloud';
  return 'unknown';
}

function localResult(task, text) {
  if (task === 'actions') return localActionItems(text) || NO_ACTIONS;
  return localSummary(text) || TOO_SHORT;
}

/**
 * Runs one AI task on a note.
 * models = { device, cloud, prepareDevice } or null (demo mode).
 * Always resolves: on any failure it falls back to the local algorithm.
 * Returns { text, source: 'device' | 'cloud' | 'unknown' | 'local', warning }.
 */
export async function runTask({ task, text, preference = 'auto', models, onProgress }) {
  const route = pickRoute(text, preference);
  const model = models ? (route === 'device' ? models.device : models.cloud) : null;

  if (!model) {
    return { text: localResult(task, text), source: 'local', warning: null };
  }

  try {
    if (route === 'device' && typeof models.prepareDevice === 'function') {
      models.prepareDevice(onProgress);
    }
    const result = await model.generateContent(buildPrompt(task, text));
    const out = (result.response.text() || '').trim();
    if (!out) throw new Error('Empty response from model');
    return {
      text: out,
      source: normalizeSource(result.response.inferenceSource, route),
      warning: null,
    };
  } catch (err) {
    return {
      text: localResult(task, text),
      source: 'local',
      warning: (err && err.message) || String(err),
    };
  }
}
