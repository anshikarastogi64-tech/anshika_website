/**
 * Premium Home Page JavaScript
 * Enhanced animations and interactions for Astro Vastu Designer
 */

(function() {
  "use strict";

  /**
   * Initialize AOS (Animate On Scroll) with custom settings
   */
  function initAOS() {
    if (typeof AOS !== 'undefined') {
      AOS.init({
        duration: 1000,
        easing: 'ease-in-out',
        once: true,
        mirror: false,
        offset: 100
      });
    }
  }

  /**
   * Parallax effect for cosmic background elements
   */
  function initParallax() {
    const cosmicCircles = document.querySelectorAll('.cosmic-circle');
    const zodiacSymbols = document.querySelectorAll('.zodiac-symbol');

    window.addEventListener('mousemove', (e) => {
      const mouseX = e.clientX / window.innerWidth;
      const mouseY = e.clientY / window.innerHeight;

      cosmicCircles.forEach((circle, index) => {
        const speed = (index + 1) * 20;
        const x = (mouseX - 0.5) * speed;
        const y = (mouseY - 0.5) * speed;
        circle.style.transform = `translate(${x}px, ${y}px)`;
      });

      zodiacSymbols.forEach((symbol, index) => {
        const speed = (index + 1) * 10;
        const x = (mouseX - 0.5) * speed;
        const y = (mouseY - 0.5) * speed;
        symbol.style.transform = `translate(${x}px, ${y}px)`;
      });
    });
  }

  /**
   * Profile image 3D tilt effect
   */
  function initProfileTilt() {
    const profileContainer = document.querySelector('.profile-image-container');

    if (profileContainer) {
      profileContainer.addEventListener('mousemove', (e) => {
        const rect = profileContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;

        profileContainer.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      });

      profileContainer.addEventListener('mouseleave', () => {
        profileContainer.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
      });
    }
  }

  /**
   * Smooth scroll to sections
   */
  function initSmoothScroll() {
    const scrollLinks = document.querySelectorAll('a[href^="#"]');

    scrollLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href !== '#' && href !== '#hero') {
          e.preventDefault();
          const target = document.querySelector(href);
          if (target) {
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
   * Typing effect for hero text
   */
  function initTypingEffect() {
    const greetingText = document.querySelector('.greeting-text');

    if (greetingText && !sessionStorage.getItem('typingAnimationShown')) {
      const text = greetingText.textContent;
      greetingText.textContent = '';
      greetingText.style.opacity = '1';

      let i = 0;
      const typeWriter = () => {
        if (i < text.length) {
          greetingText.textContent += text.charAt(i);
          i++;
          setTimeout(typeWriter, 50);
        } else {
          sessionStorage.setItem('typingAnimationShown', 'true');
        }
      };

      setTimeout(typeWriter, 500);
    }
  }

  /**
   * Floating icons enhanced interaction
   */
  function initFloatingIconsInteraction() {
    const floatingIcons = document.querySelectorAll('.floating-icon');

    floatingIcons.forEach(icon => {
      icon.addEventListener('mouseenter', function() {
        // Pause animation on hover
        this.style.animationPlayState = 'paused';

        // Create ripple effect
        const ripple = document.createElement('span');
        ripple.className = 'ripple-effect';
        ripple.style.cssText = `
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: rgba(212, 175, 55, 0.5);
          top: 0;
          left: 0;
          animation: ripple 0.6s ease-out;
        `;
        this.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
      });

      icon.addEventListener('mouseleave', function() {
        this.style.animationPlayState = 'running';
      });
    });
  }

  /**
   * Counter animation for trust badges
   */
  function initCounterAnimation() {
    const trustSection = document.querySelector('.trust-badges');
    if (!trustSection) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounters();
          observer.unobserve(entry.target);
        }
      });
    });

    observer.observe(trustSection);
  }

  function animateCounters() {
    // This can be enhanced if you add numeric counters
    const badges = document.querySelectorAll('.badge-item');
    badges.forEach((badge, index) => {
      setTimeout(() => {
        badge.style.opacity = '0';
        badge.style.transform = 'translateY(20px)';

        setTimeout(() => {
          badge.style.transition = 'all 0.5s ease';
          badge.style.opacity = '1';
          badge.style.transform = 'translateY(0)';
        }, 50);
      }, index * 100);
    });
  }

  /**
   * Identity cards sequential reveal on scroll
   */
  function initIdentityReveal() {
    const identityItems = document.querySelectorAll('.identity-item');
    if (identityItems.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.classList.add('revealed');
          }, index * 200);
        }
      });
    }, { threshold: 0.5 });

    identityItems.forEach(item => {
      observer.observe(item);
    });
  }

  /**
   * Specialization cards hover effect
   */
  function initSpecCardEffects() {
    const specCards = document.querySelectorAll('.spec-card');

    specCards.forEach(card => {
      card.addEventListener('mouseenter', function() {
        this.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      });

      card.addEventListener('mousemove', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;

        this.style.transform = `translateY(-10px) perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      });

      card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0) perspective(1000px) rotateX(0) rotateY(0)';
      });
    });
  }

  /**
   * Header shrink on scroll
   */
  function initHeaderShrink() {
    const header = document.getElementById('header');
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
   * Scroll progress indicator
   */
  function initScrollProgress() {
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--primary-gold), var(--secondary-purple));
      z-index: 9999;
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
   * Add ripple animation CSS
   */
  function addRippleStyles() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes ripple {
        0% { transform: scale(0); opacity: 1; }
        100% { transform: scale(2); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
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
   * Initialize all functions when DOM is ready
   */
  function init() {
    initAOS();
    initParallax();
    initProfileTilt();
    initSmoothScroll();
    initTypingEffect();
    initFloatingIconsInteraction();
    initCounterAnimation();
    initIdentityReveal();
    initSpecCardEffects();
    initHeaderShrink();
    initScrollProgress();
    addRippleStyles();
    initLazyLoad();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
