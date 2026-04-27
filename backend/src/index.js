// Express app entry point
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const playlistRoutes = require('./routes/playlist');
const genreRoutes = require('./routes/genres');
const filterRoutes = require('./routes/filter');

const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
app.use(express.json());
app.use(cors({
  origin: [CLIENT_URL, 'http://127.0.0.1:5173']
}));

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: "ok" });
});

// TEMPORARY DEBUG: Test Spotify API endpoints directly
const axios = require('axios');
app.get('/debug/spotify-test', async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Pass Authorization: Bearer TOKEN header" });

  const results = {};

  // Test 1: GET /me/playlists (should work)
  try {
    const r1 = await axios.get('https://api.spotify.com/v1/me/playlists?limit=1', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const firstPlaylist = r1.data.items?.[0];
    results.test1_me_playlists = {
      status: "OK",
      firstPlaylistId: firstPlaylist?.id,
      firstPlaylistName: firstPlaylist?.name,
      tracksField: firstPlaylist?.tracks,
    };

    // Test 2: GET /playlists/{id} (full playlist object)
    if (firstPlaylist?.id) {
      try {
        const r2 = await axios.get(`https://api.spotify.com/v1/playlists/${firstPlaylist.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        results.test2_playlist_full = {
          status: "OK",
          dataKeys: Object.keys(r2.data),
          tracksType: typeof r2.data.tracks,
          tracksKeys: r2.data.tracks ? Object.keys(r2.data.tracks) : null,
          tracksCount: r2.data.tracks?.items?.length,
          tracksTotal: r2.data.tracks?.total,
          firstTrackSample: r2.data.tracks?.items?.[0]?.track?.name || r2.data.tracks?.items?.[0]?.name || "NO_TRACK_DATA",
        };
      } catch (e2) {
        results.test2_playlist_full = {
          status: "FAILED",
          code: e2.response?.status,
          error: e2.response?.data,
        };
      }

      // Test 3: GET /playlists/{id}/tracks
      try {
        const r3 = await axios.get(`https://api.spotify.com/v1/playlists/${firstPlaylist.id}/tracks?limit=1`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        results.test3_playlist_tracks = {
          status: "OK",
          totalTracks: r3.data.total,
          firstTrackName: r3.data.items?.[0]?.track?.name,
        };
      } catch (e3) {
        results.test3_playlist_tracks = {
          status: "FAILED",
          code: e3.response?.status,
          error: e3.response?.data,
        };
      }
    }
  } catch (e1) {
    results.test1_me_playlists = {
      status: "FAILED",
      code: e1.response?.status,
      error: e1.response?.data,
    };
  }

  res.json(results);
});

// Routes
app.use('/auth', authRoutes);
app.use('/playlists', playlistRoutes);
app.use('/api/genres', genreRoutes);
app.use('/api/filter', filterRoutes);

// Error handling middleware should be last
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
