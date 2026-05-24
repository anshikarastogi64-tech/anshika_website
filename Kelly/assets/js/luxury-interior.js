/**
 * Luxury Interior Homepage - Interactive Features
 * Interior Design First, Vastu/Astro Elegantly Integrated
 */

(function() {
  "use strict";

  /**
   * Initialize AOS animations
   */
  function initAOS() {
    if (typeof AOS !== 'undefined') {
      AOS.init({
        duration: 1000,
        easing: 'ease-in-out',
        once: true,
        offset: 100
      });
    }
  }

  /**
   * Header scroll behavior
   */
  function initHeaderScroll() {
    const header = document.querySelector('.luxury-header');
    if (!header) return;

    window.addEventListener('scroll', () => {
      if (window.scrollY > 100) {
        header.classList.add('header-scrolled');
      } else {
        header.classList.remove('header-scrolled');
      }
    });
  }

  /**
   * Background image slider for hero section
   */
  function initHeroSlider() {
    const slides = document.querySelectorAll('.hero-slide');
    if (slides.length === 0) return;

    let currentSlide = 0;

    setInterval(() => {
      slides[currentSlide].classList.remove('active');
      currentSlide = (currentSlide + 1) % slides.length;
      slides[currentSlide].classList.add('active');
    }, 6000);
  }

  /**
   * Smooth scroll for anchor links
   */
  function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');

    links.forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href !== '#' && href.length > 1) {
          const target = document.querySelector(href);
          if (target) {
            e.preventDefault();
            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
          }
        }
      });
    });
  }

  /**
   * Service cards hover effects
   */
  function initServiceCardEffects() {
    const serviceCards = document.querySelectorAll('.service-luxury-card');

    serviceCards.forEach(card => {
      card.addEventListener('mouseenter', function() {
        this.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      });

      card.addEventListener('mousemove', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 30;
        const rotateY = (centerX - x) / 30;

        this.style.transform = `translateY(-10px) perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      });

      card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0) perspective(1000px) rotateX(0) rotateY(0)';
      });
    });
  }

  /**
   * Designer card image parallax effect
   */
  function initDesignerCardParallax() {
    const designerCard = document.querySelector('.designer-card');
    if (!designerCard) return;

    designerCard.addEventListener('mousemove', (e) => {
      const rect = designerCard.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const moveX = (x - centerX) / 30;
      const moveY = (y - centerY) / 30;

      const img = designerCard.querySelector('.designer-image img');
      if (img) {
        img.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.05)`;
      }
    });

    designerCard.addEventListener('mouseleave', () => {
      const img = designerCard.querySelector('.designer-image img');
      if (img) {
        img.style.transform = 'translate(0, 0) scale(1)';
      }
    });
  }

  /**
   * Scroll progress indicator
   */
  function initScrollProgress() {
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--luxury-gold), var(--luxury-gold-dark));
      z-index: 10000;
      transition: width 0.1s ease;
      width: 0%;
    `;
    document.body.appendChild(progressBar);

    window.addEventListener('scroll', () => {
      const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (window.scrollY / windowHeight) * 100;
      progressBar.style.width = scrolled + '%';
    });
  }

  /**
   * Animate numbers in stats section
   */
  function initStatsAnimation() {
    const statNumbers = document.querySelectorAll('.stat-number');
    let hasAnimated = false;

    const observerOptions = {
      threshold: 0.5
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !hasAnimated) {
          statNumbers.forEach(stat => {
            const text = stat.textContent;
            const number = parseInt(text);

            if (!isNaN(number)) {
              let current = 0;
              const increment = number / 50;
              const timer = setInterval(() => {
                current += increment;
                if (current >= number) {
                  stat.textContent = text;
                  clearInterval(timer);
                } else {
                  stat.textContent = Math.floor(current) + (text.includes('+') ? '+' : '');
                }
              }, 30);
            }
          });
          hasAnimated = true;
        }
      });
    }, observerOptions);

    const heroStats = document.querySelector('.hero-stats');
    if (heroStats) {
      observer.observe(heroStats);
    }
  }

  /**
   * Add subtle parallax to sections
   */
  function initParallaxSections() {
    const sections = document.querySelectorAll('.services-luxury-section, .process-section, .uvp-section');

    window.addEventListener('scroll', () => {
      sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        const scrolled = window.scrollY;

        if (rect.top < window.innerHeight && rect.bottom > 0) {
          const yPos = -(scrolled - section.offsetTop) * 0.1;
          section.style.backgroundPosition = `center ${yPos}px`;
        }
      });
    });
  }

  /**
   * Lazy load images
   */
  function initLazyLoad() {
    const images = document.querySelectorAll('img[data-src]');

    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      });
    });

    images.forEach(img => imageObserver.observe(img));
  }

  /**
   * Mobile menu toggle enhancements
   */
  function initMobileMenu() {
    const mobileToggle = document.querySelector('.mobile-nav-toggle');
    const navbar = document.querySelector('.navbar');

    if (mobileToggle && navbar) {
      mobileToggle.addEventListener('click', () => {
        navbar.classList.toggle('navbar-mobile');
        mobileToggle.classList.toggle('bi-list');
        mobileToggle.classList.toggle('bi-x');
      });

      // Close menu when clicking on a link
      const navLinks = navbar.querySelectorAll('a');
      navLinks.forEach(link => {
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
   * Add hover effect to process overlay
   */
  function initProcessOverlay() {
    const processOverlay = document.querySelector('.process-overlay');
    if (processOverlay) {
      processOverlay.addEventListener('click', () => {
        // Could open a video modal here
        console.log('Process video would open here');
      });
    }
  }

  /**
   * Specialty badges interaction
   */
  function initSpecialtyBadges() {
    const badges = document.querySelectorAll('.specialty-badge');

    badges.forEach(badge => {
      badge.addEventListener('mouseenter', function() {
        this.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      });
    });
  }

  /**
   * Initialize all functions
   */
  function init() {
    initAOS();
    initHeaderScroll();
    initHeroSlider();
    initSmoothScroll();
    initServiceCardEffects();
    initDesignerCardParallax();
    initScrollProgress();
    initStatsAnimation();
    initParallaxSections();
    initLazyLoad();
    initMobileMenu();
    initProcessOverlay();
    initSpecialtyBadges();

    // Add loaded class for additional animations
    document.body.classList.add('page-loaded');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
