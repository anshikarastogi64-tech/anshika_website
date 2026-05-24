/**
 * DREAMS - Emotional Storytelling Animations
 * "I Build Dreams Into Reality"
 */

(function() {
  'use strict';

  gsap.registerPlugin(ScrollTrigger);

  let brushCanvas, brushCtx;
  let brushTrail = [];

  /**
   * Initialize all animations
   */
  function init() {
    initPaintbrushCursor();
    initCreativeMenu();
    initOpeningScene();
    initScrollAnimations();
    initSketchToReality();
    initWatercolorSplashes();
    initPolaroidTilts();
    initMagicTriangle();
    initTriangleCenter();
    initTimelineBubbles();
    initMagicalScrollEffects();
    initParallaxMagic();
    initScrollSparkles();
  }

  /**
   * CREATIVE MENU - Paint palette navigation
   */
  function initCreativeMenu() {
    const menuTrigger = document.getElementById('dream-menu-trigger');
    const menuOverlay = document.getElementById('dream-menu-overlay');
    const menuClose = document.getElementById('menu-close');
    const navLinks = document.querySelectorAll('.nav-link');

    if (!menuTrigger || !menuOverlay || !menuClose) {
      console.error('Menu elements not found');
      return;
    }

    // Open menu
    menuTrigger.addEventListener('click', () => {
      menuOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';

      // Animate paint strokes
      gsap.from('.paint-stroke', {
        scale: 0,
        opacity: 0,
        duration: 1,
        stagger: 0.2,
        ease: 'elastic.out(1, 0.5)'
      });
    });

    // Close menu
    const closeMenu = () => {
      menuOverlay.classList.remove('active');
      document.body.style.overflow = '';
    };

    menuClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    });

    // Close on overlay click (outside menu content)
    menuOverlay.addEventListener('click', (e) => {
      if (e.target === menuOverlay) {
        closeMenu();
      }
    });

    // Hover effects on nav links
    navLinks.forEach(link => {
      link.addEventListener('mouseenter', () => {
        const icon = link.querySelector('.link-icon');
        if (icon) {
          gsap.to(icon, {
            rotation: 360,
            duration: 0.6,
            ease: 'back.out(1.7)'
          });
        }
      });
    });
  }

  /**
   * PAINTBRUSH CURSOR - Creative trail effect with magic sparkles
   */
  function initPaintbrushCursor() {
    if (window.innerWidth < 768) return;

    const cursor = document.getElementById('brush-cursor');
    brushCanvas = document.getElementById('brush-canvas');
    brushCtx = brushCanvas.getContext('2d');

    brushCanvas.width = window.innerWidth;
    brushCanvas.height = window.innerHeight;

    let mouseX = 0, mouseY = 0;
    let sparkleCounter = 0;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      gsap.to(cursor, {
        x: mouseX,
        y: mouseY,
        duration: 0.2,
        ease: 'power2.out'
      });

      // Add to brush trail with sparkle effect
      brushTrail.push({
        x: mouseX,
        y: mouseY,
        opacity: 1,
        size: Math.random() * 4 + 2,
        color: Math.random() > 0.9 ? '#FFD700' : '#D4AF37' // Occasional gold sparkle
      });

      if (brushTrail.length > 60) {
        brushTrail.shift();
      }

      // Create occasional star trail
      sparkleCounter++;
      if (sparkleCounter > 20) {
        createStarTrail(mouseX, mouseY);
        sparkleCounter = 0;
      }
    });

    // Animate brush trail
    function animateBrushTrail() {
      brushCtx.clearRect(0, 0, brushCanvas.width, brushCanvas.height);

      brushTrail.forEach((point, index) => {
        point.opacity -= 0.015;

        if (point.opacity > 0) {
          brushCtx.globalAlpha = point.opacity;
          brushCtx.fillStyle = point.color;
          brushCtx.beginPath();
          brushCtx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
          brushCtx.fill();

          // Add glow effect
          brushCtx.shadowBlur = 15;
          brushCtx.shadowColor = point.color;
        }
      });

      brushTrail = brushTrail.filter(p => p.opacity > 0);
      requestAnimationFrame(animateBrushTrail);
    }

    animateBrushTrail();

    window.addEventListener('resize', () => {
      brushCanvas.width = window.innerWidth;
      brushCanvas.height = window.innerHeight;
    });
  }

  /**
   * CREATE STAR TRAIL - Cursor sparkle effect
   */
  function createStarTrail(x, y) {
    const star = document.createElement('div');
    star.className = 'star-trail';
    star.style.left = x + 'px';
    star.style.top = y + 'px';
    document.body.appendChild(star);

    setTimeout(() => star.remove(), 2000);
  }

  /**
   * OPENING SCENE - Title reveal
   */
  function initOpeningScene() {
    const tl = gsap.timeline({ delay: 0.5 });

    tl.to('.sketch-line', {
      opacity: 1,
      y: 0,
      duration: 1,
      stagger: 0.3,
      ease: 'power3.out'
    })
    .to('.subtitle-handwritten', {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power2.out'
    }, '-=0.3')
    .to('.scroll-dream', {
      opacity: 1,
      duration: 0.8
    }, '-=0.3');

    // Float clouds
    gsap.to('.dream-cloud', {
      y: '-=30',
      x: '+=20',
      duration: 4,
      repeat: -1,
      yoyo: true,
      ease: 'power1.inOut',
      stagger: {
        each: 1.5,
        from: 'random'
      }
    });

    // Floating sketch elements
    gsap.utils.toArray('.sketch-float').forEach(element => {
      gsap.to(element, {
        y: -30,
        rotation: 360,
        duration: 15,
        repeat: -1,
        ease: 'linear'
      });
    });
  }

  /**
   * SKETCH TO REALITY - SVG path animation
   */
  function initSketchToReality() {
    const drawPaths = document.querySelectorAll('.draw-path');

    ScrollTrigger.create({
      trigger: '#dream-begins',
      start: 'top center',
      onEnter: () => {
        // Animate sketch paths
        gsap.to(drawPaths, {
          strokeDashoffset: 0,
          duration: 3,
          stagger: 0.2,
          ease: 'power2.inOut',
          onComplete: () => {
            // Fade out sketch, reveal reality
            gsap.to('.sketch-layer', {
              opacity: 0,
              duration: 1.5,
              ease: 'power2.inOut'
            });
          }
        });
      }
    });

    // Section title appear
    gsap.from('.appear-text', {
      opacity: 0,
      y: 30,
      duration: 1,
      scrollTrigger: {
        trigger: '.appear-text',
        start: 'top 80%'
      }
    });
  }

  /**
   * WATERCOLOR SPLASHES - Organic reveal
   */
  function initWatercolorSplashes() {
    const splashes = document.querySelectorAll('.watercolor-splash');

    gsap.from(splashes, {
      scale: 0,
      opacity: 0,
      duration: 1.5,
      stagger: 0.3,
      ease: 'elastic.out(1, 0.5)',
      scrollTrigger: {
        trigger: '#meet-designer',
        start: 'top center'
      }
    });

    // Polaroid frame entrance
    gsap.from('.polaroid-frame', {
      scale: 0.8,
      rotation: -10,
      opacity: 0,
      duration: 1,
      ease: 'back.out(1.7)',
      scrollTrigger: {
        trigger: '.polaroid-frame',
        start: 'top 70%'
      }
    });

    // Doodles pop in
    gsap.from('.doodle', {
      scale: 0,
      rotation: -180,
      opacity: 0,
      duration: 0.8,
      stagger: 0.2,
      ease: 'back.out(2)',
      scrollTrigger: {
        trigger: '.doodle',
        start: 'top 80%'
      }
    });

    // Designer story text fade in
    gsap.from('.designer-story > *', {
      opacity: 0,
      y: 30,
      duration: 0.8,
      stagger: 0.2,
      scrollTrigger: {
        trigger: '.designer-story',
        start: 'top 70%'
      }
    });

    // Credentials slide in (disabled on mobile to prevent visibility issues)
    if (window.innerWidth > 768) {
      gsap.from('.credentials-row', {
        opacity: 0,
        y: 50,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.credentials-row',
          start: 'top 75%'
        }
      });

      gsap.from('.credential-item', {
        opacity: 0,
        x: -30,
        duration: 0.8,
        stagger: 0.2,
        scrollTrigger: {
          trigger: '.credentials-row',
          start: 'top 75%'
        }
      });
    }

    // Magic badges bounce in (DISABLED to prevent visibility issues)
    // gsap.from('.magic-badge', {
    //   scale: 0,
    //   opacity: 0,
    //   duration: 0.6,
    //   stagger: 0.15,
    //   ease: 'back.out(2)',
    //   scrollTrigger: {
    //     trigger: '.magic-badges',
    //     start: 'top 80%'
    //   }
    // });

    // Expertise tags pop in (DISABLED - causes sizing issues)
    // gsap.from('.tag', {
    //   scale: 0,
    //   opacity: 0,
    //   duration: 0.5,
    //   stagger: 0.1,
    //   ease: 'back.out(2)',
    //   scrollTrigger: {
    //     trigger: '.expertise-tags',
    //     start: 'top 85%'
    //   }
    // });
  }

  /**
   * POLAROID TILTS - Gallery interactions
   */
  function initPolaroidTilts() {
    const polaroids = document.querySelectorAll('.polaroid-item');

    polaroids.forEach((polaroid, index) => {
      // Entrance animation
      gsap.from(polaroid, {
        opacity: 0,
        y: 100,
        rotation: index % 2 === 0 ? -20 : 20,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: polaroid,
          start: 'top 85%'
        }
      });

      // Mouse parallax tilt
      polaroid.addEventListener('mousemove', (e) => {
        const rect = polaroid.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;

        gsap.to(polaroid.querySelector('.polaroid-inner'), {
          rotateX: rotateX,
          rotateY: rotateY,
          duration: 0.5,
          ease: 'power2.out',
          transformPerspective: 1000
        });
      });

      polaroid.addEventListener('mouseleave', () => {
        const inner = polaroid.querySelector('.polaroid-inner');
        const originalRotation = index % 2 === 0 ? -3 : 3;

        gsap.to(inner, {
          rotateX: 0,
          rotateY: 0,
          rotation: originalRotation,
          duration: 0.6,
          ease: 'elastic.out(1, 0.5)'
        });
      });
    });
  }

  /**
   * MAGIC TRIANGLE - Power visualization
   */
  function initMagicTriangle() {
    ScrollTrigger.create({
      trigger: '#magic-triangle',
      start: 'top center',
      onEnter: () => {
        // Triangle already animates via CSS
        // Power points are visible by default now
      }
    });

    // Mobile: Click to open modal with backdrop
    if (window.innerWidth <= 768) {
      const powerPoints = document.querySelectorAll('.power-point');
      const triangleContainer = document.querySelector('.triangle-container');

      console.log('[MOBILE TRIANGLE] Initializing mobile modals. Found power points:', powerPoints.length);

      // Create backdrop element
      let backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop-mobile';
      document.body.appendChild(backdrop);

      console.log('[MOBILE TRIANGLE] Backdrop created and appended to body');

      // Function to close all modals
      function closeAllModals() {
        console.log('[MOBILE TRIANGLE] Closing all modals');
        powerPoints.forEach(p => {
          p.classList.remove('expanded');
          // Remove close button if exists
          const closeBtn = p.querySelector('.power-modal-close');
          if (closeBtn) closeBtn.remove();
        });
        backdrop.classList.remove('active');
        document.body.style.overflow = '';
      }

      // Power point tap to open modal
      powerPoints.forEach((point, index) => {
        const compactCard = point.querySelector('.power-compact');
        const details = point.querySelector('.power-details');

        console.log(`[MOBILE TRIANGLE] Setting up power point ${index}:`, {
          hasCompact: !!compactCard,
          hasDetails: !!details
        });

        if (compactCard && details) {
          compactCard.addEventListener('click', function(e) {
            e.stopPropagation();
            console.log(`[MOBILE TRIANGLE] Clicked power point ${index}`);

            // Check if already expanded
            const isExpanded = point.classList.contains('expanded');
            console.log('[MOBILE TRIANGLE] Is expanded:', isExpanded);

            // Close all first
            closeAllModals();

            // If wasn't expanded, open this one
            if (!isExpanded) {
              console.log('[MOBILE TRIANGLE] Opening modal...');
              point.classList.add('expanded');
              backdrop.classList.add('active');
              document.body.style.overflow = 'hidden';

              // FORCE INLINE STYLES - BYPASS CSS COMPLETELY
              details.style.cssText = `
                display: block !important;
                position: fixed !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) scale(1) !important;
                opacity: 1 !important;
                visibility: visible !important;
                pointer-events: auto !important;
                z-index: 10000 !important;
                background: linear-gradient(180deg, #1a1a2e 0%, #0f3460 100%) !important;
                width: calc(100vw - 30px) !important;
                max-width: 400px !important;
                max-height: 80vh !important;
                border-radius: 20px !important;
                border: 2px solid rgba(212, 175, 55, 0.6) !important;
                overflow: visible !important;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 1) !important;
                transition: none !important;
              `;

              // FORCE ALL CHILD ELEMENTS TO BE VISIBLE
              const header = details.querySelector('.detail-header');
              if (header) {
                header.style.cssText = `
                  display: flex !important;
                  visibility: visible !important;
                  opacity: 1 !important;
                  padding: 20px !important;
                  background: rgba(255, 215, 0, 0.15) !important;
                  border-bottom: 2px solid rgba(212, 175, 55, 0.4) !important;
                  border-radius: 20px 20px 0 0 !important;
                  z-index: 1 !important;
                `;

                const h4 = header.querySelector('h4');
                if (h4) {
                  h4.style.cssText = `
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    color: #FFD700 !important;
                    font-size: 20px !important;
                    font-weight: 700 !important;
                    margin: 0 !important;
                  `;
                }
              }

              const content = details.querySelector('.detail-content');
              if (content) {
                content.style.cssText = `
                  display: block !important;
                  visibility: visible !important;
                  opacity: 1 !important;
                  padding: 20px !important;
                  max-height: calc(80vh - 140px) !important;
                  overflow-y: auto !important;
                  background: transparent !important;
                  z-index: 1 !important;
                `;

                // Force all rows and their children to be visible
                const rows = content.querySelectorAll('.detail-row');
                rows.forEach(row => {
                  row.style.cssText = `
                    display: flex !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    gap: 12px !important;
                    margin-bottom: 16px !important;
                    background: rgba(255, 255, 255, 0.08) !important;
                    padding: 14px !important;
                    border-radius: 12px !important;
                    border: 1px solid rgba(212, 175, 55, 0.2) !important;
                  `;

                  // Force icons, strong, and p elements visible
                  const icon = row.querySelector('.detail-icon');
                  if (icon) {
                    icon.style.cssText = `
                      display: block !important;
                      visibility: visible !important;
                      opacity: 1 !important;
                      font-size: 26px !important;
                    `;
                  }

                  const strong = row.querySelector('strong');
                  if (strong) {
                    strong.style.cssText = `
                      display: block !important;
                      visibility: visible !important;
                      opacity: 1 !important;
                      color: #FFD700 !important;
                      font-size: 15px !important;
                      font-weight: 700 !important;
                    `;
                  }

                  const p = row.querySelector('p');
                  if (p) {
                    p.style.cssText = `
                      display: block !important;
                      visibility: visible !important;
                      opacity: 1 !important;
                      color: #FFFFFF !important;
                      font-size: 13px !important;
                      line-height: 1.6 !important;
                    `;
                  }
                });
              }

              console.log('[MOBILE TRIANGLE] Forced inline styles on modal container + all children');

              // Log computed styles
              setTimeout(() => {
                const computedStyles = window.getComputedStyle(details);
                console.log('[MOBILE TRIANGLE] Modal computed styles AFTER FORCE:', {
                  display: computedStyles.display,
                  visibility: computedStyles.visibility,
                  opacity: computedStyles.opacity,
                  background: computedStyles.background
                });
              }, 100);

              // Create close button with inline styles
              const closeBtn = document.createElement('button');
              closeBtn.className = 'power-modal-close';
              closeBtn.innerHTML = '×';
              closeBtn.setAttribute('aria-label', 'Close modal');
              closeBtn.style.cssText = `
                position: absolute !important;
                top: 20px !important;
                right: 20px !important;
                width: 44px !important;
                height: 44px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%) !important;
                border: none !important;
                border-radius: 50% !important;
                color: #000 !important;
                font-size: 32px !important;
                font-weight: 700 !important;
                line-height: 1 !important;
                z-index: 10001 !important;
                box-shadow: 0 4px 16px rgba(255, 215, 0, 0.6) !important;
                cursor: pointer !important;
              `;
              details.appendChild(closeBtn);

              console.log('[MOBILE TRIANGLE] Close button created and styled');

              // Close button click
              closeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                console.log('[MOBILE TRIANGLE] Close button clicked');
                closeAllModals();
              });
            }
          });
        }
      });

      // Backdrop click to close
      backdrop.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log('[MOBILE TRIANGLE] Backdrop clicked');
        closeAllModals();
      });

      // Prevent modal content clicks from closing
      powerPoints.forEach(point => {
        const details = point.querySelector('.power-details');
        if (details) {
          details.addEventListener('click', function(e) {
            e.stopPropagation();
          });
        }
      });
    }
  }

  /**
   * TRIANGLE CENTER - Hover handled by CSS
   */
  function initTriangleCenter() {
    // Globe is always visible with CSS animations
    // Hover effect shows label automatically via CSS
  }

  /**
   * TIMELINE BUBBLES - Process steps
   */
  function initTimelineBubbles() {
    const steps = document.querySelectorAll('.timeline-step');

    steps.forEach((step, index) => {
      gsap.to(step, {
        opacity: 1,
        x: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: step,
          start: 'top 80%',
          toggleActions: 'play none none none'
        }
      });

      // Bubble pop effect on scroll
      ScrollTrigger.create({
        trigger: step,
        start: 'top 70%',
        onEnter: () => {
          const bubble = step.querySelector('.step-bubble');
          gsap.fromTo(bubble,
            { scale: 0 },
            {
              scale: 1,
              duration: 0.6,
              ease: 'elastic.out(1, 0.5)'
            }
          );
        }
      });
    });
  }

  /**
   * SCROLL ANIMATIONS - General reveals
   */
  function initScrollAnimations() {
    // Section titles
    gsap.utils.toArray('.section-title-center').forEach(title => {
      gsap.from(title, {
        opacity: 0,
        y: 50,
        duration: 1,
        scrollTrigger: {
          trigger: title,
          start: 'top 80%'
        }
      });
    });

    // Feature cards
    gsap.from('.feature-card', {
      opacity: 0,
      y: 80,
      duration: 0.8,
      stagger: 0.2,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '.secret-features',
        start: 'top 70%'
      }
    });

    // Secret badge
    gsap.from('.secret-badge', {
      scale: 0,
      rotation: -10,
      duration: 0.8,
      ease: 'back.out(2)',
      scrollTrigger: {
        trigger: '.secret-badge',
        start: 'top 80%'
      }
    });

    // Secret title
    gsap.from('.secret-title', {
      opacity: 0,
      y: 30,
      duration: 1,
      scrollTrigger: {
        trigger: '.secret-title',
        start: 'top 75%'
      }
    });

    // Final CTA
    gsap.from('.final-title', {
      opacity: 0,
      scale: 0.9,
      duration: 1.2,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '.final-title',
        start: 'top 70%'
      }
    });

    gsap.from('.final-text', {
      opacity: 0,
      y: 30,
      duration: 0.8,
      delay: 0.3,
      scrollTrigger: {
        trigger: '.final-text',
        start: 'top 75%'
      }
    });

    gsap.from('.btn-dream-primary, .btn-dream-secondary', {
      opacity: 0,
      y: 30,
      duration: 0.8,
      stagger: 0.2,
      delay: 0.5,
      scrollTrigger: {
        trigger: '.final-buttons',
        start: 'top 80%'
      }
    });

    gsap.from('.social-bubble', {
      scale: 0,
      opacity: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: 'back.out(2)',
      delay: 0.8,
      scrollTrigger: {
        trigger: '.final-social',
        start: 'top 85%'
      }
    });

    gsap.from('.signature', {
      opacity: 0,
      y: 20,
      duration: 0.8,
      delay: 1.2,
      scrollTrigger: {
        trigger: '.signature',
        start: 'top 90%'
      }
    });
  }

  /**
   * Initialize on load
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Refresh ScrollTrigger on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 250);
  });

  /**
   * SERVICES FILTERING - What I Create section
   */
  document.querySelectorAll('.cat-btn-dream').forEach(btn => {
    btn.addEventListener('click', function() {
      // Update active button
      document.querySelectorAll('.cat-btn-dream').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'rgba(255,255,255,0.1)';
        b.style.borderColor = 'rgba(212, 175, 55, 0.3)';
        b.style.color = 'rgba(255,255,255,0.8)';
      });

      this.classList.add('active');
      this.style.background = 'rgba(212, 175, 55, 0.2)';
      this.style.borderColor = '#D4AF37';
      this.style.color = '#D4AF37';

      // Filter cards
      const category = this.dataset.category;
      document.querySelectorAll('.service-dream-card').forEach(card => {
        card.style.display = 'block';
        card.style.opacity = '1';

        if (category === 'all' || card.dataset.category === category) {
          gsap.to(card, {
            opacity: 1,
            scale: 1,
            duration: 0.3
          });
        } else {
          gsap.to(card, {
            opacity: 0,
            scale: 0.9,
            duration: 0.3,
            onComplete: () => {
              card.style.display = 'none';
            }
          });
        }
      });
    });
  });

  /**
   * SERVICE CARD HOVER EFFECTS
   */
  document.querySelectorAll('.service-dream-card').forEach(card => {
    const overlay = card.querySelector('.service-dream-overlay');

    card.addEventListener('mouseenter', () => {
      gsap.to(overlay, {
        opacity: 1,
        duration: 0.3
      });
      gsap.to(card, {
        y: -10,
        boxShadow: '0 20px 40px rgba(212, 175, 55, 0.3)',
        duration: 0.3
      });
    });

    card.addEventListener('mouseleave', () => {
      gsap.to(overlay, {
        opacity: 0,
        duration: 0.3
      });
      gsap.to(card, {
        y: 0,
        boxShadow: 'none',
        duration: 0.3
      });
    });
  });

  /**
   * MAGICAL SCROLL EFFECTS - Sections reveal with magic
   */
  function initMagicalScrollEffects() {
    const sections = document.querySelectorAll('.story-section');

    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.classList.contains('magic-revealed')) {
          entry.target.classList.add('magic-revealed');

          // Add subtle magical entrance effect (only for specific visual elements)
          const animatableElements = entry.target.querySelectorAll('.polaroid-item, .power-point, .designer-image-container');

          if (animatableElements.length > 0) {
            gsap.from(animatableElements, {
              opacity: 0,
              y: 30,
              duration: 0.6,
              stagger: 0.08,
              ease: 'power2.out'
            });
          }

          // Create sparkle burst on reveal (but not for service section)
          if (!entry.target.id.includes('what-i-create')) {
            createSparkleBurst(entry.target);
          }
        }
      });
    }, observerOptions);

    sections.forEach(section => {
      sectionObserver.observe(section);
    });
  }

  /**
   * PARALLAX MAGIC - Elements float as you scroll
   */
  function initParallaxMagic() {
    window.addEventListener('scroll', () => {
      const scrolled = window.pageYOffset;

      // Floating elements parallax
      document.querySelectorAll('.floating-symbol, .dream-cloud, .sketch-float').forEach((element, index) => {
        const speed = (index + 1) * 0.05;
        const yPos = -(scrolled * speed);
        gsap.to(element, {
          y: yPos,
          rotation: scrolled * 0.02,
          duration: 0.5,
          ease: 'power1.out'
        });
      });

      // Service cards parallax
      document.querySelectorAll('.service-dream-card').forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;

        if (isVisible) {
          const progress = (window.innerHeight - rect.top) / window.innerHeight;
          gsap.to(card, {
            y: -progress * 20,
            duration: 0.5,
            ease: 'power1.out'
          });
        }
      });
    });
  }

  /**
   * SCROLL SPARKLES - Create magic particles on scroll
   */
  function initScrollSparkles() {
    let lastScroll = 0;
    let sparkleTimeout;

    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;

      // Only create sparkles when scrolling
      if (Math.abs(currentScroll - lastScroll) > 50) {
        clearTimeout(sparkleTimeout);
        sparkleTimeout = setTimeout(() => {
          createRandomSparkle();
        }, 100);
      }

      lastScroll = currentScroll;
    });
  }

  /**
   * CREATE SPARKLE BURST - Burst of sparkles on element reveal
   */
  function createSparkleBurst(element) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const sparkleEmojis = ['✨', '⭐', '💫', '🌟', '✦'];

    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const sparkle = document.createElement('div');
        sparkle.className = 'magic-sparkle';
        sparkle.textContent = sparkleEmojis[Math.floor(Math.random() * sparkleEmojis.length)];
        sparkle.style.left = centerX + (Math.random() - 0.5) * 200 + 'px';
        sparkle.style.top = centerY + (Math.random() - 0.5) * 200 + 'px';
        document.body.appendChild(sparkle);

        setTimeout(() => sparkle.remove(), 2000);
      }, i * 100);
    }
  }

  /**
   * CREATE RANDOM SPARKLE - Single sparkle on scroll
   */
  function createRandomSparkle() {
    const sparkle = document.createElement('div');
    sparkle.className = 'magic-sparkle';
    sparkle.textContent = ['✨', '⭐', '💫'][Math.floor(Math.random() * 3)];
    sparkle.style.left = Math.random() * window.innerWidth + 'px';
    sparkle.style.top = window.innerHeight * 0.5 + Math.random() * 200 + 'px';
    document.body.appendChild(sparkle);

    setTimeout(() => sparkle.remove(), 2000);
  }

})();
