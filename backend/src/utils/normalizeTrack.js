/**
 * normalizeTrack.js
 * Transforms a raw Spotify track object + enriched genre data
 * into the canonical NormalizedTrack shape used by the filter engine.
 *
 * NormalizedTrack shape:
 * {
 *   id:         string,
 *   uri:        string,
 *   name:       string,
 *   nameLower:  string,          // pre-lowercased for fast matching
 *   artists:    string[],        // display names
 *   artistsLower: string[],      // pre-lowercased
 *   artistIds:  string[],
 *   genres:     string[],        // raw Spotify genres from artists
 *   clusters:   string[],        // mapped cluster names
 *   popularity: number,          // 0–100
 *   durationMs: number,
 *   album:      { name, imageUrl }
 * }
 */

const { genresToClusters } = require('./genreClusters');

/**
 * Normalize a single raw Spotify track + its artist genres.
 *
 * @param {object} rawTrack       - raw Spotify track object (from playlist items)
 * @param {string[]} genres       - genre strings fetched for this track's artists
 * @returns {object|null}         - NormalizedTrack or null if track is invalid
 */
function normalizeTrack(rawTrack, genres = []) {
  if (!rawTrack || !rawTrack.id) return null;

  const artistNames  = (rawTrack.artists || []).map(a => a.name).filter(Boolean);
  const artistIds    = (rawTrack.artists || []).map(a => a.id).filter(Boolean);
  const dedupedGenres = [...new Set(genres)];
  const clusters     = genresToClusters(dedupedGenres);

  const album = rawTrack.album || {};
  const images = album.images || [];
  const imageUrl = images[0]?.url || null;

  return {
    id:           rawTrack.id,
    uri:          rawTrack.uri || `spotify:track:${rawTrack.id}`,
    name:         rawTrack.name || 'Unknown Track',
    nameLower:    (rawTrack.name || '').toLowerCase(),
    artists:      artistNames,
    artistsLower: artistNames.map(a => a.toLowerCase()),
    artistIds,
    genres:       dedupedGenres,
    clusters,
    popularity:   typeof rawTrack.popularity === 'number' ? rawTrack.popularity : 0,
    durationMs:   rawTrack.duration_ms || 0,
    album: {
      name:       album.name || null,
      imageUrl,
    },
  };
}

/**
 * Normalize a batch of raw tracks.
 * artistGenreMap: { [artistId]: string[] }
 *
 * @param {object[]} rawTracks
 * @param {object}   artistGenreMap
 * @returns {object[]}
 */
function normalizeTracks(rawTracks, artistGenreMap = {}) {
  const normalized = [];

  for (const raw of rawTracks) {
    const track = raw.track || raw;
    if (!track || !track.id) continue;

    // Collect genres for all artists on this track
    const trackArtistIds = (track.artists || []).map(a => a.id).filter(Boolean);
    const genres = [...new Set(
      trackArtistIds.flatMap(id => artistGenreMap[id] || [])
    )];

    const nt = normalizeTrack(track, genres);
    if (nt) normalized.push(nt);
  }

  return normalized;
}

module.exports = { normalizeTrack, normalizeTracks };
