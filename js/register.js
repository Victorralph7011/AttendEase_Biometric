// Global variables for face registration
let video = null;
let canvas = null;
let capturedImages = [];
let faceDetector = null;
let isModelLoaded = false;
let studentData = {};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing face registration system...');
    await loadFaceAPIModels();
    setupEventListeners();
});

// Load Face-API models from LOCAL models folder
async function loadFaceAPIModels() {
    try {
        updateDetectionStatus('Loading AI models...', 'loading');
        
        // Use LOCAL models instead of CDN
        const MODEL_URL = '/models';
        
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        
        isModelLoaded = true;
        updateDetectionStatus('AI models loaded successfully!', 'success');
        console.log('✅ Face-API models loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading Face-API models:', error);
        updateDetectionStatus('Error loading AI models. Please refresh the page.', 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Form validation
    const form = document.querySelector('.student-form');
    if (!form) return;
    
    const inputs = form.querySelectorAll('input[required], select[required]');
    
    inputs.forEach(input => {
        input.addEventListener('input', validateForm);
        input.addEventListener('blur', validateField);
    });
    
    // Button event listeners
    const proceedBtn = document.getElementById('proceedToCapture');
    const startCameraBtn = document.getElementById('startCamera');
    const captureBtn = document.getElementById('captureBtn');
    const registerBtn = document.getElementById('registerFace');
    const retakeBtn = document.getElementById('retakePhoto');
    
    if (proceedBtn) proceedBtn.addEventListener('click', proceedToCapture);
    if (startCameraBtn) startCameraBtn.addEventListener('click', startCamera);
    if (captureBtn) captureBtn.addEventListener('click', captureImage);
    if (registerBtn) registerBtn.addEventListener('click', registerFace);
    if (retakeBtn) retakeBtn.addEventListener('click', retakePhoto);
}

// Validate individual field
function validateField(event) {
    const field = event.target;
    const value = field.value.trim();
    
    // Remove existing error styling
    field.classList.remove('error');
    
    // Validate based on field type
    switch(field.id) {
        case 'studentName':
            if (value.length < 2) {
                showFieldError(field, 'Name must be at least 2 characters');
                return false;
            }
            break;
            
        case 'studentId':
            if (!/^[A-Za-z0-9]{3,10}$/.test(value)) {
                showFieldError(field, 'Student ID must be 3-10 alphanumeric characters');
                return false;
            }
            break;
            
        case 'parentName':
            if (value.length < 2) {
                showFieldError(field, 'Parent name must be at least 2 characters');
                return false;
            }
            break;
    }
    
    // Clear any error styling if validation passes
    clearFieldError(field);
    return true;
}

// Show field error
function showFieldError(field, message) {
    field.classList.add('error');
    
    // Remove existing error message
    const existingError = field.parentNode.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Add new error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    field.parentNode.appendChild(errorDiv);
}

// Clear field error
function clearFieldError(field) {
    field.classList.remove('error');
    const errorMessage = field.parentNode.querySelector('.error-message');
    if (errorMessage) {
        errorMessage.remove();
    }
}

// Validate entire form
function validateForm() {
    const form = document.querySelector('.student-form');
    const inputs = form.querySelectorAll('input[required], select[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            isValid = false;
        }
    });
    
    const proceedBtn = form.querySelector('.primary-btn');
    if (proceedBtn) {
        proceedBtn.disabled = !isValid;
        proceedBtn.style.opacity = isValid ? '1' : '0.5';
    }
    
    return isValid;
}

