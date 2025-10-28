const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const bodyParser = require('body-parser');

// Import route handlers
const registerRoutes = require('./routes/register');
const attendanceRoutes = require('./routes/attendance');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:8080', 'http://localhost:5500'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Database paths
const DB_DIR = path.join(__dirname, 'db');
const DB_PATH = path.join(DB_DIR, 'database.json');

// Ensure database directory exists
async function initializeDatabase() {
    try {
        await fs.mkdir(DB_DIR, { recursive: true });
        console.log('📁 Database directory initialized');
        
        // Check if database file exists
        try {
            await fs.access(DB_PATH);
            console.log('📄 Database file exists');
        } catch {
            // Create initial database structure
            const initialData = {
                students: [],
                attendance: [],
                meals: [],
                settings: {
                    schoolName: "Smart Attendance System",
                    academicYear: "2025-2026",
                    recognitionThreshold: 0.5,
                    mealTimeStart: "12:00",
                    mealTimeEnd: "13:00",
                    morningSessionStart: "08:00",
                    morningSessionEnd: "12:00",
                    afternoonSessionStart: "13:00",
                    afternoonSessionEnd: "17:00"
                },
                statistics: {
                    totalRegistrations: 0,
                    totalAttendanceMarked: 0,
                    totalMealsServed: 0,
                    dailyAttendance: {},
                    weeklyAttendance: {},
                    monthlyAttendance: {},
                    lastUpdated: new Date().toISOString(),
                    systemStarted: new Date().toISOString()
                },
                logs: {
                    registrations: [],
                    attendance: [],
                    meals: [],
                    system: []
                }
            };
            await fs.writeFile(DB_PATH, JSON.stringify(initialData, null, 2));
            console.log('✅ Database initialized with default structure');
        }
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        throw error;
    }
}

