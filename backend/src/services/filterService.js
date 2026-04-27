// Orchestrates the filtering of tracks using local logic and Gemini
const spotifyService = require('./spotifyService');
const lastfmService = require('./lastfmService');
const geminiService = require('./geminiService');

const filterTracks = async (token, tracks, userQuery) => {
  try {
    const uniqueArtistIds = [...new Set(tracks.flatMap(t => t.track?.artists?.map(a => a.id) || []))].filter(Boolean);
    const mappedTracks = tracks.map(t => ({
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
      const originalTrack = tracks.find(raw => raw.track?.id === t.id);
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
      
      return { ...t, genres, lastfmTags, confidence };
    });

    // Step 3 - Split By Confidence
    const highConfidence = enrichedTracks.filter(t => t.confidence >= 50);
    const lowConfidence = enrichedTracks.filter(t => t.confidence < 50);

    // Step 4 - Local Filtering
    const localMatchIds = new Set();
    const query = userQuery.toLowerCase();
    
    const isLanguageQuery = ["hindi", "korean", "spanish", "punjabi", "english"].some(lang => query.includes(lang));
    const isMoodQuery = ["chill", "sad", "happy", "party", "workout", "focus"].some(mood => query.includes(mood));
    const isGenreQuery = ["hip hop", "rock", "pop", "jazz", "classical"].some(genre => query.includes(genre));

    highConfidence.forEach(t => {
      let isMatch = false;
      const allTags = [...t.genres, ...t.lastfmTags].map(tag => tag.toLowerCase());
      
      if (query.includes("hindi") && allTags.some(tag => ["bollywood", "filmi", "hindi pop", "desi pop"].includes(tag))) isMatch = true;
      if (query.includes("korean") && allTags.some(tag => ["k-pop", "korean pop", "korean r&b"].includes(tag))) isMatch = true;
      if (query.includes("spanish") && allTags.some(tag => ["latin", "reggaeton", "spanish pop"].includes(tag))) isMatch = true;
      if (query.includes("punjabi") && allTags.some(tag => ["punjabi", "bhangra"].includes(tag))) isMatch = true;
      if (query.includes("english") && !allTags.some(tag => ["bollywood", "filmi", "hindi pop", "desi pop", "k-pop", "korean pop", "korean r&b", "latin", "reggaeton", "spanish pop", "punjabi", "bhangra"].includes(tag))) isMatch = true;

      if (query.includes("chill") && t.lastfmTags.some(tag => ["chill", "relax", "calm", "mellow", "lo-fi"].includes(tag))) isMatch = true;
      if (query.includes("sad") && t.lastfmTags.some(tag => ["sad", "melancholy", "heartbreak", "emotional"].includes(tag))) isMatch = true;
      if (query.includes("happy") && t.lastfmTags.some(tag => ["happy", "upbeat", "feel good", "euphoric"].includes(tag))) isMatch = true;
      if (query.includes("party") && t.lastfmTags.some(tag => ["party", "dance", "club", "energetic"].includes(tag))) isMatch = true;
      if (query.includes("workout") && t.lastfmTags.some(tag => ["workout", "energy", "pump up", "hype"].includes(tag))) isMatch = true;
      if (query.includes("focus") && t.lastfmTags.some(tag => ["focus", "study", "concentration", "ambient"].includes(tag))) isMatch = true;

      if (query.includes("hip hop") && allTags.some(tag => ["hip hop", "rap", "trap", "drill"].includes(tag))) isMatch = true;
      if (query.includes("rock") && allTags.some(tag => ["rock", "indie rock", "alternative rock", "punk"].includes(tag))) isMatch = true;
      if (query.includes("pop") && allTags.some(tag => ["pop", "dance pop", "electropop", "synth pop"].includes(tag))) isMatch = true;
      if (query.includes("jazz") && allTags.some(tag => ["jazz", "smooth jazz", "bebop"].includes(tag))) isMatch = true;
      if (query.includes("classical") && allTags.some(tag => ["classical", "orchestral", "piano"].includes(tag))) isMatch = true;

      if (!isLanguageQuery && !isMoodQuery && !isGenreQuery && allTags.some(tag => tag.includes(query))) isMatch = true;

      if (isMatch) {
        localMatchIds.add(t.id);
      }
    });

    // Step 5 - Gemini Fallback
    let geminiMatchIds = [];
    if (lowConfidence.length > 0) {
      geminiMatchIds = await geminiService.classifyTracks(lowConfidence, userQuery);
    }

    // Step 6 - Return Combined
    return [...new Set([...localMatchIds, ...geminiMatchIds])];

  } catch (error) {
    console.error("Filter error:", error.message);
    return []; 
  }
};

module.exports = {
  filterTracks
};
