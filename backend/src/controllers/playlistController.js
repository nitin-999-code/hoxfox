const spotifyService = require("../services/spotifyService");

const extractToken = (req) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    throw new Error("Missing token");
  }
  return token;
};

const extractRefreshToken = (req) => {
  return req.headers['x-refresh-token'] || null;
};

exports.getPlaylists = async (req, res) => {
  try {
    const token = extractToken(req);
    const refreshToken = extractRefreshToken(req);

    const playlists = await spotifyService.getUserPlaylists(token, refreshToken);
    res.json(playlists);
  } catch (error) {
    console.error("Spotify API error:", error.response?.data || error.message);
    if (error.message === "Missing token") {
      return res.status(401).json({ error: "Missing token" });
    }
    res.status(500).json({ error: "Failed to fetch playlists" });
  }
};

exports.getPlaylistTracks = async (req, res) => {
  try {
    const token = extractToken(req);
    const refreshToken = extractRefreshToken(req);
    const playlistId = req.params.id;

    console.log("Controller: fetching tracks for", playlistId);

    const tracks = await spotifyService.getPlaylistTracks(playlistId, token, refreshToken);

    console.log("Controller: returning", tracks.length, "tracks");

    res.json(tracks);
  } catch (error) {
    console.error("Spotify API error:", error.response?.data || error.message);
    if (error.message === "Missing token") {
      return res.status(401).json({ error: "Missing token" });
    }
    res.status(500).json({ error: "Failed to fetch tracks" });
  }
};

exports.getAudioFeatures = async (req, res) => {
  try {
    const token = extractToken(req);
    const refreshToken = extractRefreshToken(req);
    
    const { trackIds } = req.body;
    if (!trackIds || !Array.isArray(trackIds)) {
      return res.status(400).json({ error: 'trackIds array is required' });
    }

    const data = await spotifyService.getAudioFeatures(trackIds, token, refreshToken);
    res.json(data);
  } catch (error) {
    console.error("Spotify API error:", error.response?.data || error.message);
    if (error.message === "Missing token") {
      return res.status(401).json({ error: "Missing token" });
    }
    res.status(500).json({ error: 'Failed to fetch audio features' });
  }
};

exports.createPlaylist = async (req, res) => {
  try {
    const token = extractToken(req);
    const refreshToken = extractRefreshToken(req);

    const { userId, name } = req.body;
    if (!userId || !name) {
      return res.status(400).json({ error: 'userId and name are required' });
    }

    const data = await spotifyService.createPlaylist(userId, name, token, refreshToken);
    res.json(data);
  } catch (error) {
    console.error("Spotify API error:", error.response?.data || error.message);
    if (error.message === "Missing token") {
      return res.status(401).json({ error: "Missing token" });
    }
    res.status(500).json({ error: 'Failed to create playlist' });
  }
};

exports.addTracksToPlaylist = async (req, res) => {
  try {
    const token = extractToken(req);
    const refreshToken = extractRefreshToken(req);

    const { playlistId, uris } = req.body;
    if (!playlistId || !uris || !Array.isArray(uris)) {
      return res.status(400).json({ error: 'playlistId and uris array are required' });
    }

    const data = await spotifyService.addTracksToPlaylist(playlistId, uris, token, refreshToken);
    res.json(data);
  } catch (error) {
    console.error("Spotify API error:", error.response?.data || error.message);
    if (error.message === "Missing token") {
      return res.status(401).json({ error: "Missing token" });
    }
    res.status(500).json({ error: 'Failed to add tracks to playlist' });
  }
};
