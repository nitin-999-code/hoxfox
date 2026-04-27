/**
 * filterEngineService.js
 * Core scoring, ranking, and selection pipeline.
 *
 * Scoring weights (no artist in query):
 *   genre     45 pts  — F1-blend (recall-weighted) against target clusters
 *   mood      25 pts  — Last.fm tag overlap with query keywords
 *   keyword   20 pts  — track/artist name match against expanded keywords
 *   popularity 5 pts  — pure tiebreaker
 *   language  ±20 pts — bonus if language matches, soft penalty if it doesn't
 *   ───────────────────
 *   base max  95 pts  (+ up to 20 language bonus = 115, capped at 100)
 *
 * Scoring weights (with artist in query):
 *   artist    40 pts
 *   genre     25 pts
 *   mood      20 pts
 *   keyword   10 pts
 *   popularity 5 pts
 *
 * Key decisions:
 *   - NO normalizeScores() — scores are absolute, threshold has real meaning
 *   - Genre uses recall-weighted F1 so long target lists are not penalised
 *   - Mood tags need ≥1 keyword overlap (Last.fm tags enrich when available)
 *   - Keyword needs ≥2 matches for large keyword sets (prevents 1-word noise)
 *   - Language is a ±20 bonus/penalty (soft, not a hard exclude)
 *   - Fallback only triggers if <5 results, not just any miss
 */

const WEIGHTS = {
  noArtist: { genre: 45, mood: 25, keyword: 20, popularity: 5 },
  artist:   { artist: 40, genre: 25, mood: 20, keyword: 10, popularity: 5 },
};

const DEFAULT_TOP_N    = 30;
const MIN_RESULTS      = 5;
const MAX_PER_ARTIST   = 3;
const SCORE_THRESHOLD  = 22;   // absolute, out of 95 base
const JITTER_RANGE     = 1.5;

// Language → clusters that indicate the language
const LANGUAGE_CLUSTER_MAP = {
  hindi:   ['bollywood'],
  punjabi: ['punjabi'],
  korean:  ['kpop'],
  spanish: ['latin'],
};

// Clusters/keywords that indicate a non-English language
const NON_ENGLISH_MARKERS = {
  clusters: ['bollywood', 'punjabi', 'kpop', 'latin'],
  genreSubstrings: ['bollywood', 'filmi', 'hindi', 'k-pop', 'korean', 'latin', 'punjabi', 'bhangra'],
};

// ── Genre: F1-blend (70% recall + 30% precision + coverage bonus) ─────────────

function improvedGenreScore(trackClusters, targetClusters) {
  if (!targetClusters?.length || !trackClusters?.length) return 0;

  const trackSet = new Set(trackClusters);
  const matches  = targetClusters.filter(c => trackSet.has(c)).length;
  if (matches === 0) return 0;

  const recall    = matches / targetClusters.length;
  const precision = matches / trackClusters.length;
  const bonus     = recall >= 0.5 ? 0.15 : 0;

  return Math.min(1, 0.7 * recall + 0.3 * precision + bonus);
}

// ── Mood tags: keyword overlap with Last.fm tags ──────────────────────────────

function moodTagScore(track, keywords) {
  if (!keywords?.length || !track.moodTags?.length) return 0;

  const tagSet = track.moodTags.map(t => t.toLowerCase());
  let matches  = 0;

  for (const kw of keywords) {
    if (tagSet.some(tag => tag.includes(kw) || kw.includes(tag))) matches++;
  }

  return Math.min(1, matches / Math.max(1, Math.ceil(keywords.length * 0.3)));
}

// ── Keyword: track/artist name match with tighter min threshold ───────────────

function keywordScore(track, keywords) {
  if (!keywords?.length) return 0;

  const searchText = [track.nameLower, ...track.artistsLower].join(' ');
  const matches    = keywords.filter(kw => searchText.includes(kw)).length;

  // Require ≥2 hits when keyword list is large (prevents single coincidental match)
  const minRequired = keywords.length > 5 ? 2 : 1;
  if (matches < minRequired) return 0;

  return Math.min(1, matches / Math.max(1, Math.ceil(keywords.length * 0.5)));
}

