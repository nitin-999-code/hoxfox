// Route definitions for OAuth
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/login', authController.login);
router.get('/callback', authController.callback);
router.post('/refresh', authController.refresh);

module.exports = router;
