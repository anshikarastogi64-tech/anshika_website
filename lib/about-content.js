/**
 * About page (/about-new) — all copy stored in content_blocks (page "about").
 * Used by server.js for public render and /admin/about CRUD.
 */

const DEFAULTS = {
  intro: {
    title: 'About',
    paragraph:
      'Interior design is the art and science of enhancing interior spaces to achieve a more aesthetically pleasing and functional environment.',
  },
  profile: {
    photo_url: '/assets/img/me.png',
    photo_alt: 'Anshika Rastogi - Interior Designer',
    name: 'Anshika Rastogi',
    job_title: 'Interior Designer & Consultant',
    bio: 'Experienced in Modern & Modular Interior design. Specializing in space planning, color & material selection. I bring creativity to produce the best outcome for your space—style meets function.',
    detail_experience: '7 Years Experience',
    detail_education: 'Master in Design (IIFT)',
    detail_location: 'Hyderabad & Global',
    detail_email: 'anshika@designersvision.com',
    detail_phone: '+91 9557058902',
    skills_hero:
      'Sketch UP\nPhotoshop\nAutoCAD\nSpace Planning\nProject Management\nResidential & Commercial',
  },
  actions: {
    btn_experience_label: 'Experience',
    btn_experience_href: '/experience',
    btn_portfolio_label: 'Portfolio',
    btn_portfolio_href: '/portfolio',
    btn_contact_label: 'Contact',
    btn_contact_href: '/contact',
  },
  philosophy: {
    heading: 'Design Philosophy',
    body:
      'I believe great interior design balances aesthetics with functionality. Every space tells a story—I aim to create environments that reflect your personality while maximizing comfort and usability. From concept to execution, I focus on quality materials, thoughtful layout, and seamless project delivery.',
  },
  project_types: {
    residential_title: 'Residential',
    residential_text: 'Homes, apartments & villas—creating personalized, livable spaces.',
    commercial_title: 'Commercial',
    commercial_text: 'Offices, retail & workspaces—designs that boost productivity.',
    hospitality_title: 'Hospitality',
    hospitality_text: 'Restaurants, bars & hotels—memorable guest experiences.',
  },
  skills: {
    section_heading: 'Skills',
    list:
      'Sketch UP\nPhotoshop\nAutoCAD\nTechnical Drawing\nIllustration\nProject Management\nSpace Planning\nDesign Process\nImage Manipulation\nColor Sense\nCompusoft\nResidential & Commercial Design',
  },
  featured: {
    section_title: 'Featured Project',
    show: '1',
  },
};

async function loadAboutContent(getBlock) {
  const d = DEFAULTS;
  const intro = {
    title: await getBlock('about', 'intro', 'title', d.intro.title),
    paragraph: await getBlock('about', 'intro', 'paragraph', d.intro.paragraph),
  };
  const profile = {
    photo_url: await getBlock('about', 'profile', 'photo_url', d.profile.photo_url),
    photo_alt: await getBlock('about', 'profile', 'photo_alt', d.profile.photo_alt),
    name: await getBlock('about', 'profile', 'name', d.profile.name),
    job_title: await getBlock('about', 'profile', 'job_title', d.profile.job_title),
    bio: await getBlock('about', 'profile', 'bio', d.profile.bio),
    detail_experience: await getBlock('about', 'profile', 'detail_experience', d.profile.detail_experience),
    detail_education: await getBlock('about', 'profile', 'detail_education', d.profile.detail_education),
    detail_location: await getBlock('about', 'profile', 'detail_location', d.profile.detail_location),
    detail_email: await getBlock('about', 'profile', 'detail_email', d.profile.detail_email),
    detail_phone: await getBlock('about', 'profile', 'detail_phone', d.profile.detail_phone),
    skills_hero: await getBlock('about', 'profile', 'skills_hero', d.profile.skills_hero),
  };
  const actions = {
    btn_experience_label: await getBlock('about', 'actions', 'btn_experience_label', d.actions.btn_experience_label),
    btn_experience_href: await getBlock('about', 'actions', 'btn_experience_href', d.actions.btn_experience_href),
    btn_portfolio_label: await getBlock('about', 'actions', 'btn_portfolio_label', d.actions.btn_portfolio_label),
    btn_portfolio_href: await getBlock('about', 'actions', 'btn_portfolio_href', d.actions.btn_portfolio_href),
    btn_contact_label: await getBlock('about', 'actions', 'btn_contact_label', d.actions.btn_contact_label),
    btn_contact_href: await getBlock('about', 'actions', 'btn_contact_href', d.actions.btn_contact_href),
  };
  const philosophy = {
    heading: await getBlock('about', 'philosophy', 'heading', d.philosophy.heading),
    body: await getBlock('about', 'philosophy', 'body', d.philosophy.body),
  };
  const project_types = {
    residential_title: await getBlock(
      'about',
      'project_types',
      'residential_title',
      d.project_types.residential_title
    ),
    residential_text: await getBlock(
      'about',
      'project_types',
      'residential_text',
      d.project_types.residential_text
    ),
    commercial_title: await getBlock(
      'about',
      'project_types',
      'commercial_title',
      d.project_types.commercial_title
    ),
    commercial_text: await getBlock(
      'about',
      'project_types',
      'commercial_text',
      d.project_types.commercial_text
    ),
    hospitality_title: await getBlock(
      'about',
      'project_types',
      'hospitality_title',
      d.project_types.hospitality_title
    ),
    hospitality_text: await getBlock(
      'about',
      'project_types',
      'hospitality_text',
      d.project_types.hospitality_text
    ),
  };
  const skills = {
    section_heading: await getBlock('about', 'skills', 'section_heading', d.skills.section_heading),
    list: await getBlock('about', 'skills', 'list', d.skills.list),
  };
  const featured = {
    section_title: await getBlock('about', 'featured', 'section_title', d.featured.section_title),
    show: await getBlock('about', 'featured', 'show', d.featured.show),
  };
  return { intro, profile, actions, philosophy, project_types, skills, featured };
}

