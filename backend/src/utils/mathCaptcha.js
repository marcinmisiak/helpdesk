const crypto = require('crypto');

// Wyzwania w pamięci procesu (bez Redis/DB) — wystarcza, bo helpdesk działa jako jeden
// proces Node bez klastra. Współdzielone przez routes/public.js i routes/chat.js.
const challenges = new Map();

function cleanExpired() {
  const now = Date.now();
  for (const [id, ch] of challenges) {
    if (now > ch.expiresAt) challenges.delete(id);
  }
}
setInterval(cleanExpired, 5 * 60 * 1000);

function createChallenge() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const id = crypto.randomBytes(10).toString('hex');

  challenges.set(id, {
    answer: a + b,
    expiresAt: Date.now() + 15 * 60 * 1000,
  });

  return { id, question: `${a} + ${b}` };
}

// Zwraca 'ok' | 'expired' | 'wrong'. Usuwa wyzwanie tylko przy 'ok' — błędna odpowiedź
// nie unieważnia go, można próbować ponownie aż do naturalnego wygaśnięcia.
function verifyChallenge(id, answer) {
  const challenge = challenges.get(id);
  if (!challenge || Date.now() > challenge.expiresAt) return 'expired';
  if (parseInt(answer, 10) !== challenge.answer) return 'wrong';
  challenges.delete(id);
  return 'ok';
}

module.exports = { createChallenge, verifyChallenge };
