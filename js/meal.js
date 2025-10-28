// Global variables for mid-day meal system
let video = null;
let canvas = null;
let faceDetector = null;
let isModelLoaded = false;
let isMealScanning = false;
let mealRecognitionTimeout = null;
let mealData = {
    totalStudents: 0,
    mealsServed: 0,
    mealsRemaining: 0,
    distributionRate: 0
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing Mid-Day Meal System...');
    
    // Start real-time clock
    updateMealTime();
    setInterval(updateMealTime, 1000);
    
    // Check meal time status
    updateMealTimeStatus();
    setInterval(updateMealTimeStatus, 60000); // Update every minute
    
    // Load face recognition models
    await loadFaceAPIModels();
    
    // Load meal statistics
    await loadMealStats();
    
    // Load recent meal distribution log
    await loadRecentMealDistribution();
    
    // Load today's menu (could be dynamic from backend)
    loadTodayMenu();
});

// Update current time display
function updateMealTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    document.getElementById('currentTime').textContent = timeString;
}

// Update meal time status
function updateMealTimeStatus() {
    const now = new Date();
    const currentTime = now.toTimeString().substring(0, 5); // HH:MM format
    const mealStartTime = '12:00';
    const mealEndTime = '13:00';
    
    const statusElement = document.getElementById('mealStatus');
    const iconElement = statusElement.querySelector('i');
    const textElement = statusElement.querySelector('span');
    
    if (currentTime >= mealStartTime && currentTime <= mealEndTime) {
        statusElement.style.background = 'linear-gradient(45deg, #43e97b, #38f9d7)';
        iconElement.className = 'fas fa-check-circle';
        textElement.textContent = 'Meal Time is Active Now! (12:00 PM - 1:00 PM)';
    } else if (currentTime < mealStartTime) {
        statusElement.style.background = 'linear-gradient(45deg, #ffc107, #ff8f00)';
        iconElement.className = 'fas fa-clock';
        textElement.textContent = 'Meal Time Starts at 12:00 PM';
    } else {
        statusElement.style.background = 'linear-gradient(45deg, #f5576c, #f093fb)';
        iconElement.className = 'fas fa-times-circle';
        textElement.textContent = 'Meal Time Ended (12:00 PM - 1:00 PM)';
    }
}

// Load Face-API models from LOCAL models folder
async function loadFaceAPIModels() {
    try {
        updateMealRecognitionStatus('Loading AI models for meal distribution...', 'loading');
        
        // Use LOCAL models instead of CDN
        const MODEL_URL = '/models';
        
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        
        isModelLoaded = true;
        updateMealRecognitionStatus('AI models loaded. Ready for meal distribution!', 'success');
        console.log('✅ Face-API models loaded for meal system');
        
    } catch (error) {
        console.error('❌ Error loading Face-API models:', error);
        updateMealRecognitionStatus('Error loading AI models. Please refresh page.', 'error');
    }
}

// Load meal statistics
async function loadMealStats() {
    try {
        const response = await fetch('http://localhost:3000/api/meal/stats');
        const stats = await response.json();
        
        if (response.ok) {
            mealData.totalStudents = stats.totalStudents;
            mealData.mealsServed = stats.mealsServedToday;
            mealData.mealsRemaining = Math.max(0, stats.totalStudents - stats.mealsServedToday);
            mealData.distributionRate = stats.mealRate;
            
            updateMealStatsDisplay();
        }
    } catch (error) {
        console.warn('Could not load meal stats:', error);
        // Use default values if API is not available
        updateMealStatsDisplay();
    }
}

// Update meal statistics display
function updateMealStatsDisplay() {
    // Animate number changes
    utils.animateNumber(document.getElementById('totalStudents'), 0, mealData.totalStudents, 1500);
    utils.animateNumber(document.getElementById('mealsServed'), 0, mealData.mealsServed, 1500);
    utils.animateNumber(document.getElementById('mealsRemaining'), 0, mealData.mealsRemaining, 1500);
    
    // Update distribution rate
    setTimeout(() => {
        document.getElementById('distributionRate').textContent = mealData.distributionRate + '%';
    }, 1000);
}

