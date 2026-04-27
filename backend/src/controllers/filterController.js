// Controllers for filtering logic
const spotifyService = require('../services/spotifyService');
const filterService = require('../services/filterService');
const lastfmService = require('../services/lastfmService');

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

const debugFilter = async (req, res, next) => {
  try {
    const { playlistId, userQuery } = req.body;
    if (!playlistId) {
      return res.status(400).json({ error: 'playlistId is required' });
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Fetch all tracks from playlist
    const rawTracks = await spotifyService.getPlaylistTracks(playlistId, token, null);

    const uniqueArtistIds = [...new Set(rawTracks.flatMap(t => t.track?.artists?.map(a => a.id) || []))].filter(Boolean);
    const mappedTracks = rawTracks.map(t => ({
      id: t.track?.id,
      trackName: t.track?.name,
      artistName: t.track?.artists?.[0]?.name || 'Unknown'
    })).filter(t => t.id);

    // Step 1 - Fetch Data In Parallel
    const [artistGenres, trackTagsMap] = await Promise.all([
      spotifyService.getArtistGenresBatched ? spotifyService.getArtistGenresBatched(uniqueArtistIds, token, null).then(map => Object.keys(map).map(id => ({ id, genres: map[id] }))) : spotifyService.getArtistGenres(token, uniqueArtistIds),
      lastfmService.getTrackTagsBatch(mappedTracks)
    ]);
    
    const genreMap = {};
    artistGenres.forEach(ag => {
      genreMap[ag.id] = ag.genres || [];
    });

    // Step 2 - Enrich Each Track
    const enrichedTracks = mappedTracks.map(t => {
      let genres = [];
      const originalTrack = rawTracks.find(raw => raw.track?.id === t.id);
      if (originalTrack && originalTrack.track && originalTrack.track.artists) {
        originalTrack.track.artists.forEach(a => {
          if (genreMap[a.id]) {
            genres.push(...genreMap[a.id]);
          }
        });
      }
      genres = [...new Set(genres)];
      
      const lastfmTags = trackTagsMap[t.id] || [];
      
      let confidence = 0;
      if (genres.length > 0) confidence += 40;
      if (genres.length > 3) confidence += 20;
      if (lastfmTags.length > 0) confidence += 30;
      if (lastfmTags.length > 5) confidence += 10;
      
      const bucket = confidence >= 50 ? "highConfidence" : "lowConfidence";

      return {
        id: t.id,
        trackName: t.trackName,
        artistName: t.artistName,
        genres,
        lastfmTags,
        confidence,
        bucket
      };
    });

    const highConfidenceCount = enrichedTracks.filter(t => t.bucket === "highConfidence").length;
    const lowConfidenceCount = enrichedTracks.filter(t => t.bucket === "lowConfidence").length;

    res.json({
      totalTracks: enrichedTracks.length,
      highConfidenceCount,
      lowConfidenceCount,
      userQuery,
      tracks: enrichedTracks
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  filterPlaylist,
  debugFilter
};
