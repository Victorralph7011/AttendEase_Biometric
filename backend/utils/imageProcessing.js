const sharp = require('sharp');
const jimp = require('jimp');
const fs = require('fs').promises;
const path = require('path');

/**
 * Image Processing Utilities for Face Recognition
 * Handles image format conversion, resizing, and optimization
 */
class ImageProcessingUtils {
    constructor() {
        this.supportedFormats = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff'];
        this.maxImageSize = 2048; // Max width/height in pixels
        this.jpegQuality = 90;
    }

    /**
     * Convert image buffer to standardized format for face recognition
     * @param {Buffer} imageBuffer - Input image buffer
     * @param {string} outputFormat - Output format (jpg, png, webp)
     * @returns {Promise<Buffer>} - Processed image buffer
     */
    async standardizeImage(imageBuffer, outputFormat = 'jpg') {
        try {
            let processedImage = sharp(imageBuffer);
            
            // Get image metadata
            const metadata = await processedImage.metadata();
            console.log(`📸 Processing image: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);
            
            // Resize if image is too large
            if (metadata.width > this.maxImageSize || metadata.height > this.maxImageSize) {
                processedImage = processedImage.resize(this.maxImageSize, this.maxImageSize, {
                    fit: 'inside',
                    withoutEnlargement: true
                });
                console.log(`📐 Resized image to max ${this.maxImageSize}px`);
            }
            
            // Convert to specified format
            switch (outputFormat.toLowerCase()) {
                case 'jpg':
                case 'jpeg':
                    processedImage = processedImage.jpeg({ quality: this.jpegQuality });
                    break;
                case 'png':
                    processedImage = processedImage.png({ compressionLevel: 6 });
                    break;
                case 'webp':
                    processedImage = processedImage.webp({ quality: this.jpegQuality });
                    break;
                default:
                    throw new Error(`Unsupported output format: ${outputFormat}`);
            }
            
            const outputBuffer = await processedImage.toBuffer();
            console.log(`✅ Image processed successfully (${outputBuffer.length} bytes)`);
            
            return outputBuffer;
            
        } catch (error) {
            console.error('❌ Error processing image:', error);
            throw error;
        }
    }

    /**
     * Extract face region from image using bounding box
     * @param {Buffer} imageBuffer - Input image buffer
     * @param {Object} boundingBox - Face bounding box {x, y, width, height}
     * @param {number} padding - Padding around face (default: 0.2)
     * @returns {Promise<Buffer>} - Cropped face image buffer
     */
    async extractFaceRegion(imageBuffer, boundingBox, padding = 0.2) {
        try {
            const { x, y, width, height } = boundingBox;
            
            // Calculate padding
            const padX = Math.round(width * padding);
            const padY = Math.round(height * padding);
            
            // Calculate crop parameters with padding
            const cropX = Math.max(0, Math.round(x - padX));
            const cropY = Math.max(0, Math.round(y - padY));
            const cropWidth = Math.round(width + (2 * padX));
            const cropHeight = Math.round(height + (2 * padY));
            
            const croppedBuffer = await sharp(imageBuffer)
                .extract({
                    left: cropX,
                    top: cropY,
                    width: cropWidth,
                    height: cropHeight
                })
                .jpeg({ quality: this.jpegQuality })
                .toBuffer();
            
            console.log(`✂️  Face region extracted: ${cropWidth}x${cropHeight} at (${cropX}, ${cropY})`);
            return croppedBuffer;
            
        } catch (error) {
            console.error('❌ Error extracting face region:', error);
            throw error;
        }
    }

    /**
     * Enhance image quality for better face recognition
     * @param {Buffer} imageBuffer - Input image buffer
     * @returns {Promise<Buffer>} - Enhanced image buffer
     */
    async enhanceForRecognition(imageBuffer) {
        try {
            const enhancedBuffer = await sharp(imageBuffer)
                .normalize() // Auto levels
                .sharpen({ sigma: 1, flat: 1, jagged: 2 }) // Sharpen
                .gamma(1.2) // Slight gamma correction
                .jpeg({ quality: 95 })
                .toBuffer();
            
            console.log('✨ Image enhanced for face recognition');
            return enhancedBuffer;
            
        } catch (error) {
            console.error('❌ Error enhancing image:', error);
            throw error;
        }
    }

    /**
     * Convert base64 data URL to buffer
     * @param {string} dataUrl - Base64 data URL
     * @returns {Buffer} - Image buffer
     */
    base64ToBuffer(dataUrl) {
        try {
            // Remove data URL prefix
            const base64Data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
            return Buffer.from(base64Data, 'base64');
        } catch (error) {
            console.error('❌ Error converting base64 to buffer:', error);
            throw new Error('Invalid base64 data URL');
        }
    }

    /**
     * Convert buffer to base64 data URL
     * @param {Buffer} buffer - Image buffer
     * @param {string} mimeType - MIME type (default: image/jpeg)
     * @returns {string} - Base64 data URL
     */
    bufferToBase64(buffer, mimeType = 'image/jpeg') {
        try {
            const base64 = buffer.toString('base64');
            return `data:${mimeType};base64,${base64}`;
        } catch (error) {
            console.error('❌ Error converting buffer to base64:', error);
            throw error;
        }
    }

    /**
     * Validate image format and size
     * @param {Buffer} imageBuffer - Image buffer to validate
     * @returns {Promise<Object>} - Validation result
     */
    async validateImage(imageBuffer) {
        try {
            const metadata = await sharp(imageBuffer).metadata();
            
            const validation = {
                isValid: true,
                format: metadata.format,
                width: metadata.width,
                height: metadata.height,
                size: imageBuffer.length,
                errors: []
            };
            
            // Check format
            if (!this.supportedFormats.includes(metadata.format)) {
                validation.isValid = false;
                validation.errors.push(`Unsupported format: ${metadata.format}`);
            }
            
            // Check dimensions
            if (metadata.width < 100 || metadata.height < 100) {
                validation.isValid = false;
                validation.errors.push('Image too small (minimum 100x100 pixels)');
            }
            
            if (metadata.width > 4096 || metadata.height > 4096) {
                validation.isValid = false;
                validation.errors.push('Image too large (maximum 4096x4096 pixels)');
            }
            
            // Check file size (10MB limit)
            if (imageBuffer.length > 10 * 1024 * 1024) {
                validation.isValid = false;
                validation.errors.push('File size too large (maximum 10MB)');
            }
            
            return validation;
            
        } catch (error) {
            console.error('❌ Error validating image:', error);
            return {
                isValid: false,
                errors: ['Invalid image file']
            };
        }
    }

    /**
     * Create thumbnail image
     * @param {Buffer} imageBuffer - Input image buffer
     * @param {number} size - Thumbnail size (width/height)
     * @returns {Promise<Buffer>} - Thumbnail buffer
     */
    async createThumbnail(imageBuffer, size = 150) {
        try {
            const thumbnailBuffer = await sharp(imageBuffer)
                .resize(size, size, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({ quality: 80 })
                .toBuffer();
            
            console.log(`🖼️  Thumbnail created: ${size}x${size}px`);
            return thumbnailBuffer;
            
        } catch (error) {
            console.error('❌ Error creating thumbnail:', error);
            throw error;
        }
    }

    /**
     * Get image information
     * @param {Buffer} imageBuffer - Image buffer
     * @returns {Promise<Object>} - Image information
     */
    async getImageInfo(imageBuffer) {
        try {
            const metadata = await sharp(imageBuffer).metadata();
            
            return {
                format: metadata.format,
                width: metadata.width,
                height: metadata.height,
                channels: metadata.channels,
                hasAlpha: metadata.hasAlpha,
                orientation: metadata.orientation,
                density: metadata.density,
                size: imageBuffer.length,
                aspectRatio: (metadata.width / metadata.height).toFixed(2)
            };
            
        } catch (error) {
            console.error('❌ Error getting image info:', error);
            throw error;
        }
    }
}

// Export singleton instance
const imageProcessingUtils = new ImageProcessingUtils();

module.exports = {
    ImageProcessingUtils,
    imageProcessingUtils,
    
    // Convenience functions
    standardizeImage: (buffer, format) => imageProcessingUtils.standardizeImage(buffer, format),
    extractFaceRegion: (buffer, bbox, padding) => imageProcessingUtils.extractFaceRegion(buffer, bbox, padding),
    enhanceForRecognition: (buffer) => imageProcessingUtils.enhanceForRecognition(buffer),
    base64ToBuffer: (dataUrl) => imageProcessingUtils.base64ToBuffer(dataUrl),
    bufferToBase64: (buffer, mimeType) => imageProcessingUtils.bufferToBase64(buffer, mimeType),
    validateImage: (buffer) => imageProcessingUtils.validateImage(buffer),
    createThumbnail: (buffer, size) => imageProcessingUtils.createThumbnail(buffer, size),
    getImageInfo: (buffer) => imageProcessingUtils.getImageInfo(buffer)
};
