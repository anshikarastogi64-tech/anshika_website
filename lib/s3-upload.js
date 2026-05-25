/**
 * S3 Upload Utility
 * Handles file uploads to AWS S3 with fallback to local storage
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  // Credentials automatically loaded from IAM role or ~/.aws/credentials
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_PROD || 'anshika-designers-vision-prod';
const USE_S3 = process.env.USE_S3 === 'true';
const MIGRATION_MODE = process.env.MIGRATION_MODE || 'dual-write'; // dual-write, s3-only, local-only

/**
 * Upload file to S3
 * @param {Buffer|Stream} fileContent - File content
 * @param {string} key - S3 key (path)
 * @param {string} contentType - MIME type
 * @returns {Promise<{s3Url: string, key: string}>}
 */
async function uploadToS3(fileContent, key, contentType = 'application/octet-stream') {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
      // ServerSideEncryption: 'AES256', // Enable encryption
    });

    await s3Client.send(command);

    const s3Url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    console.log(`✅ Uploaded to S3: ${key}`);
    return { s3Url, key };
  } catch (error) {
    console.error('❌ S3 upload error:', error);
    throw new Error(`Failed to upload to S3: ${error.message}`);
  }
}

/**
 * Save file locally (fallback or dual-write mode)
 * @param {Buffer} fileContent - File content
 * @param {string} localPath - Local file path
 */
async function saveLocally(fileContent, localPath) {
  try {
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(localPath, fileContent);
    console.log(`✅ Saved locally: ${localPath}`);
  } catch (error) {
    console.error('❌ Local save error:', error);
    throw new Error(`Failed to save locally: ${error.message}`);
  }
}

/**
 * Upload file with dual-write capability
 * @param {Object} file - Multer file object
 * @param {string} s3Key - S3 key path (e.g., 'projects/123/design.jpg')
 * @param {string} localPath - Local file path (e.g., 'Kelly/assets/img/projects/123/design.jpg')
 * @returns {Promise<{url: string, s3Url?: string, localPath?: string}>}
 */
async function uploadFile(file, s3Key, localPath) {
  const fileContent = file.buffer || fs.readFileSync(file.path);
  const contentType = file.mimetype;

  const result = {
    url: null,
    s3Url: null,
    localPath: null,
  };

  // Dual-write mode: Save to both S3 and local
  if (MIGRATION_MODE === 'dual-write' && USE_S3) {
    try {
      // Upload to S3
      const s3Result = await uploadToS3(fileContent, s3Key, contentType);
      result.s3Url = s3Result.s3Url;
      result.url = s3Result.s3Url; // Primary URL

      // Also save locally as backup
      await saveLocally(fileContent, localPath);
      result.localPath = localPath;

      console.log(`📝 Dual-write: S3 + Local for ${s3Key}`);
    } catch (error) {
      console.error('❌ Dual-write failed, falling back to local only');
      await saveLocally(fileContent, localPath);
      result.localPath = localPath;
      result.url = `/assets/img/${path.basename(localPath)}`;
    }
  }
  // S3-only mode
  else if (MIGRATION_MODE === 's3-only' && USE_S3) {
    const s3Result = await uploadToS3(fileContent, s3Key, contentType);
    result.s3Url = s3Result.s3Url;
    result.url = s3Result.s3Url;
    console.log(`☁️  S3-only: ${s3Key}`);
  }
  // Local-only mode (original behavior)
  else {
    await saveLocally(fileContent, localPath);
    result.localPath = localPath;
    result.url = `/assets/img/${path.basename(localPath)}`;
    console.log(`💾 Local-only: ${localPath}`);
  }

  return result;
}

/**
 * Generate pre-signed URL for temporary access
 * @param {string} key - S3 key
 * @param {number} expiresIn - Expiration time in seconds (default 1 hour)
 * @returns {Promise<string>}
 */
async function getPresignedUrl(key, expiresIn = 3600) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('❌ Failed to generate pre-signed URL:', error);
    throw new Error(`Failed to generate pre-signed URL: ${error.message}`);
  }
}

/**
 * Delete file from S3
 * @param {string} key - S3 key
 * @returns {Promise<void>}
 */
async function deleteFromS3(key) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    console.log(`🗑️  Deleted from S3: ${key}`);
  } catch (error) {
    console.error('❌ S3 delete error:', error);
    throw new Error(`Failed to delete from S3: ${error.message}`);
  }
}

/**
 * Generate unique filename
 * @param {string} originalName - Original filename
 * @returns {string}
 */
function generateUniqueFilename(originalName) {
  const ext = path.extname(originalName);
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${random}${ext}`;
}

/**
 * Get file URL (S3 or local based on configuration)
 * @param {string} s3Key - S3 key
 * @param {string} localPath - Local path
 * @returns {string}
 */
function getFileUrl(s3Key, localPath) {
  if (USE_S3 && s3Key) {
    return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
  }
  return localPath || '';
}

module.exports = {
  uploadToS3,
  saveLocally,
  uploadFile,
  getPresignedUrl,
  deleteFromS3,
  generateUniqueFilename,
  getFileUrl,
  s3Client,
  BUCKET_NAME,
};
