from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Type, List, Dict, Any
import requests
import json

class SpotifyRecommendationInput(BaseModel):
    """Input schema for Spotify Recommendation Tool."""
    seed_track_ids: str = Field(description="Comma-separated Spotify track IDs (up to 5)")
    target_energy: float = Field(description="Target energy level (0.0 to 1.0)")
    target_valence: float = Field(description="Target valence/happiness (0.0 to 1.0)")
    target_tempo: float = Field(description="Target tempo in BPM")
    spotify_access_token: str = Field(description="Spotify Bearer access token")
    limit: int = Field(default=20, description="Number of recommendations to fetch")

class SpotifyRecommendationTool(BaseTool):
    name: str = "Spotify Recommendation Tool"
    description: str = "Fetches real song recommendations from Spotify API given seed tracks and target audio features. Returns a JSON list of tracks."
    args_schema: Type[BaseModel] = SpotifyRecommendationInput

    def _run(self, seed_track_ids: str, target_energy: float, target_valence: float, 
             target_tempo: float, spotify_access_token: str, limit: int = 20) -> str:
        try:
            url = "https://api.spotify.com/v1/recommendations"
            headers = {
                "Authorization": f"Bearer {spotify_access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "seed_tracks": seed_track_ids,
                "target_energy": target_energy,
                "target_valence": target_valence,
                "target_tempo": target_tempo,
                "limit": limit
            }

            response = requests.get(url, headers=headers, params=params, timeout=10)
            
            if response.status_code != 200:
                return json.dumps({
                    "error": f"Spotify API error: {response.status_code} - {response.text}"
                })

            data = response.json()
            tracks = []

            for item in data.get("tracks", []):
                # Extract year from release_date
                release_date = item.get("album", {}).get("release_date", "")
                year = release_date.split("-")[0] if release_date else "N/A"

                tracks.append({
                    "title": item.get("name"),
                    "artist": ", ".join([a.get("name") for a in item.get("artists", [])]),
                    "album": item.get("album", {}).get("name"),
                    "year": year,
                    "spotify_id": item.get("id"),
                    "uri": item.get("uri"),
                    "energy": "N/A",
                    "valence": "N/A",
                    "tempo": "N/A"
                })

            return json.dumps(tracks)

        except Exception as e:
            return json.dumps({"error": str(e)})
