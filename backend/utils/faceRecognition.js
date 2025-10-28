// Face recognition utilityconst faceapi = require('face-api.js');
const { Canvas, Image, ImageData } = require('canvas');
const fs = require('fs').promises;
const path = require('path');

// Configure face-api.js for Node.js environment
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

/**
 * Face Recognition Utility Module
 * Provides comprehensive face recognition functionality using face-api.js
 * Supports face detection, descriptor extraction, and face matching
 */
class FaceRecognitionUtils {
    constructor() {
        this.modelsLoaded = false;
        this.modelPath = path.join(__dirname, '..', 'models');
        this.recognitionThreshold = 0.6; // Default threshold for face matching
        this.detectionOptions = new faceapi.TinyFaceDetectorOptions({
            inputSize: 416,
            scoreThreshold: 0.5
        });
    }

    /**
     * Initialize and load all required face-api.js models
     * @param {string} modelPath - Path to the models directory (optional)
     * @returns {Promise<boolean>} - True if models loaded successfully
     */
    async loadModels(modelPath = null) {
        try {
            const modelsDir = modelPath || this.modelPath;
            
            console.log('🤖 Loading face recognition models...');
            
            // Ensure models directory exists
            await this.ensureModelsDirectory(modelsDir);
            
            // Load all required models
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromDisk(modelsDir),
                faceapi.nets.faceLandmark68Net.loadFromDisk(modelsDir),
                faceapi.nets.faceRecognitionNet.loadFromDisk(modelsDir),
                faceapi.nets.faceExpressionNet.loadFromDisk(modelsDir),
                faceapi.nets.ageGenderNet.loadFromDisk(modelsDir)
            ]);
            
            this.modelsLoaded = true;
            console.log('✅ Face recognition models loaded successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Error loading face recognition models:', error);
            this.modelsLoaded = false;
            
