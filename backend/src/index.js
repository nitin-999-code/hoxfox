// Express app entry point
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const playlistRoutes = require('./routes/playlist');
const genreRoutes = require('./routes/genres');

const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
app.use(express.json());
app.use(cors({
  origin: CLIENT_URL
}));

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: "ok" });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/playlist', playlistRoutes);
app.use('/api/genres', genreRoutes);

// Error handling middleware should be last
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
