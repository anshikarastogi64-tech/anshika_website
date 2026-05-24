(function() {
  'use strict';

  const CONFIG = {
    phone: '+919557058902',
    whatsapp: '919557058902',
    whatsappMessage: 'Hi Anshika! I\'d love to discuss my dream home project with you. ✨'
  };

  // Create floating contact button HTML
  const floatingHTML = `
    <div class="magical-floating-btn" id="magicalFloatingBtn">
      <div class="contact-options" id="contactOptions">
        <a href="tel:${CONFIG.phone}" class="contact-option" data-action="call">
          <span class="icon">📞</span>
          <span class="text">Call Now</span>
        </a>
        <a href="https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(CONFIG.whatsappMessage)}"
           target="_blank"
           class="contact-option"
           data-action="whatsapp">
          <span class="icon">💬</span>
          <span class="text">WhatsApp</span>
        </a>
        <button class="contact-option" data-action="form" id="floatingFormBtn">
          <span class="icon">✉️</span>
          <span class="text">Send Message</span>
        </button>
      </div>
      <button class="magic-main-btn" id="magicMainBtn" aria-label="Contact Us">
        ✨
      </button>
    </div>
  `;

  // Insert into page
  document.addEventListener('DOMContentLoaded', function() {
    document.body.insertAdjacentHTML('beforeend', floatingHTML);

    const mainBtn = document.getElementById('magicMainBtn');
    const contactOptions = document.getElementById('contactOptions');
    const floatingFormBtn = document.getElementById('floatingFormBtn');
    const floatingContainer = document.getElementById('magicalFloatingBtn');

    // Toggle contact options
    mainBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      const isActive = mainBtn.classList.contains('active');

      if (isActive) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Open form modal when "Send Message" is clicked
    floatingFormBtn.addEventListener('click', function(e) {
      e.preventDefault();
      closeMenu();

      // Trigger the dream form modal
      const dreamFormModal = document.getElementById('dreamFormModal');
      if (dreamFormModal) {
        dreamFormModal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
      if (!floatingContainer.contains(e.target)) {
        closeMenu();
      }
    });

    // Close menu on ESC key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeMenu();
      }
    });

    // Track interactions
    const allOptions = document.querySelectorAll('.contact-option');
    allOptions.forEach(option => {
      option.addEventListener('click', function() {
        const action = this.getAttribute('data-action');

        // Analytics tracking
        if (typeof gtag !== 'undefined') {
          gtag('event', 'floating_contact_click', {
            event_category: 'Contact',
            event_label: action,
            value: 1
          });
        }

        // Close menu after selection (except for form button which is handled separately)
        if (action !== 'form') {
          setTimeout(closeMenu, 300);
        }
      });
    });

    function openMenu() {
      mainBtn.classList.add('active');
      contactOptions.classList.add('active');
    }

    function closeMenu() {
      mainBtn.classList.remove('active');
      contactOptions.classList.remove('active');
    }

    // Add ripple effect on main button click
    mainBtn.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.5);
        left: ${x}px;
        top: ${y}px;
        transform: scale(0);
        animation: ripple-effect 0.6s ease-out;
        pointer-events: none;
      `;

      this.appendChild(ripple);

      setTimeout(() => ripple.remove(), 600);
    });

    // Add ripple animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes ripple-effect {
        to {
          transform: scale(2);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  });

})();
