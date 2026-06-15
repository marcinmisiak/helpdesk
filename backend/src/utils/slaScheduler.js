const pool = require('../config/db');
const { notifyUsers } = require('./webpush');
const { enrichTicketSla } = require('./sla');

let timer = null;

async function createWarningAlerts(ticket, nowTs) {
  const [assignedRows] = await pool.query(
    'SELECT user_id FROM user_has_ticket WHERE ticket_id = ?',
    [ticket.id]
  );
  const userIds = assignedRows.map((r) => r.user_id);

  if (!userIds.length) {
    return;
  }

  try {
    await Promise.all(userIds.map((userId) => pool.query('INSERT INTO alert (user_id, ticket_id) VALUES (?, ?)', [userId, ticket.id])));
  } catch {
    // Tabela alert może nie istnieć albo mieć inne ograniczenia.
  }

  notifyUsers(userIds, {
    title: `SLA ostrzeżenie: #${ticket.numer}`,
    body: `Ticket zbliża się do naruszenia SLA (${ticket.message_subject || 'bez tematu'})`,
    url: `/tickets/${ticket.id}`,
  }).catch(() => {});

  await pool.query('UPDATE ticket SET sla_warning_sent_at = ? WHERE id = ?', [nowTs, ticket.id]);
}

async function runSlaCheck() {
  const nowTs = Math.floor(Date.now() / 1000);
  const [rows] = await pool.query(
    `SELECT id, numer, message_subject, status, odlozony, data_utworzenia, priority,
            sla_response_deadline, sla_resolution_deadline, first_response_at, sla_warning_sent_at
     FROM ticket
     WHERE status != 3 AND (odlozony = 0 OR odlozony IS NULL)`
  );

  for (const row of rows) {
    const ticket = enrichTicketSla(row, nowTs);
    if (ticket.sla_status !== 'warning' || row.sla_warning_sent_at) {
      continue;
    }
    await createWarningAlerts(ticket, nowTs);
  }
}

function startSlaScheduler(intervalMs = 60 * 1000) {
  if (timer) {
    return;
  }

  runSlaCheck().catch((err) => {
    console.error('SLA scheduler init error:', err.message);
  });

  timer = setInterval(() => {
    runSlaCheck().catch((err) => {
      console.error('SLA scheduler error:', err.message);
    });
  }, intervalMs);
}

module.exports = { startSlaScheduler, runSlaCheck };