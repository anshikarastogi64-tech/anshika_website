/**
 * Seed data extracted from the original static website.
 * Run: node seed-data.js (or it runs automatically on first DB init when tables are empty)
 */

module.exports = {
  testimonials: [
    { name: 'Geetika', role: 'Engineer', message: "Anshika's attention to detail is phenomenal. She understands the customer requirement thoroughly and plan the interior within budget.", image_path: 'assets/img/testimonials/geetika.jpg' },
    { name: 'Garima', role: 'House Maker', message: "Anshika is most creative and experienced interior designer. She renovate and design my house with grand look with great innovations. Finally, good and right decision to get support from her and worth spending on our interiors work done by her. Anshika you are doing very well...Best of luck", image_path: 'assets/img/testimonials/garima.jpg' },
    { name: 'Ekta', role: 'House Maker', message: "I would like to express my sincerest gratitude for Anshika' s superb decorating services . One of the thing that makes her great is that she is able to grasp her clients style instead of pushing her own.", image_path: 'assets/img/testimonials/ekta.jpg' },
    { name: 'Kanupriya', role: 'Human Resourse Manager', message: "Anshika is a very talented designer, she always comes with innovative ideas and always try to put her best.\nShe decorated my 1bhk, and I still say thankyou to her whenever someone gives compliment to my house interior.", image_path: 'assets/img/testimonials/kanupriya.jpeg' },
    { name: 'Devanshi', role: 'Business Development Manager', message: "Have done my interior work with anshika rastogi.. she's awesome.. done it so well. Im really satisfied with the work she has done for my home.", image_path: 'assets/img/testimonials/devianshi.jpg' },
    { name: 'Diya', role: 'Business Development Manager', message: "I would like to express my sincerest gratitude for your superb decorating services.You are the consummate professional and I am in awe of your designs abilities and seamless coordination skills. One of the things that make you so great is that you are able to grasp your clients style instead of pushing your own.I am absolutely adore my new space and I am forever grateful to you and your team.", image_path: 'assets/img/testimonials/diya.jpg' },
    { name: 'Kashish', role: 'Human Resourse Manager', message: "She is a very good and budget friend interior desighner ... also very understanding ... She designed my dream home .. her deisgns are unique and classy", image_path: 'assets/img/testimonials/kashish.png' },
  ],

  services: [
    { title: 'COMMERCIAL INTERIOR', image_path: 'assets/img/services/File 10.jpg' },
    { title: 'HOSPATILITY INTERIOR', image_path: 'assets/img/services/File 18.jpg' },
    { title: 'SUSTAINABLE INTERIOR', image_path: 'assets/img/services/File 19.jpg' },
    { title: 'RESIDENCIAL INTERIOR', image_path: 'assets/img/services/File 4.jpeg' },
    { title: 'LOOSE FURNITURE', image_path: 'assets/img/services/File 6.jpg' },
    { title: 'CAFES INTERIOR', image_path: 'assets/img/services/File 2.jpg' },
    { title: 'OFFICE INTERIOR', image_path: 'assets/img/services/File 11.jpeg' },
    { title: 'VILLA INTERIOR', image_path: 'assets/img/services/File 1.jpeg' },
    { title: 'HOTEL INTERIOR', image_path: 'assets/img/services/File 15.jpg' },
    { title: 'SHOWROOMS INTERIOR', image_path: 'assets/img/services/File 8.jpg' },
    { title: 'MODULAR KITCHENS', image_path: 'assets/img/services/File 9.jpg' },
    { title: 'RESTAURANT INTERIOR', image_path: 'assets/img/services/File 16.jpg' },
    { title: 'RENOVATIONS', image_path: 'assets/img/services/File 17.jpeg' },
  ],

  facts: { clients: '156', projects: '309', hours: '1463', workers: '15' },

  getPortfolioItems() {
    const items = [];
    let so = 0;
    const add = (category, basePath, count, ext = 'jpg') => {
      for (let i = 1; i <= count; i++) {
        items.push({ title: `${category} ${i}`, category: `filter-${category}`, image_path: `${basePath}File ${i}.${ext}`, sort_order: so++ });
      }
    };
    add('hospital', 'assets/img/project/hospital/', 17, 'jpeg');
    add('office', 'assets/img/project/office/', 2);
    add('dining', 'assets/img/project/dining/', 1);
    add('bar', 'assets/img/project/bar/', 28);
    add('wardrobe', 'assets/img/project/wardrobe/', 20);
    add('livingarea', 'assets/img/render/living/File ', 7, 'jpeg');
    for (let i = 1; i <= 40; i++) {
      const ext = i <= 9 ? 'PNG' : 'jpg';
      items.push({ title: `Kitchen ${i}`, category: 'filter-kitchen', image_path: `assets/img/render/kitchen/File ${i}.${ext}`, sort_order: so++ });
    }
    const bedroomFiles = [
      { n: 1, e: 'jpeg' }, { n: 2, e: 'png' }, { n: 3, e: 'png' }, { n: 4, e: 'png' }, { n: 5, e: 'jpg' },
      { n: 6, e: 'jpg' }, { n: 7, e: 'jpg' }, { n: 8, e: 'jpg' }, { n: 9, e: 'jpeg' }, { n: 10, e: 'jpeg' },
      { n: 11, e: 'jpeg' }, { n: 12, e: 'jpeg' }, { n: 13, e: 'jpeg' }
    ];
    bedroomFiles.forEach(({ n, e }) => {
      items.push({ title: `Bedroom ${n}`, category: 'filter-bedroom', image_path: `assets/img/render/bedroom/File ${n}.${e}`, sort_order: so++ });
    });
    return items;
  },
};
