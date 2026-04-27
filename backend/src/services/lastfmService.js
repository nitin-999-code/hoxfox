// Handles raw Last.fm API calls
const axios = require('axios');

const getTrackTags = async (artist, trackName) => {
  try {
    const apiKey = process.env.LASTFM_API_KEY;
    if (!apiKey) return [];

    const response = await axios.get('http://ws.audioscrobbler.com/2.0/', {
      params: {
        method: 'track.gettoptags',
        artist: artist,
        track: trackName,
        api_key: apiKey,
        format: 'json'
      }
    });

    if (!response.data || !response.data.toptags || !response.data.toptags.tag) {
      return [];
    }

    const tags = response.data.toptags.tag;
    const highConfidenceTags = tags.filter(t => parseInt(t.count) >= 10);
    return highConfidenceTags.map(t => t.name.toLowerCase());
  } catch (error) {
    console.error(`Last.fm error for ${trackName}:`, error.message);
    return [];
  }
};

const getTrackTagsBatch = async (tracks) => {
  const promises = tracks.map(async (track) => {
    const tags = await getTrackTags(track.artistName, track.trackName);
    return { trackId: track.id, tags };
  });

  const results = await Promise.allSettled(promises);
  
  const tagsMap = {};
  for (const result of results) {
    if (result.status === 'fulfilled') {
      tagsMap[result.value.trackId] = result.value.tags;
    }
  }
  
  return tagsMap;
};

module.exports = {
  getTrackTags,
  getTrackTagsBatch
};
