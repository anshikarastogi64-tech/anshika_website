/**
 * Portal welcome email (Nodemailer) - spec: PORTAL_V13, portal-master-v18
 * Client notification emails (in-app alert mirrored to inbox when SMTP is configured).
 */
const nodemailer = require('nodemailer');

let transporter = null;

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(str, max) {
  const t = String(str || '').trim() || 'Your project';
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/** Absolute URL for email links; set PUBLIC_BASE_URL or BASE_URL in production. */
function publicBaseUrl() {
  const raw = (process.env.PUBLIC_BASE_URL || process.env.BASE_URL || '').trim();
  return raw.replace(/\/$/, '');
}

function absolutePortalUrl(path) {
  const base = publicBaseUrl();
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

/** Subject line flavour per notification category (premium, calm tone). */
const CATEGORY_EMAIL_SUBJECT = {
  PROJECT: 'Your project has a refined new update',
  DESIGN: 'Your design journey has a beautiful new chapter',
  FINANCE: 'Clarity on your project investment',
  MEDIA: 'New visuals and files are ready for you',
  TIMELINE: 'Your project timelines reflect fresh progress',
  DAILY: 'A fresh glimpse of life on your site',
  DOCUMENTS: 'Documents shared with you, thoughtfully curated',
  COMMENT: 'A note on your project is waiting for you',
  SYSTEM: 'Your private client portal has been updated',
};

function notificationEmailSubject(category, projectTitle) {
  const line = CATEGORY_EMAIL_SUBJECT[category] || 'Something meaningful is waiting in your portal';
  const title = truncate(projectTitle, 42);
  return `${line} · ${title}`;
}

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

/**
 * Send a polished notification email when a client receives an in-portal alert.
 * @param {Object} opts
 * @param {string} opts.toEmail
 * @param {string} [opts.recipientName]
 * @param {string} opts.message - same text as in-app notification
 * @param {string} opts.pathLink - e.g. /portal/client/projects/uuid#tab-vault
 * @param {string} [opts.projectTitle]
 * @param {string} [opts.category] - PROJECT, DESIGN, FINANCE, etc.
 */
async function sendClientNotificationEmail(opts) {
  const trans = getTransporter();
  if (!trans) return;
  const brand = process.env.EMAIL_BRAND_NAME || process.env.BRAND_NAME || "Designer's Vision";
  const name = (opts.recipientName || '').trim() || 'there';
  const message = (opts.message || '').trim();
  const projectTitle = (opts.projectTitle || '').trim() || 'Your project';
  const pathLink = opts.pathLink || '/portal/client';
  const href = absolutePortalUrl(pathLink);
  const category = opts.category || 'PROJECT';
  const subject = notificationEmailSubject(category, projectTitle);

  if (!opts.toEmail || !message) return;
  if (!publicBaseUrl()) {
    console.warn("Portal: PUBLIC_BASE_URL (or BASE_URL) is unset; notification email links may not open correctly in all clients.");
  }

  const textBody = `
Dear ${name},

We wanted you to be the first to know — something new has been added to your experience with ${brand}.

${message}

Open your private client portal to see every detail, timeline, and document in one place:
${href}

With warm regards,
The ${brand} Team

This message was sent because you have an active project with us. Sign in only through our official website.
  `.trim();

  const safeMessage = escapeHtml(message).replace(/\n/g, '<br/>');
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(projectTitle);
  const safeBrand = escapeHtml(brand);
  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background-color:#121212;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#121212;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;border-collapse:collapse;background-color:#1a1a1a;border:1px solid rgba(212,175,55,0.35);border-radius:8px;overflow:hidden;">
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#D4AF37,#c5a030);"></td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px 28px;color:#F8F8F8;font-size:17px;line-height:1.55;">
              <p style="margin:0 0 16px 0;">Dear ${safeName},</p>
              <p style="margin:0 0 18px 0;color:#e8e8e8;font-family:Inter,system-ui,sans-serif;font-size:15px;line-height:1.65;">
                Your space deserves transparency and care. We have an update we believe you will want to see — crafted for you inside your private ${safeBrand} portal.
              </p>
              <div style="margin:20px 0;padding:16px 18px;background:rgba(212,175,55,0.08);border-left:3px solid #D4AF37;border-radius:0 6px 6px 0;font-family:Inter,system-ui,sans-serif;font-size:15px;color:#f0f0f0;line-height:1.6;">
                ${safeMessage}
              </div>
              <p style="margin:22px 0 8px 0;color:#c9c9c9;font-family:Inter,system-ui,sans-serif;font-size:14px;line-height:1.6;">
                Project: <strong style="color:#D4AF37;">${safeTitle}</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px 28px;text-align:center;">
              <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;background-color:#D4AF37;color:#121212;text-decoration:none;font-family:Inter,system-ui,sans-serif;font-weight:600;font-size:15px;border-radius:4px;letter-spacing:0.02em;">
                Open your portal
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px 28px;color:#9a9a9a;font-family:Inter,system-ui,sans-serif;font-size:12px;line-height:1.55;text-align:center;">
              <p style="margin:0;">With warm regards,<br/><span style="color:#D4AF37;">The ${safeBrand} Team</span></p>
              <p style="margin:16px 0 0 0;font-size:11px;opacity:0.85;">You receive this because you are a valued client. For security, always sign in only through our official website.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    await trans.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: opts.toEmail,
      subject,
      text: textBody,
      html: htmlBody,
    });
  } catch (e) {
    console.error('Portal client notification email error:', e.message);
  }
}

module.exports = { sendWelcomeEmail, sendClientNotificationEmail, getTransporter };
