
const express = require('express');
const auth = require('../middleware/auth');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');
const router = express.Router();

// Get all classes for student
router.get('/classes', auth('student'), async (req, res) => {
  try {
    const classes = await Class.find({ students: req.user.id })
      .select('name code schedule')
      .populate('teacher', 'name');
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get attendance for specific class
router.get('/attendance/:classId', auth('student'), async (req, res) => {
  try {
    const { classId } = req.params;
    const attendance = await Attendance.find({
      student: req.user.id,
      class: classId
    })
      .sort({ date: -1 })
      .populate('class', 'name code')
      .populate('teacher', 'name');

    res.json(attendance);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get attendance stats for class
router.get('/stats/:classId', auth('student'), async (req, res) => {
  try {
    const { classId } = req.params;
    const total = await Attendance.countDocuments({
      student: req.user.id,
      class: classId
    });
    const present = await Attendance.countDocuments({
      student: req.user.id,
      class: classId,
      status: 'present'
    });
    
    res.json({
      total,
      present,
      absent: total - present,
      percentage: total > 0 ? Math.round((present / total) * 100) : 0
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;