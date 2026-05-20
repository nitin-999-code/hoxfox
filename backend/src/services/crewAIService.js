const axios = require('axios');

const CREWAI_SERVICE_URL = process.env.CREWAI_SERVICE_URL || 'http://localhost:8000';

/**
 * Calls the CrewAI FastAPI bridge to get AI-curated playlist recommendations.
 * 
 * @param {object} params
 * @param {string} params.musicRequest - The user's natural language prompt
 * @param {object[]} params.playlistTracks - The pre-filtered tracks from Node backend
 * @param {string} params.spotifyAccessToken - Spotify token to use for recommendations
 * @param {boolean} params.generateReport - Whether to generate a markdown report
 * @returns {Promise<object>}
 */
async function getCrewAIRecommendations({ musicRequest, playlistTracks, spotifyAccessToken, generateReport = false }) {
  try {
    const response = await axios.post(`${CREWAI_SERVICE_URL}/recommend`, {
      music_request: musicRequest,
      playlist_tracks: playlistTracks,
      spotify_access_token: spotifyAccessToken,
      generate_report: generateReport
    }, {
      timeout: 120000 // 120 seconds
    });

    if (response.data.status === 'error') {
      throw new Error(response.data.error);
    }

    return response.data;
  } catch (err) {
    console.error('[crewAIService] error:', err.message);
    throw err;
  }
}

/**
 * Checks the health status of the CrewAI FastAPI bridge.
 */
async function checkCrewAIHealth() {
  try {
    const resp = await axios.get(`${CREWAI_SERVICE_URL}/health`);
    return resp.data.status === 'ok';
  } catch (err) {
    return false;
  }
}

module.exports = {
  getCrewAIRecommendations,
  checkCrewAIHealth
};
