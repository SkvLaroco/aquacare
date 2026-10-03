const mongoose = require('mongoose');

const TASK_TYPES = [
  'Feeding',
  'Water Change',
  'Water Testing',
  'Filter Cleaning',
  'Plant Maintenance',
  'Medication',
  'Other',
];

const FREQUENCIES = ['Once', 'Daily', 'Weekly', 'Monthly', 'Other'];

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title must be 100 characters or fewer'],
    },
    aquarium: {
      type: String,
      required: [true, 'Aquarium name is required'],
      trim: true,
      maxlength: [60, 'Aquarium name must be 60 characters or fewer'],
    },
    type: {
      type: String,
      required: [true, 'Task type is required'],
      enum: { values: TASK_TYPES, message: 'Task type must be one of: ' + TASK_TYPES.join(', ') },
    },
    frequency: {
      type: String,
      enum: { values: FREQUENCIES, message: 'Frequency must be one of: ' + FREQUENCIES.join(', ') },
      default: 'Once',
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes must be 500 characters or fewer'],
      default: '',
    },
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

module.exports = mongoose.models.Task || mongoose.model('Task', taskSchema);
module.exports.TASK_TYPES = TASK_TYPES;
module.exports.FREQUENCIES = FREQUENCIES;
