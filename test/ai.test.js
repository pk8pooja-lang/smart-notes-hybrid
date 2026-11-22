import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pickRoute, normalizeSource, runTask, buildPrompt,
  LONG_NOTE_CHARS, TOO_SHORT, NO_ACTIONS,
} from '../src/ai.js';
import { localSummary, localActionItems } from '../src/local.js';

function fakeModel(text, source) {
  const calls = [];
  return {
    calls,
    async generateContent(prompt) {
      calls.push(prompt);
      return { response: { text: () => text, inferenceSource: source } };
    },
  };
}

const SHORT = 'The launch is on Friday. The launch needs a demo video. Lunch is at noon.';
const LONG = ('The launch is on Friday and the team needs a demo video. ').repeat(20);

test('pickRoute: short goes on-device, long goes cloud, override wins', () => {
  assert.equal(pickRoute(SHORT), 'device');
  assert.ok(LONG.length > LONG_NOTE_CHARS);
  assert.equal(pickRoute(LONG), 'cloud');
  assert.equal(pickRoute(SHORT, 'cloud'), 'cloud');
  assert.equal(pickRoute(LONG, 'device'), 'device');
});

test('normalizeSource handles the SDK values on_device / in_cloud', () => {
  assert.equal(normalizeSource('on_device', 'device'), 'device');
  assert.equal(normalizeSource('in_cloud', 'device'), 'cloud');
  assert.equal(normalizeSource('ON_DEVICE', 'cloud'), 'device');
  assert.equal(normalizeSource(undefined, 'cloud'), 'cloud');
  assert.equal(normalizeSource(undefined, 'device'), 'unknown');
});

test('short note uses the device model and reports its inferenceSource', async () => {
  const device = fakeModel('Launch Friday.', 'on_device');
  const cloud = fakeModel('cloud text', 'in_cloud');
  let prepared = 0;
  const r = await runTask({ task: 'summary', text: SHORT, models: { device, cloud, prepareDevice: () => { prepared++; } } });
  assert.deepEqual(r, { text: 'Launch Friday.', source: 'device', warning: null });
  assert.equal(device.calls.length, 1);
  assert.equal(cloud.calls.length, 0);
  assert.equal(prepared, 1);
});

test('device model falling back to cloud is reported honestly as cloud', async () => {
  const device = fakeModel('From the cloud.', 'in_cloud');
  const r = await runTask({ task: 'summary', text: SHORT, models: { device, cloud: fakeModel('x', 'in_cloud') } });
  assert.equal(r.source, 'cloud');
});

test('long note uses the cloud model and does not prepare the device', async () => {
  const device = fakeModel('d', 'on_device');
  const cloud = fakeModel('Cloud summary.', 'in_cloud');
  let prepared = 0;
  const r = await runTask({ task: 'summary', text: LONG, models: { device, cloud, prepareDevice: () => { prepared++; } } });
  assert.equal(r.source, 'cloud');
  assert.equal(r.text, 'Cloud summary.');
  assert.equal(device.calls.length, 0);
  assert.equal(prepared, 0);
});

test('model error falls back to local result with a warning', async () => {
  const bad = { async generateContent() { throw new Error('offline'); } };
  const r = await runTask({ task: 'summary', text: SHORT, models: { device: bad, cloud: bad } });
  assert.equal(r.source, 'local');
  assert.equal(r.warning, 'offline');
  assert.ok(r.text.length > 0);
});

test('empty model response falls back to local', async () => {
  const r = await runTask({ task: 'summary', text: SHORT, models: { device: fakeModel('   ', 'on_device'), cloud: fakeModel('x') } });
  assert.equal(r.source, 'local');
});

test('demo mode (no models) uses local fallback without a warning', async () => {
  const r = await runTask({ task: 'summary', text: SHORT, models: null });
  assert.equal(r.source, 'local');
  assert.equal(r.warning, null);
});

test('local summary: too short and normal cases', async () => {
  assert.equal(localSummary('milk eggs'), null);
  const r = await runTask({ task: 'summary', text: 'milk eggs', models: null });
  assert.equal(r.text, TOO_SHORT);
  assert.ok(localSummary(SHORT).length < SHORT.length);
});

test('action items: found and none', async () => {
  const t = 'We need a demo video. Lunch is at noon. Remember to submit the form.';
  const items = localActionItems(t);
  assert.match(items, /^- We need a demo video\n- Remember to submit the form$/m);
  const none = await runTask({ task: 'actions', text: 'It was a sunny day. Birds sang.', models: null });
  assert.equal(none.text, NO_ACTIONS);
});

test('prompts mention the task and include the note', () => {
  assert.match(buildPrompt('summary', 'hello'), /Summarize/);
  assert.match(buildPrompt('summary', 'hello'), /hello$/);
  assert.match(buildPrompt('actions', 'hello'), /action items/);
});
