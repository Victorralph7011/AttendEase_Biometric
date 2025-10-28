// Global variables for attendance system
let video = null;
let canvas = null;
let faceDetector = null;
let isModelLoaded = false;
let isScanning = false;
let recognitionTimeout = null;
let attendanceData = {
    totalStudents: 0,
    presentCount: 0,
    attendanceRate: 0
};

// Time slots configuration
const timeSlots = {
    morning: { start: '08:00', end: '12:00', name: 'Morning Session' },
    afternoon: { start: '13:00', end: '17:00', name: 'Afternoon Session' },
    meal: { start: '12:00', end: '13:00', name: 'Mid-Day Meal' }
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing attendance system...');
    
    // Start real-time clock
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Update time slots
    updateTimeSlots();
    setInterval(updateTimeSlots, 60000); // Update every minute
    
    // Load face recognition models
    await loadFaceAPIModels();
    
    // Load attendance statistics
    await loadAttendanceStats();
    
    // Load recent attendance log
    await loadRecentAttendance();
});

// Update current date and time display
function updateDateTime() {
    const now = new Date();
    
    // Format time (HH:MM:SS)
    const timeString = now.toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    // Format date
    const dateString = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const currentTimeEl = document.getElementById('currentTime');
    const currentDateEl = document.getElementById('currentDate');
    
    if (currentTimeEl) currentTimeEl.textContent = timeString;
    if (currentDateEl) currentDateEl.textContent = dateString;
}

// Update time slot status based on current time
function updateTimeSlots() {
    const now = new Date();
    const currentTime = now.toTimeString().substring(0, 5); // HH:MM format
    
    Object.keys(timeSlots).forEach(slotKey => {
        const slot = timeSlots[slotKey];
        const slotElement = document.querySelector(`[data-slot="${slotKey}"]`);
        
        if (slotElement) {
            const statusElement = slotElement.querySelector('.slot-status');
            
            if (currentTime >= slot.start && currentTime <= slot.end) {
                slotElement.classList.add('active');
                if (statusElement) {
                    statusElement.textContent = 'Active';
                    statusElement.style.background = 'rgba(255, 255, 255, 0.3)';
                }
            } else {
                slotElement.classList.remove('active');
                if (statusElement) {
                    statusElement.textContent = 'Inactive';
                    statusElement.style.background = '#ffc107';
                    statusElement.style.color = '#333';
                }
            }
        }
    });
}

// Load Face-API models from LOCAL models folder
async function loadFaceAPIModels() {
    try {
        updateRecognitionStatus('Loading AI recognition models...', 'loading');
        
        // Use LOCAL models instead of CDN
        const MODEL_URL = '/models';
        
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        
        isModelLoaded = true;
        updateRecognitionStatus('AI models loaded. Ready to scan faces!', 'success');
        console.log('✅ Face-API models loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading Face-API models:', error);
        updateRecognitionStatus('Error loading AI models. Please refresh page.', 'error');
    }
}

// Load attendance statistics
async function loadAttendanceStats() {
    try {
        const response = await fetch('http://localhost:3000/api/attendance/stats');
        const stats = await response.json();
        
        if (response.ok) {
            attendanceData = stats;
            updateStatsDisplay();
        }
    } catch (error) {
        console.warn('Could not load attendance stats:', error);
        updateStatsDisplay();
    }
}

// Update statistics display
function updateStatsDisplay() {
    const totalStudentsEl = document.getElementById('totalStudents');
    const presentCountEl = document.getElementById('presentCount');
    const attendanceRateEl = document.getElementById('attendanceRate');
    
    if (totalStudentsEl) totalStudentsEl.textContent = attendanceData.totalStudents || 0;
    if (presentCountEl) presentCountEl.textContent = attendanceData.presentCount || 0;
    if (attendanceRateEl) attendanceRateEl.textContent = (attendanceData.attendanceRate || 0) + '%';
}

