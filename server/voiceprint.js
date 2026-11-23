/**
 * Voice-Print consistency check.
 * The browser extracts an on-device acoustic fingerprint (24 mel-ish band
 * energies + median pitch + zero-crossing rate). We keep ONLY the vector — never
 * raw audio — and compare vectors with a weighted cosine/pitch similarity.
 * The vector is non-reversible for practical purposes: it cannot be turned back
 * into intelligible speech.
 */

export const VOICEPRINT_DIM = 24;
export const MATCH_THRESHOLD = 0.8;

const l2 = (v) => Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;

/** Cosine over mean-centred band energies: captures spectral SHAPE, not loudness. */
function cosine(a, b) {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function pitchSimilarity(a, b) {
  if (!a || !b) return 0.5;
  const cents = Math.abs(1200 * Math.log2(a / b));
  return Math.max(0, 1 - cents / 900);
}

function sanitize(v) {
  if (!v || typeof v !== 'object') return null;
  const bands = Array.isArray(v.bands) ? v.bands.slice(0, VOICEPRINT_DIM).map(Number).filter(Number.isFinite) : [];
  if (bands.length < 8) return null;
  while (bands.length < VOICEPRINT_DIM) bands.push(0);
  const norm = l2(bands);
  return { bands: bands.map((x) => x / norm), pitch: Number(v.pitch) || 0, zcr: Number(v.zcr) || 0, durationS: Number(v.durationS) || 0 };
}

export function compareVoiceprints(baseline, candidate, threshold = MATCH_THRESHOLD) {
  const a = sanitize(baseline);
  const b = sanitize(candidate);
  if (!a || !b) {
    return {
      available: false,
      similarity: null,
      threshold,
      verdict: 'unverified',
      detail: 'No usable acoustic fingerprint on one side of the comparison.',
    };
  }
  const spectral = (cosine(a.bands, b.bands) + 1) / 2; // centred cosine [-1,1] → [0,1]
  const pitch = pitchSimilarity(a.pitch, b.pitch);
  const energy = 1 - Math.min(1, Math.abs((a.zcr || 0) - (b.zcr || 0)) / 0.2);
  const similarity = Math.max(0, Math.min(1, 0.62 * spectral + 0.3 * pitch + 0.08 * energy));
  const verdict = similarity >= threshold ? 'match' : similarity >= threshold - 0.12 ? 'review' : 'mismatch';
  return {
    available: true,
    similarity: Number(similarity.toFixed(3)),
    threshold,
    verdict,
    detail:
      verdict === 'match'
        ? 'Same speaker as the enrolled baseline within tolerance.'
        : verdict === 'review'
          ? 'Borderline — likely same speaker under different microphone/room conditions. Teacher review advised.'
          : 'Acoustic fingerprint does not match the enrolled student. Possible proxy recording.',
    components: {
      spectral: Number(spectral.toFixed(3)),
      pitch: Number(pitch.toFixed(3)),
      energy: Number(energy.toFixed(3)),
      baselinePitch: Math.round(a.pitch),
      candidatePitch: Math.round(b.pitch),
    },
  };
}

/** Coarse quality estimate so the UI can reject 2-second mumbles. */
export function fingerprintQuality(vec) {
  const v = sanitize(vec);
  if (!v) return { ok: false, score: 0, reason: 'No fingerprint captured.' };
  const seconds = v.durationS;
  if (seconds < 6) return { ok: false, score: 0.2, reason: 'Too short — speak for at least 8 seconds.' };
  const flat = v.bands.filter((x) => x > 0.02).length / v.bands.length;
  const score = Math.min(1, 0.45 + flat * 0.4 + Math.min(1, seconds / 15) * 0.15);
  return { ok: score > 0.5, score: Number(score.toFixed(2)), reason: score > 0.5 ? 'Usable fingerprint.' : 'Noisy or flat signal — move closer to the microphone.' };
}