            // Fallback: try to download models if they don't exist
            return await this.downloadModels(modelsDir);
        }
    }

    /**
     * Ensure models directory exists and create if necessary
     * @param {string} modelsDir - Models directory path
     */
    async ensureModelsDirectory(modelsDir) {
        try {
            await fs.mkdir(modelsDir, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    /**
     * Download models from CDN if not available locally
     * @param {string} modelsDir - Models directory path
     * @returns {Promise<boolean>} - Success status
     */
    async downloadModels(modelsDir) {
        try {
            console.log('📥 Downloading face recognition models...');
            
            const modelFiles = [
                'tiny_face_detector_model-weights_manifest.json',
                'tiny_face_detector_model-shard1',
                'face_landmark_68_model-weights_manifest.json',
                'face_landmark_68_model-shard1',
                'face_recognition_model-weights_manifest.json',
                'face_recognition_model-shard1',
                'face_recognition_model-shard2',
                'face_expression_model-weights_manifest.json',
                'face_expression_model-shard1',
                'age_gender_model-weights_manifest.json',
                'age_gender_model-shard1'
            ];
            
            // Note: In a real implementation, you would download these files
            // For now, we'll use the CDN versions directly
            console.log('⚠️  Using CDN models. For production, download models locally.');
            
            // Use web models as fallback
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights';
            
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
                faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
            ]);
            
            this.modelsLoaded = true;
            console.log('✅ Face recognition models loaded from CDN');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to download face recognition models:', error);
            return false;
        }
    }

    /**
     * Detect faces in an image buffer
     * @param {Buffer} imageBuffer - Image buffer
     * @returns {Promise<Array>} - Array of detected faces with descriptors
     */
    async detectFaces(imageBuffer) {
        if (!this.modelsLoaded) {
            throw new Error('Face recognition models not loaded. Call loadModels() first.');
        }

        try {
            // Convert buffer to Image
            const img = await faceapi.fetchImage(imageBuffer);
            
            // Detect faces with landmarks and descriptors
            const detections = await faceapi
                .detectAllFaces(img, this.detectionOptions)
                .withFaceLandmarks()
                .withFaceDescriptors()
                .withFaceExpressions()
                .withAgeAndGender();

            return detections.map((detection, index) => ({
                id: `face_${Date.now()}_${index}`,
                boundingBox: detection.detection.box,
                landmarks: detection.landmarks,
                descriptor: Array.from(detection.descriptor),
                expressions: detection.expressions,
                age: Math.round(detection.age),
                gender: detection.gender,
                confidence: detection.detection.score,
                timestamp: new Date().toISOString()
            }));

        } catch (error) {
            console.error('❌ Error detecting faces:', error);
            throw error;
        }
    }

    /**
     * Extract face descriptor from image buffer
     * @param {Buffer} imageBuffer - Image buffer
     * @returns {Promise<Array>} - Face descriptor array (128 dimensions)
     */
    async extractDescriptor(imageBuffer) {
        const faces = await this.detectFaces(imageBuffer);
        
        if (faces.length === 0) {
            throw new Error('No face detected in the image');
        }

        if (faces.length > 1) {
            console.warn('⚠️  Multiple faces detected. Using the first face.');
        }

        return faces[0].descriptor;
    }

    /**
     * Compare two face descriptors and return similarity
     * @param {Array} descriptor1 - First face descriptor
     * @param {Array} descriptor2 - Second face descriptor
     * @returns {Object} - Match result with distance and similarity
     */
    compareFaces(descriptor1, descriptor2) {
        try {
            if (!Array.isArray(descriptor1) || !Array.isArray(descriptor2)) {
                throw new Error('Descriptors must be arrays');
            }

            if (descriptor1.length !== 128 || descriptor2.length !== 128) {
                throw new Error('Face descriptors must be 128-dimensional arrays');
            }

            // Calculate Euclidean distance
            const distance = this.euclideanDistance(descriptor1, descriptor2);
            
            // Calculate similarity percentage (0-100%)
            const similarity = Math.max(0, (1 - distance) * 100);
            
            // Determine if faces match based on threshold
            const isMatch = distance < this.recognitionThreshold;

            return {
                distance: distance,
                similarity: Math.round(similarity * 100) / 100,
                isMatch: isMatch,
                confidence: Math.round(similarity),
                threshold: this.recognitionThreshold
            };

        } catch (error) {
            console.error('❌ Error comparing faces:', error);
            throw error;
        }
    }

    /**
     * Find the best matching face from a collection of stored descriptors
     * @param {Array} targetDescriptor - Target face descriptor to match
     * @param {Array} storedDescriptors - Array of stored face descriptors
     * @param {number} threshold - Custom threshold (optional)
     * @returns {Object} - Best match result
     */
    findBestMatch(targetDescriptor, storedDescriptors, threshold = null) {
        try {
            const useThreshold = threshold || this.recognitionThreshold;
            let bestMatch = null;
            let minDistance = Infinity;
            let bestIndex = -1;

            storedDescriptors.forEach((storedDescriptor, index) => {
                const comparison = this.compareFaces(targetDescriptor, storedDescriptor);
                
                if (comparison.distance < minDistance && comparison.distance < useThreshold) {
                    minDistance = comparison.distance;
                    bestMatch = comparison;
                    bestIndex = index;
                }
            });

            return {
                found: bestMatch !== null,
                match: bestMatch,
                index: bestIndex,
                totalCompared: storedDescriptors.length,
                threshold: useThreshold
            };

        } catch (error) {
            console.error('❌ Error finding best match:', error);
            throw error;
        }
    }

    /**
     * Calculate Euclidean distance between two descriptors
     * @param {Array} desc1 - First descriptor
     * @param {Array} desc2 - Second descriptor
     * @returns {number} - Euclidean distance
     */
    euclideanDistance(desc1, desc2) {
        if (desc1.length !== desc2.length) {
            throw new Error('Descriptors must have the same length');
        }

        let sum = 0;
        for (let i = 0; i < desc1.length; i++) {
            const diff = desc1[i] - desc2[i];
            sum += diff * diff;
        }

        return Math.sqrt(sum);
    }

    /**
     * Validate face descriptor format
     * @param {Array} descriptor - Face descriptor to validate
     * @returns {boolean} - True if valid
     */
    validateDescriptor(descriptor) {
        if (!Array.isArray(descriptor)) {
            return false;
        }

        if (descriptor.length !== 128) {
            return false;
        }

        // Check if all elements are numbers
        return descriptor.every(value => typeof value === 'number' && !isNaN(value));
    }

    /**
     * Set recognition threshold
     * @param {number} threshold - New threshold value (0-1)
     */
    setRecognitionThreshold(threshold) {
        if (threshold < 0 || threshold > 1) {
            throw new Error('Threshold must be between 0 and 1');
        }
        this.recognitionThreshold = threshold;
        console.log(`🎯 Recognition threshold set to: ${threshold}`);
    }

    /**
     * Get current recognition threshold
     * @returns {number} - Current threshold
     */
    getRecognitionThreshold() {
        return this.recognitionThreshold;
    }

    /**
     * Process multiple face images and return descriptors
     * @param {Array} imageBuffers - Array of image buffers
     * @returns {Promise<Array>} - Array of face descriptors
     */
    async processFaceImages(imageBuffers) {
        const descriptors = [];
        const errors = [];

        for (let i = 0; i < imageBuffers.length; i++) {
            try {
                const descriptor = await this.extractDescriptor(imageBuffers[i]);
                descriptors.push({
                    index: i,
                    descriptor: descriptor,
                    success: true
                });
            } catch (error) {
                console.error(`❌ Error processing image ${i}:`, error.message);
                errors.push({
                    index: i,
                    error: error.message,
                    success: false
                });
            }
        }

        return {
            descriptors: descriptors.filter(d => d.success).map(d => d.descriptor),
            successful: descriptors.length,
            failed: errors.length,
            errors: errors
        };
    }

    /**
     * Create face matcher from stored descriptors with labels
     * @param {Array} labeledDescriptors - Array of {label, descriptors} objects
     * @returns {Object} - Face matcher instance
     */
    createFaceMatcher(labeledDescriptors) {
        try {
            const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, this.recognitionThreshold);
            
            console.log(`🎭 Face matcher created with ${labeledDescriptors.length} labeled faces`);
            
            return {
                matcher: faceMatcher,
                findBestMatch: (descriptor) => {
                    return faceMatcher.findBestMatch(descriptor);
                },
                getLabels: () => {
                    return labeledDescriptors.map(ld => ld.label);
                }
            };

        } catch (error) {
            console.error('❌ Error creating face matcher:', error);
            throw error;
        }
    }

    /**
     * Get system information and model status
     * @returns {Object} - System information
     */
    getSystemInfo() {
        return {
            modelsLoaded: this.modelsLoaded,
            recognitionThreshold: this.recognitionThreshold,
            modelPath: this.modelPath,
            detectionOptions: {
                inputSize: this.detectionOptions.inputSize,
                scoreThreshold: this.detectionOptions.scoreThreshold
            },
            supportedFormats: ['jpg', 'jpeg', 'png', 'bmp', 'webp'],
            version: '1.0.0',
            faceApiVersion: '0.22.2'
        };
    }

    /**
     * Cleanup resources (for graceful shutdown)
     */
    cleanup() {
        console.log('🧹 Cleaning up face recognition resources...');
        // Cleanup any resources if needed
        this.modelsLoaded = false;
    }
}

// Export singleton instance
const faceRecognitionUtils = new FaceRecognitionUtils();

module.exports = {
    FaceRecognitionUtils,
    faceRecognitionUtils,
    
    // Convenience functions
    loadModels: (modelPath) => faceRecognitionUtils.loadModels(modelPath),
    detectFaces: (imageBuffer) => faceRecognitionUtils.detectFaces(imageBuffer),
    extractDescriptor: (imageBuffer) => faceRecognitionUtils.extractDescriptor(imageBuffer),
    compareFaces: (desc1, desc2) => faceRecognitionUtils.compareFaces(desc1, desc2),
    findBestMatch: (target, stored, threshold) => faceRecognitionUtils.findBestMatch(target, stored, threshold),
    validateDescriptor: (descriptor) => faceRecognitionUtils.validateDescriptor(descriptor),
    setThreshold: (threshold) => faceRecognitionUtils.setRecognitionThreshold(threshold),
    getSystemInfo: () => faceRecognitionUtils.getSystemInfo(),
    cleanup: () => faceRecognitionUtils.cleanup()
};
