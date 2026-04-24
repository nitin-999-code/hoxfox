// Controllers for Artist genre fetching routes
const spotifyService = require('../services/spotifyService');

const getArtistsGenres = async (req, res, next) => {
  try {
    const { artistIds } = req.body;
    if (!artistIds || !Array.isArray(artistIds)) {
      return res.status(400).json({ error: 'artistIds must be an array' });
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }
    
    const token = authHeader.split(' ')[1];
    const genres = await spotifyService.getArtistGenres(token, artistIds);
    
    res.json(genres);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getArtistsGenres
};
