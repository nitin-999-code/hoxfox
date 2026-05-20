const axios = require('axios');
const { expandKeywords } = require('../utils/synonyms');

const ALLOWED_GENRES = [
  'pop', 'hip-hop', 'rnb', 'rock', 'electronic', 'chill', 'jazz', 'classical',
  'metal', 'latin', 'country', 'indie', 'blues', 'reggae', 'gospel', 'bollywood',
  'punjabi', 'kpop'
];

const RULES_TABLE = [
  {
    triggers: ['sleep', 'wind down', 'lullaby', 'bedtime'],
    keywords: ['sleep', 'calm', 'soft', 'peaceful', 'quiet'],
    genres: ['chill', 'classical'],
    label: 'Sleep & Wind Down',
    language: null
  },
  {
    triggers: ['workout', 'gym', 'energy', 'exercise', 'run', 'pump'],
    keywords: ['workout', 'gym', 'energy', 'intense', 'motivational'],
    genres: ['pop', 'hip-hop', 'rock', 'electronic'],
    label: 'Workout & Energy',
    language: null
  },
  {
    triggers: ['happy', 'upbeat', 'feel good', 'joy', 'cheerful'],
    keywords: ['happy', 'upbeat', 'bright', 'positive', 'good vibes'],
    genres: ['pop', 'indie'],
    label: 'Happy & Feel Good',
    language: null
  },
  {
    triggers: ['sad', 'heartbreak', 'emotional', 'crying', 'lonely'],
    keywords: ['sad', 'emotional', 'melancholy', 'broken heart', 'moody'],
    genres: ['chill', 'indie', 'rnb'],
    label: 'Sad & Emotional',
    language: null
  },
  {
    triggers: ['chill', 'lofi', 'study', 'focus', 'relax'],
    keywords: ['chill', 'lofi', 'study', 'focus', 'relaxing', 'mellow'],
    genres: ['chill', 'jazz'],
    label: 'Chill & Study',
    language: null
  },
  {
    triggers: ['party', 'dance', 'club', 'hype', 'rave'],
    keywords: ['party', 'dance', 'club', 'banger', 'high energy'],
    genres: ['electronic', 'pop', 'hip-hop'],
    label: 'Party & Dance',
    language: null
  },
  {
    triggers: ['acoustic', 'unplugged', 'stripped'],
    keywords: ['acoustic', 'unplugged', 'raw', 'guitar', 'live'],
    genres: ['indie', 'pop'],
    label: 'Acoustic & Unplugged',
    language: null
  },
  {
    triggers: ['instrumental', 'ambient', 'meditation', 'zen'],
    keywords: ['instrumental', 'ambient', 'meditation', 'peaceful', 'zen'],
    genres: ['classical', 'chill'],
    label: 'Instrumental & Meditation',
    language: null
  },
  {
    triggers: ['morning', 'wake up', 'sunrise'],
    keywords: ['morning', 'wake up', 'fresh', 'bright', 'starting'],
    genres: ['pop', 'chill'],
    label: 'Morning Wake Up',
    language: null
  },
  {
    triggers: ['rap', 'hip-hop', 'hiphop', 'trap', 'drill'],
    keywords: ['rap', 'hiphop', 'trap', 'bars', 'beats'],
    genres: ['hip-hop'],
    label: 'Rap & Hip-Hop',
    language: null
  },
  {
    triggers: ['rock', 'alternative', 'guitar', 'indie rock'],
    keywords: ['rock', 'alternative', 'guitar', 'band', 'raw'],
    genres: ['rock'],
    label: 'Rock & Alternative',
    language: null
  },
  {
    triggers: ['jazz', 'blues', 'swing'],
    keywords: ['jazz', 'blues', 'swing', 'classic', 'soulful'],
    genres: ['jazz', 'blues'],
    label: 'Jazz & Blues',
    language: null
  },
  {
    triggers: ['classical', 'orchestra', 'piano', 'symphony'],
    keywords: ['classical', 'orchestra', 'piano', 'instrumental', 'elegant'],
    genres: ['classical'],
    label: 'Classical & Orchestra',
    language: null
  },
  {
    triggers: ['latin', 'reggaeton', 'afrobeats', 'salsa'],
    keywords: ['latin', 'reggaeton', 'afrobeats', 'dance', 'rhythm'],
    genres: ['latin'],
    label: 'Latin & Afrobeats',
    language: null
  },
  {
    triggers: ['metal', 'heavy', 'hardcore', 'doom'],
    keywords: ['metal', 'heavy', 'intense', 'aggressive', 'loud'],
    genres: ['metal'],
    label: 'Metal & Hardcore',
    language: null
  },
  {
    triggers: ['r&b', 'rnb', 'soul', 'neo-soul'],
    keywords: ['rnb', 'soul', 'smooth', 'groove', 'moody'],
    genres: ['rnb'],
    label: 'R&B & Soul',
    language: null
  },
  {
    triggers: ['romantic', 'love', 'date night', 'valentines'],
    keywords: ['romantic', 'love', 'intimate', 'sweet', 'tender'],
    genres: ['pop', 'rnb', 'chill'],
    label: 'Romantic & Love',
    language: null
  },
  {
    triggers: ['dark', 'moody', 'gothic', 'gloomy'],
    keywords: ['dark', 'moody', 'gothic', 'gloomy', 'deep'],
    genres: ['metal', 'rock', 'chill'],
    label: 'Dark & Moody',
    language: null
  },
  {
    triggers: ['nostalgic', 'throwback', 'retro', '80s', '90s', 'classic'],
    keywords: ['nostalgic', 'throwback', 'retro', 'classic', 'old school'],
    genres: ['pop', 'rock'],
    label: 'Nostalgic Throwbacks',
    language: null
  },
  {
    triggers: ['night drive', 'road trip', 'cruising', 'driving'],
    keywords: ['drive', 'night', 'cruise', 'atmospheric', 'travel'],
    genres: ['electronic', 'indie', 'pop'],
    label: 'Night Drive & Road Trip',
    language: null
  },
  {
    triggers: ['hindi', 'bollywood', 'desi'],
    keywords: ['hindi', 'bollywood', 'indian', 'desi', 'melodic'],
    genres: ['bollywood'],
    label: 'Hindi & Bollywood Hits',
    language: 'hindi'
  },
  {
    triggers: ['punjabi', 'bhangra'],
    keywords: ['punjabi', 'bhangra', 'high energy', 'beats', 'indian'],
    genres: ['punjabi'],
    label: 'Punjabi & Bhangra',
    language: 'punjabi'
  },
  {
    triggers: ['korean', 'k-pop', 'kpop'],
    keywords: ['kpop', 'korean', 'pop', 'dance', 'catchy'],
    genres: ['kpop'],
    label: 'Korean Pop (K-Pop)',
    language: 'korean'
  },
  {
    triggers: ['spanish', 'latin'],
    keywords: ['spanish', 'latin', 'reggaeton', 'pop', 'vibrant'],
    genres: ['latin'],
    label: 'Spanish & Latin Pop',
    language: 'spanish'
  },
  {
    triggers: ['english songs', 'english only'],
    keywords: ['english', 'western', 'mainstream', 'hits'],
    genres: ['pop', 'rock', 'hip-hop'],
    label: 'English Hits',
    language: 'english'
  }
];

