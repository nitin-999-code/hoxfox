// Handles raw Spotify API calls using Axios
const axios = require('axios');
const qs = require('qs');

const getSpotifyToken = async (code) => {
  const authHeader = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
  
  const response = await axios.post('https://accounts.spotify.com/api/token', 
    qs.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authHeader}`
      }
    }
  );
  return response.data;
};

const refreshSpotifyToken = async (refreshToken) => {
  const authHeader = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
  
  const response = await axios.post('https://accounts.spotify.com/api/token',
    qs.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authHeader}`
      }
    }
  );
  return response.data;
};

const getPlaylistTracks = async (token, playlistId) => {
  let tracks = [];
  let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

  while (nextUrl) {
    const response = await axios.get(nextUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    tracks = tracks.concat(response.data.items);
    nextUrl = response.data.next;
  }

  return tracks;
};

const getArtistGenres = async (token, artistIds) => {
  let allArtists = [];
  
  // Spotify API allows max 50 artists per request
  for (let i = 0; i < artistIds.length; i += 50) {
    const batch = artistIds.slice(i, i + 50).join(',');
    const response = await axios.get(`https://api.spotify.com/v1/artists?ids=${batch}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    allArtists = allArtists.concat(response.data.artists);
  }
  
  // Return an array mapping artist ID to their genres
  return allArtists.map(artist => ({
    id: artist.id,
    genres: artist.genres
  }));
};

module.exports = {
  getSpotifyToken,
  refreshSpotifyToken,
  getPlaylistTracks,
  getArtistGenres
};
