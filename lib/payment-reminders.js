/**
 * Continuous payment-reminder engine.
 *
 * Admins start a per-project campaign when a project is complete but the client
 * still owes money. The engine periodically emails + texts the client the
 * outstanding amount, starting with a gentle "soft ask" and escalating to a
 * firm "hard ask" (which bars warranty & complimentary perks) after a
 * configurable number of soft sends. It auto-stops the moment the balance
 * reaches zero.
 *
 * Nothing is sent unless an admin explicitly starts a campaign.
 */

const portalDb = require('./portal-db');
const portalLib = require('./portal');
const portalNotify = require('./portal-notify');
const { sendPaymentReminderEmail } = require('./portal-email');
const { sendSms } = require('./sms');

const NC = portalNotify.CATEGORIES;

function nowIso() {
  return new Date().toISOString();
}

function addDaysIso(days) {
  const d = new Date(Date.now() + Math.max(0, Number(days) || 0) * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

function formatInr(amount) {
  return `₹${Math.round(Math.max(0, Number(amount) || 0)).toLocaleString('en-IN')}`;
}

/**
 * Outstanding balance for a project using the same rules as the Finance tab:
 * contract total (approved quotation + approved extras) minus payments the
 * admin has published to the client.
 * @returns {Promise<{project: object, contractTotal: number, paid: number, remaining: number}|null>}
 */
async function computeProjectBalance(projectId) {
  const project = await portalDb.getProjectById(projectId);
  if (!project) return null;
  const quotation = await portalDb.getLatestQuotationByProjectId(projectId);
  const extraCosts = quotation ? await portalDb.getExtraCostsByQuotationId(quotation.id) : [];
  const payments = await portalDb.getClientPaymentsByProject(projectId);
  const contractTotal = portalLib.calculateProjectTotal(quotation, extraCosts);
  const paid = portalLib.sumApprovedClientPayments(payments);
  const remaining = portalLib.balanceDueAfterPublishedPayments(contractTotal, payments);
  return { project, contractTotal, paid, remaining };
}

/** Client recipients for a project, each with email + phone numbers. */
async function resolveClientRecipients(projectId) {
  const users = await portalDb.getProjectClientRecipientUsers(projectId);
  const out = [];
  for (const u of users) {
    const phoneRows = await portalDb.getClientPhones(u.id);
    out.push({
      id: u.id,
      name: u.full_name,
      email: u.email,
      phones: (phoneRows || []).map((p) => p.phone).filter(Boolean),
    });
  }
  return out;
}

function buildSmsBody({ phase, projectTitle, amountRemaining, brand }) {
  const amt = formatInr(amountRemaining);
  const title = projectTitle || 'your project';
  if (phase === 'HARD') {
    return `${brand}: An outstanding balance of ${amt} remains on ${title}. Your warranty & complimentary benefits are on hold until it is cleared. Please settle at the earliest. Reply if already paid.`;
  }
  return `${brand}: A gentle reminder — ${amt} remains on ${title}. Whenever convenient, please settle the balance so we can close your project. Thank you!`;
}

function buildInAppMessage({ phase, projectTitle, amountRemaining }) {
  const amt = formatInr(amountRemaining);
  const title = projectTitle || 'your project';
  if (phase === 'HARD') {
    return `Outstanding balance of ${amt} on «${title}». Your Warranty & Guarantee and complimentary benefits are on hold until the balance is cleared. Open Finance to settle.`;
  }
  return `A gentle reminder: ${amt} remains on «${title}». Please settle the balance at your convenience — see the Finance tab for details.`;
}

/**
 * Run one reminder cycle for a campaign (send emails + SMS, log, advance state).
 * @param {object} campaign row from portal_payment_reminder_campaigns
 * @param {object} [opts]
 * @param {boolean} [opts.force] send now regardless of next_run_at (admin "Send now")
 * @returns {Promise<{sent?: boolean, completed?: boolean, reason?: string}>}
 */
async function sendReminderForCampaign(campaign, opts = {}) {
  if (!campaign) return { reason: 'no campaign' };
  if (campaign.status !== 'ACTIVE') return { reason: 'not active' };

  const balance = await computeProjectBalance(campaign.project_id);
  if (!balance) {
    await portalDb.updateReminderCampaign(campaign.id, { status: 'STOPPED', stopped_at: nowIso() });
    return { reason: 'project missing' };
  }

  const projectTitle = balance.project.title || 'Your project';

  // Fully paid -> complete campaign and lift any gating.
  if (balance.remaining <= 0) {
    await portalDb.updateReminderCampaign(campaign.id, {
      status: 'COMPLETED',
      completed_at: nowIso(),
      last_amount_remaining: 0,
    });
    portalNotify.safeNotify(
      portalNotify.notifyAdmins(portalDb, {
        category: NC.FINANCE,
        message: `Payment reminders for «${projectTitle}» stopped automatically — the balance is now fully settled.`,
        linkUrl: `/portal/admin/projects/${campaign.project_id}#tab-finance`,
        projectId: campaign.project_id,
      })
    );
    return { completed: true };
  }

  const brand = process.env.EMAIL_BRAND_NAME || process.env.BRAND_NAME || "Designer's Vision";

  // Decide phase for this send: escalate once the soft quota is used up.
  const softQuota = Math.max(0, Number(campaign.soft_sends_before_hard) || 0);
  const softSoFar = Number(campaign.soft_sends_count) || 0;
  const phase = softSoFar >= softQuota ? 'HARD' : 'SOFT';

  const recipients = await resolveClientRecipients(campaign.project_id);

  for (const r of recipients) {
    if (Number(campaign.channel_email) === 1 && r.email) {
      const res = await sendPaymentReminderEmail({
        toEmail: r.email,
        recipientName: r.name,
        projectTitle,
        projectId: campaign.project_id,
        amountRemaining: balance.remaining,
        phase,
      });
      await portalDb.addReminderLog({
        campaignId: campaign.id,
        projectId: campaign.project_id,
        phase,
        channel: 'EMAIL',
        recipient: r.email,
        amountRemaining: balance.remaining,
        status: res && res.ok ? 'SENT' : res && res.skipped ? 'SKIPPED' : 'FAILED',
        error: res && res.error ? res.error : null,
      });
    }
    if (Number(campaign.channel_sms) === 1 && r.phones.length) {
      const smsBody = buildSmsBody({ phase, projectTitle, amountRemaining: balance.remaining, brand });
      for (const phone of r.phones) {
        const res = await sendSms({ to: phone, body: smsBody });
        await portalDb.addReminderLog({
          campaignId: campaign.id,
          projectId: campaign.project_id,
          phase,
          channel: 'SMS',
          recipient: phone,
          amountRemaining: balance.remaining,
          status: res && res.ok ? 'SENT' : res && res.skipped ? 'SKIPPED' : 'FAILED',
          error: res && res.error ? res.error : null,
        });
      }
    }
  }

  // Mirror to the in-portal notification centre (client + admins; designers excluded from FINANCE).
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.FINANCE,
      message: buildInAppMessage({ phase, projectTitle, amountRemaining: balance.remaining }),
      projectId: campaign.project_id,
      tabSuffix: '#tab-finance',
      includeClient: true,
      skipClientEmail: true, // the dedicated reminder email above is the client's email
    })
  );

  const updates = {
    phase,
    sends_count: (Number(campaign.sends_count) || 0) + 1,
    last_sent_at: nowIso(),
    next_run_at: addDaysIso(campaign.interval_days),
    last_amount_remaining: balance.remaining,
  };
  if (phase === 'SOFT') updates.soft_sends_count = softSoFar + 1;
  await portalDb.updateReminderCampaign(campaign.id, updates);

  return { sent: true, phase, remaining: balance.remaining };
}