// ── Artist: exact or partial name match ──────────────────────────────────────

function artistMatchScore(track, intentArtist) {
  if (!intentArtist) return 0;
  const ia = intentArtist.toLowerCase().trim();
  return track.artistsLower.some(a => a.includes(ia) || ia.includes(a)) ? 1 : 0;
}

// ── Popularity: square-root curve so mid-tier tracks aren't buried ────────────

function popularityScore(pop) {
  return Math.sqrt((pop || 0) / 100);
}

// ── Language: ±20 bonus/penalty ──────────────────────────────────────────────

function languageAdjustment(track, language) {
  if (!language) return 0;

  const allClusters = track.clusters || [];
  const allGenres   = (track.genres || []).map(g => g.toLowerCase());

  if (language === 'english') {
    const isNonEnglish =
      NON_ENGLISH_MARKERS.clusters.some(c => allClusters.includes(c)) ||
      allGenres.some(g => NON_ENGLISH_MARKERS.genreSubstrings.some(ne => g.includes(ne)));
    return isNonEnglish ? -15 : 5;
  }

  const targetClusters  = LANGUAGE_CLUSTER_MAP[language] || [];
  const genreKeywords   = {
    hindi:   ['bollywood', 'filmi', 'hindi', 'desi'],
    punjabi: ['punjabi', 'bhangra'],
    korean:  ['k-pop', 'korean'],
    spanish: ['latin', 'reggaeton', 'spanish'],
  }[language] || [];

  const clusterMatch = targetClusters.some(c => allClusters.includes(c));
  const genreMatch   = allGenres.some(g => genreKeywords.some(kw => g.includes(kw)));

  return (clusterMatch || genreMatch) ? 20 : -10;
}

// ── Composite scorer ──────────────────────────────────────────────────────────

function scoreTrack(track, intent) {
  const { keywords = [], targetGenres = [], artist = null, language = null } = intent;

  const gScore  = improvedGenreScore(track.clusters, targetGenres);
  const mScore  = moodTagScore(track, keywords);
  const kScore  = keywordScore(track, keywords);
  const pScore  = popularityScore(track.popularity);
  const langAdj = languageAdjustment(track, language);

  let baseScore;

  if (artist) {
    const aScore = artistMatchScore(track, artist);
    baseScore =
      aScore * WEIGHTS.artist.artist +
      gScore * WEIGHTS.artist.genre  +
      mScore * WEIGHTS.artist.mood   +
      kScore * WEIGHTS.artist.keyword +
      pScore * WEIGHTS.artist.popularity;
  } else {
    // Redistribute artist weight: +20 to genre, +15 to keyword, +5 to popularity
    baseScore =
      gScore * (WEIGHTS.noArtist.genre      + 20) +
      mScore *  WEIGHTS.noArtist.mood              +
      kScore * (WEIGHTS.noArtist.keyword    + 15) +
      pScore * (WEIGHTS.noArtist.popularity +  5);
  }

  const total = Math.max(0, Math.min(100, Math.round((baseScore + langAdj) * 100) / 100));

  // ── Explainability ──────────────────────────────────────────────────────────
  const matchReasons = [];

  if (artist && artistMatchScore(track, artist) > 0)
    matchReasons.push(`artist: ${artist}`);

  if (gScore > 0.5)
    matchReasons.push(`genre: ${track.clusters.join(', ')}`);
  else if (gScore > 0)
    matchReasons.push(`partial genre: ${track.clusters.join(', ')}`);

  if (mScore > 0) {
    const hitTags = (track.moodTags || []).filter(t =>
      keywords.some(kw => t.toLowerCase().includes(kw) || kw.includes(t.toLowerCase()))
    ).slice(0, 3);
    if (hitTags.length) matchReasons.push(`mood tags: ${hitTags.join(', ')}`);
  }

  if (kScore > 0) {
    const hitKws = keywords.filter(kw =>
      [track.nameLower, ...track.artistsLower].join(' ').includes(kw)
    ).slice(0, 3);
    if (hitKws.length) matchReasons.push(`name match: ${hitKws.join(', ')}`);
  }

  if (langAdj > 0) matchReasons.push(`language match: ${language}`);
  if (langAdj < 0) matchReasons.push(`language mismatch: ${language}`);

  if (matchReasons.length === 0) matchReasons.push('popularity only');

  return {
    score: total,
    components: {
      genre:      Math.round(gScore * 100),
      mood:       Math.round(mScore * 100),
      keyword:    Math.round(kScore * 100),
      popularity: Math.round(pScore * 100),
      language:   langAdj,
    },
    matchReasons,
  };
}

