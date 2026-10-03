const mongoose = require('mongoose');
const Task = require('../models/Task');

// Only these fields can be set from a request body.
const ALLOWED_FIELDS = ['title', 'aquarium', 'type', 'frequency', 'dueDate', 'completed', 'notes'];

function pickAllowed(body) {
  const data = {};
  if (!body || typeof body !== 'object') return data;
  ALLOWED_FIELDS.forEach((field) => {
    if (body[field] !== undefined) data[field] = body[field];
  });
  return data;
}

function toBoolean(value) {
  return value === true || value === 'true';
}

// Returns an error message if dueDate is present but not a real date.
function dueDateProblem(data) {
  if (data.dueDate !== undefined && Number.isNaN(new Date(data.dueDate).getTime())) {
    return 'Due date is not a valid date';
  }
  return null;
}

function handleError(res, err) {
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: 'Validation failed', errors });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid value for ' + err.path });
  }
  console.error(err);
  return res.status(500).json({ message: 'Server error' });
}

function invalidId(res) {
  return res.status(400).json({ message: 'Invalid task id' });
}

// GET /api/tasks
exports.getTasks = async (req, res) => {
  try {
    const tasks = await Task.find().sort({ dueDate: 1, createdAt: -1 });
    res.status(200).json(tasks);
  } catch (err) {
    handleError(res, err);
  }
};

// GET /api/tasks/:id
exports.getTask = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.status(200).json(task);
  } catch (err) {
    handleError(res, err);
  }
};

// POST /api/tasks
exports.createTask = async (req, res) => {
  try {
    const data = pickAllowed(req.body);
    const problem = dueDateProblem(data);
    if (problem) return res.status(400).json({ message: 'Validation failed', errors: [problem] });

    if (data.completed !== undefined) {
      data.completed = toBoolean(data.completed);
      if (data.completed) data.completedAt = new Date();
    }

    const task = await Task.create(data);
    res.status(201).json(task);
  } catch (err) {
    handleError(res, err);
  }
};

// PUT /api/tasks/:id  (also used to mark a task completed / not completed)
exports.updateTask = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);

    const data = pickAllowed(req.body);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const problem = dueDateProblem(data);
    if (problem) return res.status(400).json({ message: 'Validation failed', errors: [problem] });

    if (data.completed !== undefined) {
      data.completed = toBoolean(data.completed);
      data.completedAt = data.completed ? new Date() : null;
    }

    const task = await Task.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.status(200).json(task);
  } catch (err) {
    handleError(res, err);
  }
};

// DELETE /api/tasks/:id
exports.deleteTask = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.status(200).json({ message: 'Task deleted', task });
  } catch (err) {
    handleError(res, err);
  }
};
