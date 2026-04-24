// Route definitions for Artist genre fetching
const express = require('express');
const router = express.Router();
const genreController = require('../controllers/genreController');

router.post('/artists', genreController.getArtistsGenres);

module.exports = router;
