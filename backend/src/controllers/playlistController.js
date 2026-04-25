const spotifyService = require("../services/spotifyService");

exports.getPlaylists = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const refreshToken = req.headers['x-refresh-token']; // Retrieve refresh token from headers

    if (!token) {
      return res.status(401).json({ error: "Missing token" });
    }

    const playlists = await spotifyService.getUserPlaylists(token, refreshToken);
    res.json(playlists);
  } catch (error) {
    console.error("Spotify API error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch playlists" });
  }
};

exports.getPlaylistTracks = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    const tracks = await spotifyService.getPlaylistTracks(req.params.id, token);

    res.json(tracks);
  } catch (error) {
    console.error("Spotify API error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch tracks" });
  }
};

exports.getAudioFeatures = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const refreshToken = req.headers['x-refresh-token'];
    
    if (!token) return res.status(401).json({ error: "Missing token" });
    
    const { trackIds } = req.body;
    if (!trackIds || !Array.isArray(trackIds)) {
      return res.status(400).json({ error: 'trackIds array is required' });
    }

    const data = await spotifyService.getAudioFeatures(trackIds, token, refreshToken);
    res.json(data);
  } catch (error) {
    console.error("Spotify API error:", error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch audio features' });
  }
};

exports.createPlaylist = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const refreshToken = req.headers['x-refresh-token'];
    
    if (!token) return res.status(401).json({ error: "Missing token" });

    const { userId, name } = req.body;
    if (!userId || !name) {
      return res.status(400).json({ error: 'userId and name are required' });
    }

    const data = await spotifyService.createPlaylist(userId, name, token, refreshToken);
    res.json(data);
  } catch (error) {
    console.error("Spotify API error:", error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create playlist' });
  }
};

exports.addTracksToPlaylist = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const refreshToken = req.headers['x-refresh-token'];
    
    if (!token) return res.status(401).json({ error: "Missing token" });

    const { playlistId, uris } = req.body;
    if (!playlistId || !uris || !Array.isArray(uris)) {
      return res.status(400).json({ error: 'playlistId and uris array are required' });
    }

    const data = await spotifyService.addTracksToPlaylist(playlistId, uris, token, refreshToken);
    res.json(data);
  } catch (error) {
    console.error("Spotify API error:", error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to add tracks to playlist' });
  }
};