// Helper function to read database
async function readDatabase() {
    try {
        const data = await fs.readFile(DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('❌ Error reading database:', error);
        return {
            students: [],
            attendance: [],
            meals: [],
            settings: {
                schoolName: "Smart Attendance System",
                academicYear: "2025-2026",
                recognitionThreshold: 0.5
            },
            statistics: {
                totalRegistrations: 0,
                totalAttendanceMarked: 0,
                totalMealsServed: 0,
                lastUpdated: new Date().toISOString()
            }
        };
    }
}

// Helper function to write database
async function writeDatabase(data) {
    try {
        data.statistics = data.statistics || {};
        data.statistics.lastUpdated = new Date().toISOString();
        
        await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('❌ Error writing database:', error);
        return false;
    }
}

// Use route handlers
app.use('/api/register', registerRoutes);
app.use('/api/attendance', attendanceRoutes);

// ===== MEAL SYSTEM API ENDPOINTS ===== 

// Mark meal distribution
app.post('/api/meal/mark', async (req, res) => {
    try {
        const { studentId, timestamp } = req.body;
        
        console.log(`🍽️ Meal marking request: ${studentId} at ${timestamp}`);
        
        if (!studentId || !timestamp) {
            return res.status(400).json({
                success: false,
                message: 'Student ID and timestamp are required'
            });
        }
        
        const db = await readDatabase();
        const mealDate = timestamp.split('T')[0];
        
        // Check if student exists and is active
        const student = db.students.find(s => s.studentId === studentId && s.status === 'active');
        if (!student) {
            console.log(`❌ Student not found: ${studentId}`);
            return res.status(404).json({
                success: false,
                message: 'Student not found or inactive'
            });
        }
        
        // Check if meal already marked today
        const existingMeal = db.meals.find(meal =>
            meal.studentId === studentId && meal.date === mealDate
        );
        
        if (existingMeal) {
            console.log(`⚠️ Meal already marked for ${student.name} on ${mealDate}`);
            return res.json({
                success: true,
                alreadyMarked: true,
                message: `Meal already marked for ${student.name} today`,
                mealRecord: existingMeal,
                student: {
                    name: student.name,
                    studentId: student.studentId,
                    class: student.class
                }
            });
        }
        
        // Create meal record
        const mealRecord = {
            id: `MEAL_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            studentId: studentId,
            studentName: student.name,
            studentClass: student.class,
            date: mealDate,
            timestamp: timestamp,
            status: 'served',
            createdAt: new Date().toISOString(),
            metadata: {
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent') || 'Unknown'
            }
        };
        
        // Add to meals array
        db.meals.push(mealRecord);
        
        // Update statistics
        if (!db.statistics.totalMealsServed) {
            db.statistics.totalMealsServed = 0;
        }
        db.statistics.totalMealsServed++;
        
        // Save to database
        const saved = await writeDatabase(db);
        if (!saved) {
            console.log(`❌ Failed to save meal record for ${student.name}`);
            return res.status(500).json({
                success: false,
                message: 'Failed to save meal record'
            });
        }
        
        console.log(`✅ Meal marked successfully: ${student.name} (${studentId}) - ${mealDate}`);
        
        res.json({
            success: true,
            alreadyMarked: false,
            message: `Nutritious meal served to ${student.name}!`,
            mealRecord: mealRecord,
            student: {
                name: student.name,
                studentId: student.studentId,
                class: student.class
            }
        });
        
    } catch (error) {
        console.error('❌ Error marking meal:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while marking meal',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get meal statistics
app.get('/api/meal/stats', async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        const db = await readDatabase();
        
        const totalStudents = db.students.filter(s => s.status === 'active').length;
        const mealsServedToday = db.meals.filter(meal => meal.date === targetDate).length;
        const mealRate = totalStudents > 0 ? Math.round((mealsServedToday / totalStudents) * 100) : 0;
        
        res.json({
            success: true,
            date: targetDate,
            totalStudents,
            mealsServedToday,
            mealsRemaining: Math.max(0, totalStudents - mealsServedToday),
            mealRate,
            totalMealsServedAllTime: db.statistics.totalMealsServed || 0
        });
        
    } catch (error) {
        console.error('❌ Error getting meal stats:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching meal statistics'
        });
    }
});

// Get recent meal distribution
app.get('/api/meal/recent', async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const db = await readDatabase();
        
        const recentMeals = db.meals
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, parseInt(limit))
            .map(meal => ({
                id: meal.id,
                studentName: meal.studentName,
                studentId: meal.studentId,
                studentClass: meal.studentClass,
                timestamp: meal.timestamp,
                date: meal.date,
                status: meal.status
            }));
        
        res.json({
            success: true,
            meals: recentMeals,
            count: recentMeals.length
        });
        
    } catch (error) {
        console.error('❌ Error getting recent meals:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching recent meals'
        });
    }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const db = await readDatabase();
        const dbStats = {
            students: db.students.length,
            attendance: db.attendance.length,
            meals: db.meals.length,
            lastUpdated: db.statistics.lastUpdated
        };
        
        res.json({
            success: true,
            status: 'healthy',
            message: 'Smart Attendance System API is running smoothly',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            database: dbStats,
            endpoints: {
                registration: '/api/register/*',
                attendance: '/api/attendance/*',
                meals: '/api/meal/*'
            }
        });
        
    } catch (error) {
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            message: 'Database connection issues',
            timestamp: new Date().toISOString()
        });
    }
});

// 🔑 **CRITICAL: Serve static files from frontend directory**
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// 🔑 **CRITICAL: Serve models folder specifically for face-api.js**
app.use('/models', express.static(path.join(__dirname, '..', 'frontend', 'models')));

// Fallback route for SPA (Single Page Application)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('💥 Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Initialize database and start server
async function startServer() {
    try {
        console.log('🚀 Starting Smart Attendance System Server...');
        
        // Initialize database
        await initializeDatabase();
        
        // Start listening
        app.listen(PORT, () => {
            console.log('\n🎯 ================================');
            console.log(`🌟 Smart Attendance System Server`);
            console.log(`🌐 Running on: http://localhost:${PORT}`);
            console.log(`📊 Database: ${DB_PATH}`);
            console.log(`🎨 Frontend: ${path.join(__dirname, '..', 'frontend')}`);
            console.log(`🤖 Models: ${path.join(__dirname, '..', 'frontend', 'models')}`);
            console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
            console.log('🎯 ================================\n');
            
            console.log('✅ Server ready! Open http://localhost:3000 in your browser');
            console.log('\n📋 CRITICAL: Models are served at http://localhost:3000/models/');
            console.log('🔧 Your face-api.js will now load models from LOCAL folder!');
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received. Shutting down gracefully...');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start the server
startServer();