function str(v) {
  return v != null ? String(v) : '';
}

async function saveAboutContent(saveBlock, body, opts = {}) {
  const d = DEFAULTS;
  const b = body || {};
  const photoFromUpload = opts.profilePhotoUrl;

  await saveBlock('about', 'intro', 'title', str(b.intro_title).trim() || d.intro.title);
  await saveBlock('about', 'intro', 'paragraph', str(b.intro_paragraph).trim() || d.intro.paragraph);

  if (photoFromUpload) {
    await saveBlock('about', 'profile', 'photo_url', photoFromUpload);
  } else {
    await saveBlock('about', 'profile', 'photo_url', str(b.profile_photo_url).trim() || d.profile.photo_url);
  }
  await saveBlock('about', 'profile', 'photo_alt', str(b.profile_photo_alt).trim() || d.profile.photo_alt);
  await saveBlock('about', 'profile', 'name', str(b.profile_name).trim() || d.profile.name);
  await saveBlock('about', 'profile', 'job_title', str(b.profile_job_title).trim() || d.profile.job_title);
  await saveBlock('about', 'profile', 'bio', str(b.profile_bio).trim() || d.profile.bio);
  await saveBlock(
    'about',
    'profile',
    'detail_experience',
    str(b.profile_detail_experience).trim() || d.profile.detail_experience
  );
  await saveBlock(
    'about',
    'profile',
    'detail_education',
    str(b.profile_detail_education).trim() || d.profile.detail_education
  );
  await saveBlock(
    'about',
    'profile',
    'detail_location',
    str(b.profile_detail_location).trim() || d.profile.detail_location
  );
  await saveBlock('about', 'profile', 'detail_email', str(b.profile_detail_email).trim() || d.profile.detail_email);
  await saveBlock('about', 'profile', 'detail_phone', str(b.profile_detail_phone).trim() || d.profile.detail_phone);
  await saveBlock('about', 'profile', 'skills_hero', str(b.profile_skills_hero) || d.profile.skills_hero);

  await saveBlock(
    'about',
    'actions',
    'btn_experience_label',
    str(b.btn_experience_label).trim() || d.actions.btn_experience_label
  );
  await saveBlock(
    'about',
    'actions',
    'btn_experience_href',
    str(b.btn_experience_href).trim() || d.actions.btn_experience_href
  );
  await saveBlock(
    'about',
    'actions',
    'btn_portfolio_label',
    str(b.btn_portfolio_label).trim() || d.actions.btn_portfolio_label
  );
  await saveBlock(
    'about',
    'actions',
    'btn_portfolio_href',
    str(b.btn_portfolio_href).trim() || d.actions.btn_portfolio_href
  );
  await saveBlock(
    'about',
    'actions',
    'btn_contact_label',
    str(b.btn_contact_label).trim() || d.actions.btn_contact_label
  );
  await saveBlock(
    'about',
    'actions',
    'btn_contact_href',
    str(b.btn_contact_href).trim() || d.actions.btn_contact_href
  );

  await saveBlock('about', 'philosophy', 'heading', str(b.philosophy_heading).trim() || d.philosophy.heading);
  await saveBlock('about', 'philosophy', 'body', str(b.philosophy_body).trim() || d.philosophy.body);

  await saveBlock(
    'about',
    'project_types',
    'residential_title',
    str(b.residential_title).trim() || d.project_types.residential_title
  );
  await saveBlock(
    'about',
    'project_types',
    'residential_text',
    str(b.residential_text).trim() || d.project_types.residential_text
  );
  await saveBlock(
    'about',
    'project_types',
    'commercial_title',
    str(b.commercial_title).trim() || d.project_types.commercial_title
  );
  await saveBlock(
    'about',
    'project_types',
    'commercial_text',
    str(b.commercial_text).trim() || d.project_types.commercial_text
  );
  await saveBlock(
    'about',
    'project_types',
    'hospitality_title',
    str(b.hospitality_title).trim() || d.project_types.hospitality_title
  );
  await saveBlock(
    'about',
    'project_types',
    'hospitality_text',
    str(b.hospitality_text).trim() || d.project_types.hospitality_text
  );

  await saveBlock(
    'about',
    'skills',
    'section_heading',
    str(b.skills_section_heading).trim() || d.skills.section_heading
  );
  await saveBlock('about', 'skills', 'list', str(b.skills_list) || d.skills.list);

  await saveBlock(
    'about',
    'featured',
    'section_title',
    str(b.featured_section_title).trim() || d.featured.section_title
  );
  const rawShow = b.featured_show;
  const showOn = Array.isArray(rawShow)
    ? rawShow.includes('1') || rawShow.includes(1)
    : rawShow === '1' || rawShow === 'on' || rawShow === true;
  await saveBlock('about', 'featured', 'show', showOn ? '1' : '0');
}

module.exports = {
  DEFAULTS,
  loadAboutContent,
  saveAboutContent,
};
