/**
 * Cinematic Scroll Experience
 * Fixed viewport, scroll-driven 3D camera movement
 * Like Apple product reveals, high-end automotive sites
 */

(function() {
  "use strict";

  gsap.registerPlugin(ScrollTrigger);

  const totalScenes = 8;
  let currentScene = 1;
  let soundEnabled = false;

  /**
   * Loading sequence
   */
  function initLoading() {
    window.addEventListener('load', () => {
      setTimeout(() => {
        document.getElementById('loading-screen').classList.add('loaded');
        init();
      }, 2500);
    });
  }

  /**
   * Main initialization
   */
  function init() {
    initSoundToggle();
    initProgressBar();
    initCinematicScroll();
  }

  /**
   * Sound toggle
   */
  function initSoundToggle() {
    const soundBtn = document.getElementById('sound-toggle');
    const audio = document.getElementById('ambient-sound');

    if (soundBtn && audio) {
      soundBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        soundBtn.classList.toggle('muted', !soundEnabled);

        if (soundEnabled) {
          audio.play().catch(err => console.log('Audio play failed:', err));
        } else {
          audio.pause();
        }
      });
    }
  }

  /**
   * Update progress bar
   */
  function initProgressBar() {
    const progressLine = document.querySelector('.progress-line::after');
    const currentSceneEl = document.querySelector('.current-scene');

    ScrollTrigger.create({
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        const progress = self.progress;
        document.querySelector('.progress-line').style.setProperty('--progress', progress);

        // Update scene number
        const scene = Math.min(Math.ceil(progress * totalScenes) || 1, totalScenes);
        if (currentSceneEl) {
          currentSceneEl.textContent = scene.toString().padStart(2, '0');
        }
        currentScene = scene;
      }
    });

    // Add CSS custom property support
    const style = document.createElement('style');
    style.textContent = `
      .progress-line::after {
        width: calc(var(--progress, 0) * 100%);
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * CINEMATIC SCROLL ANIMATION - THE MAGIC!
   */
  function initCinematicScroll() {

    // Calculate scroll range for each scene
    const sceneHeight = 100; // each scene is 100vh of scroll

    /**
     * SCENE 1: INTRO (0-100vh scroll)
     * Start with farmhouse in distance
     */
    ScrollTrigger.create({
      start: 0,
      end: sceneHeight,
      onEnter: () => showText(1),
      onEnterBack: () => showText(1),
      onLeave: () => hideText(1)
    });

    gsap.to('#layer-sky', {
      opacity: 1,
      scrollTrigger: {
        start: 0,
        end: sceneHeight,
        scrub: 1
      }
    });

    /**
     * SCENE 2: APPROACHING HOUSE (100-200vh)
     * Zoom toward farmhouse, sky fades slightly
     */
    ScrollTrigger.create({
      start: sceneHeight,
      end: sceneHeight * 2,
      onEnter: () => showText(2),
      onEnterBack: () => showText(2),
      onLeave: () => hideText(2)
    });

    gsap.fromTo('#layer-house-far',
      { scale: 0.5, opacity: 0 },
      {
        scale: 2,
        opacity: 1,
        scrollTrigger: {
          start: sceneHeight,
          end: sceneHeight * 2,
          scrub: 1
        }
      }
    );

    // Garden elements appear
    gsap.fromTo('#layer-garden',
      { opacity: 0 },
      {
        opacity: 1,
        scrollTrigger: {
          start: sceneHeight * 1.5,
          end: sceneHeight * 2,
          scrub: 1
        }
      }
    );

    /**
     * SCENE 3: AT THE DOOR (200-300vh)
     * House fades, door frame appears centered
     */
    ScrollTrigger.create({
      start: sceneHeight * 2,
      end: sceneHeight * 3,
      onEnter: () => showText(3),
      onEnterBack: () => showText(3),
      onLeave: () => hideText(3)
    });

    // Fade out house, fade in door
    gsap.to('#layer-house-far', {
      opacity: 0,
      scrollTrigger: {
        start: sceneHeight * 2,
        end: sceneHeight * 2.5,
        scrub: 1
      }
    });

    gsap.to('#layer-garden', {
      opacity: 0,
      scrollTrigger: {
        start: sceneHeight * 2,
        end: sceneHeight * 2.5,
        scrub: 1
      }
    });

    gsap.to('#layer-door', {
      opacity: 1,
      scrollTrigger: {
        start: sceneHeight * 2,
        end: sceneHeight * 2.5,
        scrub: 1
      }
    });

    /**
     * SCENE 4: DOOR OPENS (300-400vh)
     * Doors swing open, light pours through
     */
    ScrollTrigger.create({
      start: sceneHeight * 3,
      end: sceneHeight * 4,
      onEnter: () => {
        showText(4);
        openDoors();
      },
      onEnterBack: () => {
        showText(4);
        openDoors();
      },
      onLeave: () => hideText(4),
      onLeaveBack: () => closeDoors()
    });

    // Fade out door, reveal entrance hall
    gsap.to('#layer-door', {
      opacity: 0,
      scrollTrigger: {
        start: sceneHeight * 3.5,
        end: sceneHeight * 4,
        scrub: 1
      }
    });

    gsap.fromTo('#layer-entrance-hall .room',
      { opacity: 0, scale: 0.8 },
      {
        opacity: 1,
        scale: 1,
        scrollTrigger: {
          start: sceneHeight * 3.5,
          end: sceneHeight * 4,
          scrub: 1
        }
      }
    );

    /**
     * SCENE 5: LIVING ROOM + ANSHIKA (400-500vh)
     * Camera moves into living room, Anshika introduces herself
     */
    ScrollTrigger.create({
      start: sceneHeight * 4,
      end: sceneHeight * 5,
      onEnter: () => {
        showText(5);
        showVastuMarkers('.north');
      },
      onEnterBack: () => {
        showText(5);
        showVastuMarkers('.north');
      },
      onLeave: () => {
        hideText(5);
        hideVastuMarkers('.north');
      }
    });

    gsap.to('#layer-entrance-hall .room', {
      opacity: 0,
      scrollTrigger: {
        start: sceneHeight * 4,
        end: sceneHeight * 4.5,
        scrub: 1
      }
    });

    gsap.fromTo('#layer-living .room',
      { opacity: 0, x: 100 },
      {
        opacity: 1,
        x: 0,
        scrollTrigger: {
          start: sceneHeight * 4,
          end: sceneHeight * 4.5,
          scrub: 1
        }
      }
    );

    /**
     * SCENE 6: KITCHEN (500-600vh)
     * Move to kitchen, show Vastu fire element
     */
    ScrollTrigger.create({
      start: sceneHeight * 5,
      end: sceneHeight * 6,
      onEnter: () => {
        showText(6);
        showVastuMarkers('.southeast');
      },
      onEnterBack: () => {
        showText(6);
        showVastuMarkers('.southeast');
      },
      onLeave: () => {
        hideText(6);
        hideVastuMarkers('.southeast');
      }
    });

    gsap.to('#layer-living .room', {
      opacity: 0,
      x: -100,
      scrollTrigger: {
        start: sceneHeight * 5,
        end: sceneHeight * 5.5,
        scrub: 1
      }
    });

    gsap.fromTo('#layer-kitchen .room',
      { opacity: 0, y: 100 },
      {
        opacity: 1,
        y: 0,
        scrollTrigger: {
          start: sceneHeight * 5,
          end: sceneHeight * 5.5,
          scrub: 1
        }
      }
    );

    /**
     * SCENE 7: BEDROOM (600-700vh)
     * Final room - master bedroom with Vastu info
     */
    ScrollTrigger.create({
      start: sceneHeight * 6,
      end: sceneHeight * 7,
      onEnter: () => {
        showText(7);
        showVastuMarkers('.southwest');
      },
      onEnterBack: () => {
        showText(7);
        showVastuMarkers('.southwest');
      },
      onLeave: () => {
        hideText(7);
        hideVastuMarkers('.southwest');
      }
    });

    gsap.to('#layer-kitchen .room', {
      opacity: 0,
      scrollTrigger: {
        start: sceneHeight * 6,
        end: sceneHeight * 6.5,
        scrub: 1
      }
    });

    gsap.fromTo('#layer-bedroom .room',
      { opacity: 0, scale: 1.2 },
      {
        opacity: 1,
        scale: 1,
        scrollTrigger: {
          start: sceneHeight * 6,
          end: sceneHeight * 6.5,
          scrub: 1
        }
      }
    );

    /**
     * SCENE 8: FINALE CTA (700-800vh)
     * Fade to stars, show final call-to-action
     */
    ScrollTrigger.create({
      start: sceneHeight * 7,
      end: sceneHeight * 8,
      onEnter: () => showText(8),
      onEnterBack: () => showText(8),
      onLeave: () => hideText(8)
    });

    gsap.to('#layer-bedroom .room', {
      opacity: 0,
      scale: 0.8,
      scrollTrigger: {
        start: sceneHeight * 7,
        end: sceneHeight * 7.5,
        scrub: 1
      }
    });

    // Bring back starry sky
    gsap.to('#layer-sky', {
      opacity: 1,
      scrollTrigger: {
        start: sceneHeight * 7,
        end: sceneHeight * 7.5,
        scrub: 1
      }
    });
  }

  /**
   * Helper: Show text overlay
   */
  function showText(sceneNum) {
    document.querySelectorAll('.text-overlay').forEach(el => {
      el.classList.remove('active');
    });
    const textEl = document.getElementById(`text-scene-${sceneNum}`);
    if (textEl) {
      textEl.classList.add('active');
    }
  }

  /**
   * Helper: Hide text overlay
   */
  function hideText(sceneNum) {
    const textEl = document.getElementById(`text-scene-${sceneNum}`);
    if (textEl) {
      textEl.classList.remove('active');
    }
  }

  /**
   * Helper: Open doors
   */
  function openDoors() {
    const doors = document.querySelectorAll('.door');
    const light = document.querySelector('.door-light');

    doors.forEach(door => door.classList.add('open'));
    if (light) {
      setTimeout(() => light.classList.add('visible'), 600);
    }
  }

  /**
   * Helper: Close doors
   */
  function closeDoors() {
    const doors = document.querySelectorAll('.door');
    const light = document.querySelector('.door-light');

    doors.forEach(door => door.classList.remove('open'));
    if (light) {
      light.classList.remove('visible');
    }
  }

  /**
   * Helper: Show Vastu markers
   */
  function showVastuMarkers(selector) {
    const markers = document.querySelectorAll(selector);
    markers.forEach(marker => marker.classList.add('visible'));
  }

  /**
   * Helper: Hide Vastu markers
   */
  function hideVastuMarkers(selector) {
    const markers = document.querySelectorAll(selector);
    markers.forEach(marker => marker.classList.remove('visible'));
  }

  /**
   * Parallax effect for layers (subtle depth)
   */
  function initParallax() {
    document.addEventListener('mousemove', (e) => {
      const mouseX = (e.clientX / window.innerWidth) - 0.5;
      const mouseY = (e.clientY / window.innerHeight) - 0.5;

      document.querySelectorAll('.layer').forEach(layer => {
        const depth = parseFloat(layer.dataset.depth) || 0;
        const moveX = mouseX * depth * 20;
        const moveY = mouseY * depth * 20;

        gsap.to(layer, {
          x: moveX,
          y: moveY,
          duration: 0.5,
          ease: 'power2.out'
        });
      });
    });
  }

  /**
   * Smooth scroll behavior
   */
  function initSmoothScroll() {
    // Already handled by GSAP ScrollTrigger
    // Optional: Add custom easing or snap points
  }

  /**
   * Performance optimizations
   */
  function initPerformance() {
    // Lazy load images
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

    // Reduce motion for accessibility
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      gsap.globalTimeline.timeScale(0.1);
    }
  }

  /**
   * Mobile optimizations
   */
  function initMobile() {
    if (window.innerWidth < 768) {
      // Simplify animations for mobile
      ScrollTrigger.config({
        limitCallbacks: true
      });

      // Disable parallax on mobile
      return;
    }

    initParallax();
  }

  /**
   * Initialize everything
   */
  initLoading();
  initMobile();
  initPerformance();

  // Refresh on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 250);
  });

})();
