/**
 * intentParserService.js
 * Natural language query → structured intent for the filter engine.
 *
 * Output shape:
 * {
 *   keywords:     string[],    // expanded synonyms, used for name/tag matching
 *   targetGenres: string[],    // cluster names from genreClusters.js
 *   artist:       string|null,
 *   language:     string|null, // 'hindi' | 'punjabi' | 'korean' | 'spanish' | 'english' | null
 *   label:        string,
 *   source:       'rules' | 'llm' | 'fallback'
 * }
 */

const { expandKeywords } = require('../utils/synonyms');

// ── Rule table ────────────────────────────────────────────────────────────────
// language field is optional — only set for language-specific rules
const RULES = [
  // Moods / activity
  {
    triggers: ['sleep', 'bedtime', 'lullaby', 'wind down', 'insomnia'],
    keywords: ['sleep', 'night', 'calm', 'relax', 'soft'],
    genres:   ['chill', 'classical', 'indie'],
    label:    'Sleep & Wind Down',
  },
  {
    triggers: ['workout', 'gym', 'exercise', 'run', 'running', 'beast mode', 'pump up'],
    keywords: ['workout', 'energy', 'pump', 'power', 'loud'],
    genres:   ['hip-hop', 'pop', 'rock', 'electronic', 'metal'],
    label:    'Workout Energy',
  },
  {
    triggers: ['happy', 'feel good', 'joyful', 'upbeat', 'good mood', 'cheerful', 'positive'],
    keywords: ['happy', 'joy', 'upbeat', 'bright'],
    genres:   ['pop', 'rnb', 'latin', 'indie'],
    label:    'Happy Vibes',
  },
  {
    triggers: ['sad', 'heartbreak', 'cry', 'melancholy', 'depressed', 'breakup', 'emotional'],
    keywords: ['sad', 'heartbreak', 'emotional', 'lonely'],
    genres:   ['indie', 'rnb', 'pop', 'blues'],
    label:    'Sad & Emotional',
  },
  {
    triggers: ['chill', 'lofi', 'lo-fi', 'study', 'focus', 'background', 'reading', 'coffee'],
    keywords: ['chill', 'study', 'focus', 'relax'],
    genres:   ['chill', 'indie', 'jazz', 'classical'],
    label:    'Chill & Focus',
  },
  {
    triggers: ['party', 'dance', 'club', 'night out', 'banger', 'hype', 'rave', 'festival'],
    keywords: ['party', 'dance', 'hype', 'loud'],
    genres:   ['electronic', 'pop', 'hip-hop', 'latin'],
    label:    'Party & Dance',
  },
  {
    triggers: ['acoustic', 'unplugged', 'raw', 'stripped'],
    keywords: ['acoustic', 'guitar', 'raw', 'stripped'],
    genres:   ['indie', 'country', 'blues', 'folk'],
    label:    'Acoustic Vibes',
  },
  {
    triggers: ['instrumental', 'no vocals', 'ambient', 'meditation', 'mindful'],
    keywords: ['instrumental', 'ambient', 'peaceful'],
    genres:   ['classical', 'chill', 'jazz', 'electronic'],
    label:    'Instrumental',
  },
  {
    triggers: ['morning', 'wake up', 'sunrise', 'fresh', 'start the day'],
    keywords: ['morning', 'fresh', 'energize'],
    genres:   ['pop', 'indie', 'rnb'],
    label:    'Morning Energy',
  },
  {
    triggers: ['rap', 'hip hop', 'hiphop', 'hip-hop', 'trap', 'bars', 'drill'],
    keywords: ['rap', 'hip hop', 'trap', 'bars'],
    genres:   ['hip-hop'],
    label:    'Rap & Hip-Hop',
  },
  {
    triggers: ['rock', 'alternative', 'alt rock', 'guitar', 'punk', 'grunge'],
    keywords: ['rock', 'guitar', 'loud', 'electric'],
    genres:   ['rock', 'metal', 'indie'],
    label:    'Rock & Alternative',
  },
  {
    triggers: ['jazz', 'blues', 'swing', 'bebop'],
    keywords: ['jazz', 'improvisation', 'swing'],
    genres:   ['jazz', 'blues'],
    label:    'Jazz & Blues',
  },
  {
    triggers: ['classical', 'orchestra', 'symphony', 'piano', 'violin'],
    keywords: ['classical', 'orchestral', 'piano'],
    genres:   ['classical'],
    label:    'Classical',
  },
  {
    triggers: ['latin', 'reggaeton', 'salsa', 'bachata', 'afrobeats', 'dancehall'],
    keywords: ['latin', 'dance', 'rhythm'],
    genres:   ['latin', 'reggae'],
    label:    'Latin & Afro',
  },
  {
    triggers: ['metal', 'heavy', 'death metal', 'thrash', 'hardcore', 'screamo'],
    keywords: ['metal', 'heavy', 'intense', 'dark'],
    genres:   ['metal', 'rock'],
    label:    'Metal & Heavy',
  },
  {
    triggers: ['rnb', 'r&b', 'soul', 'neo soul', 'funk', 'groove'],
    keywords: ['soul', 'groove', 'smooth', 'rhythm'],
    genres:   ['rnb'],
    label:    'R&B & Soul',
  },
  {
    triggers: ['romantic', 'love', 'passion', 'date night', 'intimate'],
    keywords: ['romantic', 'love', 'tender', 'sweet'],
    genres:   ['rnb', 'pop', 'jazz', 'indie'],
    label:    'Romantic Mood',
  },
  {
    triggers: ['dark', 'moody', 'gloomy', 'brooding', 'gothic'],
    keywords: ['dark', 'moody', 'gloomy', 'ominous'],
    genres:   ['electronic', 'metal', 'indie', 'rock'],
    label:    'Dark & Moody',
  },
  {
    triggers: ['nostalgic', 'throwback', 'retro', '80s', '90s', 'old school', 'classic'],
    keywords: ['nostalgic', 'throwback', 'retro', 'classic'],
    genres:   ['pop', 'rock', 'rnb', 'hip-hop'],
    label:    'Throwback',
  },
  {
    triggers: ['drive', 'road trip', 'cruising', 'night drive', 'car'],
    keywords: ['drive', 'night', 'cruising', 'highway'],
    genres:   ['pop', 'rock', 'electronic', 'indie'],
    label:    'Late Night Drive',
  },

  // ── Language / regional rules ─────────────────────────────────────────────
  {
    triggers:  ['hindi', 'bollywood', 'hindi songs', 'desi'],
    keywords:  ['hindi', 'bollywood', 'filmi', 'desi'],
    genres:    ['bollywood'],
    label:     'Hindi / Bollywood',
    language:  'hindi',
  },
  {
    triggers:  ['punjabi', 'bhangra'],
    keywords:  ['punjabi', 'bhangra', 'desi'],
    genres:    ['punjabi', 'bollywood'],
    label:     'Punjabi',
    language:  'punjabi',
  },
  {
    triggers:  ['korean', 'k-pop', 'kpop'],
    keywords:  ['korean', 'k-pop'],
    genres:    ['kpop'],
    label:     'K-Pop',
    language:  'korean',
  },
  {
    triggers:  ['spanish', 'spanish songs'],
    keywords:  ['spanish', 'latin'],
    genres:    ['latin'],
    label:     'Spanish / Latin',
    language:  'spanish',
  },
  {
    triggers:  ['english songs', 'english only', 'english'],
    keywords:  ['english'],
    genres:    ['pop', 'rock', 'hip-hop', 'indie', 'rnb'],
    label:     'English Songs',
    language:  'english',
  },
];