// Load recent meal distribution log
async function loadRecentMealDistribution() {
    try {
        const response = await fetch('http://localhost:3000/api/meal/recent?limit=15');
        const recentData = await response.json();
        
        if (response.ok && recentData.length > 0) {
            updateMealDistributionLog(recentData);
        }
    } catch (error) {
        console.warn('Could not load recent meal distribution:', error);
    }
}

// Update meal distribution log display
function updateMealDistributionLog(mealList) {
    const logContainer = document.getElementById('mealLog');
    logContainer.innerHTML = '';
    
    if (mealList.length === 0) {
        logContainer.innerHTML = `
            <div class="meal-log-item">
                <div class="meal-log-avatar">
                    <i class="fas fa-utensils"></i>
                </div>
                <div class="meal-log-info">
                    <span class="meal-log-name">No meals distributed yet</span>
                    <span class="meal-log-time">Start scanner to begin distribution</span>
                </div>
                <div class="meal-log-status">
                    <i class="fas fa-clock"></i>
                </div>
            </div>
        `;
        return;
    }
    
    mealList.forEach(record => {
        const logItem = document.createElement('div');
        logItem.className = 'meal-log-item';
        
        const timeAgo = getTimeAgo(new Date(record.timestamp));
        
        logItem.innerHTML = `
            <div class="meal-log-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="meal-log-info">
                <span class="meal-log-name">${record.studentName}</span>
                <span class="meal-log-time">${timeAgo} - Class ${record.studentClass}</span>
            </div>
            <div class="meal-log-status">
                <i class="fas fa-check-circle"></i>
            </div>
        `;
        
        logContainer.appendChild(logItem);
    });
}

// Load today's menu (could be made dynamic)
function loadTodayMenu() {
    const menuItems = [
        {
            icon: 'fa-seedling',
            name: 'Dal (Lentils)',
            description: 'Rich in protein and essential nutrients',
            badge: 'Protein Rich',
            color: '#43e97b'
        },
        {
            icon: 'fa-leaf',
            name: 'Mixed Vegetable Curry',
            description: 'Seasonal vegetables with balanced nutrition',
            badge: 'Vitamin Rich',
            color: '#4facfe'
        },
        {
            icon: 'fa-bread-slice',
            name: 'Chapati/Rice',
            description: 'Energy-providing carbohydrates',
            badge: 'Energy Rich',
            color: '#ffc107'
        }
    ];
    
    const menuContainer = document.getElementById('todayMenu');
    menuContainer.innerHTML = '';
    
    menuItems.forEach(item => {
        const menuElement = document.createElement('div');
        menuElement.className = 'menu-item';
        menuElement.innerHTML = `
            <div class="menu-icon">
                <i class="fas ${item.icon}"></i>
            </div>
            <div class="menu-details">
                <h4>${item.name}</h4>
                <p>${item.description}</p>
                <span class="nutrition-badge" style="background: ${item.color}">${item.badge}</span>
            </div>
        `;
        menuContainer.appendChild(menuElement);
    });
}

// Start meal distribution scanner
async function startMealScanner() {
    if (!isModelLoaded) {
        alert('AI models are still loading. Please wait a moment.');
        return;
    }
    
    // Check if it's meal time
    const now = new Date();
    const currentTime = now.toTimeString().substring(0, 5);
    if (currentTime < '12:00' || currentTime > '13:00') {
        const confirmProceed = confirm(
            'It\'s currently outside meal time (12:00 PM - 1:00 PM). Do you want to proceed anyway?'
        );
        if (!confirmProceed) return;
    }
    
    try {
        updateMealRecognitionStatus('Starting camera for meal distribution...', 'loading');
        
        video = document.getElementById('video');
        canvas = document.getElementById('overlay');
        
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
            startMealFaceRecognition();
        });
        
        // Update UI
        document.getElementById('startMealScanner').classList.add('hidden');
        document.getElementById('stopMealScanner').classList.remove('hidden');
        
        isMealScanning = true;
        updateMealRecognitionStatus('Scanner active. Student can now scan face for meal.', 'info');
        
    } catch (error) {
        console.error('Error starting meal scanner:', error);
        updateMealRecognitionStatus('Camera access denied. Please allow camera permissions.', 'error');
        alert('Camera access is required for meal distribution.');
    }
}

