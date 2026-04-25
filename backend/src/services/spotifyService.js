const axios = require("axios");
const { refreshAccessToken } = require("./authService");

const BASE_URL = "https://api.spotify.com/v1";

async function safeSpotifyRequest(requestFn, token, refreshToken) {
  try {
    return await requestFn(token);
  } catch (error) {
    if (error.response?.status === 401 && refreshToken) {
      console.log("Access token expired — refreshing...");
      const newToken = await refreshAccessToken(refreshToken);
      return await requestFn(newToken);
    }
    throw error;
  }
}

async function getUserPlaylists(token, refreshToken) {
  return safeSpotifyRequest(
    async accessToken => {
      const response = await axios.get(
        `${BASE_URL}/me/playlists`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      const items = response.data.items;

      // Debug: log raw keys of first playlist to understand structure
      if (items && items.length > 0) {
        console.log("Playlist[0] keys:", Object.keys(items[0]));
        console.log("Playlist[0].tracks:", items[0].tracks);
        console.log("Playlist[0].name:", items[0].name);
      }

      return items;
    },
    token,
    refreshToken
  );
}

async function getPlaylistTracks(playlistId, accessToken, refreshToken) {
  return safeSpotifyRequest(
    async token => {
      console.log("Fetching tracks for playlist:", playlistId);

      // Step 1: Get the playlist object
      const response = await axios.get(
        `${BASE_URL}/playlists/${playlistId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      const data = response.data;

      // Find the paging object (standard: data.tracks, dev mode: data.items)
      const pagingObj = data.tracks || data.items;
      if (!pagingObj || typeof pagingObj !== 'object') {
        console.log("No paging object found in response");
        return [];
      }

      // Collect all items across pages
      let allRawItems = Array.isArray(pagingObj.items) ? [...pagingObj.items] : [];
      let nextUrl = pagingObj.next;
      const total = pagingObj.total || allRawItems.length;

      console.log(`First page: ${allRawItems.length} items, total: ${total}, has next: ${!!nextUrl}`);

      // Follow pagination to get ALL tracks
      while (nextUrl) {
        try {
          const nextResponse = await axios.get(nextUrl, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const nextItems = nextResponse.data.items || [];
          allRawItems = allRawItems.concat(nextItems);
          nextUrl = nextResponse.data.next;
          console.log(`Fetched page: +${nextItems.length} items (total so far: ${allRawItems.length})`);
        } catch (pageErr) {
          console.log("Pagination fetch failed:", pageErr.response?.status);
          break;
        }
      }

      console.log("All raw items collected:", allRawItems.length);

      // Normalize: map entry.item (Dev Mode) or entry.track (Standard) to { track: {...} }
      const tracks = allRawItems.map(entry => {
        if (entry.track) return entry;
        if (entry.item) return { track: entry.item };
        return { track: entry };
      });

      console.log("Returning", tracks.length, "normalized tracks");
      return tracks;
    },
    accessToken,
    refreshToken
  );
}

const getAudioFeatures = async (trackIds, token, refreshToken) => {
  return safeSpotifyRequest(
    async accessToken => {
      const ids = trackIds.join(',');
      const response = await axios.get(`${BASE_URL}/audio-features?ids=${ids}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return response.data;
    },
    token,
    refreshToken
  );
};

const createPlaylist = async (userId, name, token, refreshToken) => {
  return safeSpotifyRequest(
    async accessToken => {
      const response = await axios.post(`${BASE_URL}/users/${userId}/playlists`, {
        name: name
      }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return response.data;
    },
    token,
    refreshToken
  );
};

const addTracksToPlaylist = async (playlistId, uris, token, refreshToken) => {
  return safeSpotifyRequest(
    async accessToken => {
      const response = await axios.post(`${BASE_URL}/playlists/${playlistId}/tracks`, {
        uris: uris
      }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return response.data;
    },
    token,
    refreshToken
  );
};

module.exports = {
  getUserPlaylists,
  getPlaylistTracks,
  getAudioFeatures,
  createPlaylist,
  addTracksToPlaylist
};
