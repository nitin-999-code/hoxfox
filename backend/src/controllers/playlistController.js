/**
 * playlistController.js
 *
 * filterPlaylist pipeline:
 *   1. Fetch playlist tracks (paginated)
 *   2. Batch-fetch Spotify artist genres (50/req, cached)
 *   3. Normalize tracks → NormalizedTrack[]
 *   4. Fetch Last.fm mood tags (rate-limited, enriches each track.moodTags)
 *   5. Parse user intent → { keywords, targetGenres, language, artist, label }
 *   6. Score, rank, diversity filter, fallback
 *   7. (Optional) create new Spotify playlist with filtered tracks
 *   8. Return
 */

const spotifyService  = require('../services/spotifyService');
const lastfmService   = require('../services/lastfmService');
const { parseIntent } = require('../services/intentParserService');
const { filterTracks } = require('../services/filterEngineService');
const { normalizeTracks } = require('../utils/normalizeTrack');

const extractToken        = req => { const t = req.headers.authorization?.split(' ')[1]; if (!t) throw new Error('Missing token'); return t; };
const extractRefreshToken = req => req.headers['x-refresh-token'] || null;

// ─────────────────────────────────────────────────────────────────────────────
// GET /playlists
// ─────────────────────────────────────────────────────────────────────────────
exports.getPlaylists = async (req, res) => {
  try {
    const token        = extractToken(req);
    const refreshToken = extractRefreshToken(req);
    const playlists    = await spotifyService.getUserPlaylists(token, refreshToken);
    res.json(playlists);
  } catch (err) {
    console.error('[getPlaylists]', err.response?.data || err.message);
    if (err.message === 'Missing token') return res.status(401).json({ error: 'Missing token' });
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /playlists/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.getPlaylistTracks = async (req, res) => {
  try {
    const token        = extractToken(req);
    const refreshToken = extractRefreshToken(req);
    const tracks       = await spotifyService.getPlaylistTracks(req.params.id, token, refreshToken);
    res.json(tracks);
  } catch (err) {
    console.error('[getPlaylistTracks]', err.response?.data || err.message);
    if (err.message === 'Missing token') return res.status(401).json({ error: 'Missing token' });
    res.status(500).json({ error: 'Failed to fetch tracks: ' + (err.response?.data?.error?.message || err.message) });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /playlists/create
// ─────────────────────────────────────────────────────────────────────────────
exports.createPlaylist = async (req, res) => {
  try {
    const token        = extractToken(req);
    const refreshToken = extractRefreshToken(req);
    const { userId, name } = req.body;
    if (!userId || !name) return res.status(400).json({ error: 'userId and name are required' });
    const data = await spotifyService.createPlaylist(userId, name, token, refreshToken);
    res.json(data);
  } catch (err) {
    console.error('[createPlaylist]', err.response?.data || err.message);
    if (err.message === 'Missing token') return res.status(401).json({ error: 'Missing token' });
    res.status(500).json({ error: 'Failed to create playlist' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /playlists/add-tracks
// ─────────────────────────────────────────────────────────────────────────────
exports.addTracksToPlaylist = async (req, res) => {
  try {
    const token        = extractToken(req);
    const refreshToken = extractRefreshToken(req);
    const { playlistId, uris } = req.body;
    if (!playlistId || !uris || !Array.isArray(uris)) {
      return res.status(400).json({ error: 'playlistId and uris array are required' });
    }
    const data = await spotifyService.addTracksToPlaylist(playlistId, uris, token, refreshToken);
    res.json(data);
  } catch (err) {
    console.error('[addTracksToPlaylist]', err.response?.data || err.message);
    if (err.message === 'Missing token') return res.status(401).json({ error: 'Missing token' });
    res.status(500).json({ error: 'Failed to add tracks to playlist' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /playlists/filter  ← MAIN ENDPOINT
// Body: { playlistId, query, topN?, maxPerArtist?, userId?, createNewPlaylist? }
// ─────────────────────────────────────────────────────────────────────────────
exports.filterPlaylist = async (req, res) => {
  try {
    const token        = extractToken(req);
    const refreshToken = extractRefreshToken(req);
    const {
      playlistId,
      query,
      topN             = 30,
      maxPerArtist     = 3,
      userId,
      createNewPlaylist = false,
    } = req.body;

    if (!playlistId || !query) {
      return res.status(400).json({ error: 'playlistId and query are required' });
    }

    console.log(`[filter] playlist=${playlistId} query="${query}"`);

    // ── Step 1: Fetch tracks ────────────────────────────────────────────────
    const rawItems  = await spotifyService.getPlaylistTracks(playlistId, token, refreshToken);
    const rawTracks = rawItems
      .map(item => item.track || item)
      .filter(t => t && t.id && t.id !== 'local');

    if (rawTracks.length === 0) {
      return res.status(404).json({ error: 'Playlist is empty or has no playable tracks' });
    }
    console.log(`[filter] ${rawTracks.length} raw tracks`);

    // ── Step 2: Artist genres ───────────────────────────────────────────────
    const allArtistIds = [...new Set(
      rawTracks.flatMap(t => (t.artists || []).map(a => a.id).filter(Boolean))
    )];

    const artistGenreMap = await spotifyService.getArtistGenresBatched(allArtistIds, token, refreshToken);
    const covered = Object.values(artistGenreMap).filter(g => g.length > 0).length;
    console.log(`[filter] genres for ${covered}/${allArtistIds.length} artists`);

    // ── Step 3: Normalize ───────────────────────────────────────────────────
    const normalized = normalizeTracks(rawItems, artistGenreMap);

    // Deduplicate by track ID
    const seen = new Set();
    const unique = normalized.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
    console.log(`[filter] ${unique.length} unique normalized tracks`);

    // ── Step 4: Last.fm mood tags ───────────────────────────────────────────
    const forLastfm = unique.map(t => ({
      id:         t.id,
      trackName:  t.name,
      artistName: t.artists[0] || 'Unknown',
    }));

    const moodTagsMap = await lastfmService.getTrackTagsBatch(forLastfm);

    // Attach mood tags to each normalized track (mutates a copy)
    const enriched = unique.map(t => ({ ...t, moodTags: moodTagsMap[t.id] || [] }));

    const tracksWithTags = enriched.filter(t => t.moodTags.length > 0).length;
    console.log(`[filter] ${tracksWithTags}/${enriched.length} tracks enriched with mood tags`);

    // ── Step 5: Parse intent ────────────────────────────────────────────────
    const intent = await parseIntent(query);
    console.log(`[filter] intent="${intent.label}" source=${intent.source} genres=[${intent.targetGenres}] lang=${intent.language}`);

    // ── Step 6: Score, rank, diversity ─────────────────────────────────────
    const result = filterTracks(enriched, intent, { topN, maxPerArtist });
    console.log(`[filter] ${result.tracks.length} tracks selected (relaxed=${result.relaxed})`);

    // ── Step 7 (optional): Create new playlist ──────────────────────────────
    let newPlaylistId = null;
    if (createNewPlaylist && userId) {
      const name  = `${intent.label} — hoxfox`;
      const newPl = await spotifyService.createPlaylist(userId, name, token, refreshToken);
      newPlaylistId = newPl.id;

      const uris = result.tracks.map(s => s.track.uri).filter(Boolean);
      for (let i = 0; i < uris.length; i += 100) {
        await spotifyService.addTracksToPlaylist(newPlaylistId, uris.slice(i, i + 100), token, refreshToken);
      }
      console.log(`[filter] created new playlist: ${newPlaylistId}`);
    }

    // ── Step 8: Respond ─────────────────────────────────────────────────────
    return res.json({
      label:           intent.label,
      intentSource:    intent.source,
      intent: {
        keywords:     intent.keywords,
        targetGenres: intent.targetGenres,
        language:     intent.language,
        artist:       intent.artist,
      },
      totalConsidered: result.totalConsidered,
      totalReturned:   result.tracks.length,
      relaxed:         result.relaxed,
      newPlaylistId,
      tracks: result.tracks.map(s => ({
        id:             s.track.id,
        uri:            s.track.uri,
        name:           s.track.name,
        artists:        s.track.artists,
        genres:         s.track.genres,
        clusters:       s.track.clusters,
        moodTags:       s.track.moodTags,
        popularity:     s.track.popularity,
        durationMs:     s.track.durationMs,
        album:          s.track.album,
        score:          Math.round(s.score),
        matchReasons:   s.matchReasons,
        scoreBreakdown: s.components,
      })),
    });

  } catch (err) {
    console.error('[filterPlaylist] error:', err.response?.data || err.message);
    if (err.message === 'Missing token') return res.status(401).json({ error: 'Missing token' });
    res.status(500).json({ error: err.message || 'Failed to filter playlist' });
  }
};

// Kept for backwards compat — audio-features endpoint is gone from Spotify
exports.getAudioFeatures = async (req, res) => {
  res.status(410).json({ error: 'audio-features is no longer available. Use /playlists/filter.' });
};