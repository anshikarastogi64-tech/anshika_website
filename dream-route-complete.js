
// Dream Contact Form Route
app.post('/Kelly/forms/dream-contact', express.json(), async (req, res) => {
  try {
    const { name, mobile, email, projectType, message } = req.body;

    if (!name || !mobile || !email || !projectType) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const { getTransporter } = require('./lib/portal-email');
    const transporter = getTransporter();

    if (!transporter) {
      return res.status(500).json({ success: false, message: 'Email not configured' });
    }

    // Admin email HTML
    const adminHtml = `
      <h1 style="color: #FFD700;">✨ New Dream Lead!</h1>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Mobile:</strong> ${mobile}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Project:</strong> ${projectType}</p>
      <p><strong>Message:</strong> ${message || 'No message'}</p>
    `;

    // Customer welcome email HTML
    const customerHtml = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Georgia', serif; line-height: 1.8; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; }
        .header { background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); padding: 50px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 32px; color: #000; font-weight: 700; }
        .header p { margin: 10px 0 0 0; font-size: 16px; color: rgba(0,0,0,0.7); }
        .content { padding: 40px 30px; }
        .greeting { font-size: 20px; color: #000; margin-bottom: 20px; font-weight: 600; }
        .message { font-size: 16px; color: #555; margin-bottom: 20px; line-height: 1.8; }
        .section { margin: 30px 0; padding: 25px; background: #f9f9f9; border-left: 4px solid #FFD700; border-radius: 5px; }
        .section-title { font-size: 18px; color: #000; font-weight: 600; margin-bottom: 15px; }
        .section ul { margin: 10px 0; padding-left: 20px; }
        .section li { margin: 8px 0; color: #555; }
        .highlight { background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); padding: 25px; border-radius: 10px; margin: 30px 0; text-align: center; }
        .highlight p { margin: 10px 0; color: #000; font-size: 16px; font-weight: 600; }
        .cta { text-align: center; margin: 30px 0; }
        .cta a { background: #FFD700; color: #000; padding: 15px 40px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block; font-size: 16px; }
        .footer { background: #1a1a2e; padding: 30px; text-align: center; color: #fff; }
        .footer p { margin: 5px 0; font-size: 14px; }
        .signature { font-family: 'Brush Script MT', cursive; font-size: 28px; color: #FFD700; margin: 20px 0; }
    </style>
</head>
<body>
    <div class='container'>
        <div class='header'>
            <h1>✨ Welcome to Your Dream Journey! ✨</h1>
            <p>Where luxury meets cosmic wisdom</p>
        </div>

        <div class='content'>
            <p class='greeting'>Dear ${name},</p>

            <p class='message'>
                Thank you for trusting me with your vision! I'm absolutely thrilled that you've chosen to embark on this
                magical journey of creating your dream ${projectType}.
            </p>

            <p class='message'>
                I don't just design spaces – I craft experiences that transform lives. Your home will be more than beautiful;
                it will be a sanctuary that nurtures your family's growth, prosperity, and joy for generations to come.
            </p>

            <div class='section'>
                <div class='section-title'>🎨 What Happens Next?</div>
                <ul>
                    <li><strong>Within 24 hours:</strong> I'll personally review your vision and reach out to you</li>
                    <li><strong>Discovery Call:</strong> We'll discuss your dreams, timeline, budget, and lifestyle</li>
                    <li><strong>Site Visit:</strong> I'll visit your space and feel its energy</li>
                    <li><strong>Custom Proposal:</strong> You'll receive a personalized design concept with Vastu & Astro alignment</li>
                </ul>
            </div>

            <div class='section'>
                <div class='section-title'>💫 Why You Made the Right Choice</div>
                <ul>
                    <li><strong>300+ Dream Homes Created:</strong> Each one unique, each one magical</li>
                    <li><strong>Luxury Design:</strong> Sophisticated aesthetics that reflect your personality</li>
                    <li><strong>Vastu Compliance:</strong> 100% alignment with ancient wisdom for positive energy</li>
                    <li><strong>Astro Integration:</strong> Cosmic timing for every major decision</li>
                    <li><strong>Personal Touch:</strong> I'm involved in every detail, from concept to completion</li>
                </ul>
            </div>

            <div class='highlight'>
                <p>📱 Have questions? I'm just a WhatsApp away!</p>
                <p style='font-size: 20px; margin-top: 15px;'>+91 9557058902</p>
            </div>

            <p class='message'>
                In the meantime, feel free to explore my portfolio and see the magic I've created for others.
                Each project is a love story between design and the families who live in these spaces.
            </p>

            <div class='cta'>
                <a href='https://wa.me/919557058902?text=Hi%20Anshika%2C%20I%20just%20received%20your%20email!' target='_blank'>
                    💬 Let's Chat on WhatsApp
                </a>
            </div>

            <p class='message' style='margin-top: 40px;'>
                <strong>"My Promise to You:"</strong><br>
                I will listen to your dreams with my heart, design them with my expertise, align them with cosmic wisdom,
                and deliver them with unwavering commitment to excellence.
            </p>

            <p style='text-align: center; margin-top: 40px; color: #888; font-style: italic;'>
                With love & creativity,
            </p>
            <p class='signature' style='text-align: center;'>
                Anshika Rastogi
            </p>
            <p style='text-align: center; color: #888; font-size: 14px;'>
                Master Interior Designer | Vastu Expert | Astro Consultant
            </p>
        </div>

        <div class='footer'>
            <p>✨ Designer's Vision Studio ✨</p>
            <p>Creating Spaces That Transform Lives</p>
            <p style='margin-top: 15px; font-size: 12px;'>
                📧 designersvisionstudio@gmail.com | 📱 +91 9557058902
            </p>
        </div>
    </div>
</body>
</html>
    `;

    // Send emails
    console.log('Sending dream form emails...');
    await Promise.all([
      transporter.sendMail({
        from: process.env.EMAIL_FROM || 'designersvisionstudio@gmail.com',
        to: 'designersvisionstudio@gmail.com',
        subject: `🎨 New Dream Lead: ${projectType}`,
        html: adminHtml
      }),
      transporter.sendMail({
        from: process.env.EMAIL_FROM || 'designersvisionstudio@gmail.com',
        to: email,
        subject: `✨ Welcome to Your Dream Journey, ${name}!`,
        html: customerHtml
      })
    ]);

    console.log('Dream form emails sent successfully');
    res.json({ success: true, message: 'Emails sent!' });
  } catch (error) {
    console.error('Dream contact error:', error);
    res.status(500).json({ success: false, message: 'Failed to send email' });
  }
});
