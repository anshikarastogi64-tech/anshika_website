'use strict';

/**
 * Central SEO: titles, meta descriptions, canonicals, Open Graph, Twitter Cards,
 * and JSON-LD (InteriorDesigner + WebSite). Keyword themes are woven into copy;
 * Google does not use meta keywords as a ranking signal.
 */

const DEFAULT_OG_PATH = '/assets/img/me.png';

const KNOWS_ABOUT = [
  'Residential interior design',
  'Commercial interior design',
  'Turnkey interior design',
  'End-to-end project implementation',
  'Modular kitchen design',
  'Wardrobe and storage design',
  'False ceiling and lighting design',
  'Vastu-aligned interiors',
  'Space planning',
  '3BHK and 2BHK interior packages',
  'Luxury home interiors',
  'Office and retail interiors',
  'Biophilic and sustainable interiors',
  'Personalized home design',
  'Pan-India interior projects',
  'Remote interior consultation',
];

function normalizePath(p) {
  if (!p) return '/';
  if (p !== '/' && p.endsWith('/')) return p.slice(0, -1);
  return p;
}

/** Canonical site URL for links, sitemap, and JSON-LD (set PUBLIC_BASE_URL in production). */
function publicBaseUrl(req) {
  const fromEnv = (process.env.PUBLIC_BASE_URL || process.env.PUBLIC_SITE_URL || '').trim();
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) {
    return fromEnv.replace(/\/$/, '');
  }
  const proto = req.protocol || 'http';
  const host = req.get('host') || 'localhost';
  return `${proto}://${host}`.replace(/\/$/, '');
}

