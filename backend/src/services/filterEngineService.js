/**
 * filterEngineService.js
 * Adaptive Pre-Filter Scoring Engine for Hoxfox.
 * Scores and trims tracks before they are passed to the CrewAI pipeline.
 */

const SCORE_THRESHOLD = 18;
const JITTER_RANGE = 1.5;

const CLUSTER_ADJACENCY = {
  chill: ['indie', 'classical', 'jazz'],
  'hip-hop': ['rnb', 'pop', 'electronic'],
  indie: ['chill', 'rock', 'pop'],
  pop: ['rnb', 'indie', 'electronic'],
  rock: ['indie', 'metal', 'blues'],
  electronic: ['chill', 'hip-hop', 'pop'],
  rnb: ['pop', 'hip-hop', 'jazz'],
  bollywood: ['pop', 'rnb'],
  kpop: ['pop', 'rnb'],
  punjabi: ['bollywood', 'hip-hop'],
};

const NON_ENGLISH_MARKERS = {
  clusters: ['bollywood', 'punjabi', 'kpop', 'latin'],
  genreSubstrings: ['bollywood', 'filmi', 'hindi', 'k-pop', 'korean', 'latin', 'punjabi', 'bhangra'],
};

const LANGUAGE_CLUSTER_MAP = {
  hindi: ['bollywood'],
  punjabi: ['punjabi'],
  korean: ['kpop'],
  spanish: ['latin'],
};

/**
 * Detects the probable language of a track based on its genres and clusters.
 */
function getTrackLanguage(track) {
  const clusters = track.clusters || [];
  const genres = (track.genres || []).map(g => g.toLowerCase());

  if (clusters.includes('bollywood') || genres.some(g => ['bollywood', 'filmi', 'hindi', 'desi'].some(s => g.includes(s)))) return 'hindi';
  if (clusters.includes('punjabi') || genres.some(g => ['punjabi', 'bhangra'].some(s => g.includes(s)))) return 'punjabi';
  if (clusters.includes('kpop') || genres.some(g => ['k-pop', 'korean'].some(s => g.includes(s)))) return 'korean';
  if (clusters.includes('latin') || genres.some(g => ['latin', 'reggaeton', 'spanish'].some(s => g.includes(s)))) return 'spanish';

  return 'english';
}

/**
 * Scores a single track against a parsed intent.
 */
