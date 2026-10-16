const express = require('express');
const controller = require('../controllers/waterController');

const router = express.Router();

router.post('/', controller.addReading);
router.get('/latest', controller.getLatest);

module.exports = router;
