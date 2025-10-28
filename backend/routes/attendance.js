const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const DB_PATH = path.join(__dirname, '..', 'db', 'database.json');

async function readDatabase() {
    try {
        const data = await fs.readFile(DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch {
        return { students: [], attendance: [], settings: {}, statistics: {} };
    }
}

async function writeDatabase(data) {
    try {
        await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch {
        return false;
    }
}

// Calculate Euclidean distance between two descriptors
function euclideanDistance(desc1, desc2) {
    if (!desc1 || !desc2 || desc1.length !== desc2.length) return Infinity;

    let sum = 0;
    for (let i = 0; i < desc1.length; i++) {
        let diff = desc1[i] - desc2[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}

// Find best matching student using face descriptor
function findBestMatch(inputDescriptor, students, threshold = 0.6) {
    let bestMatch = null;
    let matchedStudent = null;

    for (const student of students) {
        if (student.status !== 'active' || !student.faceData || !student.faceData.descriptors) continue;

        for (const descriptor of student.faceData.descriptors) {
            const dist = euclideanDistance(inputDescriptor, descriptor);
            if (dist < threshold && (bestMatch === null || dist < bestMatch.distance)) {
                bestMatch = {
                    distance: dist,
                    confidence: Math.round((1 - dist) * 100)
                };
                matchedStudent = student;
            }
        }
    }
    return { bestMatch, matchedStudent };
}

// Get current time slot (morning, afternoon, meal)
function getCurrentTimeSlot() {
    const now = new Date();
    const time = now.toTimeString().slice(0, 5);

    const slots = {
        morning: { start: '08:00', end: '12:00', name: 'Morning Session' },
        meal: { start: '12:00', end: '13:00', name: 'Mid-Day Meal' },
        afternoon: { start: '13:00', end: '17:00', name: 'Afternoon Session' }
    };

    for (const [key, slot] of Object.entries(slots)) {
        if (time >= slot.start && time <= slot.end) {
            return { type: key, name: slot.name, active: true };
        }
    }

    return { type: 'none', name: 'No Active Session', active: false };
}

// POST /api/attendance/mark
router.post('/mark', async (req, res) => {
    try {
        const { faceDescriptor, timestamp, session, sessionType } = req.body;

        if (!faceDescriptor || !timestamp) {
            return res.status(400).json({ success: false, message: 'Face descriptor and timestamp required' });
        }
        if (!Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
            return res.status(400).json({ success: false, message: 'Invalid face descriptor' });
        }

        const db = await readDatabase();
        const threshold = db.settings?.recognitionThreshold || 0.6;

        const { bestMatch, matchedStudent } = findBestMatch(faceDescriptor, db.students, threshold);

        if (!matchedStudent) {
            return res.json({ success: false, recognized: false, message: 'Face not recognized', confidence: 0 });
        }

        const attendanceDate = timestamp.slice(0, 10);
        const slot = getCurrentTimeSlot();
        const sessionName = session || slot.name;

        // Check existing attendance for this student on this date and session
        const existing = db.attendance.find(a =>
            a.studentId === matchedStudent.studentId &&
            a.date === attendanceDate &&
            a.session === sessionName
        );

        if (existing) {
            return res.json({
                success: true,
                recognized: true,
                alreadyMarked: true,
                message: 'Attendance already marked',
                studentName: matchedStudent.name,
                studentId: matchedStudent.studentId,
                session: sessionName,
                timestamp: existing.timestamp
            });
        }

        // Create new attendance record
        const record = {
            id: `att_${Date.now()}`,
            studentId: matchedStudent.studentId,
            studentName: matchedStudent.name,
            studentClass: matchedStudent.class,
            timestamp,
            date: attendanceDate,
            session: sessionName,
            sessionType: sessionType || slot.type,
            status: 'present',
            confidence: bestMatch.confidence,
            createdAt: new Date().toISOString()
        };

        db.attendance.push(record);

        db.statistics = db.statistics || {};
        db.statistics.totalAttendance = (db.statistics.totalAttendance || 0) + 1;

        await writeDatabase(db);

        return res.json({
            success: true,
            recognized: true,
            alreadyMarked: false,
            message: 'Attendance marked successfully',
            studentName: record.studentName,
            studentId: record.studentId,
            session: record.session,
            timestamp: record.timestamp,
            confidence: record.confidence
        });
    } catch (error) {
        console.error('Attendance marking error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Additional routes like stats, recent records etc can be implemented similarly.

module.exports = router;
