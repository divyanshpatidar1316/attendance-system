const mongoose = require('mongoose');

const ClassSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true }, // e.g. "MATH101"
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  schedule: [{
    day: { type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
    time: String,
    location: String
  }],
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  activeCode: { type: String }, // Added field
  codeExpires: { type: Date },  // Added field
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Class', ClassSchema);