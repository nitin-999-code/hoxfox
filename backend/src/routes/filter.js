// Route definitions for filtering
const express = require('express');
const router = express.Router();
const filterController = require('../controllers/filterController');

router.post('/', filterController.filterPlaylist);
router.post('/debug', filterController.debugFilter);

module.exports = router;
