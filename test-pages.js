const http = require('http');

function fetch(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port: 8000, path, method: 'GET' },
      (res) => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  try {
    const about = await fetch('/about');
    console.log('=== /about ===');
    console.log('Status:', about.status);
    console.log('Has swiper-slide:', about.body.includes('swiper-slide'));
    console.log('Has Geetika:', about.body.includes('Geetika'));
    console.log('Swiper-slide count:', (about.body.match(/swiper-slide/g) || []).length);
    const testimonialSection = about.body.indexOf('id="testimonials"');
    if (testimonialSection > 0) {
      console.log('Testimonials section snippet:', about.body.substring(testimonialSection, testimonialSection + 500));
    }

    const portfolio = await fetch('/portfolio');
    console.log('\n=== /portfolio ===');
    console.log('Status:', portfolio.status);
    console.log('Has portfolio-item:', portfolio.body.includes('portfolio-item'));
    console.log('Portfolio-item count:', (portfolio.body.match(/portfolio-item filter-/g) || []).length);
  } catch (e) {
    console.error('Error (is server running on :8000?):', e.message);
  }
}

run();
