/**
 * Provider-agnostic SMS adapter.
 *
 * The rest of the app calls `sendSms({ to, body })` and never cares which
 * provider is behind it. Today the default provider is a safe no-op that only
 * logs — email reminders work immediately without any SMS account.
 *
 * To go live with real SMS, set SMS_PROVIDER and the matching credentials in
 * the environment, then (if needed) fill in the small provider block below.
 * No other file has to change.
 *
 *   SMS_PROVIDER=msg91   MSG91_AUTHKEY=...  MSG91_SENDER=...  MSG91_TEMPLATE_ID=...  (India, DLT)
 *   SMS_PROVIDER=twilio  TWILIO_SID=...     TWILIO_TOKEN=...  TWILIO_FROM=+1...
 *   SMS_PROVIDER=none    (default — logs and skips)
 */

/** Normalise a phone number to a plausible E.164-ish string. Returns '' if unusable. */
function normalizePhone(raw, defaultCountryCode) {
  if (!raw) return '';
  let s = String(raw).trim();
  // Keep a leading + then strip everything non-digit.
  const hasPlus = s.startsWith('+');
  s = s.replace(/[^\d]/g, '');
  if (!s) return '';
  if (hasPlus) return '+' + s;
  // Bare 10-digit Indian mobile -> prefix default country code (91) when configured.
  const cc = (defaultCountryCode || process.env.SMS_DEFAULT_COUNTRY_CODE || '91').replace(/[^\d]/g, '');
  if (s.length === 10 && cc) return '+' + cc + s;
  if (s.length > 10) return '+' + s;
  return '+' + s;
}

function providerName() {
  return String(process.env.SMS_PROVIDER || 'none').trim().toLowerCase();
}

/** True when a real SMS provider is configured (used by UI to explain state). */
function isConfigured() {
  const p = providerName();
  if (p === 'msg91') return !!(process.env.MSG91_AUTHKEY && process.env.MSG91_SENDER);
  if (p === 'twilio') return !!(process.env.TWILIO_SID && process.env.TWILIO_TOKEN && process.env.TWILIO_FROM);
  return false;
}

async function sendViaMsg91({ to, body }) {
  const authkey = process.env.MSG91_AUTHKEY;
  const sender = process.env.MSG91_SENDER;
  // MSG91 flow/transactional API. DLT template registration is required in India.
  const url = 'https://api.msg91.com/api/v5/flow/';
  const payload = {
    sender,
    // If you use a DLT-approved template, set MSG91_TEMPLATE_ID and adjust the
    // body/variables mapping to match your template. Kept generic here.
    template_id: process.env.MSG91_TEMPLATE_ID || undefined,
    short_url: '0',
    recipients: [{ mobiles: to.replace(/^\+/, ''), body }],
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authkey },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`MSG91 HTTP ${resp.status}`);
  const data = await resp.json().catch(() => ({}));
  return { ok: true, id: data.request_id || data.message || null, provider: 'msg91' };
}

async function sendViaTwilio({ to, body }) {
  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_TOKEN;
  const from = process.env.TWILIO_FROM;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const form = new URLSearchParams({ To: to, From: from, Body: body });
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
    },
    body: form.toString(),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`Twilio HTTP ${resp.status}: ${data.message || ''}`);
  return { ok: true, id: data.sid || null, provider: 'twilio' };
}

/**
 * Send one SMS.
 * @param {{to: string, body: string}} opts
 * @returns {Promise<{ok: boolean, skipped?: boolean, id?: string|null, provider: string, error?: string}>}
 *          Never throws — always resolves so callers can log the outcome per recipient.
 */
async function sendSms({ to, body }) {
  const provider = providerName();
  const number = normalizePhone(to);
  if (!number) {
    return { ok: false, skipped: true, provider, error: 'no valid phone number' };
  }
  if (!body || !String(body).trim()) {
    return { ok: false, skipped: true, provider, error: 'empty body' };
  }
  try {
    if (provider === 'msg91') {
      if (!isConfigured()) return { ok: false, skipped: true, provider, error: 'MSG91 not configured' };
      return await sendViaMsg91({ to: number, body });
    }
    if (provider === 'twilio') {
      if (!isConfigured()) return { ok: false, skipped: true, provider, error: 'Twilio not configured' };
      return await sendViaTwilio({ to: number, body });
    }
    // Default: no provider configured. Log so the flow is observable in dev/prod logs.
    console.log(`[sms:noop] would send to ${number}: ${String(body).slice(0, 120)}`);
    return { ok: false, skipped: true, provider: 'none', error: 'no SMS provider configured' };
  } catch (e) {
    console.error('SMS send error:', e.message);
    return { ok: false, provider, error: e.message };
  }
}

module.exports = { sendSms, normalizePhone, isConfigured, providerName };
