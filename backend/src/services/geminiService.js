// Handles calls to Gemini API
const axios = require('axios');

const classifyTracks = async (tracks, userQuery) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return [];
    
    let prompt = `Here is a list of songs with their genre and mood tags:\n`;
    tracks.forEach((t, i) => {
      prompt += `${i + 1}. ${t.trackName} - ${t.artistName} | genres: ${t.genres.join(', ')} | tags: ${t.lastfmTags.join(', ')}\n`;
    });
    
    prompt += `\nUser wants: ${userQuery}\n`;
    prompt += `\nWhich of these songs match? Return only a JSON array of the matching song numbers.\nExample: [1, 4, 7]\nReturn nothing else.`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const text = response.data.candidates[0].content.parts[0].text.trim();
    const match = text.match(/\[.*\]/s);
    if (!match) return [];
    
    const indices = JSON.parse(match[0]);
    const matchingTrackIds = indices.map(i => tracks[i - 1]?.id).filter(id => id != null);
    return matchingTrackIds;
  } catch (error) {
    console.error('Gemini classification error:', error.message);
    return [];
  }
};

module.exports = {
  classifyTracks
};
