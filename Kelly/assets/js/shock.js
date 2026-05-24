/**
 * SHOCK - Awwwards-Level Homepage
 * Cinema-grade animations, magnetic cursor, particles, morphing text
 */

(function() {
  'use strict';

  gsap.registerPlugin(ScrollTrigger);

  let particles;

  /**
   * Initialize everything
   */
  function init() {
    initLoading();
    initMagneticCursor();
    initParticles();
    initHeroAnimations();
    initScrollAnimations();
    initSmoothScroll();
  }

  /**
   * Loading sequence with dramatic reveal
   */
  function initLoading() {
    window.addEventListener('load', () => {
      setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hide');

        // Start hero animations after loading
        setTimeout(() => {
          animateHeroTitle();
        }, 800);
      }, 2500);
    });
  }

  /**
   * MAGNETIC CURSOR - Premium effect
   */
  function initMagneticCursor() {
    if (window.innerWidth < 768) return;

    const cursor = document.getElementById('cursor');
    const cursorBlur = document.getElementById('cursor-blur');

    let mouseX = 0, mouseY = 0;
    let cursorX = 0, cursorY = 0;
    let blurX = 0, blurY = 0;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    // Smooth cursor follow
    function animateCursor() {
      cursorX += (mouseX - cursorX) * 0.3;
      cursorY += (mouseY - cursorY) * 0.3;
      blurX += (mouseX - blurX) * 0.15;
      blurY += (mouseY - blurY) * 0.15;

      cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
      cursorBlur.style.transform = `translate(${blurX}px, ${blurY}px)`;

      requestAnimationFrame(animateCursor);
    }
    animateCursor();

    // Magnetic effect on hover
    const magneticElements = document.querySelectorAll('a, button, .service-item, .badge');

    magneticElements.forEach(el => {
      el.addEventListener('mouseenter', () => {
        cursor.classList.add('hover');
        gsap.to(cursorBlur, { scale: 2, duration: 0.4 });
      });

      el.addEventListener('mouseleave', () => {
        cursor.classList.remove('hover');
        gsap.to(cursorBlur, { scale: 1, duration: 0.4 });
      });

      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        gsap.to(el, {
          x: x * 0.3,
          y: y * 0.3,
          duration: 0.4,
          ease: 'power2.out'
        });
      });

      el.addEventListener('mouseleave', () => {
        gsap.to(el, {
          x: 0,
          y: 0,
          duration: 0.6,
          ease: 'elastic.out(1, 0.5)'
        });
      });
    });
  }

  /**
   * 3D PARTICLES - Like Three.js background
   */
  function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    particles = [];
    const particleCount = 100;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 2 + 1,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.5 + 0.2
      });
    }

    function animateParticles() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 175, 55, ${p.opacity})`;
        ctx.fill();
      });

      // Connect nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(212, 175, 55, ${0.1 * (1 - distance / 150)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(animateParticles);
    }

    animateParticles();

    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });
  }

  /**
   * HERO TITLE - Character-by-character reveal
   */
  function animateHeroTitle() {
    const chars = document.querySelectorAll('.hero-title .char');

    gsap.to(chars, {
      y: 0,
      stagger: 0.03,
      duration: 1.2,
      ease: 'power4.out'
    });

    gsap.to('.hero-subtitle', {
      opacity: 1,
      y: 0,
      duration: 1,
      delay: 0.8
    });

    gsap.to('.scroll-indicator', {
      opacity: 1,
      y: 0,
      duration: 1,
      delay: 1.5
    });
  }

  /**
   * SCROLL-TRIGGERED ANIMATIONS
   */
  function initScrollAnimations() {

    // Video parallax
    gsap.to('#hero-video', {
      scale: 1.5,
      ease: 'none',
      scrollTrigger: {
        trigger: '.section-hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });

    // Split screen effect
    gsap.to('.split-left', {
      xPercent: -50,
      ease: 'none',
      scrollTrigger: {
        trigger: '.section-split',
        start: 'top bottom',
        end: 'center center',
        scrub: true
      }
    });

    gsap.to('.split-right', {
      xPercent: 50,
      ease: 'none',
      scrollTrigger: {
        trigger: '.section-split',
        start: 'top bottom',
        end: 'center center',
        scrub: true
      }
    });

    gsap.from('.split-content', {
      opacity: 0,
      scale: 0.8,
      duration: 1,
      scrollTrigger: {
        trigger: '.section-split',
        start: 'center center',
        toggleActions: 'play none none reverse'
      }
    });

    // Profile image reveal
    gsap.from('.profile-image', {
      scale: 1.3,
      duration: 1.5,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '.section-profile',
        start: 'top center'
      }
    });

    gsap.from('.profile-name', {
      x: -100,
      opacity: 0,
      duration: 1,
      scrollTrigger: {
        trigger: '.section-profile',
        start: 'top center'
      }
    });

    gsap.from('.profile-bio', {
      y: 50,
      opacity: 0,
      duration: 1,
      delay: 0.3,
      scrollTrigger: {
        trigger: '.section-profile',
        start: 'top center'
      }
    });

    // Services cards stagger
    gsap.from('.service-item', {
      y: 100,
      opacity: 0,
      duration: 1,
      stagger: 0.2,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '.section-services',
        start: 'top 70%'
      }
    });

    // Signature section scale
    gsap.from('.signature-content', {
      scale: 0.9,
      opacity: 0,
      duration: 1.5,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '.section-signature',
        start: 'top center'
      }
    });

    // CTA title split reveal
    const ctaTitle = document.querySelector('.cta-title');
    if (ctaTitle) {
      const lines = ctaTitle.innerHTML.split('<br>');
      ctaTitle.innerHTML = lines.map(line => `<div style="overflow:hidden"><div class="cta-line">${line}</div></div>`).join('');

      gsap.from('.cta-line', {
        y: 200,
        stagger: 0.2,
        duration: 1.2,
        ease: 'power4.out',
        scrollTrigger: {
          trigger: '.section-cta',
          start: 'top center'
        }
      });
    }

    gsap.from('.cta-btn', {
      opacity: 0,
      y: 50,
      duration: 1,
      delay: 0.6,
      scrollTrigger: {
        trigger: '.section-cta',
        start: 'top center'
      }
    });
  }

  /**
   * Smooth scroll
   */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          gsap.to(window, {
            duration: 1.5,
            scrollTo: target,
            ease: 'power3.inOut'
          });
        }
      });
    });
  }

  /**
   * Parallax on mouse move
   */
  function initMouseParallax() {
    document.addEventListener('mousemove', (e) => {
      const mouseX = (e.clientX / window.innerWidth) - 0.5;
      const mouseY = (e.clientY / window.innerHeight) - 0.5;

      gsap.to('.hero-content', {
        x: mouseX * 30,
        y: mouseY * 30,
        duration: 1,
        ease: 'power2.out'
      });

      gsap.to('#hero-video', {
        x: mouseX * -20,
        y: mouseY * -20,
        duration: 2,
        ease: 'power2.out'
      });
    });
  }

  /**
   * Initialize
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Initialize mouse parallax after slight delay
  setTimeout(initMouseParallax, 1000);

})();