function absoluteUrl(baseUrl, assetPath) {
  const base = (baseUrl || '').replace(/\/$/, '');
  const path = String(assetPath || '').replace(/^\//, '');
  if (!path) return base + '/';
  if (/^https?:\/\//i.test(assetPath)) return assetPath;
  return `${base}/${path}`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PAGES = {
  '/': {
    title:
      'Interior Designer Hyderabad | Turnkey Homes & Offices | Anshika Rastogi — Designer\'s Vision',
    description:
      "Hyderabad's interior designer for end-to-end turnkey homes, apartments, villas, and offices: personalized layouts, modular kitchens, wardrobes, lighting, and creative execution. Complimentary interior consultation, artwork guidance, and Vastu-aware planning. Serving Telangana, pan-India, and clients worldwide with remote design support.",
  },
  '/about-new': {
    title: 'About Anshika Rastogi | Luxury & Personalized Interior Design | Hyderabad',
    description:
      'Meet Anshika Rastogi: bespoke interior design rooted in creativity, meticulous detailing, and honest project delivery. Residential and commercial spaces across Hyderabad, India, and international projects—each home treated as unique with tailored concepts and full implementation support.',
  },
  '/services': {
    title:
      'Interior Design Services | Turnkey Execution | Modular Kitchen | Hyderabad & Remote',
    description:
      'Full-spectrum interior services: concept design, 3D visualization, material and furniture selection, turnkey site execution, modular kitchens, wardrobes, ceilings, and styling. Ideal for new builds, renovations, and luxury upgrades in Hyderabad, rest of India, and overseas—book a free consultation.',
  },
  '/portfolio': {
    title: 'Interior Design Portfolio | Residential & Commercial Projects | Hyderabad',
    description:
      'Explore completed interiors: living rooms, bedrooms, modular kitchens, offices, and more. Real Hyderabad and India projects showcasing unique, client-centric design and professional implementation—your reference for quality and creativity.',
  },
  '/testimonials': {
    title: 'Client Reviews | Best Interior Designer Hyderabad | Anshika Rastogi',
    description:
      'Verified client stories on design process, transparency, and finished spaces. Trusted interior design partner in Hyderabad for families and businesses seeking stress-free, beautiful results.',
  },
  '/contact': {
    title: 'Free Interior Consultation | Contact Interior Designer Hyderabad | Vastu & Artwork',
    description:
      "Book a free interior design consultation: discuss layout, budget, timeline, Vastu-friendly planning, and artwork ideas. Reach Designer's Vision by phone, WhatsApp, or email—Hyderabad studio with projects across India and globally.",
  },
  '/experience': {
    title: 'Design Experience & Expertise | Interior Projects Hyderabad | Anshika Rastogi',
    description:
      'Depth of experience across residential and commercial interiors, coordination with vendors, and on-site execution—delivering distinctive, functional spaces in Hyderabad and beyond.',
  },
  '/womens-day': {
    title: "Women's Day | Designer's Vision Community | Interior Design Hyderabad",
    description:
      "Celebrate with Designer's Vision—interior design studio in Hyderabad championing creativity and women in design. Connect via the main site for consultations and projects.",
  },
  '/style-discovery': {
    title: 'Style Discovery Quiz | Find Your Interior Style | Hyderabad Interior Designer',
    description:
      'Short style quiz to uncover your aesthetic—then connect with Anshika Rastogi for a personalized interior roadmap, whether you are in Hyderabad, elsewhere in India, or abroad.',
  },
  '/style-discovery/quiz': {
    title: "Style Discovery — Quiz | Personalized Interiors | Designer's Vision",
    description:
      'Continue your style discovery to shape a home that feels uniquely yours—backed by professional interior design from Hyderabad.',
  },
  '/style-discovery/result': {
    title: 'Your Design Persona | Next Steps | Interior Designer Hyderabad',
    description:
      'See your style persona and book a consultation for turnkey interior design, modular solutions, and creative execution tailored to your space.',
  },
};

function matchPortfolioProject(path) {
  const m = /^\/portfolio\/project\/(\d+)$/.exec(path);
  return m ? m[1] : null;
}

function matchTestimonial(path) {
  const m = /^\/testimonials\/(\d+)$/.exec(path);
  return m ? m[1] : null;
}

function matchRecording(path) {
  const m = /^\/recording\/([^/]+)$/.exec(path);
  return m ? m[1] : null;
}

function buildInteriorDesignerSchema(baseUrl) {
  const url = baseUrl.replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'InteriorDesigner',
    '@id': `${url}/#organization`,
    name: "Anshika Rastogi — Designer's Vision",
    alternateName: ["Designer's Vision", 'Designers Vision', 'Anshika Rastogi Interior Design'],
    url,
    image: absoluteUrl(baseUrl, DEFAULT_OG_PATH),
    telephone: '+91-9557058902',
    email: 'info@designersvision.com',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Honer Vivantis, Tellapur Road',
      addressLocality: 'Hyderabad',
      addressRegion: 'Telangana',
      postalCode: '500019',
      addressCountry: 'IN',
    },
    areaServed: [
      { '@type': 'City', name: 'Hyderabad' },
      { '@type': 'State', name: 'Telangana' },
      { '@type': 'Country', name: 'India' },
      { '@type': 'Place', name: 'Worldwide' },
    ],
    knowsAbout: KNOWS_ABOUT,
    priceRange: '$$',
    sameAs: [
      'https://www.instagram.com/anshikarastogi07/',
      'https://www.linkedin.com/in/anshika-rastogi-9814061aa/',
      'https://anshikarastogi.blogspot.com/',
    ],
    description:
      'Interior design studio specializing in turnkey residential and commercial projects, personalized layouts, modular kitchens, Vastu-aware planning, and creative execution for clients in Hyderabad, across India, and internationally.',
  };
}

function buildWebSiteSchema(baseUrl) {
  const url = baseUrl.replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${url}/#website`,
    url,
    name: "Anshika Rastogi — Designer's Vision",
    description: PAGES['/'].description,
    publisher: { '@id': `${url}/#organization` },
    inLanguage: 'en-IN',
    potentialAction: {
      '@type': 'ReadAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${url}/contact`,
      },
    },
  };
}

/**
 * Default SEO for a request path. Dynamic segments (/portfolio/project/:id) get templates;
 * use enhance* helpers from routes for full copy.
 */