let _running = false;

/** Process every ACTIVE campaign whose next_run_at has arrived. Non-overlapping. */
async function runDueCampaigns() {
  if (_running) return { skipped: 'already running' };
  _running = true;
  let processed = 0;
  try {
    const due = await portalDb.getDueReminderCampaigns(nowIso());
    for (const c of due) {
      try {
        await sendReminderForCampaign(c);
        processed++;
      } catch (e) {
        console.error('Payment reminder cycle error for campaign', c.id, e.message);
      }
    }
  } catch (e) {
    console.error('runDueCampaigns error:', e.message);
  } finally {
    _running = false;
  }
  return { processed };
}

/** Start (or restart) a campaign for a project. */
async function startCampaign(projectId, { intervalDays, softSendsBeforeHard, channelEmail, channelSms, startedByUserId }) {
  const balance = await computeProjectBalance(projectId);
  const existing = await portalDb.getSteeringReminderCampaign(projectId);
  if (existing) {
    // Re-arm the existing campaign with new settings rather than duplicating.
    await portalDb.updateReminderCampaign(existing.id, {
      status: 'ACTIVE',
      interval_days: Math.max(1, Number(intervalDays) || 3),
      soft_sends_before_hard: Math.max(0, Number(softSendsBeforeHard) || 0),
      channel_email: channelEmail ? 1 : 0,
      channel_sms: channelSms ? 1 : 0,
      next_run_at: nowIso(), // fire on the next scheduler tick
      last_amount_remaining: balance ? balance.remaining : null,
    });
    return portalDb.getReminderCampaignById(existing.id);
  }
  return portalDb.createReminderCampaign({
    projectId,
    intervalDays,
    softSendsBeforeHard,
    channelEmail,
    channelSms,
    startedByUserId,
    nextRunAt: nowIso(),
    lastAmountRemaining: balance ? balance.remaining : null,
  });
}

async function pauseCampaign(campaignId) {
  await portalDb.updateReminderCampaign(campaignId, { status: 'PAUSED' });
}

async function resumeCampaign(campaignId) {
  await portalDb.updateReminderCampaign(campaignId, { status: 'ACTIVE', next_run_at: nowIso() });
}

async function stopCampaign(campaignId) {
  await portalDb.updateReminderCampaign(campaignId, { status: 'STOPPED', stopped_at: nowIso() });
}

/** Admin "Send now" — send immediately and reschedule. */
async function sendNow(campaignId) {
  const c = await portalDb.getReminderCampaignById(campaignId);
  if (!c) return { reason: 'not found' };
  if (c.status === 'PAUSED') {
    await portalDb.updateReminderCampaign(campaignId, { status: 'ACTIVE' });
    c.status = 'ACTIVE';
  }
  return sendReminderForCampaign(c, { force: true });
}

module.exports = {
  computeProjectBalance,
  sendReminderForCampaign,
  runDueCampaigns,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  stopCampaign,
  sendNow,
  formatInr,
};
