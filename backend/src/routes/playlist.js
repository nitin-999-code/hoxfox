// Route definitions for Playlist fetching
const express = require('express');
const router = express.Router();
const playlistController = require('../controllers/playlistController');

router.get('/:playlistId/tracks', playlistController.getTracks);

module.exports = router;
