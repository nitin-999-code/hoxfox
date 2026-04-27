/**
 * spotifyService.js
 * All communication with the Spotify Web API.
 *
 * Allowed endpoints (per spec — audio-features is EXCLUDED, it causes 403):
 *   GET /me/playlists
 *   GET /playlists/:id/tracks  (paginated — NOT the full playlist object)
 *   GET /artists?ids=…         (batch up to 50 per request)
 *   POST /users/:uid/playlists
 *   POST /playlists/:id/tracks
 *
 * Features:
 *   - Automatic token refresh on 401
 *   - In-memory LRU cache for artist → genres (survives across requests)
 *   - Artist genre batching (50 per request, Spotify limit)
 */

const axios = require('axios');
const { refreshAccessToken } = require('./authService');

const BASE_URL = 'https://api.spotify.com/v1';

// ── Simple in-memory LRU cache ─────────────────────────────────────────────
const CACHE_MAX = 2000; // store up to 2000 artists
const _artistCache = new Map();

function _cacheGet(artistId) {
  if (!_artistCache.has(artistId)) return null;
  // LRU: move to end on access
  const val = _artistCache.get(artistId);
  _artistCache.delete(artistId);
  _artistCache.set(artistId, val);
  return val;
}

function _cacheSet(artistId, genres) {
  if (_artistCache.size >= CACHE_MAX) {
    // Evict oldest entry (first key)
    const firstKey = _artistCache.keys().next().value;
    _artistCache.delete(firstKey);
  }
  _artistCache.set(artistId, genres);
}

// ── Token-refresh wrapper ──────────────────────────────────────────────────
async function safeSpotifyRequest(requestFn, token, refreshToken) {
  try {
    return await requestFn(token);
  } catch (error) {
    if (error.response?.status === 401 && refreshToken) {
      console.log('[spotify] Access token expired — refreshing...');
      const newToken = await refreshAccessToken(refreshToken);
      return await requestFn(newToken);
    }
    throw error;
  }
}

// ── User playlists ─────────────────────────────────────────────────────────
async function getUserPlaylists(token, refreshToken) {
  return safeSpotifyRequest(
    async accessToken => {
      const response = await axios.get(`${BASE_URL}/me/playlists`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return response.data.items;
    },
    token,
    refreshToken
  );
}

// ── Playlist tracks (with full pagination) ─────────────────────────────────
async function getPlaylistTracks(playlistId, accessToken, refreshToken) {
  return safeSpotifyRequest(
    async token => {
      console.log('[spotify] Fetching tracks for playlist:', playlistId);

      let pagingObj;

      try {
        console.log('[spotify] Trying GET /playlists/{id}/items');
        const tracksRes = await axios.get(`${BASE_URL}/playlists/${playlistId}/items`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        pagingObj = tracksRes.data;
      } catch (err) {
        if (err.response?.status === 403) {
          console.warn('[spotify] /items endpoint returned 403. Falling back to /playlists/{id}');
          const fallbackRes = await axios.get(`${BASE_URL}/playlists/${playlistId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          pagingObj = fallbackRes.data.tracks || fallbackRes.data.items;
        } else {
          throw err;
        }
      }

      if (!pagingObj || typeof pagingObj !== 'object') return [];

      let allRawItems = Array.isArray(pagingObj.items) ? [...pagingObj.items] : [];
      let nextUrl = pagingObj.next;

      while (nextUrl) {
        try {
          const nextRes = await axios.get(nextUrl, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const nextItems = nextRes.data.items || [];
          allRawItems = allRawItems.concat(nextItems);
          nextUrl = nextRes.data.next;
        } catch (pageErr) {
          console.warn('[spotify] Pagination fetch failed:', pageErr.response?.status);
          break;
        }
      }

      console.log(`[spotify] Fetched ${allRawItems.length} raw items from playlist`);

      const tracks = allRawItems
        .filter(entry => entry !== null && entry !== undefined)
        .map(entry => {
          if (entry && entry.track) return entry;
          if (entry && entry.item) return { track: entry.item };
          return { track: entry };
        })
        .filter(entry => entry.track !== null);

      console.log(`[spotify] ${tracks.length} valid (non-null) tracks after filtering`);
      return tracks;
    },
    accessToken,
    refreshToken
  );
}

// ── Artist genre fetch — batched + cached ─────────────────────────────────
/**
 * Fetch genres for a list of artist IDs.
 * - Checks in-memory cache first (avoids redundant API calls)
 * - Batches remaining IDs in groups of 50 (Spotify limit)
 * - Returns { [artistId]: string[] }
 *
 * @param {string[]} artistIds
 * @param {string}   token
 * @param {string}   refreshToken
 * @returns {Promise<{ [artistId]: string[] }>}
 */
async function getArtistGenresBatched(artistIds, token, refreshToken) {
  const unique = [...new Set(artistIds.filter(Boolean))];
  const result = {};
  const uncached = [];

  // Serve from cache where possible
  for (const id of unique) {
    const cached = _cacheGet(id);
    if (cached !== null) {
      result[id] = cached;
    } else {
      uncached.push(id);
    }
  }

  if (uncached.length === 0) {
    console.log('[spotify] All artist genres served from cache');
    return result;
  }

  console.log(`[spotify] Fetching genres for ${uncached.length} artists (${unique.length - uncached.length} cached)`);

  // Batch in groups of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);
    try {
      const data = await safeSpotifyRequest(
        async tkn => {
          const res = await axios.get(`${BASE_URL}/artists`, {
            params: { ids: batch.join(',') },
            headers: { Authorization: `Bearer ${tkn}` },
          });
          return res.data;
        },
        token,
        refreshToken
      );

      const artists = data.artists || [];
      for (const artist of artists) {
        if (!artist) continue;
        const genres = artist.genres || [];
        result[artist.id] = genres;
        _cacheSet(artist.id, genres);
      }
    } catch (err) {
      console.warn(`[spotify] Artist batch ${i}–${i + BATCH_SIZE} failed:`, err.response?.status, err.message);
      // Mark as empty so we don't retry on this run
      for (const id of batch) {
        if (!result[id]) result[id] = [];
      }
    }
  }

  return result;
}

// ── Create playlist ────────────────────────────────────────────────────────
async function createPlaylist(userId, name, token, refreshToken) {
  return safeSpotifyRequest(
    async accessToken => {
      const response = await axios.post(
        `${BASE_URL}/users/${userId}/playlists`,
        { name, public: false },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return response.data;
    },
    token,
    refreshToken
  );
}

// ── Add tracks to playlist ─────────────────────────────────────────────────
async function addTracksToPlaylist(playlistId, uris, token, refreshToken) {
  return safeSpotifyRequest(
    async accessToken => {
      const response = await axios.post(
        `${BASE_URL}/playlists/${playlistId}/tracks`,
        { uris },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return response.data;
    },
    token,
    refreshToken
  );
}

module.exports = {
  safeSpotifyRequest,
  getUserPlaylists,
  getPlaylistTracks,
  getArtistGenresBatched,
  createPlaylist,
  addTracksToPlaylist,
};
