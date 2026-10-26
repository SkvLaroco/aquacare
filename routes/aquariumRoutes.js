const express = require('express');
const controller = require('../controllers/aquariumController');

const router = express.Router();

router.route('/').get(controller.getAquariums).post(controller.createAquarium);

module.exports = router;
