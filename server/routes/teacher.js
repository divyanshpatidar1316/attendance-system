const express = require('express');
const auth = require('../middleware/auth');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const router = express.Router();

// Get teacher's classes
router.get('/classes', auth('teacher'), async (req, res) => {
    try {
        const classes = await Class.find({ teacher: req.user.id })
            .populate('students', 'name email')
            .select('-__v');
        res.json({ success: true, data: classes });
    } catch (err) {
        console.error('Error fetching classes:', err);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch classes',
            error: err.message 
        });
    }
});

// Get today's attendance for a specific class (or all classes if no classId provided)
router.get('/today', auth('teacher'), async (req, res) => {
    try {
        const { classId } = req.query; // Get classId from query parameters
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let query = {
            teacher: req.user.id,
            date: { $gte: today }
        };

        let classesQuery = { teacher: req.user.id };

        if (classId) {
            query.class = classId; // Filter attendance by classId
            classesQuery._id = classId; // Filter classes to get students for that specific class
        }

        // Get attendance records for today (filtered by class if classId is present)
        const attendanceRecords = await Attendance.find(query)
            .populate('student', 'name email');

        // Get students in the relevant classes (filtered by class if classId is present)
        const relevantClasses = await Class.find(classesQuery)
            .populate('students', 'name email');
        
        const allStudents = relevantClasses.flatMap(cls => cls.students);
        
        // Filter present students from the attendance records
        const presentStudents = attendanceRecords
            .filter(record => record.status === 'present')
            .map(record => ({
                id: record.student._id,
                name: record.student.name,
                email: record.student.email,
                time: record.createdAt
            }));

        const presentEmails = new Set(presentStudents.map(s => s.email));
        
        // Identify absent students by comparing all students in the class(es) with those present
        const absentStudents = allStudents
            .filter(student => !presentEmails.has(student.email))
            .map(student => ({
                id: student._id,
                name: student.name,
                email: student.email
            }));

        res.json({ 
            success: true,
            data: {
                present: presentStudents,
                absent: absentStudents,
                totalStudents: allStudents.length,
                attendancePercentage: allStudents.length > 0 
                    ? Math.round((presentStudents.length / allStudents.length) * 100)
                    : 0
            }
        });

    } catch (err) {
        console.error('Error fetching attendance:', err);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch attendance',
            error: err.message 
        });
    }
});

// Create new class
router.post('/classes', auth('teacher'), async (req, res) => {
    try {
        const { name, code } = req.body;

        // Validate class code is unique for this teacher (optional, can be globally unique)
        const existingClass = await Class.findOne({ code, teacher: req.user.id });
        if (existingClass) {
            return res.status(400).json({
                success: false,
                message: 'You already have a class with this code.'
            });
        }
         // Validate global class code uniqueness as a fallback
        const globalExistingClass = await Class.findOne({ code });
        if (globalExistingClass) {
            return res.status(400).json({
                success: false,
                message: 'Class code already exists, please choose a different one.'
            });
        }


        const newClass = new Class({
            name,
            code,
            teacher: req.user.id,
            schedule: [] // Initialize empty schedule
        });

        await newClass.save();
        
        res.status(201).json({ 
            success: true,
            message: 'Class created successfully',
            data: newClass
        });

    } catch (err) {
        console.error('Error creating class:', err);
        res.status(500).json({ 
            success: false,
            message: 'Failed to create class',
            error: err.message 
        });
    }
});

// Generate attendance code for class
router.post('/classes/:id/generate-code', auth('teacher'), async (req, res) => {
    try {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now (adjust as needed)

        const updatedClass = await Class.findOneAndUpdate(
            { 
                _id: req.params.id,
                teacher: req.user.id 
            },
            { 
                activeCode: code,
                codeExpires: expiresAt 
            },
            { new: true }
        );

        if (!updatedClass) {
            return res.status(404).json({
                success: false,
                message: 'Class not found or you are not authorized to generate code for this class.'
            });
        }

        res.json({ 
            success: true,
            message: 'Attendance code generated',
            data: {
                code,
                expiresAt,
                class: updatedClass.name
            }
        });

    } catch (err) {
        console.error('Error generating code:', err);
        res.status(500).json({ 
            success: false,
            message: 'Failed to generate code',
            error: err.message 
        });
    }
});

module.exports = router;