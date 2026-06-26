import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import useDateLocale from '../i18n/useDateLocale';
import Avatar from '../components/Avatar';

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api');
const API_BASE = BASE.replace('/api', '');
const pub = axios.create({ baseURL: BASE });

const STATUS_COLORS = {
  1: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800',
  2: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800',
  3: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600',
};

export default function PublicTicketView() {
  const { t } = useTranslation();
  const locale = useDateLocale();
  const formatDate = (ts) => { if (!ts) return '—'; return format(new Date(ts * 1000), 'dd.MM.yyyy HH:mm', { locale }); };
  const STATUS_LABELS = { 1: t('public_ticket.status_new'), 2: t('public_ticket.status_inprogress'), 3: t('public_ticket.status_closed') };
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tresc, setTresc] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [rodoZgoda, setRodoZgoda] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const [branding, setBranding] = useState({ app_name: 'Helpdesk', logo_path: null });

  useEffect(() => {
    axios.get(`${API_BASE}/api/ustawienia/app-name`).then(r => setBranding(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    pub.get(`/public/status/${token}`)
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.error || 'Nie udało się załadować zgłoszenia.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleClose = async () => {
    setClosing(true);
    try {
      await pub.post(`/public/status/${token}/zamknij`);
      setClosed(true);
      setData(prev => prev ? { ...prev, ticket: { ...prev.ticket, status: 3 } } : prev);
    } catch (err) {
      setSendError(err.response?.data?.error || 'Błąd zamykania. Spróbuj ponownie.');
    } finally {
      setClosing(false);
      setCloseConfirm(false);
    }
  };

  const handleAskAi = async () => {
    if (!rodoZgoda) return;
    setAiLoading(true);
    setAiError('');
    try {
      await pub.post(`/public/status/${token}/zapytaj-ai`, { rodo_zgoda: true });
      setShowAiModal(false);
      setRodoZgoda(false);
      const r = await pub.get(`/public/status/${token}`);
      setData(r.data);
    } catch (err) {
      setAiError(err.response?.data?.error || 'Błąd. Spróbuj ponownie.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleReply = async () => {
    if (!tresc.trim()) return;
    setSending(true);
    setSendError('');
    setSendSuccess(false);
    try {
      await pub.post(`/public/status/${token}/odpowiedz`, { tresc });
      setSendSuccess(true);
      setTresc('');
      // Odśwież wątek
      const r = await pub.get(`/public/status/${token}`);
      setData(r.data);
    } catch (err) {
      setSendError(err.response?.data?.error || 'Błąd wysyłania. Spróbuj ponownie.');
    } finally {
      setSending(false);
    }
  };

  const logoUrl = branding.logo_path ? `${API_BASE}/pliki/${branding.logo_path}` : null;
  const appName = branding.app_name || 'Helpdesk';
  const phones = branding.kontakt_telefony?.split('\n').map(s => s.trim()).filter(Boolean) || [];
  const emails = branding.kontakt_emaile?.split('\n').map(s => s.trim()).filter(Boolean) || [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
    <div className="flex-1 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Nagłówek */}
        <div className="text-center mb-6">
          {logoUrl
            ? <img src={logoUrl} alt={branding.app_name} className="h-12 w-auto object-contain mx-auto mb-3" />
            : <div className="text-4xl mb-3">🎫</div>}
          <h1 className="text-xl font-bold text-gray-900">{branding.app_name}</h1>
          <p className="text-sm text-gray-600 mt-0.5">Podgląd zgłoszenia</p>
        </div>

        {loading && (
          <div className="text-center py-16 text-gray-600">
            <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
            <p>{t('public_ticket.loading')}</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Nie można wyświetlić zgłoszenia</h2>
            <p className="text-red-600 text-sm">{error}</p>
            <p className="text-gray-600 text-xs mt-4">Sprawdź czy link jest poprawny lub skontaktuj się z obsługą.</p>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Karta zgłoszenia */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-gray-900 break-words">
                    {data.ticket.temat || '(brak tematu)'}
                  </h2>
                  <p className="text-sm text-gray-600 mt-0.5">{t('public_ticket.ticket_no')}{data.ticket.numer}</p>
                </div>
                <span className={STATUS_COLORS[data.ticket.status]}>
                  {STATUS_LABELS[data.ticket.status]}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-600 mb-4">
                <span>📅 Złożone: {formatDate(data.ticket.data_utworzenia)}</span>
              </div>

              {/* Treść oryginalna */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-3 py-1.5 bg-gray-100 border-b border-gray-200 text-xs text-gray-700 font-medium">
                  Treść zgłoszenia
                </div>
                {data.ticket.html ? (
                  <iframe
                    srcDoc={data.ticket.html}
                    className="w-full"
                    style={{ minHeight: '120px', maxHeight: '300px' }}
                    sandbox="allow-same-origin"
                    title="Treść zgłoszenia"
                  />
                ) : (
                  <pre className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap font-sans">
                    {data.ticket.tresc || '(brak treści)'}
                  </pre>
                )}
              </div>

              {/* Pliki */}
              {data.pliki?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-700 font-medium mb-1.5">Załączniki:</p>
                  <div className="flex flex-wrap gap-2">
                    {data.pliki.map(p => (
                      <span key={p.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        📎 {p.originalname}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Wątek korespondencji */}
            {data.korespondencja?.length > 0 && (
              <div className="mb-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 px-1">{t('public_ticket.correspondence')} ({data.korespondencja.length})</h3>
                {data.korespondencja.map(k => {
                  const isAi = k.typ === 'ai_answer';
                  const isAuto = k.typ === 'auto_weekend';
                  const isLeft = k.jest_od_pracownika || isAi || isAuto;
                  return (
                    <div key={k.id} className={`flex ${isLeft ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[85%] rounded-xl px-4 py-3 shadow-sm border ${
                        isAi
                          ? 'bg-indigo-50 border-indigo-200 rounded-tl-none'
                          : isAuto
                            ? 'bg-gray-50 border-gray-200 rounded-tl-none'
                            : k.jest_od_pracownika
                              ? 'bg-white border-gray-300 rounded-tl-none'
                              : 'bg-blue-700 border-blue-800 rounded-tr-none'
                      }`}>
                        <div className={`text-xs mb-1.5 font-semibold flex items-center gap-1.5 ${
                          isAi ? 'text-indigo-700' : isAuto ? 'text-gray-500' : k.jest_od_pracownika ? 'text-blue-800' : 'text-white'
                        }`}>
                          {k.jest_od_pracownika && (
                            <Avatar imie={k.imie} nazwisko={k.nazwisko} avatarPath={k.avatar_path} className="w-5 h-5 text-[9px]" />
                          )}
                          {isAi ? '🤖 Odpowiedź AI' : isAuto ? '⚙️ Helpdesk (auto)' : k.jest_od_pracownika ? k.od : '✉️ Ty'}
                          <span className={`ml-2 font-normal ${
                            isAi ? 'text-indigo-400' : isAuto ? 'text-gray-400' : k.jest_od_pracownika ? 'text-gray-700' : 'text-blue-100'
                          }`}>
                            {formatDate(k.data)}
                          </span>
                        </div>
                        {k.html ? (
                          <div
                            className="text-sm max-w-none"
                            style={{ color: isAi ? '#312e81' : isAuto ? '#374151' : k.jest_od_pracownika ? '#111827' : '#ffffff' }}
                            dangerouslySetInnerHTML={{ __html: k.html }}
                          />
                        ) : (
                          <p className={`text-sm whitespace-pre-wrap ${
                            isAi ? 'text-indigo-900' : isAuto ? 'text-gray-700' : k.jest_od_pracownika ? 'text-gray-900' : 'text-white'
                          }`}>{k.tresc}</p>
                        )}
                        {isAi && (
                          <p className="text-xs text-indigo-400 mt-2 pt-2 border-t border-indigo-100">
                            Wygenerowano automatycznie przez AI — nie pochodzi od pracownika
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Przycisk Zapytaj AI */}
            {data.ticket.status !== 3 && !closed && !data.korespondencja?.some(k => k.typ === 'ai_answer') && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-indigo-800">Potrzebujesz szybkiej pomocy?</p>
                  <p className="text-xs text-indigo-600 mt-0.5">Zapytaj AI — może odpowiedzieć na Twoje pytanie natychmiast.</p>
                </div>
                <button
                  onClick={() => { setShowAiModal(true); setAiError(''); setRodoZgoda(false); }}
                  className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  🤖 Zapytaj AI
                </button>
              </div>
            )}

            {/* Modal RODO */}
            {showAiModal && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                  <h3 className="text-base font-bold text-gray-900 mb-2">🤖 Zapytaj AI</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Treść Twojego zgłoszenia zostanie przesłana do zewnętrznego serwisu AI (Groq) w celu wygenerowania automatycznej odpowiedzi.
                    Odpowiedź AI jest pomocnicza i nie zastępuje obsługi przez pracownika helpdesku.
                  </p>
                  <label className="flex items-start gap-3 cursor-pointer mb-4">
                    <input
                      type="checkbox"
                      checked={rodoZgoda}
                      onChange={e => setRodoZgoda(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-indigo-600 flex-shrink-0"
                    />
                    <span className="text-xs text-gray-700">
                      Wyrażam zgodę na przesłanie treści zgłoszenia do zewnętrznego serwisu AI (Groq) w celu udzielenia automatycznej odpowiedzi (RODO — przetwarzanie przez podmiot trzeci).
                    </span>
                  </label>
                  {aiError && <p className="text-red-600 text-xs mb-3">{aiError}</p>}
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setShowAiModal(false); setAiError(''); }}
                      className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Anuluj
                    </button>
                    <button
                      onClick={handleAskAi}
                      disabled={!rodoZgoda || aiLoading}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {aiLoading ? 'Generowanie...' : 'Wyślij do AI →'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Formularz odpowiedzi */}
            {(data.ticket.status !== 3 && !closed) ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">✍️ Dodaj wiadomość</h3>
                  <textarea
                    value={tresc}
                    onChange={e => setTresc(e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                    placeholder="Wpisz wiadomość do obsługi..."
                  />
                  {sendError && (
                    <p className="text-red-600 text-xs mt-1.5">{sendError}</p>
                  )}
                  {sendSuccess && (
                    <p className="text-green-600 text-xs mt-1.5">✓ Wiadomość wysłana. Obsługa wkrótce odpowie.</p>
                  )}
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={handleReply}
                      disabled={sending || !tresc.trim()}
                      className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {sending ? 'Wysyłanie...' : 'Wyślij wiadomość'}
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  {!closeConfirm ? (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">Problem rozwiązany? Możesz zamknąć zgłoszenie.</p>
                      <button
                        onClick={() => setCloseConfirm(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                      >
                        ✓ Zamknij zgłoszenie
                      </button>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-green-800 mb-3">
                        Czy na pewno chcesz zamknąć zgłoszenie? Problem został rozwiązany?
                      </p>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setCloseConfirm(false)}
                          className="px-4 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Anuluj
                        </button>
                        <button
                          onClick={handleClose}
                          disabled={closing}
                          className="px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {closing ? 'Zamykanie...' : 'Tak, zamknij zgłoszenie'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
                <div className="text-3xl mb-2">✅</div>
                <h3 className="text-sm font-semibold text-green-800">Zgłoszenie zamknięte</h3>
                <p className="text-xs text-green-800 mt-1">
                  Sprawa została uznana za rozwiązaną. Jeśli problem powróci, prosimy o nowe zgłoszenie.
                </p>
                <a
                  href="/zgloszenie"
                  className="inline-block mt-3 text-xs text-blue-600 hover:underline"
                >
                  Złóż nowe zgłoszenie →
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            {logoUrl && <img src={logoUrl} alt={appName} className="h-5 w-auto opacity-60" />}
            <span>{appName} &copy; {new Date().getFullYear()}</span>
          </div>
          {(phones.length > 0 || emails.length > 0) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 justify-center sm:justify-end">
              {phones.map((p, i) => (
                <a key={i} href={`tel:${p.replace(/\s/g, '')}`} className="hover:text-gray-600 transition-colors">
                  📞 {p}
                </a>
              ))}
              {emails.map((e, i) => (
                <a key={i} href={`mailto:${e}`} className="hover:text-gray-600 transition-colors">
                  ✉️ {e}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
    </div>
  );
}
