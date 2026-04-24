const querystring = require('querystring');
const authService = require('../services/authService');

const login = async (req, res) => {
  try {
    const scope = 'user-read-private user-read-email playlist-read-private playlist-modify-public playlist-modify-private';
    
    const query = querystring.stringify({
      response_type: 'code',
      client_id: process.env.SPOTIFY_CLIENT_ID,
      scope: scope,
      redirect_uri: process.env.REDIRECT_URI
    });

    res.redirect(`https://accounts.spotify.com/authorize?${query}`);
  } catch (error) {
    res.status(500).json({ error: 'Failed to initiate login' });
  }
};

const callback = async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const tokenData = await authService.exchangeCodeForToken(code);
    res.status(200).json(tokenData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to exchange code for token' });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const tokenData = await authService.refreshAccessToken(refreshToken);
    res.status(200).json(tokenData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh token' });
  }
};

module.exports = {
  login,
  callback,
  refreshToken
};