// Start face recognition for meal distribution
async function startMealFaceRecognition() {
    if (!video || !isModelLoaded || !isMealScanning) return;
    
    const recognizeFaces = async () => {
        if (video.readyState === 4 && isMealScanning) {
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
                        updateMealRecognitionStatus('Student face detected! Verifying for meal...', 'processing');
                        
                        // Clear any existing timeout
                        if (mealRecognitionTimeout) {
                            clearTimeout(mealRecognitionTimeout);
                        }
                        
                        // Set timeout for meal recognition
                        mealRecognitionTimeout = setTimeout(() => {
                            processMealDistribution(detection.descriptor);
                        }, 2000); // Wait 2 seconds for stable detection
                        
                    } else {
                        updateMealRecognitionStatus('Face detected but unclear. Please improve positioning.', 'warning');
                    }
                } else {
                    updateMealRecognitionStatus('No face detected. Please position student in the frame.', 'warning');
                    
                    // Clear timeout if no face detected
                    if (mealRecognitionTimeout) {
                        clearTimeout(mealRecognitionTimeout);
                        mealRecognitionTimeout = null;
                    }
                }
            } catch (error) {
                console.error('Meal face recognition error:', error);
                updateMealRecognitionStatus('Recognition error. Please try again.', 'error');
            }
        }
        
        // Continue recognition loop
        if (isMealScanning) {
            requestAnimationFrame(recognizeFaces);
        }
    };
    
    recognizeFaces();
}

// Process meal distribution with face recognition
async function processMealDistribution(faceDescriptor) {
    try {
        updateMealRecognitionStatus('Processing meal distribution...', 'loading');
        
        // First, verify student identity through attendance system
        const verificationPayload = {
            faceDescriptor: Array.from(faceDescriptor),
            timestamp: new Date().toISOString(),
            session: 'Mid-Day Meal',
            sessionType: 'meal'
        };
        
        // Verify student identity
        const verifyResponse = await fetch('http://localhost:3000/api/attendance/mark', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(verificationPayload)
        });
        
        const verifyResult = await verifyResponse.json();
        
        if (verifyResponse.ok && verifyResult.recognized) {
            // Now mark meal distribution
            const mealPayload = {
                studentId: verifyResult.studentId,
                timestamp: new Date().toISOString()
            };
            
            const mealResponse = await fetch('http://localhost:3000/api/meal/mark', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(mealPayload)
            });
            
            const mealResult = await mealResponse.json();
            
            if (mealResponse.ok) {
                if (mealResult.alreadyMarked) {
                    showMealError(`${verifyResult.studentName} has already received meal today.`);
                } else {
                    await showMealSuccess({
                        ...verifyResult,
                        mealRecord: mealResult.mealRecord
                    });
                    
                    // Update statistics and log
                    await loadMealStats();
                    await loadRecentMealDistribution();
                    
                    // Stop scanning after successful distribution
                    setTimeout(() => {
                        stopMealScanner();
                    }, 4000);
                }
            } else {
                throw new Error(mealResult.message || 'Failed to record meal distribution');
            }
        } else {
            showMealError('Student not recognized. Please ensure student is registered in the system.');
        }
        
    } catch (error) {
        console.error('Meal distribution processing error:', error);
        showMealError('Failed to process meal distribution: ' + error.message);
    }
}

