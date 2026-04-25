/**
 * genreClusters.js
 * Maps raw Spotify genre strings → high-level cluster names.
 *
 * Spotify returns genres like: "album rock", "indie folk", "trap soul", etc.
 * This maps them into a small set of user-facing clusters so the intent
 * parser output can match against tracks generically.
 *
 * A single raw genre can belong to multiple clusters.
 */

// cluster name → array of genre substrings that map to it
const CLUSTER_MAP = {
  'pop': [
    'pop', 'dance pop', 'electropop', 'synth pop', 'indie pop', 'teen pop',
    'k-pop', 'j-pop', 'art pop', 'chamber pop', 'bubblegum',
  ],
  'hip-hop': [
    'hip hop', 'hip-hop', 'rap', 'trap', 'drill', 'conscious hip hop',
    'cloud rap', 'emo rap', 'gangsta rap', 'crunk', 'mumble rap',
    'underground hip hop', 'boom bap', 'grime',
  ],
  'rnb': [
    'r&b', 'rnb', 'soul', 'neo soul', 'funk', 'rhythm and blues',
    'contemporary r&b', 'quiet storm', 'new jack swing',
  ],
  'rock': [
    'rock', 'alternative', 'grunge', 'garage rock', 'hard rock',
    'indie rock', 'punk', 'post-punk', 'emo', 'math rock', 'noise rock',
    'progressive rock', 'psychedelic rock', 'art rock', 'glam rock',
    'classic rock',
  ],
  'electronic': [
    'electronic', 'edm', 'house', 'techno', 'trance', 'dubstep',
    'drum and bass', 'dnb', 'electro', 'ambient', 'idm', 'future bass',
    'uk garage', 'deep house', 'tech house', 'progressive house',
    'big room', 'bass music', 'glitch hop',
  ],
  'chill': [
    'chillout', 'chill', 'lo-fi', 'lofi', 'chillhop', 'downtempo',
    'trip hop', 'new age', 'ambient', 'bedroom pop', 'dream pop',
    'shoegaze', 'atmospheric',
  ],
  'jazz': [
    'jazz', 'bebop', 'swing', 'cool jazz', 'fusion jazz', 'nu jazz',
    'contemporary jazz', 'vocal jazz', 'smooth jazz', 'modal jazz',
  ],
  'classical': [
    'classical', 'baroque', 'orchestral', 'symphonic', 'opera',
    'contemporary classical', 'chamber music', 'piano', 'string quartet',
    'neoclassical',
  ],
  'metal': [
    'metal', 'heavy metal', 'death metal', 'black metal', 'thrash metal',
    'metalcore', 'post-metal', 'doom metal', 'power metal', 'screamo',
    'deathcore', 'nu metal',
  ],
  'latin': [
    'latin', 'reggaeton', 'salsa', 'bachata', 'cumbia', 'bossa nova',
    'samba', 'latin pop', 'latin rock', 'urbano', 'afrobeats', 'afropop',
    'dancehall',
  ],
  'country': [
    'country', 'americana', 'folk', 'bluegrass', 'country pop',
    'southern rock', 'outlaw country', 'western', 'singer-songwriter',
  ],
  'indie': [
    'indie', 'indie folk', 'indie pop', 'indie rock', 'lo-fi indie',
    'bedroom pop', 'freak folk', 'chamber folk',
  ],
  'blues': [
    'blues', 'delta blues', 'chicago blues', 'electric blues', 'soul blues',
  ],
  'reggae': [
    'reggae', 'ska', 'rocksteady', 'dub', 'dancehall', 'roots reggae',
  ],
  'gospel': [
    'gospel', 'christian', 'worship', 'contemporary christian',
    'ccm', 'religious',
  ],
};

// Inverted index: each raw genre substring → array of cluster names
// Built once at startup for O(1) lookups
const _invertedIndex = new Map();

for (const [cluster, substrings] of Object.entries(CLUSTER_MAP)) {
  for (const sub of substrings) {
    if (!_invertedIndex.has(sub)) _invertedIndex.set(sub, []);
    _invertedIndex.get(sub).push(cluster);
  }
}

/**
 * Map a single Spotify genre string to an array of cluster names.
 * A genre can match multiple clusters (e.g. "trap" → ['hip-hop']).
 * Returns an empty array if no cluster matches.
 *
 * @param {string} rawGenre
 * @returns {string[]} cluster names
 */
function genreToClusters(rawGenre) {
  const g = rawGenre.toLowerCase().trim();
  const matched = new Set();

  for (const [sub, clusters] of _invertedIndex.entries()) {
    if (g.includes(sub)) {
      clusters.forEach(c => matched.add(c));
    }
  }

  return [...matched];
}

/**
 * Map an array of Spotify genres to a deduplicated array of clusters.
 * @param {string[]} rawGenres
 * @returns {string[]}
 */
function genresToClusters(rawGenres) {
  const all = rawGenres.flatMap(genreToClusters);
  return [...new Set(all)];
}

/**
 * Compute a genre match score between a track's clusters and
 * the intent's target genres.
 *
 * @param {string[]} trackClusters   clusters a track belongs to
 * @param {string[]} targetClusters  clusters the user wants
 * @returns {number} 0–1
 */
function genreMatchScore(trackClusters, targetClusters) {
  if (!targetClusters || targetClusters.length === 0) return 0;
  if (!trackClusters || trackClusters.length === 0) return 0;

  const trackSet = new Set(trackClusters);
  const matches = targetClusters.filter(c => trackSet.has(c)).length;
  return matches / targetClusters.length;
}

module.exports = { genreToClusters, genresToClusters, genreMatchScore, CLUSTER_MAP };
