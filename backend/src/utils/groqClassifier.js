const Groq = require('groq-sdk');
const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
let sharp; try { sharp = require('sharp'); } catch { sharp = null; }
const { normalizePriority, computeDeadlines } = require('./sla');
const { extractEmail, checkSenderStatus } = require('./spamBlocklist');

const DOCS_DIR = path.join(__dirname, '../../docs');

const VALID_TAGS = ['spam', 'niskie', 'normalne', 'pilne'];

function getClient() {
  if (!process.env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

async function classifyTicket({ subject = '', body = '', from = '' }) {
  const client = getClient();
  if (!client) {
    console.warn('[Groq] Brak GROQ_API_KEY — klasyfikacja pominięta');
    return null;
  }

  const content = [
    `Od: ${from}`,
    `Temat: ${subject}`,
    `Treść: ${(body || '').slice(0, 1000)}`,
  ].join('\n');

  try {
    const chat = await client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `Jesteś klasyfikatorem zgłoszeń helpdesk. Analizuj wiadomość i zwróć JSON z polami:
- tag: jeden z: "spam", "niskie", "normalne", "pilne"
- priority: liczba 1, 2 lub 3 (1=najwyższy)
- reason: jedno zdanie po polsku z uzasadnieniem

Zasady klasyfikacji:
- spam: automatyczne alerty, newslettery, wiadomości marketing, no-reply, noreply, powiadomienia systemowe
- niskie (priority 3): pytania informacyjne, prośby nienagłe, sugestie
- normalne (priority 2): typowe zgłoszenia serwisowe, prośby o pomoc
- pilne (priority 1): awaria, brak dostępu, blokada pracy, błąd krytyczny

Ważne: wiadomość OPISUJĄCA problem (np. wspominająca słowa "system", "automatycznie",
"aplikacja") to NIE jest spam — spamem jest WYŁĄCZNIE wiadomość, która sama w sobie jest
niechcianą automatyczną/marketingową treścią wysłaną do zgłaszającego, nie wiadomość OD
zgłaszającego opisująca jego problem. W razie wątpliwości wybierz "niskie", nie "spam".

Odpowiedz WYŁĄCZNIE poprawnym JSON, bez dodatkowego tekstu.`,
        },
        { role: 'user', content },
      ],
      temperature: 0.1,
      max_tokens: 150,
    });

    const raw = chat.choices[0]?.message?.content?.trim() || '';
    const json = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');

    const tag = VALID_TAGS.includes(json.tag) ? json.tag : null;
    const priority = [1, 2, 3].includes(Number(json.priority)) ? Number(json.priority) : null;
    const reason = typeof json.reason === 'string' ? json.reason.slice(0, 490) : null;

    return { tag, priority, reason };
  } catch (err) {
    console.error('[Groq] Błąd klasyfikacji:', err.message);
    return null;
  }
}

async function classifyAndSave(ticketId, { subject, body, from, ip }) {
  const email = extractEmail(from);
  const senderStatus = await checkSenderStatus({ email, ip });

  if (senderStatus) {
    try {
      if (senderStatus.typ === 'zaufany') {
        await pool.query("UPDATE ticket SET ai_tag = 'normalne', ai_reason = NULL WHERE id = ?", [ticketId]);
        console.log(`[Spam] Ticket #${ticketId} → zaufany nadawca, AI nie zapytane`);
      } else {
        await pool.query('UPDATE ticket SET ai_tag = ?, ai_reason = ? WHERE id = ?', ['spam', senderStatus.reason, ticketId]);
        console.log(`[Spam] Ticket #${ticketId} → spam (${senderStatus.reason}), AI nie zapytane`);
      }
    } catch (err) {
      console.error('[Spam] Błąd zapisu statusu nadawcy:', err.message);
    }
    return;
  }

  const result = await classifyTicket({ subject, body, from });
  if (!result?.tag) return;

  const { tag, priority, reason } = result;

  try {
    await pool.query(
      'UPDATE ticket SET ai_tag = ?, ai_reason = ? WHERE id = ?',
      [tag, reason, ticketId]
    );

    // Spam jest filtrowany z głównej kolejki niezależnie od priority — nie nadpisuj SLA,
    // inaczej zostaje "zamrożone" na błędnym priorytecie po późniejszym odznaczeniu spamu.
    if (priority && tag !== 'spam') {
      const now = Math.floor(Date.now() / 1000);
      const [[ticket]] = await pool.query('SELECT data_utworzenia FROM ticket WHERE id = ?', [ticketId]);
      const deadlines = computeDeadlines(ticket?.data_utworzenia || now, normalizePriority(priority));
      await pool.query(
        'UPDATE ticket SET priority = ?, sla_response_deadline = ?, sla_resolution_deadline = ? WHERE id = ? AND (priority IS NULL OR priority = 2)',
        [priority, deadlines.responseDeadline, deadlines.resolutionDeadline, ticketId]
      );
    }

    console.log(`[Groq] Ticket #${ticketId} → tag=${tag}, priority=${priority}`);
  } catch (err) {
    console.error('[Groq] Błąd zapisu klasyfikacji:', err.message);
  }
}

