// Controllers for OAuth routes
const spotifyService = require('../services/spotifyService');

const login = async (req, res, next) => {
  try {
    const scope = 'playlist-read-private playlist-modify-private playlist-modify-public';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.SPOTIFY_CLIENT_ID,
      scope: scope,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    });
    
    res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
  } catch (error) {
    next(error);
  }
};

const callback = async (req, res, next) => {
  try {
    const code = req.query.code || null;
    if (!code) {
      return res.status(400).json({ error: 'Code not provided' });
    }
    
    const tokenData = await spotifyService.getSpotifyToken(code);
    res.json(tokenData);
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token not provided' });
    }
    
    const tokenData = await spotifyService.refreshSpotifyToken(refresh_token);
    res.json(tokenData);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  callback,
  refresh
};
