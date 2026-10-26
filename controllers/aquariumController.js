const Aquarium = require('../models/Aquarium');

// GET /api/aquariums
exports.getAquariums = async (req, res) => {
  try {
    const aquariums = await Aquarium.find().sort({ nameKey: 1 });
    res.status(200).json(aquariums);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/aquariums   body: { "name": "5G Betta Tank" }
exports.createAquarium = async (req, res) => {
  try {
    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return res.status(400).json({ message: 'Validation failed', errors: ['Aquarium name is required'] });
    }
    if (name.length > 60) {
      return res.status(400).json({ message: 'Validation failed', errors: ['Aquarium name must be 60 characters or fewer'] });
    }

    const aquarium = await Aquarium.create({ name, nameKey: name.toLowerCase() });
    res.status(201).json(aquarium);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'That aquarium already exists' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation failed', errors: Object.values(err.errors).map((e) => e.message) });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
