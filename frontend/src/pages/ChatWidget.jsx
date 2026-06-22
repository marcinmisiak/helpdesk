import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api');
const API_BASE = BASE.replace('/api', '');
const pub = axios.create({ baseURL: BASE });

function linkify(text) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noreferrer" className="underline break-all">{part}</a>
      : part
  );
}

export default function ChatWidget() {
  const { t } = useTranslation();
  const { channelKey } = useParams();
  const storageKey = `chat_token_${channelKey}`;

  const [token, setToken] = useState(() => localStorage.getItem(storageKey) || '');
  const [imie, setImie] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — pole ukryte przed ludźmi, wykrywa boty
  const [firstMessage, setFirstMessage] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const [status, setStatus] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pliki, setPliki] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  const [branding, setBranding] = useState({ app_name: 'Helpdesk' });
  const threadRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    axios.get(`${API_BASE}/api/ustawienia/app-name`).then((r) => setBranding(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    // Widget renderuje się we własnym dokumencie (iframe), więc to nie wpływa na resztę
    // aplikacji — bez tego Chrome/Firefox z systemowym trybem ciemnym auto-przyciemnia
    // pola formularza (czarny tekst na czarnym tle) mimo jawnych kolorów w klasach Tailwind.
    document.documentElement.style.colorScheme = 'light';
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await pub.get(`/chat/${token}/messages`);
      setStatus(data.status);
      setMessages(data.korespondencja);
      setPliki(data.pliki);
    } catch {
      // token nieprawidłowy lub rozmowa nie istnieje — usuń lokalnie i wróć do formularza
      localStorage.removeItem(storageKey);
      setToken('');
    }
  }, [token, storageKey]);

  useEffect(() => {
    if (!token) return;
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 4000);
    return () => clearInterval(pollRef.current);
  }, [token, fetchMessages]);

  useEffect(() => {
    // Bezpośrednio ustawiamy scrollTop kontenera wątku — scrollIntoView() wewnątrz iframe
    // może eskalować przewijanie do strony-rodzica (gdy element jest już w pełni widoczny
    // w obrębie iframe, niektóre przeglądarki próbują "doscrollować" całą ramkę w stronie
    // hosta). Zależność na .length, nie na całej tablicy — polling co 4s tworzy nową
    // referencję nawet bez nowych wiadomości.
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const startChat = async () => {
    if (!imie.trim()) return setError(t('chat_widget.error_no_name'));
    if (!firstMessage.trim()) return setError(t('chat_widget.error_no_message'));
    setStarting(true);
    setError('');
    try {
      const { data } = await pub.post('/chat/start', {
        channel_key: channelKey,
        imie: imie.trim(),
        email: email.trim() || undefined,
        tresc: firstMessage.trim(),
        website,
      });
      localStorage.setItem(storageKey, data.token);
      setToken(data.token);
    } catch (err) {
      setError(err.response?.data?.error || t('chat_widget.error_default'));
    } finally {
      setStarting(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      await pub.post(`/chat/${token}/message`, { tresc: newMessage.trim() });
      setNewMessage('');
      fetchMessages();
    } catch (err) {
      setError(err.response?.data?.error || t('chat_widget.error_default'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-white" style={{ colorScheme: 'light' }}>
      <div className="bg-blue-700 text-white px-4 py-3 flex items-center gap-2 flex-shrink-0">
        <span className="text-lg">💬</span>
        <span className="font-semibold text-sm">{branding.app_name}</span>
      </div>

      {!token ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <p className="text-sm text-gray-600">{t('chat_widget.intro')}</p>
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
          />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('chat_widget.field_name')}</label>
            <input
              value={imie}
              onChange={(e) => setImie(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white text-black"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('chat_widget.field_email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white text-black"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('chat_widget.field_message')}</label>
            <textarea
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white text-black"
            />
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <button
            onClick={startChat}
            disabled={starting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded py-2 text-sm font-medium disabled:opacity-50"
          >
            {starting ? t('chat_widget.starting') : t('chat_widget.start_button')}
          </button>
        </div>
      ) : (
        <>
          <div ref={threadRef} className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((m) => (
              m.jest_systemowa ? (
                <div key={m.id} className="text-center text-xs text-gray-500 px-4 py-1">
                  {linkify(m.tresc)}
                </div>
              ) : (
                <div key={m.id} className={`flex ${m.jest_od_pracownika ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                      m.jest_od_pracownika ? 'bg-gray-100 text-gray-900' : 'bg-blue-600 text-white'
                    }`}
                  >
                    {m.tresc}
                  </div>
                </div>
              )
            ))}
            {pliki.length > 0 && (
              <div className="pt-2 border-t text-xs text-gray-500 space-y-1">
                {pliki.map((p) => (
                  <a key={p.id} href={`${API_BASE}/pliki/${p.filepath}`} target="_blank" rel="noreferrer" className="block text-blue-600 hover:underline">
                    📎 {p.originalname}
                  </a>
                ))}
              </div>
            )}
          </div>

          {status === 3 && (
            <div className="border-t px-3 py-2 text-center text-xs text-gray-500 bg-gray-50">
              {t('chat_widget.closed_hint')}
            </div>
          )}
          <div className="border-t p-3 flex gap-2 flex-shrink-0">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={t('chat_widget.message_placeholder')}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm bg-white text-black"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !newMessage.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 text-sm font-medium disabled:opacity-50"
            >
              {t('chat_widget.send')}
            </button>
          </div>
          {error && <p className="text-red-600 text-xs text-center pb-2">{error}</p>}
        </>
      )}
    </div>
  );
}
