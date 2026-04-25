// lib/filter-engine.js
// Scores, ranks, and selects tracks based on parsed filter intent.
// Implements soft scoring (partial credit for near-misses) + fallback relaxation.

const MIN_PLAYLIST_SIZE = 5;
const DEFAULT_TOP_N = 30;
const SCORE_THRESHOLD = 50; // out of 100

/** Soft score: returns 0–1 based on how well a value fits the range.
 *  - Value inside range → 1.0
 *  - Value just outside → partial credit (linear decay, capped at 0)
 *  - Decay zone = 20% of range width (min 0.1)
 */
function softScore(value, min, max) {
  if (value >= min && value <= max) return 1;

  const rangeWidth = max - min;
  const decayZone = Math.max(rangeWidth * 0.2, 0.1);

  if (value < min) {
    return Math.max(0, 1 - (min - value) / decayZone);
  } else {
    return Math.max(0, 1 - (value - max) / decayZone);
  }
}

/** Score a single track against the filters. Returns 0–100. */
function scoreTrack(track, filters, weights) {
  const f = track.features;
  let totalWeight = 0;
  let weightedScore = 0;

  const featureMap = {
    energy: f.energy,
    tempo: f.tempo,
    valence: f.valence,
    danceability: f.danceability,
    acousticness: f.acousticness,
    instrumentalness: f.instrumentalness,
    speechiness: f.speechiness,
  };

  for (const [feature, range] of Object.entries(filters)) {
    if (!range) continue;
    const value = featureMap[feature];
    if (value === undefined) continue;

    const weight = weights[feature] ?? 1;
    const score = softScore(value, range.min, range.max);

    weightedScore += score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return (weightedScore / totalWeight) * 100;
}

/** Relax all filter ranges by a given factor (e.g. 0.2 = expand by 20%) */
function relaxFilters(filters, factor) {
  const relaxed = {};

  for (const [key, range] of Object.entries(filters)) {
    if (!range) continue;
    const width = range.max - range.min;
    const expansion = width * factor;
    relaxed[key] = {
      min: Math.max(0, range.min - expansion),
      max: Math.min(key === "tempo" ? 250 : 1, range.max + expansion),
    };
  }

  return relaxed;
}

/** Main entry point: score all tracks, rank, select top N with fallback */
function filterTracks(tracks, filters, weights, options = {}) {
  const topN = options.topN ?? DEFAULT_TOP_N;
  const threshold = options.threshold ?? SCORE_THRESHOLD;

  let activeFilters = filters;
  let relaxed = false;

  let scored = tracks
    .map((t) => ({ track: t, score: scoreTrack(t, activeFilters, weights) }))
    .filter((s) => s.score >= threshold)
    .sort((a, b) => b.score - a.score);

  // Fallback: relax filters if too few results
  if (scored.length < MIN_PLAYLIST_SIZE) {
    relaxed = true;
    for (const factor of [0.3, 0.5, 0.7]) {
      activeFilters = relaxFilters(filters, factor);
      scored = tracks
        .map((t) => ({ track: t, score: scoreTrack(t, activeFilters, weights) }))
        .filter((s) => s.score >= threshold * (1 - factor))
        .sort((a, b) => b.score - a.score);

      if (scored.length >= MIN_PLAYLIST_SIZE) break;
    }
  }

  return {
    tracks: scored.slice(0, topN),
    totalConsidered: tracks.length,
    relaxed,
  };
}

module.exports = { filterTracks };
