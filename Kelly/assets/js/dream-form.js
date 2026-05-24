(function() {
  'use strict';

  // Smooth scroll for CTA
  const scrollCTA = document.querySelector('.scroll-cta-container');
  if (scrollCTA) {
    scrollCTA.addEventListener('click', function() {
      const nextSection = document.querySelector('#dream-begins');
      if (nextSection) {
        nextSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // Configuration
  const CONFIG = {
    adminEmail: 'anshika.rastogi@example.com', // Replace with actual admin email
    adminMobile: '919557058902', // Admin WhatsApp number (with country code, no +)
    adminWhatsApp: '919557058902',
    emailEndpoint: 'forms/dream-contact.php' // Your existing PHP email handler
  };

  // Elements
  const modal = document.getElementById('dreamFormModal');
  const ctaButtons = document.querySelectorAll('.magical-cta-btn');
  const closeBtn = document.getElementById('formCloseBtn');
  const successCloseBtn = document.getElementById('successCloseBtn');
  const form = document.getElementById('dreamContactForm');
  const formContent = document.getElementById('formContent');
  const formSuccess = document.getElementById('formSuccess');
  const submitBtn = form.querySelector('.form-submit-btn');

  // Open modal
  ctaButtons.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      openModal();
    });
  });

  // Close modal
  closeBtn.addEventListener('click', closeModal);
  successCloseBtn.addEventListener('click', closeModal);

  // Close on backdrop click
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Close on ESC key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  function openModal() {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';

    // Reset form after animation
    setTimeout(() => {
      form.reset();
      formContent.style.display = 'block';
      formSuccess.classList.remove('active');
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }, 400);
  }

  // Handle form submission
  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    // Get form data
    const formData = new FormData(form);
    const data = {
      name: formData.get('name'),
      mobile: formData.get('mobile'),
      email: formData.get('email'),
      projectType: formData.get('projectType'),
      message: formData.get('message') || 'No specific message provided'
    };

    // Validate
    if (!data.name || !data.mobile || !data.email || !data.projectType) {
      alert('Please fill all required fields');
      return;
    }

    // Show loading
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      // Try to send to admin via email (will fail on localhost without PHP)
      try {
        await sendToAdmin(data);
      } catch (emailError) {
        console.warn('Email sending failed (expected on localhost):', emailError);
        // Continue anyway - WhatsApp will still work
      }

      // Send WhatsApp message to customer
      sendWhatsAppToCustomer(data);

      // Send notification to admin WhatsApp
      sendWhatsAppToAdmin(data);

      // Show success
      formContent.style.display = 'none';
      formSuccess.classList.add('active');

      // Track conversion (Google Analytics, Facebook Pixel, etc.)
      trackConversion(data);

    } catch (error) {
      console.error('Form submission error:', error);
      alert('Oops! Something went wrong. Please try again or contact us directly via WhatsApp.');
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });

  // Send to admin email using your existing PHP backend
  async function sendToAdmin(data) {
    const response = await fetch(CONFIG.emailEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: data.name,
        mobile: data.mobile,
        email: data.email,
        projectType: data.projectType,
        message: data.message,
        submittedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to send email');
    }

    return result;
  }

  // Send WhatsApp message to customer
  function sendWhatsAppToCustomer(data) {
    const customerMessage =
      `✨ Welcome ${data.name}! ✨\n\n` +
      `Thank you for choosing to build your dream with me! 🏡\n\n` +
      `I'm Anshika Rastogi, and I'm absolutely thrilled to bring your vision to life. ` +
      `Your ${data.projectType} project sounds amazing, and I can't wait to create something extraordinary together!\n\n` +
      `🎨 What happens next?\n` +
      `• I'll review your vision personally\n` +
      `• You'll receive a call within 24 hours\n` +
      `• We'll discuss your dreams, timeline & budget\n` +
      `• I'll create a custom design proposal\n\n` +
      `💫 Why you made the right choice:\n` +
      `✓ 300+ dream homes created\n` +
      `✓ Luxury design + Vastu + Astro alignment\n` +
      `✓ Personalized attention to every detail\n` +
      `✓ Your space will tell YOUR story\n\n` +
      `Feel free to reply with any questions or share photos of your space!\n\n` +
      `With love & creativity,\n` +
      `Anshika ✨\n` +
      `Master Interior Designer\n` +
      `📞 +91 9557058902`;

    // Open WhatsApp with message
    const whatsappURL = `https://wa.me/${data.mobile.replace(/^0+/, '91')}?text=${encodeURIComponent(customerMessage)}`;

    // Open in new tab after a short delay to avoid popup blockers
    setTimeout(() => {
      window.open(whatsappURL, '_blank');
    }, 1000);
  }

  // Send notification to admin WhatsApp
  function sendWhatsAppToAdmin(data) {
    const adminMessage =
      `🎨 *NEW DREAM LEAD!*\n\n` +
      `👤 *Name:* ${data.name}\n` +
      `📱 *Mobile:* ${data.mobile}\n` +
      `📧 *Email:* ${data.email}\n` +
      `🏠 *Project:* ${data.projectType}\n` +
      `💭 *Message:* ${data.message}\n\n` +
      `⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n` +
      `🔥 Follow up within 24 hours!`;

    const whatsappURL = `https://wa.me/${CONFIG.adminWhatsApp}?text=${encodeURIComponent(adminMessage)}`;

    // Log the URL (you can also auto-open it, but might be blocked by popup blockers)
    console.log('Admin notification URL:', whatsappURL);

    // Optionally open admin notification in background after customer message
    setTimeout(() => {
      window.open(whatsappURL, '_blank');
    }, 2000);
  }

  // Track conversion
  function trackConversion(data) {
    // Google Analytics 4
    if (typeof gtag !== 'undefined') {
      gtag('event', 'generate_lead', {
        event_category: 'Lead',
        event_label: data.projectType,
        value: data.name
      });
    }

    // Facebook Pixel
    if (typeof fbq !== 'undefined') {
      fbq('track', 'Lead', {
        content_name: data.projectType,
        content_category: 'Interior Design'
      });
    }

    // Console log for debugging
    console.log('Form submitted successfully:', data);
  }

})();
