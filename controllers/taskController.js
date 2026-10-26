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

// ---------- Recurring tasks ----------
// Daily, Weekly and Monthly tasks create their next occurrence when completed.
const RECURRING = ['Daily', 'Weekly', 'Monthly'];

// Adds one interval to a date (all maths in UTC, because dueDate is stored as midnight UTC).
function addInterval(date, frequency) {
  const d = new Date(date);
  if (frequency === 'Daily') {
    d.setUTCDate(d.getUTCDate() + 1);
  } else if (frequency === 'Weekly') {
    d.setUTCDate(d.getUTCDate() + 7);
  } else if (frequency === 'Monthly') {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, lastDay)); // e.g. Jan 31 -> Feb 28
  }
  return d;
}

// The next due date: one interval after the old due date, moved forward
// until it is later than today (so an overdue task does not create overdue copies).
function nextDueDate(dueDate, frequency, todayStr) {
  let next = addInterval(dueDate, frequency);
  while (next.toISOString().slice(0, 10) <= todayStr) {
    next = addInterval(next, frequency);
  }
  return next;
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

    const existing = await Task.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Task not found' });

    // Completing a Daily / Weekly / Monthly task creates the next occurrence.
    let nextTask = null;
    const frequency = data.frequency !== undefined ? data.frequency : existing.frequency;
    if (data.completed === true && !existing.completed && !existing.nextCreated && RECURRING.includes(frequency)) {
      const body = req.body || {};
      // The browser sends its own "today" so the result matches the user's time zone.
      const todayStr = /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);
      const dueDate = data.dueDate !== undefined ? data.dueDate : existing.dueDate;
      nextTask = await Task.create({
        title: data.title !== undefined ? data.title : existing.title,
        aquarium: data.aquarium !== undefined ? data.aquarium : existing.aquarium,
        type: data.type !== undefined ? data.type : existing.type,
        frequency,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        dueDate: nextDueDate(dueDate, frequency, todayStr),
      });
      data.nextCreated = true;
    }

    const task = await Task.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.status(200).json({ ...task.toObject(), nextTask });
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
