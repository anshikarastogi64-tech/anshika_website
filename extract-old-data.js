/**
 * Extract testimonials, services, and portfolio from old folder HTML files.
 * Run: node extract-old-data.js
 */

const fs = require('fs');
const path = require('path');

const oldDir = path.join(__dirname, 'old');

function extractTestimonials(html) {
  const testimonials = [];
  const slideRegex = /<div class="swiper-slide">\s*<div class="testimonial-item">\s*<img[^>]*src="([^"]*)"[^>]*>\s*<h3>([^<]*)<\/h3>\s*<h4>([^<]*)<\/h4>\s*<p>\s*<i[^>]*><\/i>\s*([\s\S]*?)\s*<i[^>]*><\/i>\s*<\/p>/g;
  let m;
  while ((m = slideRegex.exec(html)) !== null) {
    const message = m[4].replace(/\s+/g, ' ').trim();
    testimonials.push({
      name: m[2].trim(),
      role: m[3].trim(),
      message,
      image_path: m[1].trim()
    });
  }
  // Also try pattern without img (some might not have image)
  if (testimonials.length === 0) {
    const altRegex = /<div class="swiper-slide">\s*<div class="testimonial-item">\s*(?:<img[^>]*src="([^"]*)"[^>]*>\s*)?<h3>([^<]*)<\/h3>\s*<h4>([^<]*)<\/h4>\s*<p>[\s\S]*?<i class="bx bxs-quote-alt-left[^>]*><\/i>\s*([\s\S]*?)\s*<i class="bx bxs-quote-alt-right/g;
    let m2;
    while ((m2 = altRegex.exec(html)) !== null) {
      const message = (m2[4] || '').replace(/\s+/g, ' ').trim();
      testimonials.push({
        name: (m2[2] || '').trim(),
        role: (m2[3] || '').trim(),
        message,
        image_path: (m2[1] || '').trim()
      });
    }
  }
  return testimonials;
}

function extractPortfolio(html) {
  const items = [];
  const itemRegex = /<div class="col-lg-4 col-md-6 portfolio-item (filter-[^"]+)">[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>/g;
  let m;
  while ((m = itemRegex.exec(html)) !== null) {
    const category = m[1].trim();
    const imagePath = m[2].trim();
    const baseName = path.basename(imagePath, path.extname(imagePath));
    items.push({
      title: `${category.replace('filter-', '')} ${baseName}`,
      category,
      image_path: imagePath
    });
  }
  return items;
}

function extractServices(html) {
  const services = [];
  const serviceRegex = /<img src="(assets\/img\/services\/[^"]+)"[^>]*>[\s\S]*?<h4><a[^>]*>([^<]*)<\/a><\/h4>/g;
  let m;
  while ((m = serviceRegex.exec(html)) !== null) {
    services.push({
      title: m[2].trim(),
      image_path: m[1].trim()
    });
  }
  return services;
}

// Main
const aboutHtml = fs.readFileSync(path.join(oldDir, 'about.html'), 'utf8');
const servicesHtml = fs.readFileSync(path.join(oldDir, 'services.html'), 'utf8');
const portfolioHtml = fs.readFileSync(path.join(oldDir, 'portfolio.html'), 'utf8');

const testimonials = extractTestimonials(aboutHtml);
const services = extractServices(servicesHtml);
const portfolioItems = extractPortfolio(portfolioHtml);

console.log('Extracted:', testimonials.length, 'testimonials,', services.length, 'services,', portfolioItems.length, 'portfolio items');

// Write to seed-from-old.json for reseed script to use
const output = {
  testimonials,
  services,
  portfolioItems,
  facts: { clients: '156', projects: '309', hours: '1463', workers: '15' }
};
fs.writeFileSync(path.join(__dirname, 'seed-from-old.json'), JSON.stringify(output, null, 2));
console.log('Written to seed-from-old.json');
