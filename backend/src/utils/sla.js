const pool = require('../config/db');

const SLA_CONFIG = {
  1: { responseSeconds: 60 * 60, resolutionSeconds: 8 * 60 * 60 },
  2: { responseSeconds: 4 * 60 * 60, resolutionSeconds: 24 * 60 * 60 },
  3: { responseSeconds: 8 * 60 * 60, resolutionSeconds: 48 * 60 * 60 },
};

const WARNING_RATIO = 0.8;

function normalizePriority(value) {
  const parsed = Number(value);
  return [1, 2, 3].includes(parsed) ? parsed : 2;
}

function getPriorityConfig(priority) {
  return SLA_CONFIG[normalizePriority(priority)];
}

function computeDeadlines(createdAt, priority) {
  const created = Number(createdAt || 0);
  if (!created) {
    return {
      responseDeadline: null,
      resolutionDeadline: null,
      responseWarningAt: null,
      resolutionWarningAt: null,
    };
  }

  const cfg = getPriorityConfig(priority);
  const responseDeadline = created + cfg.responseSeconds;
  const resolutionDeadline = created + cfg.resolutionSeconds;

  return {
    responseDeadline,
    resolutionDeadline,
    responseWarningAt: created + Math.floor(cfg.responseSeconds * WARNING_RATIO),
    resolutionWarningAt: created + Math.floor(cfg.resolutionSeconds * WARNING_RATIO),
  };
}

function enrichTicketSla(ticket, nowTs = Math.floor(Date.now() / 1000)) {
  const priority = normalizePriority(ticket.priority);
  const createdAt = Number(ticket.data_utworzenia || 0);

  const computed = computeDeadlines(createdAt, priority);
  const responseDeadline = Number(ticket.sla_response_deadline || computed.responseDeadline || 0) || null;
  const resolutionDeadline = Number(ticket.sla_resolution_deadline || computed.resolutionDeadline || 0) || null;
  const firstResponseAt = Number(ticket.first_response_at || 0) || null;
  const closedAt = Number(ticket.data_zamkniecia || 0) || null;

  const responseBreached = !firstResponseAt && !!responseDeadline && nowTs >= responseDeadline;
  const resolutionBreached = ticket.status !== 3 && !!resolutionDeadline && nowTs >= resolutionDeadline;

  let status = 'ok';
  if (ticket.status === 3 && closedAt && resolutionDeadline && closedAt > resolutionDeadline) {
    status = 'breach';
  } else if (responseBreached || resolutionBreached) {
    status = 'breach';
  } else {
    const responseWarning = !firstResponseAt && !!computed.responseWarningAt && nowTs >= computed.responseWarningAt;
    const resolutionWarning = ticket.status !== 3 && !!computed.resolutionWarningAt && nowTs >= computed.resolutionWarningAt;
    if (responseWarning || resolutionWarning) {
      status = 'warning';
    }
  }

  return {
    ...ticket,
    priority,
    sla_response_deadline: responseDeadline,
    sla_resolution_deadline: resolutionDeadline,
    first_response_at: firstResponseAt,
    sla_status: status,
    sla_seconds_left: resolutionDeadline ? resolutionDeadline - nowTs : null,
  };
}

async function ensureSlaSchema() {
  const [columns] = await pool.query('SHOW COLUMNS FROM ticket');
  const names = new Set(columns.map((c) => c.Field));

  if (!names.has('priority')) {
    await pool.query('ALTER TABLE ticket ADD COLUMN priority TINYINT NOT NULL DEFAULT 2 AFTER status');
  }
  if (!names.has('sla_response_deadline')) {
    await pool.query('ALTER TABLE ticket ADD COLUMN sla_response_deadline INT NULL AFTER priority');
  }
  if (!names.has('sla_resolution_deadline')) {
    await pool.query('ALTER TABLE ticket ADD COLUMN sla_resolution_deadline INT NULL AFTER sla_response_deadline');
  }
  if (!names.has('first_response_at')) {
    await pool.query('ALTER TABLE ticket ADD COLUMN first_response_at INT NULL AFTER sla_resolution_deadline');
  }
  if (!names.has('sla_warning_sent_at')) {
    await pool.query('ALTER TABLE ticket ADD COLUMN sla_warning_sent_at INT NULL AFTER first_response_at');
  }

  await pool.query('UPDATE ticket SET priority = 2 WHERE priority IS NULL OR priority NOT IN (1, 2, 3)');
  await pool.query('UPDATE ticket SET sla_response_deadline = data_utworzenia + CASE priority WHEN 1 THEN 3600 WHEN 2 THEN 14400 ELSE 28800 END WHERE sla_response_deadline IS NULL');
  await pool.query('UPDATE ticket SET sla_resolution_deadline = data_utworzenia + CASE priority WHEN 1 THEN 28800 WHEN 2 THEN 86400 ELSE 172800 END WHERE sla_resolution_deadline IS NULL');

  try {
    await pool.query('CREATE INDEX idx_ticket_sla_response ON ticket (status, sla_response_deadline)');
  } catch {}
  try {
    await pool.query('CREATE INDEX idx_ticket_sla_resolution ON ticket (status, sla_resolution_deadline)');
  } catch {}
}

module.exports = {
  SLA_CONFIG,
  WARNING_RATIO,
  normalizePriority,
  getPriorityConfig,
  computeDeadlines,
  enrichTicketSla,
  ensureSlaSchema,
};