// Proceed to face capture step
async function proceedToCapture() {
    // Validate form first
    if (!validateForm()) {
        alert('Please fill in all required fields correctly.');
        return;
    }
    
    // Check if models are loaded
    if (!isModelLoaded) {
        alert('AI models are still loading. Please wait a moment.');
        return;
    }
    
    // Store student data
    const form = document.querySelector('.student-form');
    studentData = {
        name: form.studentName.value.trim(),
        studentId: form.studentId.value.trim(),
        class: form.studentClass.value,
        parentName: form.parentName.value.trim(),
        registrationDate: new Date().toISOString()
    };
    
    // Check for duplicate student ID
    try {
        const response = await fetch('http://localhost:3000/api/register/check-student', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ studentId: studentData.studentId })
        });
        
        const result = await response.json();
        if (result.exists) {
            alert('A student with this ID already exists. Please use a different Student ID.');
            return;
        }
    } catch (error) {
        console.warn('Could not check for duplicate student ID:', error);
    }
    
    // Update UI to show capture section
    const detailsSection = document.getElementById('detailsForm');
    const captureSection = document.getElementById('captureSection');
    
    if (detailsSection) detailsSection.classList.add('hidden');
    if (captureSection) captureSection.classList.remove('hidden');
    
    // Update step indicator
    updateStep(2);
    
    // Scroll to capture section
    setTimeout(() => {
        if (captureSection) {
            captureSection.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }
    }, 300);
}

// Start camera for face capture
async function startCamera() {
    try {
        updateDetectionStatus('Starting camera...', 'loading');
        
        video = document.getElementById('video');
        canvas = document.getElementById('overlay');
        
        if (!video || !canvas) {
            console.error('Video or canvas elements not found');
            updateDetectionStatus('Camera elements not found on page.', 'error');
            return;
        }
        
        // Get video stream
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 400 },
                height: { ideal: 300 },
                facingMode: 'user'
            },
            audio: false
        });
        
        video.srcObject = stream;
        
        // Setup canvas
        canvas.width = video.videoWidth || 400;
        canvas.height = video.videoHeight || 300;
        
        // Wait for video to be ready
        video.addEventListener('loadedmetadata', () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            startFaceDetection();
        });
        
        // Update UI
        const startCameraBtn = document.getElementById('startCamera');
        const captureBtn = document.getElementById('captureBtn');
        
        if (startCameraBtn) startCameraBtn.classList.add('hidden');
        if (captureBtn) captureBtn.classList.remove('hidden');
        
        updateDetectionStatus('Camera started! Position your face in the circle.', 'success');
        
    } catch (error) {
        console.error('Error starting camera:', error);
        updateDetectionStatus('Camera access denied. Please allow camera permissions.', 'error');
        
        alert('Camera access is required for face registration. Please allow camera permissions and try again.');
    }
}

// Start real-time face detection
async function startFaceDetection() {
    if (!video || !isModelLoaded) return;
    
    const detectFaces = async () => {
        if (video.readyState === 4) {
            const detections = await faceapi
                .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceExpressions();
            
            // Clear canvas
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (detections.length > 0) {
                // Draw face detection results
                faceapi.draw.drawDetections(canvas, detections);
                faceapi.draw.drawFaceLandmarks(canvas, detections);
                
                // Update status based on detection quality
                const detection = detections[0];
                const confidence = detection.detection.score;
                
                if (confidence > 0.8) {
                    updateDetectionStatus('Perfect! Face detected clearly. Ready to capture.', 'success');
                    enableCaptureButton(true);
                } else if (confidence > 0.6) {
                    updateDetectionStatus('Face detected. Please improve lighting or position.', 'warning');
                    enableCaptureButton(true);
                } else {
                    updateDetectionStatus('Face detected but unclear. Please adjust position.', 'warning');
                    enableCaptureButton(false);
                }
            } else {
                updateDetectionStatus('No face detected. Please position your face in the circle.', 'warning');
                enableCaptureButton(false);
            }
        }
        
        // Continue detection
        requestAnimationFrame(detectFaces);
    };
    
    detectFaces();
}

// Enable/disable capture button
function enableCaptureButton(enabled) {
    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) {
        captureBtn.disabled = !enabled;
        captureBtn.style.opacity = enabled ? '1' : '0.5';
    }
}

