const webpush = require('web-push');
const pool = require('../config/db');

const vapidEnabled = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_EMAIL);

if (vapidEnabled) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.log('[webpush] VAPID keys not configured — push notifications disabled');
}

async function notifyUsers(userIds, payload) {
  if (!vapidEnabled || !userIds?.length) return;
  const placeholders = userIds.map(() => '?').join(',');
  const [subs] = await pool.query(
    `SELECT id, user_id, endpoint, p256dh, auth FROM push_subscription WHERE user_id IN (${placeholders})`,
    userIds
  );

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await pool.query('DELETE FROM push_subscription WHERE id = ?', [sub.id]);
        }
      }
    })
  );
}

async function notifyAllAdmins(payload) {
  const [rows] = await pool.query(
    `SELECT ps.user_id FROM push_subscription ps
     JOIN auth_assignment aa ON aa.user_id = ps.user_id
     WHERE aa.item_name = 'admin'`
  );
  const ids = rows.map((r) => r.user_id);
  await notifyUsers(ids, payload);
}

module.exports = { notifyUsers, notifyAllAdmins };
