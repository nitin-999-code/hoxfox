/**
 * synonyms.js
 * Maps a root keyword → array of related terms.
 * Used during intent parsing to expand keywords before scoring.
 */

const SYNONYM_MAP = {
  // Mood / energy
  sleep:       ['sleep', 'night', 'calm', 'relax', 'peaceful', 'soft', 'quiet', 'dreamy', 'lullaby'],
  relax:       ['relax', 'chill', 'easy', 'mellow', 'smooth', 'soothing', 'gentle', 'tranquil'],
  chill:       ['chill', 'relax', 'mellow', 'laid back', 'lo-fi', 'lofi', 'slow', 'easy'],
  happy:       ['happy', 'joy', 'upbeat', 'cheerful', 'positive', 'bright', 'good vibes', 'feel good'],
  sad:         ['sad', 'heartbreak', 'cry', 'melancholy', 'depressed', 'breakup', 'emotional', 'grief', 'lonely'],
  dark:        ['dark', 'gloomy', 'moody', 'ominous', 'brooding', 'mysterious', 'deep'],
  angry:       ['angry', 'aggressive', 'intense', 'rage', 'furious', 'loud', 'heavy'],
  romantic:    ['romantic', 'love', 'passion', 'intimate', 'sensual', 'sweet', 'tender'],
  nostalgic:   ['nostalgic', 'throwback', 'classic', 'retro', 'old school', 'vintage', 'memories'],

  // Activity
  workout:     ['workout', 'gym', 'exercise', 'run', 'running', 'pump up', 'beast mode', 'training', 'sweat'],
  party:       ['party', 'dance', 'club', 'night out', 'banger', 'hype', 'rave', 'festival'],
  study:       ['study', 'focus', 'concentration', 'reading', 'background', 'work', 'productive', 'homework'],
  drive:       ['drive', 'road trip', 'cruising', 'car', 'highway', 'commute', 'night drive'],
  morning:     ['morning', 'wake up', 'sunrise', 'fresh', 'energize', 'start the day', 'coffee'],
  meditation:  ['meditation', 'mindful', 'zen', 'breathe', 'peaceful', 'stillness', 'focus'],

  // Time of day
  night:       ['night', 'midnight', 'late night', 'evening', 'after dark', 'nighttime'],
  morning2:    ['morning', 'early', 'dawn', 'sunrise', 'am'],

  // Sound character
  acoustic:    ['acoustic', 'unplugged', 'raw', 'stripped', 'live', 'guitar'],
  instrumental:['instrumental', 'no vocals', 'ambient', 'orchestral', 'classical', 'soundtrack'],
  bass:        ['bass', 'bassy', 'low end', 'heavy bass', 'sub bass', 'bass boosted'],
  loud:        ['loud', 'heavy', 'hard', 'intense', 'powerful', 'aggressive', 'electric'],

  // Genre-adjacent keywords
  hiphop:      ['rap', 'hip hop', 'hiphop', 'trap', 'bars', 'flow', 'beats', 'drill'],
  pop:         ['pop', 'mainstream', 'chart', 'hit', 'catchy', 'radio'],
  rock:        ['rock', 'guitar', 'band', 'electric', 'alternative', 'indie rock', 'grunge'],
  jazz:        ['jazz', 'blues', 'swing', 'bebop', 'improvisation', 'saxophone', 'trumpet'],
  electronic:  ['electronic', 'edm', 'synth', 'techno', 'house', 'trance', 'beats', 'rave'],
  rnb:         ['rnb', 'r&b', 'soul', 'funk', 'groove', 'smooth', 'neo soul'],
  latin:       ['latin', 'salsa', 'reggaeton', 'bachata', 'cumbia', 'afrobeats'],
  country:     ['country', 'western', 'folk', 'bluegrass', 'americana', 'twang'],
  metal:       ['metal', 'heavy metal', 'hard rock', 'screamo', 'death metal', 'thrash'],
  classical:   ['classical', 'orchestra', 'symphony', 'piano', 'violin', 'baroque', 'opera'],
};

/**
 * Expand a single keyword using the synonym map.
 * Falls back to returning the keyword itself in an array if no mapping found.
 * @param {string} keyword
 * @returns {string[]}
 */
function expandKeyword(keyword) {
  const kw = keyword.toLowerCase().trim();

  // Direct map hit
  if (SYNONYM_MAP[kw]) return SYNONYM_MAP[kw];

  // Partial match: find first key that contains the keyword or vice-versa
  for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
    if (key.includes(kw) || kw.includes(key)) return synonyms;
  }

  // No match — return the keyword itself
  return [kw];
}

/**
 * Expand a list of keywords, flatten and deduplicate.
 * @param {string[]} keywords
 * @returns {string[]}
 */
function expandKeywords(keywords) {
  const expanded = keywords.flatMap(expandKeyword);
  return [...new Set(expanded)];
}

module.exports = { expandKeyword, expandKeywords, SYNONYM_MAP };