// ── Diversity: cap tracks per artist ─────────────────────────────────────────

function applyDiversityFilter(scored, maxPerArtist) {
  const counts = {};
  return scored.filter(({ track }) => {
    const primary = track.artists[0] || 'unknown';
    counts[primary] = (counts[primary] || 0) + 1;
    return counts[primary] <= maxPerArtist;
  });
}

// ── Jitter: tiny random noise to break ties naturally ────────────────────────

function addJitter(scored) {
  return scored.map(s => ({
    ...s,
    score: s.score + (Math.random() * JITTER_RANGE * 2 - JITTER_RANGE),
  }));
}

// ── Relaxed re-score ─────────────────────────────────────────────────────────

function scoreRelaxed(track, intent) {
  // Clone intent with broader genres (add adjacent clusters)
  const CLUSTER_ADJACENCY = {
    'chill':      ['indie', 'classical', 'jazz'],
    'hip-hop':    ['rnb', 'pop', 'electronic'],
    'indie':      ['chill', 'rock', 'pop'],
    'pop':        ['rnb', 'indie', 'electronic'],
    'rock':       ['indie', 'metal', 'blues'],
    'electronic': ['chill', 'hip-hop', 'pop'],
    'rnb':        ['pop', 'hip-hop', 'jazz'],
    'bollywood':  ['pop', 'rnb'],
    'kpop':       ['pop', 'rnb'],
    'punjabi':    ['bollywood', 'hip-hop'],
  };

  const broadened = [...new Set([
    ...(intent.targetGenres || []),
    ...(intent.targetGenres || []).flatMap(g => CLUSTER_ADJACENCY[g] || []),
  ])];

  return scoreTrack(track, { ...intent, targetGenres: broadened });
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * @param {object[]} tracks  - NormalizedTrack[] (with moodTags populated)
 * @param {object}   intent  - { keywords, targetGenres, artist, language, label }
 * @param {object}   options - { topN, maxPerArtist }
 * @returns {{ tracks, totalConsidered, relaxed }}
 */
function filterTracks(tracks, intent, options = {}) {
  const topN         = options.topN         || DEFAULT_TOP_N;
  const maxPerArtist = options.maxPerArtist || MAX_PER_ARTIST;

  // 1. Score all tracks
  let scored = tracks.map(track => ({ track, ...scoreTrack(track, intent) }));

  // 2. Apply threshold
  let filtered = scored.filter(s => s.score >= SCORE_THRESHOLD);
  let relaxed  = false;

  // 3. Fallback: relax genre clusters if too few results
  if (filtered.length < MIN_RESULTS) {
    console.log(`[filter] only ${filtered.length} above threshold — relaxing genre clusters`);
    relaxed  = true;
    filtered = tracks
      .map(track => ({ track, ...scoreRelaxed(track, intent) }))
      .filter(s => s.score >= SCORE_THRESHOLD * 0.6)
      .sort((a, b) => b.score - a.score);

    // Last resort: top N by raw score, no threshold
    if (filtered.length < MIN_RESULTS) {
      console.log('[filter] still too few — using top-N fallback');
      filtered = [...scored].sort((a, b) => b.score - a.score).slice(0, topN);
    }
  }

  // 4. Sort descending
  filtered.sort((a, b) => b.score - a.score);

  // 5. Jitter + re-sort for natural variety
  filtered = addJitter(filtered);
  filtered.sort((a, b) => b.score - a.score);

  // 6. Diversity cap
  filtered = applyDiversityFilter(filtered, maxPerArtist);

  // 7. Take top N
  return {
    tracks:          filtered.slice(0, topN),
    totalConsidered: tracks.length,
    relaxed,
  };
}

module.exports = { filterTracks, scoreTrack };
