// Dream Contact Form Route for Node.js/Express
// Add this to your server.js file

const nodemailer = require('nodemailer');

// Email configuration
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: 'designersvisionstudio@gmail.com',
    pass: process.env.EMAIL_PASSWORD // Store in .env file
  }
});

// POST route for dream contact form
app.post('/Kelly/forms/dream-contact', express.json(), async (req, res) => {
  try {
    const { name, mobile, email, projectType, message } = req.body;

    // Validate required fields
    if (!name || !mobile || !email || !projectType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Admin email HTML
    const adminEmailHtml = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
        .header { background: linear-gradient(135deg, #FFD700, #FFA500); padding: 30px; text-align: center; color: #000; border-radius: 10px 10px 0 0; }
        .content { background: #fff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .field { margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-left: 4px solid #FFD700; border-radius: 5px; }
        .label { font-weight: bold; color: #555; font-size: 12px; text-transform: uppercase; }
        .value { font-size: 16px; color: #000; margin-top: 5px; }
    </style>
</head>
<body>
    <div class='container'>
        <div class='header'>
            <h1 style='margin: 0; font-size: 28px;'>✨ New Dream Lead!</h1>
        </div>
        <div class='content'>
            <div class='field'><div class='label'>👤 Name</div><div class='value'>${name}</div></div>
            <div class='field'><div class='label'>📱 Mobile</div><div class='value'>${mobile}</div></div>
            <div class='field'><div class='label'>📧 Email</div><div class='value'>${email}</div></div>
            <div class='field'><div class='label'>🏠 Project</div><div class='value'>${projectType}</div></div>
            <div class='field'><div class='label'>💭 Message</div><div class='value'>${message || 'No message'}</div></div>
        </div>
    </div>
</body>
</html>
`;

    // Customer welcome email HTML
    const customerEmailHtml = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Georgia', serif; line-height: 1.8; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; }
        .header { background: linear-gradient(135deg, #FFD700, #FFA500); padding: 50px 30px; text-align: center; }
        .content { padding: 40px 30px; }
        .section { margin: 30px 0; padding: 25px; background: #f9f9f9; border-left: 4px solid #FFD700; }
    </style>
</head>
<body>
    <div class='container'>
        <div class='header'><h1>✨ Welcome ${name}! ✨</h1></div>
        <div class='content'>
            <p>Thank you for trusting me with your vision for ${projectType}!</p>
            <div class='section'>
                <h3>What Happens Next?</h3>
                <ul>
                    <li>I'll review your vision personally</li>
                    <li>You'll receive a call within 24 hours</li>
                    <li>We'll discuss your dreams and timeline</li>
                </ul>
            </div>
            <p>With love & creativity,<br><strong>Anshika Rastogi</strong></p>
        </div>
    </div>
</body>
</html>
`;

    // Send emails
    await Promise.all([
      // Admin email
      transporter.sendMail({
        from: '"Dream Lead" <designersvisionstudio@gmail.com>',
        to: 'designersvisionstudio@gmail.com',
        subject: `🎨 New Dream Lead: ${projectType}`,
        html: adminEmailHtml
      }),
      // Customer email
      transporter.sendMail({
        from: '"Anshika Rastogi" <designersvisionstudio@gmail.com>',
        to: email,
        subject: `✨ Welcome to Your Dream Journey, ${name}!`,
        html: customerEmailHtml
      })
    ]);

    // Save to database (optional)
    if (req.app.locals.db) {
      const db = req.app.locals.db;
      db.run(`
        INSERT INTO contacts (name, email, phone, subject, message, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `, [name, email, mobile, `Dream Home - ${projectType}`, message || '']);
    }

    res.json({
      success: true,
      message: 'Emails sent successfully!'
    });

  } catch (error) {
    console.error('Dream contact form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email. Please try again.'
    });
  }
});
