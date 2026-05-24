# Add Dream Contact Form Route to Server

## Step 1: Add route to server.js

Open `kelly-app/server.js` and add this code after the other POST routes (around line 400):

```javascript
// Dream Contact Form
app.post('/Kelly/forms/dream-contact', express.json(), async (req, res) => {
  try {
    const { name, mobile, email, projectType, message } = req.body;

    if (!name || !mobile || !email || !projectType) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const nodemailer = require('nodemailer');

    // Use existing email transporter or create new one
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: 'designersvisionstudio@gmail.com',
        pass: process.env.EMAIL_PASSWORD
      }
    });

    // Admin email
    const adminHtml = `
      <h1>✨ New Dream Lead!</h1>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Mobile:</strong> ${mobile}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Project:</strong> ${projectType}</p>
      <p><strong>Message:</strong> ${message || 'No message'}</p>
    `;

    // Customer email
    const customerHtml = `
      <h1>✨ Welcome ${name}! ✨</h1>
      <p>Thank you for trusting me with your ${projectType} vision!</p>
      <p>I'll reach out within 24 hours.</p>
      <p>With love & creativity,<br><strong>Anshika Rastogi</strong></p>
    `;

    await Promise.all([
      transporter.sendMail({
        from: 'designersvisionstudio@gmail.com',
        to: 'designersvisionstudio@gmail.com',
        subject: `🎨 New Dream Lead: ${projectType}`,
        html: adminHtml
      }),
      transporter.sendMail({
        from: 'designersvisionstudio@gmail.com',
        to: email,
        subject: `✨ Welcome ${name}!`,
        html: customerHtml
      })
    ]);

    res.json({ success: true, message: 'Emails sent!' });
  } catch (error) {
    console.error('Dream contact error:', error);
    res.status(500).json({ success: false, message: 'Failed to send email' });
  }
});
```

## Step 2: Add EMAIL_PASSWORD to .env

Add this line to `kelly-app/.env`:
```
EMAIL_PASSWORD=your-gmail-app-password
```

Get Gmail App Password:
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Go to App Passwords
4. Generate password for "Mail"
5. Copy and paste to .env

## Step 3: Install nodemailer (if not installed)

```bash
cd ~/kelly-app
npm install nodemailer
```

## Step 4: Restart PM2

```bash
pm2 restart all
```

## Step 5: Test

Visit https://anshikarastogi.com/Kelly/index.html and submit the form!
