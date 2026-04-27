// Route definitions for filtering
const express = require('express');
const router = express.Router();
const filterController = require('../controllers/filterController');

router.post('/', filterController.filterPlaylist);

module.exports = router;