// ── Rule matcher ──────────────────────────────────────────────────────────────

function matchRules(query) {
  const q = query.toLowerCase();
  let best      = null;
  let bestScore = 0;

  for (const rule of RULES) {
    const score = rule.triggers.filter(t => q.includes(t)).length;
    if (score > bestScore) {
      bestScore = score;
      best      = rule;
    }
  }

  return bestScore > 0 ? best : null;
}

// ── LLM system prompt ─────────────────────────────────────────────────────────

const LLM_SYSTEM_PROMPT = `You are a music intent parser. Given a user's natural language query about music mood or genre, return a JSON object describing WHAT KIND of music to look for.

IMPORTANT:
- Do NOT return audio feature ranges (energy, tempo, valence, etc.).
- Output ONLY raw JSON — no markdown, no explanation.

Available genre clusters (use ONLY these in targetGenres):
pop, hip-hop, rnb, rock, electronic, chill, jazz, classical, metal, latin, country, indie, blues, reggae, gospel, bollywood, punjabi, kpop

Available language values (use ONLY these, or null):
hindi, punjabi, korean, spanish, english, null

Return this exact shape:
{
  "keywords": ["keyword1", "keyword2"],
  "targetGenres": ["cluster1", "cluster2"],
  "artist": null,
  "language": null,
  "label": "Short playlist name"
}

Rules:
- keywords: 3–8 mood/vibe words (e.g. "dark", "sleep", "pump up", "rainy")
- targetGenres: 1–4 clusters that fit the query
- artist: string only if the user explicitly named an artist, otherwise null
- language: one of the allowed values if the query implies a language/region, otherwise null
- label: 2–4 word playlist name`;

