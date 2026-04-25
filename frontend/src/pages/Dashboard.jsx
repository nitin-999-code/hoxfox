import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const Dashboard = () => {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { logout, isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) return;

    const getPlaylists = async () => {
      try {
        const response = await api.get('/playlists');
        setPlaylists(Array.isArray(response.data) ? response.data : (response.data.items || []));
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch playlists:', err);
        setError('Failed to fetch playlists');
        setLoading(false);
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          logout();
        }
      }
    };

    getPlaylists();
  }, [isAuthenticated, logout]);

  if (loading) return <div className="p-8 text-white bg-black min-h-screen flex items-center justify-center">Loading playlists...</div>;
  if (error) return <div className="p-8 text-red-500 bg-black min-h-screen flex items-center justify-center">{error}</div>;

  return (
    <div className="p-8 min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Your Playlists</h1>
          <button onClick={logout} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition font-medium">Logout</button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {playlists.map(playlist => {
            // Handle both raw Spotify objects and custom mapped objects
            const trackCount = typeof playlist.tracks === 'number' 
              ? playlist.tracks 
              : playlist.tracks?.total ?? playlist.trackCount ?? 0;
              
            return (
              <Link 
                to={`/playlist/${playlist.id}`}
                key={playlist.id} 
                className="bg-gray-800 p-4 rounded-lg shadow-lg hover:bg-gray-700 transition cursor-pointer hover:scale-[1.02] block"
              >
                {playlist.images && playlist.images.length > 0 ? (
                  <img src={playlist.images[0].url} alt={playlist.name} className="w-full aspect-square object-cover rounded-md mb-4 shadow-md" />
                ) : (
                  <div className="w-full aspect-square bg-gray-600 rounded-md mb-4 flex items-center justify-center text-gray-400 shadow-md">No Image</div>
                )}
                <h2 className="text-lg font-semibold truncate mb-1" title={playlist.name}>{playlist.name}</h2>
                <p className="text-sm text-gray-400">{trackCount} tracks</p>
              </Link>
            );
          })}
          {playlists.length === 0 && (
            <div className="col-span-full text-center text-gray-400 py-12">
              You don't have any playlists yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