function scoreTrack(track, intent) {
  const { keywords = [], targetGenres = [], artist: intentArtist = null, language: intentLanguage = null } = intent;
  
  const weights = intentArtist 
    ? { artist: 40, genre: 25, mood: 20, keyword: 10, popularity: 5 }
    : { genre: 45, mood: 25, keyword: 20, popularity: 5 };

  const matchReasons = [];
  const components = { genre: 0, mood: 0, keyword: 0, popularity: 0, language: 0 };

  // 1. Genre Score (F1-blend)
  if (targetGenres.length > 0 && track.clusters?.length > 0) {
    const matches = targetGenres.filter(g => track.clusters.includes(g)).length;
    if (matches > 0) {
      const recall = matches / targetGenres.length;
      const precision = matches / track.clusters.length;
      const f1 = (0.7 * recall + 0.3 * precision);
      const bonus = recall >= 0.5 ? 0.15 : 0;
      const rawGenre = Math.min(1, f1 + bonus);
      components.genre = Math.round(rawGenre * 100);
      if (rawGenre > 0.5) matchReasons.push(`genre match: ${track.clusters.join(', ')}`);
    }
  }

  // 2. Mood Score (Last.fm tag overlap)
  if (keywords.length > 0 && track.moodTags?.length > 0) {
    const trackTags = track.moodTags.map(t => t.toLowerCase());
    const matches = keywords.filter(kw => trackTags.some(tag => tag.includes(kw) || kw.includes(tag))).length;
    if (matches >= 1) {
      const rawMood = Math.min(1, matches / Math.ceil(keywords.length * 0.3));
      components.mood = Math.round(rawMood * 100);
      matchReasons.push(`mood vibes: ${keywords.filter(kw => trackTags.some(tag => tag.includes(kw))).slice(0, 2).join(', ')}`);
    }
  }

  // 3. Keyword Score (Track + Artist names)
  if (keywords.length > 0) {
    const searchText = `${track.nameLower} ${track.artistsLower.join(' ')}`;
    const matches = keywords.filter(kw => searchText.includes(kw)).length;
    const minRequired = keywords.length > 5 ? 2 : 1;
    if (matches >= minRequired) {
      const rawKeyword = Math.min(1, matches / Math.ceil(keywords.length * 0.5));
      components.keyword = Math.round(rawKeyword * 100);
      matchReasons.push('keyword hit');
    }
  }

  // 4. Popularity Score
  const rawPop = Math.sqrt((track.popularity || 0) / 100);
  components.popularity = Math.round(rawPop * 100);

  // 5. Artist Match (Special Weight)
  let artistScore = 0;
  if (intentArtist) {
    const ia = intentArtist.toLowerCase();
    if (track.artistsLower.some(a => a.includes(ia) || ia.includes(a))) {
      artistScore = 100;
      matchReasons.push(`artist: ${intentArtist}`);
    }
  }

  // 6. Language Adjustment
  let langAdj = 0;
  if (intentLanguage) {
    const trackLang = getTrackLanguage(track);
    if (trackLang === intentLanguage) {
      langAdj = 20;
      matchReasons.push(`language: ${intentLanguage}`);
    } else {
      langAdj = -20;
    }
  }
  components.language = langAdj;

  // Calculate final absolute score
  let finalScore = 0;
  if (intentArtist) {
    finalScore = (artistScore/100 * weights.artist) +
                 (components.genre/100 * weights.genre) +
                 (components.mood/100 * weights.mood) +
                 (components.keyword/100 * weights.keyword) +
                 (components.popularity/100 * weights.popularity);
  } else {
    finalScore = (components.genre/100 * weights.genre) +
                 (components.mood/100 * weights.mood) +
                 (components.keyword/100 * weights.keyword) +
                 (components.popularity/100 * weights.popularity);
  }

  finalScore += langAdj;
  
  return {
    score: Math.max(0, Math.min(100, finalScore)),
    components,
    matchReasons: matchReasons.length > 0 ? matchReasons : ['popularity']
  };
}

/**
 * Main filtering logic.
 */
function filterTracks(tracks, intent, options = {}) {
  const { topN = 45, maxPerArtist = 5 } = options;
  
  let totalConsidered = tracks.length;
  let relaxed = false;

  // 1. Initial Scoring
  let scored = tracks.map(t => ({
    track: t,
    ...scoreTrack(t, intent)
  }));

  // 2. Threshold Check
  let filtered = scored.filter(s => s.score >= SCORE_THRESHOLD);

  // 3. Fallback: Relaxation
  if (filtered.length < 8) {
    relaxed = true;
    const broadenedGenres = [...new Set([
      ...(intent.targetGenres || []),
      ...(intent.targetGenres || []).flatMap(g => CLUSTER_ADJACENCY[g] || [])
    ])];
    
    const relaxedIntent = { ...intent, targetGenres: broadenedGenres };
    const relaxedThreshold = SCORE_THRESHOLD * 0.6;
    
    filtered = tracks.map(t => ({
      track: t,
      ...scoreTrack(t, relaxedIntent)
    })).filter(s => s.score >= relaxedThreshold);

    if (filtered.length < 8) {
      // Last resort: return top-N by raw score
      filtered = tracks.map(t => ({
        track: t,
        ...scoreTrack(t, intent)
      })).sort((a, b) => b.score - a.score);
    }
  }

  // 4. Apply Jitter
  filtered = filtered.map(s => ({
    ...s,
    score: s.score + (Math.random() * JITTER_RANGE * 2 - JITTER_RANGE)
  }));

  // 5. Sort by score
  filtered.sort((a, b) => b.score - a.score);

  // 6. Diversity Cap (maxPerArtist)
  const artistCounts = {};
  const diverse = [];
  for (const s of filtered) {
    const primaryArtist = s.track.artists[0] || 'unknown';
    artistCounts[primaryArtist] = (artistCounts[primaryArtist] || 0) + 1;
    if (artistCounts[primaryArtist] <= maxPerArtist) {
      diverse.push(s);
    }
  }

  return {
    tracks: diverse.slice(0, topN),
    totalConsidered,
    relaxed
  };
}

module.exports = { filterTracks, scoreTrack };