// Load recent attendance log
async function loadRecentAttendance() {
    try {
        const response = await fetch('http://localhost:3000/api/attendance/recent');
        const recentData = await response.json();
        
        if (response.ok && recentData.length > 0) {
            updateAttendanceLog(recentData);
        }
    } catch (error) {
        console.warn('Could not load recent attendance:', error);
    }
}

// Update attendance log display
function updateAttendanceLog(attendanceList) {
    const logContainer = document.getElementById('attendanceLog');
    if (!logContainer) return;
    
    logContainer.innerHTML = '';
    
    if (attendanceList.length === 0) {
        logContainer.innerHTML = `
            <div class="log-item">
                <div class="log-avatar">
                    <i class="fas fa-clock"></i>
                </div>
                <div class="log-info">
                    <span class="log-name">No recent attendance</span>
                    <span class="log-time">Start scanning to see activity</span>
                </div>
                <div class="log-status">
                    <i class="fas fa-info-circle"></i>
                </div>
            </div>
        `;
        return;
    }
    
    attendanceList.forEach(record => {
        const logItem = document.createElement('div');
        logItem.className = 'log-item';
        
        const timeAgo = getTimeAgo(new Date(record.timestamp));
        const statusIcon = record.status === 'present' ? 'fa-check-circle' : 'fa-times-circle';
        const statusClass = record.status === 'present' ? 'present' : 'absent';
        
        logItem.innerHTML = `
            <div class="log-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="log-info">
                <span class="log-name">${record.studentName}</span>
                <span class="log-time">${timeAgo} - ${record.session || 'Morning Session'}</span>
            </div>
            <div class="log-status ${statusClass}">
                <i class="fas ${statusIcon}"></i>
            </div>
        `;
        
        logContainer.appendChild(logItem);
    });
}

// Start face recognition scanner
async function startScanner() {
    if (!isModelLoaded) {
        alert('AI models are still loading. Please wait a moment.');
        return;
    }
    
    try {
        updateRecognitionStatus('Starting camera...', 'loading');
        
        video = document.getElementById('video');
        canvas = document.getElementById('overlay');
        
        if (!video || !canvas) {
            console.error('Video or canvas elements not found');
            updateRecognitionStatus('Camera elements not found on page.', 'error');
            return;
        }
        
        // Get video stream
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 480 },
                height: { ideal: 360 },
                facingMode: 'user'
            },
            audio: false
        });
        
        video.srcObject = stream;
        
        // Setup canvas
        canvas.width = video.videoWidth || 480;
        canvas.height = video.videoHeight || 360;
        
        // Wait for video to be ready
        video.addEventListener('loadedmetadata', () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            startFaceRecognition();
        });
        
        // Update UI
        const startBtn = document.getElementById('startScanner');
        const stopBtn = document.getElementById('stopScanner');
        
        if (startBtn) startBtn.classList.add('hidden');
        if (stopBtn) stopBtn.classList.remove('hidden');
        
        isScanning = true;
        updateRecognitionStatus('Scanner active. Please position your face in the frame.', 'info');
        
    } catch (error) {
        console.error('Error starting camera:', error);
        updateRecognitionStatus('Camera access denied. Please allow camera permissions.', 'error');
        alert('Camera access is required for attendance. Please allow camera permissions and try again.');
    }
}

