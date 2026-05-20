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
const crewAIService = require('../services/crewAIService');

const extractToken        = req => { const t = req.headers.authorization?.split(' ')[1]; if (!t) throw new Error('Missing token'); return t; };
const extractRefreshToken = req => req.headers['x-refresh-token'] || null;

// ─────────────────────────────────────────────────────────────────────────────
// GET /playlists
// ─────────────────────────────────────────────────────────────────────────────
exports.getPlaylists = async (req, res) => {
  try {
    const token        = extractToken(req);
    const refreshToken = extractRefreshToken(req);
    
    // Fetch user and playlists in parallel
    const [user, playlists] = await Promise.all([
      spotifyService.getCurrentUser(token, refreshToken),
      spotifyService.getUserPlaylists(token, refreshToken)
    ]);

    // Filter: Only playlists where the owner's ID matches the current user's ID
    const filteredPlaylists = playlists.filter(p => p.owner.id === user.id);
    
    res.json(filteredPlaylists);
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
// Body: { playlistId, query, topN?, maxPerArtist?, generateReport?, createNewPlaylist?, userId? }
// ─────────────────────────────────────────────────────────────────────────────
exports.filterPlaylist = async (req, res) => {
  try {
    const token = extractToken(req);
    const refreshToken = extractRefreshToken(req);
    const {
      playlistId,
      query,
      topN = 45,
      maxPerArtist = 5,
      generateReport = false,
      createNewPlaylist = false,
      userId,
    } = req.body;

    if (!playlistId || !query) {
      return res.status(400).json({ error: 'playlistId and query are required' });
    }

    console.log(`[filter] playlist=${playlistId} query="${query}"`);

    // ── Step 3: Fetch tracks ────────────────────────────────────────────────
    const rawItems = await spotifyService.getPlaylistTracks(playlistId, token, refreshToken);
    const rawTracks = rawItems
      .map(item => item.track || item)
      .filter(t => t && t.id && t.id !== 'local');

    if (rawTracks.length === 0) {
      return res.status(404).json({ error: 'Playlist is empty or has no playable tracks' });
    }

    // ── Step 4: Batch-fetch artist genres ───────────────────────────────────
    const allArtistIds = [...new Set(
      rawTracks.flatMap(t => (t.artists || []).map(a => a.id).filter(Boolean))
    )];
    const artistGenreMap = await spotifyService.getArtistGenresBatched(allArtistIds, token, refreshToken);

    // ── Step 5: Normalize ───────────────────────────────────────────────────
    const normalized = normalizeTracks(rawItems, artistGenreMap);

    // ── Step 6: Deduplicate ──────────────────────────────────────────────────
    const seen = new Set();
    const unique = normalized.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    // ── Step 7: Last.fm mood tags ───────────────────────────────────────────
    const forLastfm = unique.map(t => ({
      id: t.id,
      trackName: t.name,
      artistName: t.artists[0] || 'Unknown',
    }));
    const moodTagsMap = await lastfmService.getTrackTagsBatch(forLastfm);
    const enriched = unique.map(t => ({ ...t, moodTags: moodTagsMap[t.id] || [] }));

    // ── Step 8: Parse intent ────────────────────────────────────────────────
    const intent = await parseIntent(query);

    // ── Step 9: Adaptive pre-filter ─────────────────────────────────────────
    // Commented out all rule-based initial filtering logic
    /*
    const preFiltered = filterTracks(enriched, intent, { topN, maxPerArtist });
    console.log(`[filter] adaptive pre-filter: ${unique.length} → ${preFiltered.tracks.length} tracks`);
    */

    // ── Step 10: Call CrewAI ────────────────────────────────────────────────
    let finalTracks = [];
    let crewAIResult = null;
    let crewAIFailed = false;

    try {
      // Map all songs in the playlist to go to the AI
      const crewInputTracks = enriched.map(s => ({
        id: s.id,
        name: s.name,
        artists: s.artists,
        genres: s.genres,
        clusters: s.clusters,
        moodTags: s.moodTags,
        popularity: s.popularity,
        score: 0,
        matchReasons: []
      }));

      crewAIResult = await crewAIService.getCrewAIRecommendations({
        musicRequest: query,
        playlistTracks: crewInputTracks,
        spotifyAccessToken: token,
        generateReport
      });

      // Map CrewAI recommendations back to enriched track data
      if (crewAIResult.playlist && Array.isArray(crewAIResult.playlist)) {
        finalTracks = crewAIResult.playlist.map(item => {
          const origTrack = enriched.find(t => t.id === item.id);
          if (!origTrack) return null;
          return {
            ...origTrack,
            score: item.score,
            matchReasons: item.matchReasons
          };
        }).filter(Boolean);
      } else {
        throw new Error('CrewAI returned an empty or invalid playlist');
      }
    } catch (err) {
      console.error('[filter] CrewAI failed:', err.message);
      crewAIFailed = true;
      // Commented out rule-based fallback
      /*
      finalTracks = preFiltered.tracks.map(s => ({
        ...s.track,
        score: Math.round(s.score),
        matchReasons: s.matchReasons,
        scoreBreakdown: s.components
      }));
      */
      throw err;
    }

    // ── Step 11 (optional): Create new Spotify playlist ─────────────────────
    let newPlaylistId = null;
    if (createNewPlaylist && userId) {
      const name = `${intent.label} — hoxfox`;
      const newPl = await spotifyService.createPlaylist(userId, name, token, refreshToken);
      newPlaylistId = newPl.id;

      const uris = finalTracks.map(t => t.uri || t.track?.uri).filter(Boolean);
      for (let i = 0; i < uris.length; i += 100) {
        await spotifyService.addTracksToPlaylist(newPlaylistId, uris.slice(i, i + 100), token, refreshToken);
      }
      console.log(`[filter] created new playlist: ${newPlaylistId}`);
    }

    // ── Step 12: Respond ────────────────────────────────────────────────────
    return res.json({
      label: intent.label,
      intentSource: 'AI',
      intent: {
        keywords: intent.keywords,
        targetGenres: intent.targetGenres,
        language: intent.language,
        artist: intent.artist,
      },
      totalConsidered: rawTracks.length,
      preFilteredCount: enriched.length,
      totalReturned: finalTracks.length,
      relaxed: false,
      crewAIFailed,
      report: crewAIResult?.report || null,
      finalScore: crewAIResult?.final_score || null,
      confidenceScore: crewAIResult?.confidence_score || null,
      newPlaylistId,
      tracks: finalTracks
    });

  } catch (err) {
    console.error('[filterPlaylist] fatal error:', err.response?.data || err.message);
    if (err.message === 'Missing token') return res.status(401).json({ error: 'Missing token' });
    res.status(500).json({ error: err.message || 'Failed to filter playlist' });
  }
};

// Kept for backwards compat — audio-features endpoint is gone from Spotify
exports.getAudioFeatures = async (req, res) => {
  res.status(410).json({ error: 'audio-features is no longer available. Use /playlists/filter.' });
};