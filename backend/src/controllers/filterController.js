// Controllers for filtering logic
const spotifyService = require('../services/spotifyService');
const filterService = require('../services/filterService');

const filterPlaylist = async (req, res, next) => {
  try {
    const { playlistId, userQuery } = req.body;
    if (!playlistId || !userQuery) {
      return res.status(400).json({ error: 'playlistId and userQuery are required' });
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Fetch all tracks from playlist
    const rawTracks = await spotifyService.getPlaylistTracks(playlistId, token, null);
    
    // Filter tracks
    const matchingTrackIds = await filterService.filterTracks(token, rawTracks, userQuery);
    
    res.json({ matchingTrackIds });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  filterPlaylist
};