function seoForPath(reqPath, baseUrl) {
  const path = normalizePath(reqPath);
  const canonical = `${baseUrl.replace(/\/$/, '')}${path === '/' ? '/' : path}`;
  const defaults = {
    title: "Anshika Rastogi | Interior Designer Hyderabad | Designer's Vision",
    description: PAGES['/'].description,
    canonical,
    ogImage: absoluteUrl(baseUrl, DEFAULT_OG_PATH),
    robots: 'index, follow',
    jsonLd: [],
  };

  if (path.startsWith('/admin')) {
    return {
      ...defaults,
      title: 'Admin',
      description: 'Site administration.',
      robots: 'noindex, nofollow',
      canonical: `${baseUrl.replace(/\/$/, '')}${path}`,
      jsonLd: [],
    };
  }

  if (path.startsWith('/portal') && path !== '/portal/login') {
    return {
      ...defaults,
      title: 'Client Portal',
      description: "Secure client portal for Designer's Vision interior projects.",
      robots: 'noindex, nofollow',
      canonical: `${baseUrl.replace(/\/$/, '')}${path}`,
      jsonLd: [],
    };
  }

  if (path === '/portal/login') {
    return {
      ...defaults,
      title: "Client Portal Login | Interior Design Projects | Designer's Vision",
      description:
        "Sign in to track your interior design project: approvals, payments, site updates, and documents. Designer's Vision—Hyderabad-based turnkey interiors, serving clients across India and worldwide.",
      robots: 'index, follow',
      canonical: `${baseUrl.replace(/\/$/, '')}/portal/login`,
      jsonLd: [],
    };
  }

  if (path === '/testimonial-submit') {
    return {
      ...defaults,
      title: 'Submit Testimonial',
      description: "Private testimonial submission for Designer's Vision clients.",
      robots: 'noindex, nofollow',
      canonical: `${baseUrl.replace(/\/$/, '')}/testimonial-submit`,
      jsonLd: [],
    };
  }

  const projId = matchPortfolioProject(path);
  if (projId) {
    return {
      ...defaults,
      title: `Interior Design Project | Portfolio | Anshika Rastogi Hyderabad`,
      description:
        'Residential or commercial interior showcase by Anshika Rastogi—turnkey design and implementation in Hyderabad and across India. Explore the gallery and similar projects.',
      canonical,
      jsonLd: [],
    };
  }

  if (path === '/style-discovery/start' || path === '/style-discovery/verify') {
    const page = PAGES['/style-discovery'];
    return {
      ...defaults,
      title: page.title,
      description: page.description,
      canonical: `${baseUrl.replace(/\/$/, '')}/style-discovery`,
      jsonLd: [],
    };
  }

  const testimonialId = matchTestimonial(path);
  if (testimonialId) {
    return {
      ...defaults,
      title: `Client Review | Interior Designer Hyderabad | Testimonial #${testimonialId}`,
      description:
        "Client experience with Designer's Vision—interior design and end-to-end delivery in Hyderabad and beyond.",
      canonical,
      jsonLd: [],
    };
  }

  const recSlug = matchRecording(path);
  if (recSlug) {
    return {
      ...defaults,
      title: "Audio | Designer's Vision",
      description: "Listen to a message from Designer's Vision interior design studio.",
      robots: 'noindex, follow',
      canonical,
      jsonLd: [],
    };
  }

  const page = PAGES[path];
  if (page) {
    const jsonLd = [];
    if (path === '/') {
      jsonLd.push(buildInteriorDesignerSchema(baseUrl), buildWebSiteSchema(baseUrl));
    }
    return {
      ...defaults,
      title: page.title,
      description: page.description,
      canonical,
      jsonLd,
    };
  }

  return defaults;
}

function mergeSeo(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  const next = { ...base, ...patch };
  if (patch.jsonLd !== undefined) next.jsonLd = patch.jsonLd;
  return next;
}

