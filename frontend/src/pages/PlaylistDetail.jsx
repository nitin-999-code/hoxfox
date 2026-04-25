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

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchTracks = async () => {
      try {
        const response = await api.get(`/playlists/${id}`);
        // Handle both raw array and { items: [] } depending on backend mapping
        setTracks(Array.isArray(response.data) ? response.data : (response.data.items || []));
      } catch (err) {
        console.error('Error fetching tracks:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTracks();
  }, [id, isAuthenticated]);

  if (loading) return <div className="p-8 text-white bg-black min-h-screen flex justify-center items-center">Loading tracks...</div>;

  return (
    <div className="p-8 min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate(-1)} className="mb-6 text-gray-400 hover:text-white transition flex items-center gap-2">
          &larr; Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold mb-6">Playlist Tracks</h1>
        <div className="bg-gray-900 rounded-lg p-6 shadow-xl">
          {tracks.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No tracks found.</p>
          ) : (
            <ul className="space-y-2">
              {tracks.map((item, index) => {
                const track = item.track;
                if (!track) return null;
                return (
                  <li key={track.id || index} className="flex items-center space-x-4 p-3 hover:bg-gray-800 rounded-md transition cursor-default">
                    {track.album?.images?.[0] ? (
                      <img src={track.album.images[0].url} className="w-12 h-12 rounded object-cover shadow-sm" alt={track.name} />
                    ) : (
                      <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center">🎵</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{track.name}</p>
                      <p className="text-sm text-gray-400 truncate">
                        {track.artists?.map(a => a.name).join(', ')}
                      </p>
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