// Start real-time face recognition
async function startFaceRecognition() {
    if (!video || !isModelLoaded || !isScanning) return;
    
    const recognizeFaces = async () => {
        if (video.readyState === 4 && isScanning) {
            try {
                const detections = await faceapi
                    .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceDescriptors();
                
                // Clear canvas
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                if (detections.length > 0) {
                    // Draw face detection results
                    faceapi.draw.drawDetections(canvas, detections);
                    faceapi.draw.drawFaceLandmarks(canvas, detections);
                    
                    const detection = detections[0];
                    const confidence = detection.detection.score;
                    
                    if (confidence > 0.7) {
                        updateRecognitionStatus('Face detected! Verifying identity...', 'processing');
                        
                        // Clear any existing timeout
                        if (recognitionTimeout) {
                            clearTimeout(recognitionTimeout);
                        }
                        
                        // Set timeout for recognition
                        recognitionTimeout = setTimeout(() => {
                            processAttendance(detection.descriptor);
                        }, 2000); // Wait 2 seconds for stable detection
                        
                    } else {
                        updateRecognitionStatus('Face detected but unclear. Please improve positioning.', 'warning');
                    }
                } else {
                    updateRecognitionStatus('No face detected. Please position yourself in the frame.', 'warning');
                    
                    // Clear timeout if no face detected
                    if (recognitionTimeout) {
                        clearTimeout(recognitionTimeout);
                        recognitionTimeout = null;
                    }
                }
            } catch (error) {
                console.error('Face recognition error:', error);
                updateRecognitionStatus('Recognition error. Please try again.', 'error');
            }
        }
        
        // Continue recognition loop
        if (isScanning) {
            requestAnimationFrame(recognizeFaces);
        }
    };
    
    recognizeFaces();
}

// Process attendance with face descriptor
async function processAttendance(faceDescriptor) {
    try {
        updateRecognitionStatus('Processing attendance...', 'loading');
        
        // Determine current session
        const currentSession = getCurrentSession();
        
        // Prepare attendance data
        const attendancePayload = {
            faceDescriptor: Array.from(faceDescriptor),
            timestamp: new Date().toISOString(),
            session: currentSession.name,
            sessionType: currentSession.type
        };
        
        // Send to backend for recognition
        const response = await fetch('http://localhost:3000/api/attendance/mark', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(attendancePayload)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            if (result.recognized) {
                await showAttendanceSuccess(result);
                
                // Update statistics
                await loadAttendanceStats();
                await loadRecentAttendance();
                
                // Stop scanning after successful attendance
                setTimeout(() => {
                    stopScanner();
                }, 3000);
                
            } else {
                showAttendanceError('Face not recognized. Please register first or try again.');
            }
        } else {
            throw new Error(result.message || 'Attendance marking failed');
        }
        
    } catch (error) {
        console.error('Attendance processing error:', error);
        showAttendanceError('Failed to process attendance: ' + error.message);
    }
}

// Get current active session
function getCurrentSession() {
    const now = new Date();
    const currentTime = now.toTimeString().substring(0, 5);
    
    for (const [key, slot] of Object.entries(timeSlots)) {
        if (currentTime >= slot.start && currentTime <= slot.end) {
            return {
                type: key,
                name: slot.name,
                active: true
            };
        }
    }
    
    // Default to morning session if no active slot
    return {
        type: 'morning',
        name: 'Morning Session',
        active: false
    };
}

