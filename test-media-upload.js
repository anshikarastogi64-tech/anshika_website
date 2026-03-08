/**
 * Test media upload (multiple photos) - requires server running.
 * Run: node test-media-upload.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8000';
let cookies = '';

function request(method, path, body, contentType) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { Cookie: cookies };
    if (contentType) headers['Content-Type'] = contentType;
    else if (body && !Buffer.isBuffer(body)) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (body) headers['Content-Length'] = Buffer.isBuffer(body) ? body.length : Buffer.byteLength(body);
    const req = http.request({
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method,
      headers,
    }, (res) => {
      if (res.headers['set-cookie']) {
        cookies = res.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ');
      }
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.write(Buffer.isBuffer(body) ? body : (body || ''));
    req.end();
  });
}

async function test() {
  console.log('1. Login...');
  const loginRes = await request('POST', '/admin/login', 'username=admin&password=Admin%40123', 'application/x-www-form-urlencoded');
  if (loginRes.status !== 302) {
    console.log('   FAIL: Login');
    return;
  }
  console.log('   OK');

  console.log('2. Get first project ID from portfolio...');
  const portRes = await request('GET', '/admin/portfolio');
  const projMatch = portRes.data.match(/href="\/admin\/portfolio\/projects\/(\d+)"/);
  const projId = projMatch ? projMatch[1] : '36';

  console.log('3. Create minimal 1x1 PNG for upload...');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const testPath = path.join(__dirname, 'test-1x1.png');
  fs.writeFileSync(testPath, png);

  console.log('4. Build multipart form with 2 images...');
  const boundary = '----FormBoundary' + Date.now();
  const CRLF = '\r\n';
  const parts = [
    Buffer.from('--' + boundary + CRLF + 'Content-Disposition: form-data; name="media_type"' + CRLF + CRLF + 'image' + CRLF),
    Buffer.from('--' + boundary + CRLF + 'Content-Disposition: form-data; name="media_files"; filename="a.png"' + CRLF + 'Content-Type: image/png' + CRLF + CRLF),
    png,
    Buffer.from(CRLF + '--' + boundary + CRLF + 'Content-Disposition: form-data; name="media_files"; filename="b.png"' + CRLF + 'Content-Type: image/png' + CRLF + CRLF),
    png,
    Buffer.from(CRLF + '--' + boundary + '--' + CRLF),
  ];
  const body = Buffer.concat(parts);

  console.log('5. POST to media endpoint (project ' + projId + ')...');
  const contentType = 'multipart/form-data; boundary=' + boundary;
  const res = await request('POST', '/admin/portfolio/projects/' + projId + '/media', body, contentType);
  fs.unlinkSync(testPath);

  if (res.status === 302) {
    console.log('   OK - redirect received (upload succeeded)');
  } else {
    console.log('   Response:', res.status);
    if (res.data && res.data.includes('Unexpected field')) {
      console.log('   ERROR: MulterError Unexpected field still occurs');
    }
  }
}

test().catch((e) => {
  console.error('Error:', e.message);
  if (e.code === 'ECONNREFUSED') console.error('Start server: node server.js');
  process.exit(1);
});