// Capture face image
async function captureImage() {
    if (!video || !isModelLoaded) return;
    
    try {
        updateDetectionStatus('Capturing image...', 'loading');
        
        // Create temporary canvas for capture
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const ctx = tempCanvas.getContext('2d');
        
        // Draw video frame
        ctx.drawImage(video, 0, 0);
        
        // Get face detection for this frame
        const detections = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();
        
        if (detections.length === 0) {
            updateDetectionStatus('No face detected in capture. Please try again.', 'error');
            return;
        }
        
        // Extract face descriptor (encoding)
        const faceDescriptor = detections[0].descriptor;
        
        // Convert canvas to blob
        tempCanvas.toBlob((blob) => {
            const imageUrl = URL.createObjectURL(blob);
            
            // Store captured image data
            capturedImages.push({
                imageUrl: imageUrl,
                descriptor: Array.from(faceDescriptor),
                timestamp: new Date().toISOString(),
                confidence: detections[0].detection.score
            });
            
            // Update UI
            displayCapturedImage(imageUrl);
            updateDetectionStatus(`Image ${capturedImages.length} captured successfully!`, 'success');
            
            // Check if we have enough images
            if (capturedImages.length >= 3) {
                const capturedImagesSection = document.getElementById('capturedImages');
                if (capturedImagesSection) {
                    capturedImagesSection.classList.remove('hidden');
                }
                updateDetectionStatus('Great! You have captured enough images for registration.', 'success');
            } else {
                updateDetectionStatus(`Image ${capturedImages.length}/3 captured. Capture ${3 - capturedImages.length} more for better accuracy.`, 'info');
            }
            
        }, 'image/jpeg', 0.8);
        
    } catch (error) {
        console.error('Error capturing image:', error);
        updateDetectionStatus('Error capturing image. Please try again.', 'error');
    }
}

// Display captured image in preview grid
function displayCapturedImage(imageUrl) {
    const imageGrid = document.getElementById('imageGrid');
    if (!imageGrid) return;
    
    const imgElement = document.createElement('img');
    imgElement.src = imageUrl;
    imgElement.className = 'captured-image';
    imgElement.alt = `Captured face ${capturedImages.length}`;
    
    // Add click to remove functionality
    imgElement.addEventListener('click', () => {
        if (confirm('Remove this image?')) {
            const index = Array.from(imageGrid.children).indexOf(imgElement);
            capturedImages.splice(index, 1);
            imgElement.remove();
            
            if (capturedImages.length === 0) {
                const capturedImagesSection = document.getElementById('capturedImages');
                if (capturedImagesSection) {
                    capturedImagesSection.classList.add('hidden');
                }
            }
            
            updateDetectionStatus(`Image removed. ${capturedImages.length} images remaining.`, 'info');
        }
    });
    
    imageGrid.appendChild(imgElement);
}

// Retake photos
function retakePhoto() {
    // Clear captured images
    capturedImages = [];
    const imageGrid = document.getElementById('imageGrid');
    if (imageGrid) {
        imageGrid.innerHTML = '';
    }
    
    const capturedImagesSection = document.getElementById('capturedImages');
    if (capturedImagesSection) {
        capturedImagesSection.classList.add('hidden');
    }
    
    updateDetectionStatus('Ready to capture new images.', 'info');
}

// Register face with backend
async function registerFace() {
    if (capturedImages.length === 0) {
        alert('Please capture at least one image before registering.');
        return;
    }
    
    try {
        showLoading('Registering face data...');
        
        // Prepare registration data
        const registrationData = {
            ...studentData,
            faceData: {
                descriptors: capturedImages.map(img => img.descriptor),
                confidence: capturedImages.reduce((sum, img) => sum + img.confidence, 0) / capturedImages.length,
                imageCount: capturedImages.length,
                registrationTimestamp: new Date().toISOString()
            }
        };
        
        // Send to backend
        const response = await fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registrationData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            hideLoading();
            
            // Stop camera
            if (video && video.srcObject) {
                video.srcObject.getTracks().forEach(track => track.stop());
            }
            
            // Show success
            updateStep(3);
            const confirmationSection = document.getElementById('confirmationSection');
            const captureSection = document.getElementById('captureSection');
            
            if (captureSection) captureSection.classList.add('hidden');
            if (confirmationSection) confirmationSection.classList.remove('hidden');
            
            populateStudentSummary();
            
            // Scroll to confirmation
            setTimeout(() => {
                if (confirmationSection) {
                    confirmationSection.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start' 
                    });
                }
            }, 300);
            
        } else {
            throw new Error(result.message || 'Registration failed');
        }
        
    } catch (error) {
        hideLoading();
        console.error('Registration error:', error);
        alert('Registration failed: ' + error.message);
    }
}