/**
 * Match a query against the predefined rules table.
 */
function matchRules(query) {
  const q = query.toLowerCase();
  let bestRule = null;
  let bestScore = 0;

  for (const rule of RULES_TABLE) {
    const score = rule.triggers.filter(trigger => q.includes(trigger)).length;
    if (score > bestScore) {
      bestScore = score;
      bestRule = rule;
    }
  }

  if (!bestRule) return null;

  return {
    keywords: expandKeywords(bestRule.keywords),
    targetGenres: bestRule.genres,
    artist: null,
    language: bestRule.language,
    label: bestRule.label,
    source: 'rules'
  };
}

/**
 * Parse a query using LLMs with a fallback mechanism.
 */
async function parseWithLLM(query) {
  const systemPrompt = `You are a music intent parser. Return ONLY raw JSON.
Allowed genre clusters: ${ALLOWED_GENRES.join(', ')}.
Output shape: {
  "keywords": ["3-8 mood/vibe words, lowercase"],
  "targetGenres": ["1-4 clusters from allowed list"],
  "artist": "string if named, else null",
  "language": "hindi" | "punjabi" | "korean" | "spanish" | "english" | null,
  "label": "2-4 word playlist name"
}`;

  // 1. Try Gemini
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
      const resp = await axios.post(url, {
        contents: [{ parts: [{ text: `${systemPrompt}\n\nQuery: "${query}"` }] }],
        generationConfig: { responseMimeType: "application/json" }
      });
      const text = resp.data.candidates[0].content.parts[0].text;
      const parsed = JSON.parse(text);
      return { ...parsed, keywords: expandKeywords(parsed.keywords), source: 'llm' };
    }
  } catch (err) {
    console.error('[intentParser] Gemini failed, trying Groq...', err.message);
  }

  // 2. Try Groq as fallback
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      const url = 'https://api.groq.com/openai/v1/chat/completions';
      const resp = await axios.post(url, {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        response_format: { type: "json_object" }
      }, {
        headers: { Authorization: `Bearer ${groqKey}` }
      });
      const parsed = JSON.parse(resp.data.choices[0].message.content);
      return { ...parsed, keywords: expandKeywords(parsed.keywords), source: 'llm' };
    }
  } catch (err) {
    console.error('[intentParser] Groq failed...', err.message);
  }

  return null;
}

/**
 * Main entry point for intent parsing.
 * Strategy: Rules -> LLM -> Fallback
 */
async function parseIntent(query) {
  // 1. Match Rules
  const ruleMatch = matchRules(query);
  if (ruleMatch) return ruleMatch;

  // 2. Parse with LLM
  const llmMatch = await parseWithLLM(query);
  if (llmMatch) return llmMatch;

  // 3. Fallback
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  return {
    keywords: expandKeywords(words.slice(0, 5)),
    targetGenres: ['pop'], // safe default
    artist: null,
    language: null,
    label: 'My Playlist',
    source: 'fallback'
  };
}

module.exports = { parseIntent, matchRules, parseWithLLM };
