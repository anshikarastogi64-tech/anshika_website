/**
 * Portal welcome email (Nodemailer) - spec: PORTAL_V13, portal-master-v18
 */
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.EMAIL_HOST || process.env.SMTP_HOST;
  const port = Number(process.env.EMAIL_PORT || process.env.SMTP_PORT) || 465;
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

/**
 * Send welcome email when a new client project is created (convert lead or manual add).
 * @param {Object} opts - { toEmail, clientName, portalUrl, loginEmail, tempPassword, brandName }
 */
async function sendWelcomeEmail(opts) {
  const trans = getTransporter();
  if (!trans) {
    console.warn('Portal: Welcome email skipped (no EMAIL_* config).');
    return;
  }
  const brand = opts.brandName || 'Luxury Interior';
  const body = `
Dear ${opts.clientName},

We are thrilled to begin crafting your dream space. Your project portal is now live.

Login Details:
Portal Link: ${opts.portalUrl}
Username: ${opts.loginEmail}
Temporary Password: ${opts.tempPassword}

In your portal, you can track daily site progress, approve designs, and watch your site live via CCTV.

Welcome to the family.

The ${brand} Team
  `.trim();
  try {
    await trans.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: opts.toEmail,
      subject: `Welcome to ${brand} – Your Design Journey Begins`,
      text: body,
    });
  } catch (e) {
    console.error('Portal welcome email error:', e.message);
  }
}

module.exports = { sendWelcomeEmail, getTransporter };
