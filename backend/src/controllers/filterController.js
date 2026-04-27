// filterController.js
const spotifyService      = require('../services/spotifyService');
const lastfmService       = require('../services/lastfmService');
const intentParser        = require('../services/intentParserService');
const filterEngine        = require('../services/filterEngineService');
const { normalizeTracks } = require('../utils/normalizeTrack');

const filterPlaylist = async (req, res, next) => {
  try {
    const { playlistId, userQuery } = req.body;
    if (!playlistId || !userQuery)
      return res.status(400).json({ error: 'playlistId and userQuery are required' });

    const token = req.headers.authorization?.split(' ')[1];
    if (!token)
      return res.status(401).json({ error: 'Authorization header missing' });

    const intent = await intentParser.parseIntent(userQuery);
    console.log('[filter] intent:', intent);

    const rawTracks = await spotifyService.getPlaylistTracks(playlistId, token, null);

    const artistIds = [...new Set(
      rawTracks.flatMap(t => t.track?.artists?.map(a => a.id) || [])
    )].filter(Boolean);

    const artistGenreMap = await spotifyService.getArtistGenresBatched(artistIds, token, null);

    const normalizedTracks = normalizeTracks(rawTracks, artistGenreMap);

    const seen = new Set();
    const dedupedTracks = normalizedTracks.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    const mappedForLastfm = dedupedTracks.map(t => ({
      id:         t.id,
      trackName:  t.name,
      artistName: t.artists[0] || 'Unknown',
    }));
    const moodTagsMap = await lastfmService.getTrackTagsBatch(mappedForLastfm);

    dedupedTracks.forEach(t => {
      t.moodTags = moodTagsMap[t.id] || [];
    });

    const { tracks: scored, totalConsidered, relaxed } = filterEngine.filterTracks(
      dedupedTracks,
      intent
    );

    const matchingTrackIds = scored.map(s => s.track.id);

    if (matchingTrackIds.length === 0) {
      return res.json({
        matchingTrackIds: [],
        meta: {
          intent,
          totalConsidered,
          matched: 0,
          relaxed,
          message: `No "${intent.label}" songs found in this playlist. Try a different mood or genre.`,
        },
      });
    }

    res.json({
      matchingTrackIds,
      meta: { intent, totalConsidered, matched: matchingTrackIds.length, relaxed },
    });

  } catch (error) {
    next(error);
  }
};

// kept so the /debug route doesn't break
const debugFilter = async (req, res, next) => {
  try {
    const { playlistId } = req.body;
    if (!playlistId)
      return res.status(400).json({ error: 'playlistId is required' });

    const token = req.headers.authorization?.split(' ')[1];
    if (!token)
      return res.status(401).json({ error: 'Authorization header missing' });

    const rawTracks = await spotifyService.getPlaylistTracks(playlistId, token, null);

    const artistIds = [...new Set(
      rawTracks.flatMap(t => t.track?.artists?.map(a => a.id) || [])
    )].filter(Boolean);

    const artistGenreMap = await spotifyService.getArtistGenresBatched(artistIds, token, null);
    const normalizedTracks = normalizeTracks(rawTracks, artistGenreMap);

    const mappedForLastfm = normalizedTracks.map(t => ({
      id: t.id, trackName: t.name, artistName: t.artists[0] || 'Unknown',
    }));
    const moodTagsMap = await lastfmService.getTrackTagsBatch(mappedForLastfm);
    normalizedTracks.forEach(t => { t.moodTags = moodTagsMap[t.id] || []; });

    res.json({
      totalTracks: normalizedTracks.length,
      tracks: normalizedTracks.map(t => ({
        id: t.id, name: t.name, artists: t.artists,
        genres: t.genres, clusters: t.clusters, moodTags: t.moodTags,
      })),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  filterPlaylist,
  debugFilter,
};