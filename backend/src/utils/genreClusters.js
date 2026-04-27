/**
 * genreClusters.js
 * Maps raw Spotify genre strings → high-level cluster names.
 */

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
    'gospel', 'christian', 'worship', 'contemporary christian', 'ccm', 'religious',
  ],

  // ── Regional / language clusters ──────────────────────────────────────────
  'bollywood': [
    'bollywood', 'filmi', 'hindi pop', 'hindi film', 'desi pop',
    'indian pop', 'tollywood', 'kollywood', 'mollywood',
    'carnatic', 'hindustani', 'indian classical', 'classical indian',
    'bhajan', 'ghazal', 'devotional', 'sufi', 'qawwali', 'punjabi pop',
  ],
  'punjabi': [
    'punjabi', 'bhangra', 'desi hip hop', 'punjabi folk',
  ],
  'kpop': [
    'k-pop', 'korean pop', 'korean r&b', 'korean indie', 'k-indie',
    'k-rock', 'j-pop', 'j-rock', 'city pop', 'japanese pop',
  ],
};

const _invertedIndex = new Map();
for (const [cluster, substrings] of Object.entries(CLUSTER_MAP)) {
  for (const sub of substrings) {
    if (!_invertedIndex.has(sub)) _invertedIndex.set(sub, []);
    _invertedIndex.get(sub).push(cluster);
  }
}

function genreToClusters(rawGenre) {
  const g = rawGenre.toLowerCase().trim();
  const matched = new Set();
  for (const [sub, clusters] of _invertedIndex.entries()) {
    if (g.includes(sub)) clusters.forEach(c => matched.add(c));
  }
  return [...matched];
}

function genresToClusters(rawGenres) {
  return [...new Set(rawGenres.flatMap(genreToClusters))];
}

function genreMatchScore(trackClusters, targetClusters) {
  if (!targetClusters?.length || !trackClusters?.length) return 0;
  const trackSet = new Set(trackClusters);
  const matches = targetClusters.filter(c => trackSet.has(c)).length;
  return matches / targetClusters.length;
}

module.exports = { genreToClusters, genresToClusters, genreMatchScore, CLUSTER_MAP };
