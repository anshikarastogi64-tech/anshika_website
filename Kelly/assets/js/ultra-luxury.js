/**
 * Ultra Luxury Homepage - Enhanced Animations
 * Smooth, impressive, professional
 */

(function() {
  'use strict';

  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

  /**
   * Initialize
   */
  function init() {
    initPreloader();
    initCustomCursor();
    initHeader();
    initHeroAnimations();
    initStatsCounter();
    initBackgroundSlider();
    initServiceCards();
    initProcessTimeline();
    initParallax();
    initSmoothScroll();
    initMobileMenu();
  }

  /**
   * Preloader
   */
  function initPreloader() {
    window.addEventListener('load', () => {
      setTimeout(() => {
        document.getElementById('preloader').classList.add('loaded');
      }, 1500);
    });
  }

  /**
   * Custom Cursor
   */
  function initCustomCursor() {
    if (window.innerWidth < 768) return; // Skip on mobile

    const cursor = document.querySelector('.custom-cursor');
    const follower = document.querySelector('.cursor-follower');

    document.addEventListener('mousemove', (e) => {
      gsap.to(cursor, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.1
      });

      gsap.to(follower, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.3
      });
    });

    // Expand on hover over interactive elements
    const interactiveElements = document.querySelectorAll('a, button, .service-card-ultra');

    interactiveElements.forEach(el => {
      el.addEventListener('mouseenter', () => {
        gsap.to(cursor, { scale: 1.5, duration: 0.3 });
        gsap.to(follower, { scale: 1.5, duration: 0.3 });
      });

      el.addEventListener('mouseleave', () => {
        gsap.to(cursor, { scale: 1, duration: 0.3 });
        gsap.to(follower, { scale: 1, duration: 0.3 });
      });
    });
  }

  /**
   * Header scroll behavior
   */
  function initHeader() {
    const header = document.getElementById('header');

    ScrollTrigger.create({
      start: 'top -80',
      end: 99999,
      toggleClass: { className: 'scrolled', targets: header }
    });
  }

  /**
   * Hero animations
   */
  function initHeroAnimations() {
    // Background parallax
    gsap.to('.hero-bg-parallax', {
      yPercent: 30,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero-ultra-section',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });

    // Floating elements
    gsap.utils.toArray('.float-element').forEach((element, i) => {
      gsap.to(element, {
        y: -50,
        rotation: 360,
        duration: 3 + i,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut'
      });
    });

    // Designer card 3D tilt
    const card = document.querySelector('.designer-card-3d');
    if (card) {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;

        gsap.to(card, {
          rotateX: rotateX,
          rotateY: rotateY,
          duration: 0.5,
          ease: 'power2.out'
        });
      });

      card.addEventListener('mouseleave', () => {
        gsap.to(card, {
          rotateX: 0,
          rotateY: 0,
          duration: 0.5
        });
      });
    }
  }

  /**
   * Stats counter animation
   */
  function initStatsCounter() {
    const stats = document.querySelectorAll('.stat-number[data-target]');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const target = parseInt(entry.target.dataset.target);
          const duration = 2;

          gsap.to(entry.target, {
            innerText: target,
            duration: duration,
            snap: { innerText: 1 },
            onUpdate: function() {
              const value = Math.ceil(this.targets()[0].innerText);
              this.targets()[0].innerText = value + (target === 100 ? '%' : '+');
            }
          });

          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    stats.forEach(stat => observer.observe(stat));
  }

  /**
   * Background image slider
   */
  function initBackgroundSlider() {
    const slides = document.querySelectorAll('.hero-slide');
    let currentSlide = 0;

    setInterval(() => {
      slides[currentSlide].classList.remove('active');
      currentSlide = (currentSlide + 1) % slides.length;
      slides[currentSlide].classList.add('active');
    }, 6000);
  }

  /**
   * Service cards animations
   */
  function initServiceCards() {
    const cards = document.querySelectorAll('.service-card-ultra');

    gsap.from(cards, {
      y: 100,
      opacity: 0,
      duration: 1,
      stagger: 0.2,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '.services-ultra-section',
        start: 'top 70%',
        toggleActions: 'play none none none'
      }
    });

    // 3D tilt effect on hover
    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 30;
        const rotateY = (centerX - x) / 30;

        gsap.to(card, {
          rotateX: rotateX,
          rotateY: rotateY,
          duration: 0.5,
          ease: 'power2.out',
          transformPerspective: 1000
        });
      });

      card.addEventListener('mouseleave', () => {
        gsap.to(card, {
          rotateX: 0,
          rotateY: 0,
          duration: 0.5
        });
      });
    });
  }

  /**
   * Process timeline reveal
   */
  function initProcessTimeline() {
    const steps = document.querySelectorAll('.process-step-ultra');

    steps.forEach((step, index) => {
      ScrollTrigger.create({
        trigger: step,
        start: 'top 80%',
        onEnter: () => {
          step.classList.add('visible');
        }
      });
    });
  }

  /**
   * Parallax effects
   */
  function initParallax() {
    // UVP section parallax
    gsap.to('.uvp-bg-parallax', {
      yPercent: 30,
      ease: 'none',
      scrollTrigger: {
        trigger: '.uvp-ultra-section',
        start: 'top bottom',
        end: 'bottom top',
        scrub: true
      }
    });

    // Geometric patterns parallax
    gsap.utils.toArray('.pattern').forEach((pattern, i) => {
      gsap.to(pattern, {
        yPercent: -30 * (i + 1),
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero-ultra-section',
          start: 'top top',
          end: 'bottom top',
          scrub: true
        }
      });
    });
  }

  /**
   * Smooth scroll
   */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href !== '#' && href.length > 1) {
          e.preventDefault();
          const target = document.querySelector(href);
          if (target) {
            gsap.to(window, {
              duration: 1.5,
              scrollTo: {
                y: target,
                offsetY: 80
              },
              ease: 'power3.inOut'
            });
          }
        }
      });
    });
  }

  /**
   * Mobile menu
   */
  function initMobileMenu() {
    const mobileToggle = document.querySelector('.mobile-nav-toggle');
    const navbar = document.querySelector('.navbar');

    if (mobileToggle) {
      mobileToggle.addEventListener('click', () => {
        navbar.classList.toggle('navbar-mobile');
        mobileToggle.classList.toggle('bi-list');
        mobileToggle.classList.toggle('bi-x');
      });

      // Close menu on link click
      navbar.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          if (navbar.classList.contains('navbar-mobile')) {
            navbar.classList.remove('navbar-mobile');
            mobileToggle.classList.add('bi-list');
            mobileToggle.classList.remove('bi-x');
          }
        });
      });
    }
  }

  /**
   * Image lazy loading
   */
  function initLazyLoad() {
    const images = document.querySelectorAll('img[data-src]');

    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          imageObserver.unobserve(img);
        }
      });
    });

    images.forEach(img => imageObserver.observe(img));
  }

  /**
   * Accessibility - Reduced motion
   */
  function checkReducedMotion() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      gsap.globalTimeline.timeScale(0.5);
      document.body.style.scrollBehavior = 'smooth';
    }
  }

  /**
   * Initialize everything
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      initLazyLoad();
      checkReducedMotion();
    });
  } else {
    init();
    initLazyLoad();
    checkReducedMotion();
  }

  // Refresh ScrollTrigger on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 250);
  });

})();
