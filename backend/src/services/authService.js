const axios = require('axios');

const exchangeCodeForToken = async (code) => {
  const data = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: process.env.REDIRECT_URI
  });

  const authHeader = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');

  const response = await axios.post('https://accounts.spotify.com/api/token', data.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authHeader}`
    }
  });

  return response.data;
};

const refreshAccessToken = async (refreshToken) => {
  const data = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  const authHeader = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');

  const response = await axios.post('https://accounts.spotify.com/api/token', data.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authHeader}`
    }
  });

  return response.data;
};

module.exports = {
  exchangeCodeForToken,
  refreshAccessToken
};