// ── LLM parsers ──────────────────────────────────────────────────────────────

async function parseWithGemini(query) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        systemInstruction: { parts: [{ text: LLM_SYSTEM_PROMPT }] },
        contents:          [{ role: 'user', parts: [{ text: query }] }],
        generationConfig:  { maxOutputTokens: 300, temperature: 0.2 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini failed (${res.status}): ${err?.error?.message ?? 'unknown'}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

async function parseWithGroq(query) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model:       'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens:  300,
      messages: [
        { role: 'system', content: LLM_SYSTEM_PROMPT },
        { role: 'user',   content: query },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Groq failed (${res.status}): ${err?.error?.message ?? 'unknown'}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '{}';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

async function parseWithLLM(query) {
  let parsed = null;

  try {
    console.log('[intent] trying Gemini...');
    parsed = await parseWithGemini(query);
  } catch (geminiErr) {
    console.warn('[intent] Gemini unavailable:', geminiErr.message, '→ falling back to Groq');
    try {
      parsed = await parseWithGroq(query);
    } catch (groqErr) {
      console.warn('[intent] Groq also unavailable:', groqErr.message);
      return {
        keywords:     expandKeywords([query]),
        targetGenres: [],
        artist:       null,
        language:     null,
        label:        'Filtered Playlist',
        source:       'fallback',
      };
    }
  }

  return {
    keywords:     expandKeywords(parsed.keywords || [query]),
    targetGenres: parsed.targetGenres || [],
    artist:       parsed.artist       || null,
    language:     parsed.language     || null,
    label:        parsed.label        || 'Filtered Playlist',
    source:       'llm',
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

async function parseIntent(query) {
  const ruleMatch = matchRules(query);

  if (ruleMatch) {
    console.log(`[intent] rule match → "${ruleMatch.label}" lang=${ruleMatch.language || 'none'}`);
    return {
      keywords:     expandKeywords(ruleMatch.keywords),
      targetGenres: ruleMatch.genres,
      artist:       null,
      language:     ruleMatch.language || null,
      label:        ruleMatch.label,
      source:       'rules',
    };
  }

  console.log('[intent] no rule match → falling back to LLM');
  return parseWithLLM(query);
}

module.exports = { parseIntent, matchRules, parseWithLLM };
