const express = require('express');
const controller = require('../controllers/taskController');

const router = express.Router();

router.route('/').get(controller.getTasks).post(controller.createTask);

router
  .route('/:id')
  .get(controller.getTask)
  .put(controller.updateTask)
  .delete(controller.deleteTask);

module.exports = router;