function forPortfolioProject(baseSeo, project, baseUrl) {
  if (!project) return baseSeo;
  const city = (project.city || '').trim();
  const loc = (project.location || '').trim();
  const place = [loc, city].filter(Boolean).join(', ') || 'Hyderabad';
  const snippet = (project.initial_text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 155);
  const desc =
    snippet ||
    `Interior design project "${project.name}" in ${place}: turnkey execution, personalized styling, and professional implementation by Anshika Rastogi — serving Hyderabad, India, and global clients.`;
  const cat = project.category_name ? ` — ${project.category_name}` : '';
  const title = `${project.name}${cat} | Interior Design Portfolio | Hyderabad`;
  let ogImage = baseSeo.ogImage;
  if (project.cover_image_path) {
    const p = project.cover_image_path.replace(/^\/?/, '');
    ogImage = absoluteUrl(baseUrl, p);
  }
  const creativeWork = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: project.name,
    description: desc.slice(0, 300),
    creator: { '@id': `${baseUrl.replace(/\/$/, '')}/#organization` },
    ...(project.cover_image_path
      ? { image: absoluteUrl(baseUrl, project.cover_image_path.replace(/^\/?/, '')) }
      : {}),
  };
  return mergeSeo(baseSeo, {
    title,
    description: desc.slice(0, 320),
    ogImage,
    jsonLd: [creativeWork],
  });
}

function forTestimonialDetail(baseSeo, testimonial, baseUrl) {
  if (!testimonial) return baseSeo;
  const name = testimonial.name || 'Client';
  const role = (testimonial.role || '').trim();
  const msg = (testimonial.message || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
  const desc =
    msg ||
    `${name}${role ? `, ${role}` : ''} shares their experience with interior design and turnkey delivery by Anshika Rastogi in Hyderabad.`;
  let ogImage = baseSeo.ogImage;
  if (testimonial.image_path) {
    ogImage = absoluteUrl(baseUrl, testimonial.image_path.replace(/^\/?/, ''));
  }
  const review = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    author: { '@type': 'Person', name },
    reviewBody: (testimonial.message || '').replace(/<[^>]+>/g, ' ').slice(0, 500),
    itemReviewed: { '@id': `${baseUrl.replace(/\/$/, '')}/#organization` },
    ...(testimonial.rating
      ? { reviewRating: { '@type': 'Rating', ratingValue: String(testimonial.rating), bestRating: '5' } }
      : {}),
  };
  return mergeSeo(baseSeo, {
    title: `${name} — Client Review | Interior Designer Hyderabad`,
    description: desc,
    ogImage,
    jsonLd: [review],
  });
}

function forRecording(baseSeo, recording, baseUrl) {
  const title = recording.title || 'Audio message';
  return mergeSeo(baseSeo, {
    title: `${title} | Designer's Vision`,
    description: `Listen: ${title}. Designer's Vision — interior design Hyderabad.`,
    canonical: `${baseUrl.replace(/\/$/, '')}/recording/${encodeURIComponent(recording.slug)}`,
    robots: 'noindex, follow',
    jsonLd: [],
  });
}

function buildSitemapXml(baseUrl, paths) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  const lastmod = new Date().toISOString().slice(0, 10);
  for (const u of paths) {
    const loc = typeof u === 'string' ? u : u.loc;
    const pri = typeof u === 'object' && u.priority != null ? u.priority : '0.8';
    const ch = typeof u === 'object' && u.changefreq ? u.changefreq : 'weekly';
    lines.push('  <url>');
    lines.push(`    <loc>${escapeXml(loc)}</loc>`);
    lines.push(`    <lastmod>${lastmod}</lastmod>`);
    lines.push(`    <changefreq>${ch}</changefreq>`);
    lines.push(`    <priority>${pri}</priority>`);
    lines.push('  </url>');
  }
  lines.push('</urlset>');
  return lines.join('\n');
}

module.exports = {
  normalizePath,
  publicBaseUrl,
  absoluteUrl,
  seoForPath,
  mergeSeo,
  forPortfolioProject,
  forTestimonialDetail,
  forRecording,
  buildSitemapXml,
  escapeXml,
  KNOWS_ABOUT,
  PAGES,
};
