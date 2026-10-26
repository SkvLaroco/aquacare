const mongoose = require('mongoose');

// A named aquarium (tank) that tasks can belong to.
// nameKey is the lower-case name; its unique index stops duplicates such as "Betta" and "betta".
const aquariumSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Aquarium name is required'],
      trim: true,
      maxlength: [60, 'Aquarium name must be 60 characters or fewer'],
    },
    nameKey: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Aquarium || mongoose.model('Aquarium', aquariumSchema);
