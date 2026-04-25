// lib/intent-parser.js
// Converts natural language query → structured filter ranges
// Step 1: Rule-based matching for common patterns
// Step 2: LLM fallback (Gemini) for complex/ambiguous queries

const DEFAULT_WEIGHTS = {
  energy: 1,
  tempo: 0.8,
  valence: 1,
  danceability: 0.8,
  acousticness: 0.7,
  instrumentalness: 0.5,
  speechiness: 0.4,
};

const RULES = [
  {
    keywords: ["sleep", "night", "bedtime", "calm", "relax", "lullaby", "wind down"],
    filters: {
      energy: { min: 0, max: 0.35 },
      tempo: { min: 0, max: 90 },
      valence: { min: 0, max: 0.55 },
      acousticness: { min: 0.35, max: 1 },
    },
    weights: { energy: 1.5, tempo: 1.2, acousticness: 1.2 },
    label: "Night & Sleep",
  },
  {
    keywords: ["workout", "gym", "exercise", "run", "running", "high energy", "pump up", "beast mode"],
    filters: {
      energy: { min: 0.7, max: 1 },
      tempo: { min: 120, max: 200 },
      danceability: { min: 0.5, max: 1 },
    },
    weights: { energy: 1.5, tempo: 1.3, danceability: 1.1 },
    label: "Workout",
  },
  {
    keywords: ["happy", "feel good", "joyful", "upbeat", "good mood", "cheerful", "positive"],
    filters: {
      valence: { min: 0.65, max: 1 },
      energy: { min: 0.45, max: 1 },
    },
    weights: { valence: 1.5, energy: 1.1 },
    label: "Happy Vibes",
  },
  {
    keywords: ["sad", "heartbreak", "cry", "melancholy", "depressed", "breakup", "emotional"],
    filters: {
      valence: { min: 0, max: 0.35 },
      energy: { min: 0, max: 0.5 },
    },
    weights: { valence: 1.5, energy: 1.0 },
    label: "Sad / Emotional",
  },
  {
    keywords: ["chill", "lofi", "lo-fi", "study", "focus", "background", "reading", "coffee"],
    filters: {
      energy: { min: 0.1, max: 0.5 },
      tempo: { min: 60, max: 110 },
      valence: { min: 0.2, max: 0.7 },
    },
    weights: { energy: 1.3, tempo: 1.0 },
    label: "Chill / Focus",
  },
  {
    keywords: ["party", "dance", "club", "night out", "banger", "hype", "rave"],
    filters: {
      danceability: { min: 0.7, max: 1 },
      energy: { min: 0.65, max: 1 },
      tempo: { min: 110, max: 200 },
    },
    weights: { danceability: 1.5, energy: 1.3, tempo: 1.1 },
    label: "Party / Dance",
  },
  {
    keywords: ["acoustic", "unplugged", "raw", "stripped"],
    filters: {
      acousticness: { min: 0.6, max: 1 },
      instrumentalness: { min: 0, max: 0.5 },
    },
    weights: { acousticness: 1.5 },
    label: "Acoustic",
  },
  {
    keywords: ["instrumental", "no vocals", "ambient", "classical", "jazz", "meditation"],
    filters: {
      instrumentalness: { min: 0.5, max: 1 },
      speechiness: { min: 0, max: 0.1 },
    },
    weights: { instrumentalness: 1.5, speechiness: 1.2 },
    label: "Instrumental",
  },
  {
    keywords: ["morning", "wake up", "sunrise", "fresh", "energize", "start the day"],
    filters: {
      energy: { min: 0.4, max: 0.8 },
      valence: { min: 0.5, max: 1 },
      tempo: { min: 90, max: 150 },
    },
    weights: { energy: 1.2, valence: 1.3 },
    label: "Morning Energy",
  },
  {
    keywords: ["rap", "hip hop", "hiphop", "trap", "bars"],
    filters: {
      speechiness: { min: 0.1, max: 1 },
      danceability: { min: 0.5, max: 1 },
    },
    weights: { speechiness: 1.3, danceability: 1.1 },
    label: "Rap / Hip-Hop",
  },
];

function matchRules(query) {
  const q = query.toLowerCase();
  let best = null;
  let bestScore = 0;

  for (const rule of RULES) {
    const score = rule.keywords.filter((kw) => q.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      best = rule;
    }
  }

  return bestScore > 0 ? best : null;
}

const LLM_SYSTEM_PROMPT = `You are a music filter assistant. Given a user's natural language query about the kind of music they want to listen to, return a JSON object describing Spotify audio feature filter ranges and weights.

Audio features and their value ranges:
- energy: 0–1 (0=calm, 1=intense)
- tempo: BPM, typically 60–200
- valence: 0–1 (0=sad/dark, 1=happy/bright)
- danceability: 0–1 (0=not danceable, 1=very danceable)
- acousticness: 0–1 (0=electronic, 1=fully acoustic)
- instrumentalness: 0–1 (0=has vocals, 1=no vocals)
- speechiness: 0–1 (0=music, 1=spoken word)

Respond ONLY with a valid JSON object, no markdown, no explanation:
{
  "filters": {
    "energy": { "min": 0, "max": 1 },
    "tempo": { "min": 60, "max": 200 },
    "valence": { "min": 0, "max": 1 },
    "danceability": { "min": 0, "max": 1 },
    "acousticness": { "min": 0, "max": 1 },
    "instrumentalness": { "min": 0, "max": 1 },
    "speechiness": { "min": 0, "max": 1 }
  },
  "weights": {
    "energy": 1,
    "tempo": 1,
    "valence": 1,
    "danceability": 1,
    "acousticness": 1,
    "instrumentalness": 1,
    "speechiness": 1
  },
  "label": "Short playlist name (3 words max)"
}

Only include filter features that are relevant to the query. Set weights higher (1.2–1.5) for the most important features.`;

async function parseWithLLM(query) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: LLM_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: query }] }],
        generationConfig: { maxOutputTokens: 500, temperature: 0.2 },
      }),
    }
  );

  if (!res.ok) throw new Error("Gemini LLM fallback failed");

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

  return {
    filters: parsed.filters ?? {},
    weights: { ...DEFAULT_WEIGHTS, ...(parsed.weights ?? {}) },
    label: parsed.label ?? "Filtered Playlist",
    source: "llm",
  };
}

async function parseIntent(query) {
  const ruleMatch = matchRules(query);
  if (ruleMatch) {
    return {
      filters: ruleMatch.filters,
      weights: { ...DEFAULT_WEIGHTS, ...ruleMatch.weights },
      label: ruleMatch.label,
      source: "rules",
    };
  }
  return parseWithLLM(query);
}

module.exports = { parseIntent };
