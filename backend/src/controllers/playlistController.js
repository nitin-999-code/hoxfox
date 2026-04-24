// Controllers for Playlist fetching routes
const spotifyService = require('../services/spotifyService');

const getTracks = async (req, res, next) => {
  try {
    const { playlistId } = req.params;
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }
    
    const token = authHeader.split(' ')[1];
    const tracks = await spotifyService.getPlaylistTracks(token, playlistId);
    
    res.json(tracks);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTracks
};
