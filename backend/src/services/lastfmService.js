/**
 * lastfmService.js
 * Fetches mood/genre tags from Last.fm for individual tracks.
 *
 * Rate limit: Last.fm allows ~5 req/sec on free tier.
 * We process in batches of 4 with a 250ms pause between batches —
 * so 100 tracks takes ~7 seconds, which is acceptable.
 *
 * Max tracks per filter call is capped at 150 to keep response time sane.
 * Tracks beyond 150 get empty tags (genre scoring carries them instead).
 */

const axios = require('axios');

const BATCH_SIZE  = 4;    // concurrent requests per batch
const BATCH_DELAY = 250;  // ms pause between batches
const MAX_TRACKS  = 150;  // cap to avoid very long requests
const MIN_TAG_COUNT = 10; // minimum Last.fm tag count to consider reliable

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch top tags for a single track.
 * Returns a deduplicated lowercase array of reliable tags.
 */
async function getTrackTags(artist, trackName) {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await axios.get('https://ws.audioscrobbler.com/2.0/', {
      params: {
        method:  'track.gettoptags',
        artist,
        track:   trackName,
        api_key: apiKey,
        format:  'json',
      },
      timeout: 5000,
    });

    const tags = response.data?.toptags?.tag;
    if (!tags) return [];

    const tagArray = Array.isArray(tags) ? tags : [tags];
    return tagArray
      .filter(t => parseInt(t.count, 10) >= MIN_TAG_COUNT)
      .map(t => t.name.toLowerCase())
      .filter((t, i, arr) => arr.indexOf(t) === i); // deduplicate
  } catch (err) {
    // Silently fail — genre scoring will compensate
    return [];
  }
}

/**
 * Fetch tags for a batch of tracks with concurrency limiting.
 *
 * @param {{ id: string, trackName: string, artistName: string }[]} tracks
 * @returns {Promise<{ [trackId: string]: string[] }>}
 */
async function getTrackTagsBatch(tracks) {
  const tagsMap = {};
  const toFetch = tracks.slice(0, MAX_TRACKS);

  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(t => getTrackTags(t.artistName, t.trackName))
    );

    results.forEach((result, j) => {
      tagsMap[batch[j].id] = result.status === 'fulfilled' ? result.value : [];
    });

    // Pause between batches (skip after the last one)
    if (i + BATCH_SIZE < toFetch.length) {
      await delay(BATCH_DELAY);
    }
  }

  const fetched    = Object.values(tagsMap).filter(t => t.length > 0).length;
  const totalTags  = Object.values(tagsMap).reduce((s, t) => s + t.length, 0);
  console.log(`[lastfm] ${fetched}/${toFetch.length} tracks have tags (${totalTags} total)`);

  return tagsMap;
}

module.exports = { getTrackTags, getTrackTagsBatch };
