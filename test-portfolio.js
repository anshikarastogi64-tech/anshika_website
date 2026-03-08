/**
 * Test portfolio functionality: login, add category, add project, view public pages.
 * Run: node test-portfolio.js
 * Requires server to be running on port 8000.
 */
const http = require('http');

const BASE = 'http://localhost:8000';
let cookies = '';

function request(method, path, body, contentType = 'application/x-www-form-urlencoded') {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = {
      'Content-Type': contentType,
      Cookie: cookies,
    };
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers,
    };
    const req = http.request(options, (res) => {
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        cookies = setCookie.map((c) => c.split(';')[0]).join('; ');
      }
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location, data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function test() {
  console.log('1. Login...');
  const loginRes = await request('POST', '/admin/login', 'username=admin&password=Admin%40123');
  if (loginRes.status !== 302 || loginRes.location !== '/admin') {
    console.log('   FAIL: Login', loginRes.status, loginRes.location);
    return;
  }
  console.log('   OK');

  console.log('2. GET /admin/portfolio...');
  const portRes = await request('GET', '/admin/portfolio');
  if (portRes.status !== 200) {
    console.log('   FAIL:', portRes.status, portRes.location);
    return;
  }
  console.log('   OK');

  console.log('3. POST add category "TestCategory123"...');
  const addRes = await request('POST', '/admin/portfolio/categories', 'name=TestCategory123');
  if (addRes.status !== 302 || !addRes.location.includes('/admin/portfolio')) {
    console.log('   FAIL:', addRes.status, addRes.location, addRes.data?.substring(0, 200));
    return;
  }
  console.log('   OK, redirected to', addRes.location);

  console.log('4. GET /admin/portfolio again...');
  const portRes2 = await request('GET', addRes.location || '/admin/portfolio');
  if (!portRes2.data.includes('TestCategory123')) {
    console.log('   FAIL: TestCategory123 not found on page');
    return;
  }
  console.log('   OK, TestCategory123 appears');

  console.log('5. GET first project edit (seeded project has details)...');
  const projLink = portRes2.data.match(/href="\/admin\/portfolio\/projects\/(\d+)"/);
  const projId = projLink ? projLink[1] : '30';
  const editRes = await request('GET', '/admin/portfolio/projects/' + projId);
  if (editRes.status !== 200) {
    console.log('   FAIL: Edit page', editRes.status);
    return;
  }
  const hasDetails = editRes.data.includes('quality materials') || editRes.data.includes('Full project details');
  const hasDeleteBtn = editRes.data.includes('delete');
  const hasDelProject = editRes.data.includes('Del</button>');
  console.log('   Details in form:', hasDetails, '| Delete category/project:', hasDeleteBtn);

  console.log('5b. Testimonials selector on project edit...');
  const hasLinkTestimonials = editRes.data.includes('Link Testimonials');
  const hasNoTestimonials = editRes.data.includes('No testimonials yet');
  const hasTestimonialCheckbox = editRes.data.includes('testimonial_ids') || editRes.data.includes('tid_');
  const hasGeetika = editRes.data.includes('Geetika');
  console.log('   Link Testimonials section:', hasLinkTestimonials, '| No testimonials msg:', hasNoTestimonials, '| Checkboxes:', hasTestimonialCheckbox, '| Sample (Geetika):', hasGeetika);
  if (hasNoTestimonials && !hasGeetika) {
    console.log('   FAIL: Testimonials exist in DB but not shown on project edit page');
    return;
  }

  console.log('6. Verify delete options on portfolio page...');
  const hasCatDelete = portRes2.data.includes('categories') && portRes2.data.includes('delete');
  console.log('   Category delete:', hasCatDelete);

  console.log('7. GET /portfolio (public)...');
  const pubRes = await request('GET', '/portfolio');
  if (pubRes.status !== 200) {
    console.log('   FAIL:', pubRes.status);
    return;
  }
  console.log('   OK');

  console.log('\nAll tests passed.');
}

test().catch((e) => {
  console.error('Error:', e.message);
  if (e.code === 'ECONNREFUSED') console.error('Make sure the server is running: node server.js');
  process.exit(1);
});
