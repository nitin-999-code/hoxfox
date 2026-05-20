import os
import json
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

class TrackInput(BaseModel):
    id: str
    name: str
    artists: List[str]
    genres: Optional[List[str]] = []
    clusters: Optional[List[str]] = []
    moodTags: Optional[List[str]] = []
    popularity: Optional[int] = 0
    score: float
    matchReasons: Optional[List[str]] = []

class RecommendRequest(BaseModel):
    music_request: str
    playlist_tracks: List[TrackInput]
    spotify_access_token: str
    generate_report: bool = False

class RecommendResponse(BaseModel):
    playlist: List[Dict[str, Any]] = []
    report: Optional[str] = None
    final_score: Optional[float] = None
    confidence_score: Optional[float] = None
    status: str
    error: Optional[str] = None

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/recommend", response_model=RecommendResponse)
async def recommend(request: RecommendRequest):
    try:
        # 1. Build list of tracks to send to the AI
        tracks_data = []
        for t in request.playlist_tracks:
            tracks_data.append({
                "id": t.id,
                "name": t.name,
                "artists": t.artists,
                "genres": t.genres,
                "clusters": t.clusters,
                "moodTags": t.moodTags,
                "popularity": t.popularity
            })

        # 2. Call Gemini API directly using requests
        api_key = os.getenv("GOOGLE_API_KEY")
        groq_api_key = os.getenv("GROQ_API_KEY")
        
        playlist = []
        text_content = ""
        success = False
        
        prompt = f"""You are an expert music curator AI. 
The user wants to filter their playlist to match this request: "{request.music_request}"

Evaluate every song in the following playlist. Determine which songs match the user's intent, vibe, energy, mood, genre, context, or style requested.
For each matching song, calculate an alignment score (0 to 100) representing how well it fits. 
Be realistic and differentiate the scores (do not return 100 for all matching tracks; use the full range).
Also provide a short explanation (match reason) for each selected song.

Playlist Tracks:
{json.dumps(tracks_data, indent=2)}

Output a JSON object containing the filtered list of matching tracks. Do NOT return any markdown code blocks or explanations outside of the JSON.

Expected Output Format:
{{
  "playlist": [
    {{
      "id": "song_id",
      "score": 85,
      "matchReasons": ["Fits the acoustic and calm mood requested"]
    }}
  ]
}}"""

        # Try Gemini 2.0 Flash first
        if api_key:
            try:
                headers = {"Content-Type": "application/json"}
                payload = {
                    "contents": [{
                        "parts": [{
                            "text": prompt
                        }]
                    }],
                    "generationConfig": {
                        "responseMimeType": "application/json"
                    }
                }
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
                resp = requests.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    resp_json = resp.json()
                    text_content = resp_json['candidates'][0]['content']['parts'][0]['text'].strip()
                    success = True
                else:
                    print(f"Gemini 2.0 Flash failed: status {resp.status_code}, error: {resp.text}")
            except Exception as e:
                print(f"Gemini 2.0 Flash exception: {e}")
                
        # Try Gemini 1.5 Flash fallback
        if not success and api_key:
            try:
                headers = {"Content-Type": "application/json"}
                payload = {
                    "contents": [{
                        "parts": [{
                            "text": prompt
                        }]
                    }],
                    "generationConfig": {
                        "responseMimeType": "application/json"
                    }
                }
                url_fallback = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
                resp = requests.post(url_fallback, json=payload, headers=headers)
                if resp.status_code == 200:
                    resp_json = resp.json()
                    text_content = resp_json['candidates'][0]['content']['parts'][0]['text'].strip()
                    success = True
                else:
                    print(f"Gemini 1.5 Flash failed: status {resp.status_code}, error: {resp.text}")
            except Exception as e:
                print(f"Gemini 1.5 Flash exception: {e}")

        # Try Groq Llama 3.3 fallback
        if not success and groq_api_key:
            try:
                print("Falling back to Groq Llama-3.3-70b...")
                groq_url = "https://api.groq.com/openai/v1/chat/completions"
                groq_headers = {
                    "Authorization": f"Bearer {groq_api_key}",
                    "Content-Type": "application/json"
                }
                groq_payload = {
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": "You are a professional music recommendation assistant. You return only raw JSON as requested."},
                        {"role": "user", "content": prompt}
                    ],
                    "response_format": {"type": "json_object"}
                }
                resp = requests.post(groq_url, json=groq_payload, headers=groq_headers)
                if resp.status_code == 200:
                    resp_json = resp.json()
                    text_content = resp_json['choices'][0]['message']['content'].strip()
                    success = True
                else:
                    print(f"Groq Llama-3.3 failed: status {resp.status_code}, error: {resp.text}")
            except Exception as e:
                print(f"Groq Llama-3.3 exception: {e}")

        if not success:
            raise Exception("All AI APIs failed (Gemini and Groq). Please check quota/keys.")

        parsed_result = json.loads(text_content)
        playlist = parsed_result.get("playlist", [])

        # 3. Sanitize and format outputs
        sanitized_playlist = []
        for track_item in playlist:
            track_id = track_item.get("id")
            score = track_item.get("score", 0)
            try:
                score = int(float(score))
            except:
                score = 0
            
            reasons = track_item.get("matchReasons", [])
            if isinstance(reasons, str):
                reasons = [reasons]
            
            if track_id:
                sanitized_playlist.append({
                    "id": track_id,
                    "score": score,
                    "matchReasons": reasons
                })

        return RecommendResponse(
            playlist=sanitized_playlist,
            status="success"
        )

    except Exception as e:
        return RecommendResponse(
            status="error",
            error=str(e)
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
