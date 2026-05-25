/**
 * Test S3 Connection
 * Verify that S3 buckets are accessible and working
 */

require('dotenv').config();
const { s3Client, uploadToS3, getPresignedUrl, deleteFromS3, BUCKET_NAME } = require('../lib/s3-upload');

async function testS3Connection() {
  console.log('🧪 Testing S3 Connection...\n');

  console.log('Configuration:');
  console.log(`- Region: ${process.env.AWS_REGION}`);
  console.log(`- Bucket: ${BUCKET_NAME}`);
  console.log(`- USE_S3: ${process.env.USE_S3}`);
  console.log('');

  try {
    // Test 1: Upload a test file
    console.log('📤 Test 1: Upload test file...');
    const testContent = Buffer.from('Hello from Anshika Website!');
    const testKey = 'test/connection-test.txt';

    const uploadResult = await uploadToS3(testContent, testKey, 'text/plain');
    console.log('✅ Upload successful!');
    console.log(`   URL: ${uploadResult.s3Url}`);
    console.log('');

    // Test 2: Generate pre-signed URL
    console.log('🔗 Test 2: Generate pre-signed URL...');
    const presignedUrl = await getPresignedUrl(testKey, 300); // 5 minutes
    console.log('✅ Pre-signed URL generated!');
    console.log(`   URL: ${presignedUrl.substring(0, 100)}...`);
    console.log('');

    // Test 3: Delete test file
    console.log('🗑️  Test 3: Delete test file...');
    await deleteFromS3(testKey);
    console.log('✅ Delete successful!');
    console.log('');

    console.log('🎉 All S3 tests passed!\n');
    console.log('Next steps:');
    console.log('1. Update MIGRATION_MODE in .env (set to "dual-write")');
    console.log('2. Run: node scripts/test-pg-connection.js');
    console.log('3. Run: npm install (to install new dependencies)');

  } catch (error) {
    console.error('❌ S3 test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check AWS credentials are configured');
    console.error('2. Verify IAM role has S3 permissions');
    console.error('3. Confirm bucket name is correct');
    console.error('4. Check bucket region matches AWS_REGION');
    process.exit(1);
  }
}

testS3Connection();
