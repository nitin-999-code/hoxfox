const axios = require('axios');

/**
 * Fetches mood/genre tags from Last.fm for a single track.
 * Returns an array of tag strings.
 */
async function getTrackTags(track) {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];

  try {
    const url = 'http://ws.audioscrobbler.com/2.0/';
    const response = await axios.get(url, {
      params: {
        method: 'track.getTopTags',
        artist: track.artistName,
        track: track.trackName,
        api_key: apiKey,
        format: 'json'
      },
      timeout: 5000
    });

    const tags = response.data?.toptags?.tag;
    if (!tags || !Array.isArray(tags)) return [];

    return tags
      .filter(t => parseInt(t.count, 10) >= 30)
      .map(t => t.name.toLowerCase())
      .slice(0, 10);
  } catch (err) {
    // Return empty array for any error (404, network, etc.)
    return [];
  }
}

/**
 * Processes a batch of tracks with a concurrency limit of 3.
 * Returns a map of trackId -> tags[].
 * 
 * @param {{ id: string, trackName: string, artistName: string }[]} tracks
 * @returns {Promise<{ [trackId: string]: string[] }>}
 */
async function getTrackTagsBatch(tracks) {
  console.log(`[lastfm] fetching tags for ${tracks.length} tracks`);
  
  const resultsMap = {};
  const queue = [...tracks];
  const activeRequests = new Set();
  const limit = 3;

  async function processQueue() {
    while (queue.length > 0) {
      if (activeRequests.size < limit) {
        const track = queue.shift();
        const promise = getTrackTags(track).then(tags => {
          resultsMap[track.id] = tags;
          activeRequests.delete(promise);
        });
        activeRequests.add(promise);
      } else {
        await Promise.race(activeRequests);
      }
    }
    // Wait for remaining active requests to finish
    await Promise.all(activeRequests);
  }

  await processQueue();

  const successCount = Object.values(resultsMap).filter(tags => tags.length > 0).length;
  console.log(`[lastfm] completed: ${successCount}/${tracks.length} tracks got tags`);

  return resultsMap;
}

module.exports = { getTrackTagsBatch };
