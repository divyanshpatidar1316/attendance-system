const express = require('express');
const auth = require('../middleware/auth');
const Attendance = require('../models/Attendance');
const Class = require('../models/Class');
const router = express.Router();

// Mark attendance
router.post('/mark', auth('student'), async (req, res) => {
    try {
        const { code, location } = req.body;
        const studentId = req.user.id;

        // Find active class with this code
        const activeClass = await Class.findOne({
            activeCode: code,
            codeExpires: { $gt: new Date() }
        });

        if (!activeClass) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid or expired attendance code' 
            });
        }

        // Check if already marked today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existingAttendance = await Attendance.findOne({
            student: studentId,
            class: activeClass._id,
            date: { $gte: today }
        });

        if (existingAttendance) {
            return res.status(400).json({
                success: false,
                message: 'Attendance already marked for today'
            });
        }

        // Create new attendance record
        const attendance = new Attendance({
            student: studentId,
            teacher: activeClass.teacher,
            class: activeClass._id,
            code: code,
            location: location,
            status: 'present'
        });

        await attendance.save();

        res.json({
            success: true,
            message: 'Attendance marked successfully',
            class: activeClass.name
        });

    } catch (err) {
        console.error('Error marking attendance:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error while marking attendance' 
        });
    }
});

module.exports = router;