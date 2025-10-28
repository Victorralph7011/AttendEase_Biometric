const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Path to database JSON file
const DB_PATH = path.join(__dirname, '..', 'db', 'database.json');

// Helper to read the database
async function readDatabase() {
    try {
        const data = await fs.readFile(DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading database:', error);
        return {
            students: [],
            attendance: [],
            settings: {
                recognitionThreshold: 0.5,
                schoolName: "Smart Attendance System",
                academicYear: "2025-2026"
            },
            statistics: {}
        };
    }
}

// Helper to write to the database
async function writeDatabase(data) {
    try {
        await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('Error writing database:', error);
        return false;
    }
}

// Validation function
function validateStudentData(data) {
    const errors = [];

    if (!data.name || data.name.trim().length < 2) errors.push("Name must be at least 2 characters.");
    if (!data.studentId || !/^[A-Za-z0-9]{3,10}$/.test(data.studentId.trim())) errors.push("Student ID must be 3-10 alphanumeric.");
    if (!data.class || !["1","2","3","4","5","6","7","8","9","10"].includes(data.class.toString())) errors.push("Class must be between 1 and 10.");
    if (!data.parentName || data.parentName.trim().length < 2) errors.push("Parent/Guardian name must be at least 2 characters.");
    if (!data.faceData || !Array.isArray(data.faceData.descriptors) || data.faceData.descriptors.length === 0) errors.push("Face descriptors are required.");
    
    // Validate all descriptors length
    if (data.faceData?.descriptors) {
        for (let i = 0; i < data.faceData.descriptors.length; i++) {
            if (!Array.isArray(data.faceData.descriptors[i]) || data.faceData.descriptors[i].length !== 128) {
                errors.push(`Descriptor ${i + 1} must be an array of 128 numbers.`);
                break;
            }
        }
    }

    return errors;
}

// Route: Check if Student ID exists
router.post('/check', async (req, res) => {
    try {
        const { studentId } = req.body;

        if (!studentId) {
            return res.status(400).json({ success: false, message: "Student ID is required." });
        }

        const db = await readDatabase();
        const exists = db.students.some(s => s.studentId.toLowerCase() === studentId.toLowerCase() && s.status === "active");
        
        res.json({ success: true, exists });
    } catch (error) {
        console.error("Error in /check:", error);
        res.status(500).json({ success: false, message: "Server error checking Student ID." });
    }
});

// Route: Register Student
router.post('/', async (req, res) => {
    try {
        const data = req.body;

        // Validate input
        const validationErrors = validateStudentData(data);
        if (validationErrors.length > 0) {
            return res.status(400).json({ success: false, message: "Validation failed", errors: validationErrors });
        }

        const db = await readDatabase();

        // Duplicate check
        if (db.students.some(s => s.studentId.toLowerCase() === data.studentId.toLowerCase() && s.status === "active")) {
            return res.status(409).json({ success: false, message: "Student ID already exists." });
        }

        const newStudent = {
            id: `stu_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
            name: data.name.trim(),
            studentId: data.studentId.trim(),
            class: data.class,
            parentName: data.parentName.trim(),
            faceData: {
                descriptors: data.faceData.descriptors,
                confidence: data.faceData.confidence || 0,
                imageCount: data.faceData.descriptors.length,
                registrationTimestamp: new Date().toISOString()
            },
            status: "active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: {
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.get("User-Agent") || "Unknown",
                appVersion: "1.0.0"
            }
        };

        db.students.push(newStudent);
        db.statistics = db.statistics || {};
        db.statistics.totalRegistrations = (db.statistics.totalRegistrations || 0) + 1;

        // Save database
        const saved = await writeDatabase(db);
        if (!saved) {
            return res.status(500).json({ success: false, message: "Failed to save student registration." });
        }
        
        console.log(`Registered new student: ${newStudent.name} (${newStudent.studentId})`);

        res.status(201).json({
            success: true,
            message: "Student registered successfully",
            student: {
                id: newStudent.id,
                name: newStudent.name,
                studentId: newStudent.studentId,
                class: newStudent.class,
                parentName: newStudent.parentName,
                registrationTimestamp: newStudent.faceData.registrationTimestamp
            }
        });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ success: false, message: "Internal server error.", error: error.message });
    }
});

// Other routes (get students, update, delete) can be added similarly...

module.exports = router;
