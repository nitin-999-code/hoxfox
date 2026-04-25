import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5001'
});

// Automatically attach Authorization header
api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem('spotify_access_token');
    const refreshToken = localStorage.getItem('spotify_refresh_token');

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    if (refreshToken) {
      config.headers['x-refresh-token'] = refreshToken;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
