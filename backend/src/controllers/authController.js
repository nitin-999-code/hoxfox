const querystring = require('querystring');
const authService = require('../services/authService');
const axios = require('axios');

const login = async (req, res) => {
  try {
    const scope = [
      "playlist-read-private",
      "playlist-read-collaborative",
      "playlist-modify-private",
      "playlist-modify-public",
      "user-read-private",
      "user-read-email"
    ].join(" ");

    console.log("Using Spotify scopes:", scope);
    
    const authUrl = "https://accounts.spotify.com/authorize?" + new URLSearchParams({
      response_type: "code",
      client_id: process.env.SPOTIFY_CLIENT_ID,
      scope,
      redirect_uri: process.env.REDIRECT_URI
    });

    res.redirect(authUrl);
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

    const tokenResponse = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.REDIRECT_URI,
        client_id: process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    const {
      access_token,
      refresh_token,
      expires_in
    } = tokenResponse.data;

    res.json({
      access_token,
      refresh_token,
      expires_in
    });
  } catch (error) {
    console.error("Callback error:", error.response?.data || error.message);
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
    res.status(200).json({ access_token: tokenData });
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh token' });
  }
};

module.exports = {
  login,
  callback,
  refreshToken
};