function loadDocs() {
  if (!fs.existsSync(DOCS_DIR)) return '';
  const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'));
  if (!files.length) return '';
  return files.map(f => {
    const content = fs.readFileSync(path.join(DOCS_DIR, f), 'utf8').slice(0, 8000);
    return `## Plik: ${f}\n${content}`;
  }).join('\n\n---\n\n').slice(0, 24000);
}

async function generateReply({ subject = '', body = '', from = '', history = [], workerName = '' }) {
  const client = getClient();
  if (!client) return null;

  const docs = loadDocs();
  const docsSection = docs
    ? `\nDokumentacja bazy wiedzy helpdesku:\n\n${docs}\n\n---\n`
    : '';

  const historyText = history.length
    ? '\nHistoria korespondencji:\n' + history.map(h => `[${h.autor}]: ${h.tresc}`).join('\n') + '\n'
    : '';

  const userContent = [
    `Od: ${from}`,
    `Temat: ${subject}`,
    `Treść zgłoszenia:\n${(body || '').slice(0, 3000)}`,
    historyText,
  ].join('\n');

  try {
    const chat = await client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `Jesteś asystentem helpdesku. Na podstawie zgłoszenia i bazy wiedzy przygotuj propozycję formalnej odpowiedzi dla pracownika.${docsSection}

Zasady:
- Pisz po polsku, formalnie i uprzejmie (forma grzecznościowa: "Państwo", "Szanowni Państwo", "uprzejmie informujemy")
- Zacznij od zwrotu grzecznościowego np. "Szanowni Państwo," lub "Szanowna Pani," / "Szanowny Panie," jeśli znasz imię
- Odpowiedź powinna bezpośrednio adresować problem użytkownika
- Jeśli dokumentacja zawiera odpowiedź — przywołaj ją
- Jeśli nie — napisz ogólną pomocną odpowiedź formalnym językiem
- Nie używaj żadnych placeholderów jak [imię], [Twoja nazwa], [Twoje imię] itp.
- Zakończ zwrotem np. "Pozostajemy do dyspozycji" lub "Z poważaniem" — bez podpisu, podpis zostanie dodany automatycznie
- Maksymalnie 300 słów
- Zwróć TYLKO treść odpowiedzi, bez nagłówków i bez podpisu`,
        },
        { role: 'user', content: userContent },
      ],
      temperature: 0.4,
      max_tokens: 600,
    });

    const text = chat.choices[0]?.message?.content?.trim() || null;
    if (!text) return null;
    return workerName ? `${text}\n\n${workerName}` : text;
  } catch (err) {
    console.error('[Groq] Błąd generowania odpowiedzi:', err.message);
    return null;
  }
}

async function generatePublicReply({ subject = '', body = '', kategoria = '', attachmentNames = [], images = [] }) {
  const client = getClient();
  if (!client) return null;

  const docs = loadDocs();
  const docsSection = docs ? `\nDokumentacja bazy wiedzy helpdesku:\n\n${docs}\n\n---\n` : '';
  const attachInfo = attachmentNames.length
    ? `\nZałączniki: ${attachmentNames.join(', ')}`
    : '';

  const textContent = [
    kategoria ? `Kategoria: ${kategoria}` : '',
    `Temat: ${subject}`,
    `Treść zgłoszenia:\n${(body || '').slice(0, 3000)}`,
    attachInfo,
  ].filter(Boolean).join('\n');

  const systemPrompt = `Jesteś automatycznym asystentem helpdesku. Odpowiadasz bezpośrednio zgłaszającemu na jego problem.${docsSection}

Zasady:
- Pisz po polsku, formalnie i uprzejmie
- Zacznij od "Szanowni Państwo,"
- Odpowiedz bezpośrednio na problem opisany w zgłoszeniu${images.length ? '\n- Jeśli przesłano zrzut ekranu — odnieś się do tego co na nim widać' : ''}
- Jeśli dokumentacja zawiera odpowiedź — przywołaj ją
- Jeśli nie — napisz ogólną pomocną odpowiedź
- Nie używaj żadnych placeholderów
- Zakończ zwrotem np. "Pozostajemy do dyspozycji" — bez podpisu
- Maksymalnie 300 słów
- Zwróć TYLKO treść odpowiedzi`;

  // Gdy są obrazy — użyj modelu wizji z multimodalnym contentem
  const useVision = images.length > 0;
  const model = useVision ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.1-8b-instant';

  const userMessage = useVision
    ? [
        { type: 'text', text: textContent },
        ...images.map(url => ({ type: 'image_url', image_url: { url } })),
      ]
    : textContent;

  try {
    const chat = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: 800,
    });

    return chat.choices[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error('[Groq] Błąd generatePublicReply:', err.message);
    return null;
  }
}

module.exports = { classifyTicket, classifyAndSave, generateReply, generatePublicReply };
