// API calls to the backend for filtering
import api from '../services/api';

export const filterPlaylist = async (playlistId, userQuery) => {
  const response = await api.post('/api/filter', { playlistId, userQuery });
  return response.data;
};
