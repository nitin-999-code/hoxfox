import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';

const PlaylistDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useContext(AuthContext);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state — NEW
  const [query, setQuery] = useState('');
  const [filtering, setFiltering] = useState(false);
  const [filterError, setFilterError] = useState(null);
  const [filterResult, setFilterResult] = useState(null); // null = not filtered yet

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchTracks = async () => {
      try {
        const response = await api.get(`/playlists/${id}`);
        console.log("Raw API response:", response.data);
        
        // Handle both raw array and { items: [] } depending on backend mapping
        const items = Array.isArray(response.data) ? response.data : (response.data.items || []);
        console.log("Track items count:", items.length);
        if (items.length > 0) {
          console.log("First item:", JSON.stringify(items[0]).substring(0, 200));
        }
        
        setTracks(items);
      } catch (err) {
        console.error('Error fetching tracks:', err);
        setError(err.response?.data?.error || err.message || 'Failed to fetch tracks');
      } finally {
        setLoading(false);
      }
    };
    fetchTracks();
  }, [id, isAuthenticated]);

  // Filter handler — NEW
  const handleFilter = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setFiltering(true);
    setFilterError(null);
    setFilterResult(null);

    try {
      const response = await api.post('/playlists/filter', {
        playlistId: id,
        query: query.trim(),
        topN: 50,
      });
      setFilterResult(response.data);
    } catch (err) {
      console.error('Filter error:', err);
      setFilterError(err.response?.data?.error || err.message || 'Filter failed');
    } finally {
      setFiltering(false);
    }
  };

  // Clear filter — NEW
  const handleClearFilter = () => {
    setFilterResult(null);
    setFilterError(null);
    setQuery('');
  };

  if (loading) return <div className="p-8 text-white bg-black min-h-screen flex justify-center items-center">Loading tracks...</div>;
  if (error) return <div className="p-8 text-red-400 bg-black min-h-screen flex justify-center items-center">{error}</div>;

  // Decide what to show — NEW
  const isFiltered = filterResult !== null;
  const displayTracks = isFiltered ? filterResult.tracks : tracks;

  return (
    <div className="p-8 min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate(-1)} className="mb-6 text-gray-400 hover:text-white transition flex items-center gap-2">
          &larr; Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold mb-2">Playlist Tracks</h1>

        {/* Filter Bar — NEW */}
        <form onSubmit={handleFilter} className="my-4 flex gap-3">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder='e.g. "songs for sleeping", "workout", "chill vibes"'
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition"
            disabled={filtering}
          />
          <button
            type="submit"
            disabled={filtering || !query.trim()}
            className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
          >
            {filtering ? 'Filtering...' : 'Filter'}
          </button>
          {isFiltered && (
            <button
              type="button"
              onClick={handleClearFilter}
              className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
            >
              Clear
            </button>
          )}
        </form>

        {/* Filter Result Banner — NEW */}
        {isFiltered && (
          <div className="mb-3 p-4 bg-gray-900 border border-green-800 rounded-lg flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-green-400 font-semibold">{filterResult.label}</span>
              <span className="text-gray-400 ml-2 text-sm">
                — {filterResult.tracks.length} of {filterResult.totalConsidered} tracks matched
                {filterResult.relaxed && <span className="text-yellow-400 ml-2">(filters relaxed)</span>}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              via {filterResult.intentSource === 'rules' ? '⚡ rules' : '🤖 AI'}
            </span>
          </div>
        )}

        {/* Filter Error — NEW */}
        {filterError && (
          <div className="mb-3 p-3 bg-red-900 border border-red-700 rounded-lg text-red-300 text-sm">
            {filterError}
          </div>
        )}

        <p className="text-gray-400 mb-6">{displayTracks.length} tracks</p>

        <div className="bg-gray-900 rounded-lg p-6 shadow-xl">
          {displayTracks.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              {isFiltered ? 'No tracks matched your query. Try something different.' : 'No tracks found.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {displayTracks.map((item, index) => {
                // Handle both formats:
                // Standard: { track: { id, name, artists, album, ... } }
                // Dev Mode: { id, name, artists, album, ... } (track IS the item)
                // Filtered: { id, name, artists, score, ... } (flat from filter endpoint)
                const track = item.track || item;
                if (!track || !track.name) return null;
                const durationMs = track.duration_ms || track.durationMs;
                const albumUrl = track.album?.images?.[0]?.url || track.album?.imageUrl;
                return (
                  <li key={track.id || index} className="flex items-start space-x-4 p-3 hover:bg-gray-800 rounded-md transition cursor-default">
                    {albumUrl ? (
                      <img src={albumUrl} className="w-12 h-12 rounded object-cover shadow-sm shrink-0" alt={track.name} />
                    ) : (
                      <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center shrink-0">🎵</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{track.name}</p>
                      <p className="text-sm text-gray-400 truncate">
                        {track.artists?.map(a => a.name || a).join(', ') || 'Unknown Artist'}
                      </p>
                      {isFiltered && item.matchReasons && item.matchReasons.length > 0 && (
                        <p className="text-xs text-green-400/90 mt-1 italic line-clamp-2">
                          💡 {Array.isArray(item.matchReasons) ? item.matchReasons.join('. ') : item.matchReasons}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 self-center">
                      {/* Score badge only shown when filtered — NEW */}
                      {isFiltered && item.score !== undefined && (
                        <span className="text-xs px-2 py-1 rounded-full bg-green-950 text-green-300 font-semibold border border-green-800/30">
                          {item.score}% match
                        </span>
                      )}
                      {durationMs && (
                        <span className="text-sm text-gray-500">
                          {Math.floor(durationMs / 60000)}:{String(Math.floor((durationMs % 60000) / 1000)).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaylistDetail;
