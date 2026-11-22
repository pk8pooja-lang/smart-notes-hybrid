// Offline, dependency-free fallbacks. Used when Firebase is not configured
// or when both the on-device and the cloud model fail, so the app never breaks.

const STOP = new Set(
  'a an the and or but if then of to in on at for with by from is are was were be been it this that these those as so not no we you they he she i our your their its'.split(' ')
);

export function splitSentences(text) {
  const m = text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]*/g) || [];
  return m.map((s) => s.trim()).filter(Boolean);
}

export function words(text) {
  return text.toLowerCase().match(/[a-z']+/g) || [];
}

export function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Picks the highest scoring sentences (word frequency), keeps original order.
// Returns null when the text has fewer than 2 sentences.
export function localSummary(text) {
  const sentences = splitSentences(text);
  if (sentences.length < 2) return null;
  const freq = {};
  words(text).forEach((w) => {
    if (!STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
  });
  const scored = sentences.map((s, i) => {
    const total = words(s).reduce((a, w) => a + (freq[w] || 0), 0);
    return { s, i, score: total / Math.max(1, wordCount(s)) };
  });
  const keep = Math.max(1, Math.floor(sentences.length / 3));
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, keep)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s)
    .join(' ');
}

const ACTION_RE =
  /\b(need|needs|must|should|todo|to do|remember|don't forget|buy|call|send|submit|finish|prepare|review|schedule|book|email|deadline|due)\b/i;

// Returns a bullet list string, or null when no action items are found.
export function localActionItems(text) {
  const items = splitSentences(text).filter((s) => ACTION_RE.test(s));
  if (!items.length) return null;
  return items.map((s) => '- ' + s.replace(/[.!?]+$/, '')).join('\n');
}
