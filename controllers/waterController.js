const Reading = require('../models/Reading');

const OK_LEVEL = 60;  // percent: at or above this is OK
const LOW_LEVEL = 30; // percent: at or above this (but below OK) is LOW; below is CRITICAL

function statusFor(level) {
  if (level >= OK_LEVEL) return 'OK';
  if (level >= LOW_LEVEL) return 'LOW';
  return 'CRITICAL';
}

// POST /api/water-level   (called by the sensor; needs the x-device-key header)
exports.addReading = async (req, res) => {
  try {
    const expectedKey = process.env.DEVICE_KEY;
    if (!expectedKey) {
      return res.status(503).json({ message: 'Device key is not configured on the server' });
    }
    if (req.get('x-device-key') !== expectedKey) {
      return res.status(401).json({ message: 'Invalid device key' });
    }

    const body = req.body || {};
    const level = Number(body.level);
    if (body.level === undefined || body.level === null || body.level === '' ||
        !Number.isFinite(level) || level < 0 || level > 100) {
      return res.status(400).json({ message: 'Validation failed', errors: ['Level must be a number from 0 to 100'] });
    }

    const aquarium = typeof body.aquarium === 'string' ? body.aquarium.trim().slice(0, 60) : '';
    const reading = await Reading.create({ level: Math.round(level), status: statusFor(level), aquarium });
    res.status(201).json(reading);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/water-level/latest   (used by the dashboard)
exports.getLatest = async (req, res) => {
  try {
    const reading = await Reading.findOne().sort({ createdAt: -1 });
    if (!reading) return res.status(404).json({ message: 'No readings yet' });
    res.status(200).json(reading);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