// Show attendance success result
async function showAttendanceSuccess(result) {
    const resultsContainer = document.getElementById('attendanceResults');
    const animationContainer = document.getElementById('resultAnimation');
    const contentContainer = document.getElementById('resultContent');
    
    if (!resultsContainer || !animationContainer || !contentContainer) {
        // Fallback for simple success display
        updateRecognitionStatus(`Welcome ${result.studentName}! Attendance marked successfully.`, 'success');
        return;
    }
    
    // Create success animation
    animationContainer.innerHTML = `
        <div class="success-icon">
            <i class="fas fa-check"></i>
        </div>
    `;
    
    // Create success content
    contentContainer.innerHTML = `
        <h3 style="color: #43e97b; margin-bottom: 10px;">Attendance Marked Successfully!</h3>
        <div class="student-info">
            <h4>${result.studentName}</h4>
            <p>Student ID: ${result.studentId}</p>
            <p>Class: ${result.studentClass}</p>
            <p>Session: ${result.session}</p>
            <p>Time: ${new Date().toLocaleTimeString()}</p>
        </div>
        <div class="attendance-message">
            <p><strong>Status:</strong> Present</p>
            <p><strong>Message:</strong> Welcome to school today!</p>
        </div>
    `;
    
    // Show results
    resultsContainer.className = 'attendance-results success';
    resultsContainer.classList.remove('hidden');
    
    // Scroll to results
    setTimeout(() => {
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    
    // Update recognition status
    updateRecognitionStatus(`Welcome ${result.studentName}! Attendance marked successfully.`, 'success');
}

// Show attendance error result
function showAttendanceError(message) {
    const resultsContainer = document.getElementById('attendanceResults');
    const animationContainer = document.getElementById('resultAnimation');
    const contentContainer = document.getElementById('resultContent');
    
    if (resultsContainer && animationContainer && contentContainer) {
        // Create error animation
        animationContainer.innerHTML = `
            <div class="error-icon">
                <i class="fas fa-times"></i>
            </div>
        `;
        
        // Create error content
        contentContainer.innerHTML = `
            <h3 style="color: #f5576c; margin-bottom: 10px;">Attendance Failed</h3>
            <div class="error-info">
                <p>${message}</p>
                <div class="error-actions">
                    <p><strong>What you can do:</strong></p>
                    <ul style="text-align: left; margin: 10px 0;">
                        <li>Make sure you are registered in the system</li>
                        <li>Ensure good lighting conditions</li>
                        <li>Position your face clearly in the frame</li>
                        <li>Try again or contact your teacher</li>
                    </ul>
                </div>
            </div>
        `;
        
        // Show results
        resultsContainer.className = 'attendance-results error';
        resultsContainer.classList.remove('hidden');
        
        // Show retry button
        const retryBtn = document.getElementById('retryBtn');
        if (retryBtn) retryBtn.classList.remove('hidden');
        
        // Scroll to results
        setTimeout(() => {
            resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
    
    // Update recognition status
    updateRecognitionStatus(message, 'error');
}

// Stop face recognition scanner
function stopScanner() {
    isScanning = false;
    
    // Clear recognition timeout
    if (recognitionTimeout) {
        clearTimeout(recognitionTimeout);
        recognitionTimeout = null;
    }
    
    // Stop camera stream
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    
    // Clear canvas
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    // Update UI
    const startBtn = document.getElementById('startScanner');
    const stopBtn = document.getElementById('stopScanner');
    const retryBtn = document.getElementById('retryBtn');
    
    if (startBtn) startBtn.classList.remove('hidden');
    if (stopBtn) stopBtn.classList.add('hidden');
    if (retryBtn) retryBtn.classList.add('hidden');
    
    updateRecognitionStatus('Scanner stopped. Ready to start again.', 'info');
}

// Retry recognition after error
function retryRecognition() {
    // Hide results
    const resultsContainer = document.getElementById('attendanceResults');
    const retryBtn = document.getElementById('retryBtn');
    
    if (resultsContainer) resultsContainer.classList.add('hidden');
    if (retryBtn) retryBtn.classList.add('hidden');
    
    // Restart scanning if not already running
    if (!isScanning) {
        startScanner();
    } else {
        updateRecognitionStatus('Scanner active. Please position your face in the frame.', 'info');
    }
}

// Helper functions
function updateRecognitionStatus(message, type) {
    const statusContainer = document.getElementById('recognitionStatus');
    if (!statusContainer) return;
    
    const statusIndicator = statusContainer.querySelector('.status-indicator');
    if (!statusIndicator) return;
    
    // Update icon based on type
    const icon = statusIndicator.querySelector('i');
    if (icon) {
        icon.className = 'fas ' + getStatusIcon(type);
    }
    
    // Update message
    const span = statusIndicator.querySelector('span');
    if (span) {
        span.textContent = message;
    }
    
    // Update styling
    statusContainer.className = `recognition-status ${type}`;
}

function getStatusIcon(type) {
    const icons = {
        'loading': 'fa-spinner fa-spin',
        'processing': 'fa-cog fa-spin',
        'success': 'fa-check-circle',
        'warning': 'fa-exclamation-triangle',
        'error': 'fa-times-circle',
        'info': 'fa-info-circle'
    };
    return icons[type] || 'fa-info-circle';
}

function getTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

// Global functions for button clicks
window.startScanner = startScanner;
window.stopScanner = stopScanner;
window.retryRecognition = retryRecognition;