// Show meal distribution success
async function showMealSuccess(result) {
    const resultsContainer = document.getElementById('mealResults');
    const animationContainer = document.getElementById('mealResultAnimation');
    const contentContainer = document.getElementById('mealResultContent');
    
    // Create success animation
    animationContainer.innerHTML = `
        <div class="success-icon">
            <i class="fas fa-utensils"></i>
        </div>
    `;
    
    // Create success content
    contentContainer.innerHTML = `
        <h3 style="color: #43e97b; margin-bottom: 15px;">Meal Distributed Successfully!</h3>
        <div class="student-meal-info">
            <h4>${result.studentName}</h4>
            <p><strong>Student ID:</strong> ${result.studentId}</p>
            <p><strong>Class:</strong> ${result.studentClass}</p>
            <p><strong>Meal Time:</strong> ${new Date().toLocaleTimeString()}</p>
            <p><strong>Status:</strong> <span style="color: #43e97b;">Meal Served</span></p>
        </div>
        <div class="meal-message">
            <p><strong>Nutritious meal served!</strong></p>
            <p>Enjoy your healthy and balanced lunch, ${result.studentName}!</p>
        </div>
    `;
    
    // Show results
    resultsContainer.className = 'meal-results success';
    resultsContainer.classList.remove('hidden');
    
    // Scroll to results
    setTimeout(() => {
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    
    // Update recognition status
    updateMealRecognitionStatus(`Meal served to ${result.studentName}! Distribution recorded.`, 'success');
    
    // Show success notification
    notifications.success(`Meal successfully distributed to ${result.studentName}!`, 3000);
}

// Show meal distribution error
function showMealError(message) {
    const resultsContainer = document.getElementById('mealResults');
    const animationContainer = document.getElementById('mealResultAnimation');
    const contentContainer = document.getElementById('mealResultContent');
    
    // Create error animation
    animationContainer.innerHTML = `
        <div class="error-icon">
            <i class="fas fa-exclamation-triangle"></i>
        </div>
    `;
    
    // Create error content
    contentContainer.innerHTML = `
        <h3 style="color: #f5576c; margin-bottom: 15px;">Meal Distribution Failed</h3>
        <div class="meal-error-info">
            <p>${message}</p>
            <div class="meal-error-actions">
                <p><strong>Possible solutions:</strong></p>
                <ul style="text-align: left; margin: 10px 0;">
                    <li>Ensure the student is registered in the attendance system</li>
                    <li>Check if the student has already received meal today</li>
                    <li>Verify good lighting conditions for face recognition</li>
                    <li>Contact the system administrator if issues persist</li>
                </ul>
            </div>
        </div>
    `;
    
    // Show results
    resultsContainer.className = 'meal-results error';
    resultsContainer.classList.remove('hidden');
    
    // Scroll to results
    setTimeout(() => {
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    
    // Update recognition status
    updateMealRecognitionStatus(message, 'error');
    
    // Show error notification
    notifications.error(message, 4000);
    
    // Auto-restart scanner after error
    setTimeout(() => {
        document.getElementById('mealResults').classList.add('hidden');
        if (isMealScanning) {
            updateMealRecognitionStatus('Scanner ready. Student can try again.', 'info');
        }
    }, 5000);
}

// Stop meal distribution scanner
function stopMealScanner() {
    isMealScanning = false;
    
    // Clear recognition timeout
    if (mealRecognitionTimeout) {
        clearTimeout(mealRecognitionTimeout);
        mealRecognitionTimeout = null;
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
    document.getElementById('startMealScanner').classList.remove('hidden');
    document.getElementById('stopMealScanner').classList.add('hidden');
    
    // Hide results if visible
    document.getElementById('mealResults').classList.add('hidden');
    
    updateMealRecognitionStatus('Meal distribution scanner stopped. Ready to start again.', 'info');
}

// Helper functions
function updateMealRecognitionStatus(message, type) {
    const statusContainer = document.getElementById('mealRecognitionStatus');
    const statusIndicator = statusContainer.querySelector('.status-indicator');
    
    // Update icon based on type
    const icon = statusIndicator.querySelector('i');
    icon.className = 'fas ' + getStatusIcon(type);
    
    // Update message
    statusIndicator.querySelector('span').textContent = message;
    
    // Update styling
    statusContainer.className = `meal-recognition-status ${type}`;
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
