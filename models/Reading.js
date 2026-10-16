const mongoose = require('mongoose');

// One water level reading sent by the sensor (ESP32 / Arduino-style device).
const readingSchema = new mongoose.Schema(
  {
    level: { type: Number, required: true, min: 0, max: 100 }, // percent
    status: { type: String, enum: ['OK', 'LOW', 'CRITICAL'], required: true },
    aquarium: { type: String, trim: true, maxlength: 60, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Reading || mongoose.model('Reading', readingSchema);
