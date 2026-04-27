const express = require('express');
const playlistController = require('../controllers/playlistController');

const router = express.Router();

router.get('/',            playlistController.getPlaylists);
router.get('/:id',         playlistController.getPlaylistTracks);
router.post('/filter',     playlistController.filterPlaylist);      // ← THE MISSING ROUTE
router.post('/create',     playlistController.createPlaylist);
router.post('/add-tracks', playlistController.addTracksToPlaylist);
router.post('/filter', playlistController.filterPlaylist);

module.exports = router;