// Populate student summary
function populateStudentSummary() {
    const summaryContainer = document.getElementById('studentSummary');
    if (!summaryContainer) return;
    
    summaryContainer.innerHTML = `
        <h4 style="margin-bottom: 15px; color: #333;">Registration Details</h4>
        <div class="summary-item">
            <span><strong>Name:</strong></span>
            <span>${studentData.name}</span>
        </div>
        <div class="summary-item">
            <span><strong>Student ID:</strong></span>
            <span>${studentData.studentId}</span>
        </div>
        <div class="summary-item">
            <span><strong>Class:</strong></span>
            <span>Class ${studentData.class}</span>
        </div>
        <div class="summary-item">
            <span><strong>Parent/Guardian:</strong></span>
            <span>${studentData.parentName}</span>
        </div>
        <div class="summary-item">
            <span><strong>Images Captured:</strong></span>
            <span>${capturedImages.length} images</span>
        </div>
        <div class="summary-item">
            <span><strong>Registration Date:</strong></span>
            <span>${new Date().toLocaleDateString()}</span>
        </div>
    `;
}

// Helper functions
function updateStep(stepNumber) {
    // Remove active class from all steps
    const stepItems = document.querySelectorAll('.step-item');
    stepItems.forEach(step => {
        step.classList.remove('active', 'completed');
    });
    
    // Add completed class to previous steps
    for (let i = 1; i < stepNumber; i++) {
        const step = document.getElementById(`step${i}`);
        if (step) step.classList.add('completed');
    }
    
    // Add active class to current step
    const currentStep = document.getElementById(`step${stepNumber}`);
    if (currentStep) currentStep.classList.add('active');
}

function updateDetectionStatus(message, type) {
    const statusContainer = document.getElementById('recognitionStatus');
    if (!statusContainer) return;
    
    const statusIndicator = statusContainer.querySelector('.status-indicator');
    if (!statusIndicator) return;
    
    // Update icon based on type
    const icon = statusIndicator.querySelector('i');
    if (icon) {
        const icons = {
            'loading': 'fa-spinner fa-spin',
            'success': 'fa-check-circle',
            'warning': 'fa-exclamation-triangle',
            'error': 'fa-times-circle',
            'info': 'fa-info-circle'
        };
        icon.className = 'fas ' + (icons[type] || icons.info);
    }
    
    // Update message
    const span = statusIndicator.querySelector('span');
    if (span) {
        span.textContent = message;
    }
    
    // Update styling
    statusContainer.className = `recognition-status ${type}`;
}

function showLoading(message) {
    const overlay = document.getElementById('loadingOverlay');
    const text = document.getElementById('loadingText');
    if (overlay && text) {
        text.textContent = message;
        overlay.classList.remove('hidden');
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// Global functions for navigation
function registerAnother() {
    // Reset all data
    studentData = {};
    capturedImages = [];
    
    // Reset UI
    const form = document.querySelector('.student-form');
    if (form) form.reset();
    
    const imageGrid = document.getElementById('imageGrid');
    if (imageGrid) imageGrid.innerHTML = '';
    
    const capturedImagesSection = document.getElementById('capturedImages');
    if (capturedImagesSection) capturedImagesSection.classList.add('hidden');
    
    // Stop camera if running
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
    
    // Reset to step 1
    updateStep(1);
    
    const detailsSection = document.getElementById('detailsForm');
    const captureSection = document.getElementById('captureSection');
    const confirmationSection = document.getElementById('confirmationSection');
    
    if (detailsSection) detailsSection.classList.remove('hidden');
    if (captureSection) captureSection.classList.add('hidden');
    if (confirmationSection) confirmationSection.classList.add('hidden');
    
    updateDetectionStatus('Fill in student details to continue.', 'info');
}

function goToAttendance() {
    window.location.href = 'attendance.html';
}

// Export global functions
window.registerAnother = registerAnother;
window.goToAttendance = goToAttendance;
window.proceedToCapture = proceedToCapture;
window.startCamera = startCamera;
window.captureImage = captureImage;
window.registerFace = registerFace;
window.retakePhoto = retakePhoto;
