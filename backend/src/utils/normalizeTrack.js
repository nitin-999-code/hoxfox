/**
 * normalizeTrack.js
 * Transforms a raw Spotify track + genre data → canonical NormalizedTrack.
 *
 * NormalizedTrack shape:
 * {
 *   id, uri, name, nameLower,
 *   artists, artistsLower, artistIds,
 *   genres, clusters,
 *   moodTags,      ← Last.fm tags, populated by controller after fetch
 *   popularity, durationMs,
 *   album: { name, imageUrl }
 * }
 */

const { genresToClusters } = require('./genreClusters');

function normalizeTrack(rawTrack, genres = []) {
  if (!rawTrack || !rawTrack.id) return null;

  const artistNames   = (rawTrack.artists || []).map(a => a.name).filter(Boolean);
  const artistIds     = (rawTrack.artists || []).map(a => a.id).filter(Boolean);
  const dedupedGenres = [...new Set(genres)];
  const clusters      = genresToClusters(dedupedGenres);

  const album    = rawTrack.album || {};
  const imageUrl = (album.images || [])[0]?.url || null;

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
    moodTags:     [],   // populated by playlistController after Last.fm fetch
    popularity:   typeof rawTrack.popularity === 'number' ? rawTrack.popularity : 0,
    durationMs:   rawTrack.duration_ms || 0,
    album: {
      name:       album.name || null,
      imageUrl,
    },
  };
}

function normalizeTracks(rawTracks, artistGenreMap = {}) {
  const normalized = [];
  for (const raw of rawTracks) {
    const track = raw.track || raw;
    if (!track || !track.id) continue;

    const trackArtistIds = (track.artists || []).map(a => a.id).filter(Boolean);
    const genres = [...new Set(trackArtistIds.flatMap(id => artistGenreMap[id] || []))];

    const nt = normalizeTrack(track, genres);
    if (nt) normalized.push(nt);
  }
  return normalized;
}

module.exports = { normalizeTrack, normalizeTracks };
