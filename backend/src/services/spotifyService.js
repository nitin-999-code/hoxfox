const axios = require("axios");
const { refreshAccessToken } = require("./authService");

const BASE_URL = "https://api.spotify.com/v1";

async function safeSpotifyRequest(requestFn, token, refreshToken) {
  try {
    return await requestFn(token);
  } catch (error) {
    if (error.response?.status === 401) {
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
      return response.data.items;
    },
    token,
    refreshToken
  );
}

async function getPlaylistTracks(playlistId, accessToken) {
  try {
    console.log("Fetching tracks for playlist:", playlistId);

    const response = await axios.get(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Tracks fetched:", response.data.items.length);

    return response.data.items;
  } catch (error) {
    console.error("Spotify API error:", error.response?.data);
    throw error;
  }
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
