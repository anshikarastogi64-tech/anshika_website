/**
 * Journey Home - Immersive Scroll-Based Story
 * Using GSAP ScrollTrigger for smooth animations
 */

(function() {
  "use strict";

  // Register GSAP ScrollTrigger
  gsap.registerPlugin(ScrollTrigger);

  let audioEnabled = false;
  const audio = document.getElementById('ambient-audio');
  const audioToggle = document.getElementById('audio-toggle');

  /**
   * Initialize all animations and interactions
   */
  function init() {
    initScrollProgress();
    initSceneNavigation();
    initAudioControl();
    initIntroScene();
    initApproachScene();
    initEntranceScene();
    initDesignerScene();
    initVastuScene();
    initProcessScene();
    initFinaleScene();
    initSkipIntro();
  }

  /**
   * Scroll progress bar
   */
  function initScrollProgress() {
    const progressBar = document.getElementById('scroll-progress');

    gsap.to(progressBar, {
      width: '100%',
      ease: 'none',
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.3
      }
    });
  }

  /**
   * Scene navigation dots
   */
  function initSceneNavigation() {
    const dots = document.querySelectorAll('.nav-dot');
    const scenes = document.querySelectorAll('.journey-scene');

    scenes.forEach((scene, index) => {
      ScrollTrigger.create({
        trigger: scene,
        start: 'top center',
        end: 'bottom center',
        onEnter: () => updateActiveDot(index),
        onEnterBack: () => updateActiveDot(index)
      });
    });

    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        scenes[index].scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  function updateActiveDot(index) {
    document.querySelectorAll('.nav-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  }

  /**
   * Audio control
   */
  function initAudioControl() {
    if (audioToggle && audio) {
      audioToggle.addEventListener('click', () => {
        audioEnabled = !audioEnabled;
        audioToggle.classList.toggle('muted', !audioEnabled);

        if (audioEnabled) {
          audio.play().catch(err => console.log('Audio play failed:', err));
        } else {
          audio.pause();
        }
      });
    }
  }

  /**
   * SCENE 0: Intro animations
   */
  function initIntroScene() {
    const intro = document.getElementById('scene-intro');

    // Fade out intro when scrolling
    gsap.to(intro, {
      opacity: 0,
      scrollTrigger: {
        trigger: intro,
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });
  }

  /**
   * SCENE 1: Approaching Home - Zoom effect
   */
  function initApproachScene() {
    const houseImage = document.querySelector('.house-image');
    const vastuCompass = document.querySelector('.vastu-compass');
    const sceneText = document.querySelector('.scene-text-overlay');

    if (!houseImage) return;

    // Zoom in on house as we scroll
    gsap.to(houseImage, {
      scale: 1,
      scrollTrigger: {
        trigger: '#scene-approach',
        start: 'top bottom',
        end: 'center center',
        scrub: 1
      }
    });

    // Show Vastu compass
    ScrollTrigger.create({
      trigger: '#scene-approach',
      start: 'top center',
      onEnter: () => {
        vastuCompass.style.opacity = '1';
      }
    });

    // Show text overlay
    ScrollTrigger.create({
      trigger: '#scene-approach',
      start: 'center center',
      onEnter: () => {
        sceneText.style.opacity = '1';
      }
    });
  }

  /**
   * SCENE 2: Entrance Opens - Door animation
   */
  function initEntranceScene() {
    const doors = document.querySelectorAll('.door');
    const doorLight = document.querySelector('.door-light');
    const entranceWelcome = document.querySelector('.entrance-welcome');
    const vastuInsight = document.querySelector('.entrance-insight');

    if (doors.length === 0) return;

    ScrollTrigger.create({
      trigger: '#scene-entrance',
      start: 'top center',
      onEnter: () => {
        // Open doors
        setTimeout(() => {
          doors.forEach(door => door.classList.add('open'));
        }, 300);

        // Show light
        setTimeout(() => {
          if (doorLight) doorLight.classList.add('visible');
        }, 800);

        // Show welcome message
        setTimeout(() => {
          if (entranceWelcome) entranceWelcome.classList.add('visible');
        }, 1200);

        // Show Vastu insight
        setTimeout(() => {
          if (vastuInsight) vastuInsight.classList.add('visible');
        }, 2000);
      }
    });
  }

  /**
   * SCENE 3: Meet Anshika - Profile reveal
   */
  function initDesignerScene() {
    const profileImage = document.querySelector('.profile-image-frame');
    const designerContent = document.querySelector('.profile-content');
    const approachItems = document.querySelectorAll('.approach-item');

    if (!profileImage) return;

    // Profile image slide in from left
    gsap.from(profileImage, {
      x: -100,
      opacity: 0,
      duration: 1,
      scrollTrigger: {
        trigger: '#scene-designer',
        start: 'top center',
        toggleActions: 'play none none none'
      }
    });

    // Content fade in from right
    gsap.from(designerContent, {
      x: 100,
      opacity: 0,
      duration: 1,
      scrollTrigger: {
        trigger: '#scene-designer',
        start: 'top center',
        toggleActions: 'play none none none'
      }
    });

    // Approach items stagger
    gsap.from(approachItems, {
      y: 50,
      opacity: 0,
      duration: 0.8,
      stagger: 0.2,
      scrollTrigger: {
        trigger: '.approach-grid',
        start: 'top 80%',
        toggleActions: 'play none none none'
      }
    });
  }

  /**
   * SCENE 4: Vastu in Action - Interactive floor plan
   */
  function initVastuScene() {
    const vastuZones = document.querySelectorAll('.vastu-zone');
    const professionCards = document.querySelectorAll('.profession-card');

    // Vastu zones appear one by one
    gsap.from(vastuZones, {
      scale: 0,
      opacity: 0,
      duration: 0.5,
      stagger: {
        each: 0.1,
        from: 'center'
      },
      scrollTrigger: {
        trigger: '.plan-grid',
        start: 'top 70%',
        toggleActions: 'play none none none'
      }
    });

    // Profession cards slide up
    gsap.from(professionCards, {
      y: 80,
      opacity: 0,
      duration: 0.8,
      stagger: 0.15,
      scrollTrigger: {
        trigger: '.profession-cards',
        start: 'top 80%',
        toggleActions: 'play none none none'
      }
    });

    // Interactive hover effects for zones
    vastuZones.forEach(zone => {
      zone.addEventListener('mouseenter', function() {
        gsap.to(this, {
          scale: 1.05,
          duration: 0.3,
          ease: 'power2.out'
        });
      });

      zone.addEventListener('mouseleave', function() {
        gsap.to(this, {
          scale: 1,
          duration: 0.3,
          ease: 'power2.out'
        });
      });
    });
  }

  /**
   * SCENE 5: Design Process - Sequential reveals
   */
  function initProcessScene() {
    const processSteps = document.querySelectorAll('.process-step');

    processSteps.forEach((step, index) => {
      ScrollTrigger.create({
        trigger: step,
        start: 'top 75%',
        onEnter: () => {
          step.classList.add('visible');
        }
      });
    });
  }

  /**
   * SCENE 6: Finale animations
   */
  function initFinaleScene() {
    const finaleTitle = document.querySelector('.finale-title');
    const finaleMessage = document.querySelector('.finale-message');
    const finaleCta = document.querySelector('.finale-cta');
    const finaleLinks = document.querySelector('.finale-links');
    const finaleSocial = document.querySelector('.finale-social');

    if (!finaleTitle) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '#scene-finale',
        start: 'top center',
        toggleActions: 'play none none none'
      }
    });

    tl.from(finaleTitle, {
      y: 50,
      opacity: 0,
      duration: 1
    })
    .from(finaleMessage, {
      y: 30,
      opacity: 0,
      duration: 0.8
    }, '-=0.5')
    .from(finaleCta, {
      y: 30,
      opacity: 0,
      duration: 0.8
    }, '-=0.5')
    .from(finaleLinks, {
      y: 20,
      opacity: 0,
      duration: 0.6
    }, '-=0.4')
    .from(finaleSocial, {
      y: 20,
      opacity: 0,
      duration: 0.6
    }, '-=0.4');
  }

  /**
   * Skip intro button
   */
  function initSkipIntro() {
    const skipBtn = document.querySelector('#skip-intro a');
    if (skipBtn) {
      skipBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const designerScene = document.getElementById('scene-designer');
        if (designerScene) {
          designerScene.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
  }

  /**
   * Parallax effect on scroll
   */
  function initParallax() {
    gsap.utils.toArray('.vastu-compass, .profile-aura').forEach(el => {
      gsap.to(el, {
        y: () => -ScrollTrigger.maxScroll(window) * 0.05,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      });
    });
  }

  /**
   * Smooth scroll for anchor links
   */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href !== '#' && href.length > 1) {
          e.preventDefault();
          const target = document.querySelector(href);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });
  }

  /**
   * Add cursor trail effect (optional luxury touch)
   */
  function initCursorTrail() {
    const trail = [];
    const trailLength = 10;

    document.addEventListener('mousemove', (e) => {
      trail.push({ x: e.clientX, y: e.clientY });
      if (trail.length > trailLength) {
        trail.shift();
      }
    });

    // This could be expanded with actual visual cursor trail
  }

  /**
   * Ambient sound fade in/out based on sections
   */
  function initAmbientSound() {
    if (!audio) return;

    // You could add different audio zones here
    ScrollTrigger.create({
      trigger: '#scene-vastu',
      start: 'top center',
      end: 'bottom center',
      onEnter: () => {
        if (audioEnabled && audio.volume < 0.5) {
          gsap.to(audio, { volume: 0.5, duration: 2 });
        }
      },
      onLeave: () => {
        if (audioEnabled) {
          gsap.to(audio, { volume: 0.3, duration: 2 });
        }
      },
      onEnterBack: () => {
        if (audioEnabled) {
          gsap.to(audio, { volume: 0.5, duration: 2 });
        }
      }
    });
  }

  /**
   * Performance: Lazy load images
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
   * Accessibility: Reduce motion preference
   */
  function checkReducedMotion() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      // Disable animations for users who prefer reduced motion
      gsap.globalTimeline.timeScale(0.001);
      document.body.style.scrollBehavior = 'auto';
    }
  }

  /**
   * Mobile optimizations
   */
  function initMobileOptimizations() {
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      // Simplify some animations for mobile performance
      ScrollTrigger.config({
        limitCallbacks: true
      });
    }
  }

  /**
   * Initialize everything when DOM is ready
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      initParallax();
      initSmoothScroll();
      initAmbientSound();
      initLazyLoad();
      checkReducedMotion();
      initMobileOptimizations();
    });
  } else {
    init();
    initParallax();
    initSmoothScroll();
    initAmbientSound();
    initLazyLoad();
    checkReducedMotion();
    initMobileOptimizations();
  }

  // Handle window resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 250);
  });

})();
