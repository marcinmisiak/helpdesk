import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import useDateLocale from '../i18n/useDateLocale';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import SLABadge from '../components/SLABadge';
import PrzydielModal from '../components/PrzydielModal';
import LdapPanel from '../components/LdapPanel';

const STATUS_COLORS = { 1: 'badge-red', 2: 'badge-yellow', 3: 'badge-gray' };
const PRIORITY_LABELS = { 1: 'P1', 2: 'P2', 3: 'P3' };

export default function ChatTicketView() {
  const { t } = useTranslation();
  const locale = useDateLocale();
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin } = useAuth();

  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState('');
  const [closeAfter, setCloseAfter] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const bottomRef = useRef(null);

  const formatDate = (ts) => (ts ? format(new Date(ts * 1000), 'dd.MM.yyyy HH:mm', { locale }) : '—');
  const formatTime = (ts) => (ts ? format(new Date(ts * 1000), 'HH:mm', { locale }) : '');

  const STATUS_LABELS = {
    1: t('ticket_view.status_new'),
    2: t('ticket_view.status_inprogress'),
    3: t('ticket_view.status_closed'),
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.get(`/tickets/${id}`).then(r => r.data),
    refetchInterval: 4000,
  });

  const { data: templates } = useQuery({
    queryKey: ['szablony'],
    queryFn: () => api.get('/szablony').then(r => r.data.data),
  });

  const { data: ldapCardConfig } = useQuery({
    queryKey: ['ldap-card-config'],
    queryFn: () => api.get('/ustawienia/ldap-card-config').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const changeStatus = useMutation({
    mutationFn: (status) => api.post(`/tickets/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries(['ticket', id]); qc.invalidateQueries(['tickets']); },
    onError: (err) => toast.error(err.response?.data?.error || t('common.error')),
  });

  const usunPrzydzial = useMutation({
    mutationFn: (userId) => api.delete(`/tickets/${id}/przydziel/${userId}`),
    onSuccess: () => { toast.success(t('ticket_view.toast_unassigned')); qc.invalidateQueries(['ticket', id]); },
    onError: (err) => toast.error(err.response?.data?.error || t('common.error')),
  });

  const usunPrzydzialZespol = useMutation({
    mutationFn: (zespolId) => api.delete(`/tickets/${id}/przydziel-zespol/${zespolId}`),
    onSuccess: () => { toast.success(t('ticket_view.toast_team_unassigned')); qc.invalidateQueries(['ticket', id]); },
    onError: (err) => toast.error(err.response?.data?.error || t('common.error')),
  });

  const usunTicket = useMutation({
    mutationFn: () => api.delete(`/tickets/${id}/trwale`),
    onSuccess: () => { toast.success(t('ticket_view.toast_deleted')); navigate('/czaty'); },
    onError: (err) => toast.error(err.response?.data?.error || t('common.error')),
  });

  const ticket = data?.ticket;
  const korespondencja = data?.korespondencja || [];
  const notatki = data?.notatki || [];
  const przypisania = data?.przypisania || [];
  const zespoly = data?.zespoly || [];

  useEffect(() => {
    korespondencja.filter(k => !k.przeczytane && !k.created_by).forEach(k => {
      api.patch(`/korespondencja/${k.id}/przeczytane`).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [korespondencja.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [korespondencja.length]);

  const applyTemplate = (e) => {
    const tplId = e.target.value;
    e.target.value = '';
    if (!tplId) return;
    const tpl = templates?.find(s => String(s.id) === tplId);
    if (!tpl) return;
    if (message && !confirm(t('ticket_view.reply_template_confirm_replace'))) return;
    setMessage(tpl.tresc);
  };

  const suggestAi = async () => {
    setAiLoading(true);
    try {
      const { data: resp } = await api.post(`/tickets/${id}/ai-reply`);
      setMessage(resp.suggestion);
    } catch (err) {
      toast.error(err.response?.data?.error || t('ticket_view.toast_ai_error'));
    } finally {
      setAiLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('to', '');
      formData.append('cc', '');
      formData.append('tresc', message.trim());
      formData.append('html', `<p>${message.trim().replace(/\n/g, '<br/>')}</p>`);
      formData.append('zamknij', closeAfter ? '1' : '0');
      formData.append('close_notify', '0');
      await api.post(`/tickets/${id}/odpowiedz`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage('');
      setCloseAfter(false);
      refetch();
      qc.invalidateQueries(['tickets']);
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setSending(false);
    }
  };

  const saveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await api.post('/notatki', { ticket_id: id, tresc: noteText });
      setNoteText('');
      refetch();
      toast.success(t('ticket_view.toast_note_added'));
    } catch {
      toast.error(t('ticket_view.toast_note_error'));
    } finally {
      setSavingNote(false);
    }
  };

  if (isLoading) return <div className="text-center py-12 text-gray-500 dark:text-gray-400">{t('common.loading')}</div>;
  if (error) return <div className="text-center py-12 text-red-500">{t('ticket_view.error_loading')}</div>;

  if (ticket.zrodlo !== 'live_chat') {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-600 dark:text-gray-300 mb-3">{t('chat_view.not_chat_ticket')}</p>
        <Link to={`/tickets/${id}`} className="text-blue-600 hover:underline">{t('chat_view.open_standard')} →</Link>
      </div>
    );
  }

  const pliki = (apiPliki) => (apiPliki || []).map(p => (
    <a
      key={p.id}
      href={`${import.meta.env.VITE_API_URL?.replace('/api', '')}/pliki/${p.filepath}`}
      target="_blank"
      rel="noreferrer"
      className="block text-xs underline opacity-80 hover:opacity-100"
    >
      📎 {p.originalname}
    </a>
  ));

  const allMessages = [
    {
      id: 'first',
      tresc: ticket.tresc,
      data: ticket.data_utworzenia,
      jest_od_pracownika: false,
      jest_systemowa: false,
      pliki: [],
    },
    ...korespondencja.map(k => ({
      id: k.id,
      tresc: k.tresc,
      data: k.data,
      jest_od_pracownika: !!k.created_by,
      jest_systemowa: k.typ === 'system',
      autor: k.imie ? `${k.imie} ${k.nazwisko}` : null,
      pliki: k.pliki,
    })),
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/czaty" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">←</Link>
          <h2 className="text-lg font-semibold truncate">{ticket.message_from || t('chat_view.anonymous_visitor')}</h2>
          <span className="text-sm text-gray-400">#{ticket.numer}</span>
          <span className={STATUS_COLORS[ticket.status]}>{STATUS_LABELS[ticket.status]}</span>
        </div>
        <Link to={`/tickets/${id}`} className="text-xs text-blue-600 hover:underline whitespace-nowrap">
          {t('chat_view.open_standard')} →
        </Link>
      </div>

      <div className="flex gap-4 items-start">
        {/* Główna kolumna: wątek + composer */}
        <div className="flex-1 min-w-0 card p-0 flex flex-col overflow-hidden">
          <div className="overflow-y-auto p-4 space-y-3" style={{ maxHeight: '65vh', minHeight: '320px' }}>
            {allMessages.map(m => (
              m.jest_systemowa ? (
                <div key={m.id} className="text-center text-xs text-gray-400 px-4 py-1">{m.tresc}</div>
              ) : (
                <div key={m.id} className={`flex ${m.jest_od_pracownika ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[75%]">
                    {m.jest_od_pracownika && m.autor && (
                      <p className="text-[11px] text-gray-400 text-right mb-0.5">{m.autor}</p>
                    )}
                    <div
                      className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                        m.jest_od_pracownika ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {m.tresc}
                    </div>
                    {m.pliki?.length > 0 && (
                      <div className={`mt-1 ${m.jest_od_pracownika ? 'text-right' : ''}`}>{pliki(m.pliki)}</div>
                    )}
                    <p className={`text-[11px] text-gray-400 mt-0.5 ${m.jest_od_pracownika ? 'text-right' : ''}`}>
                      {formatTime(m.data)}
                    </p>
                  </div>
                </div>
              )
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="border-t dark:border-gray-800 p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                {templates?.length > 0 && (
                  <select onChange={applyTemplate} defaultValue="" className="text-xs border rounded px-1 py-0.5 dark:bg-gray-800 dark:border-gray-700">
                    <option value="">{`📋 ${t('ticket_view.reply_template_label')}`}</option>
                    {templates.map(tpl => <option key={tpl.id} value={tpl.id}>{tpl.nazwa}</option>)}
                  </select>
                )}
                <button
                  onClick={suggestAi}
                  disabled={aiLoading}
                  className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-300 flex items-center gap-1 disabled:opacity-50"
                >
                  {aiLoading ? `⏳ ${t('ticket_view.reply_ai_loading')}` : `🤖 ${t('ticket_view.reply_ai_suggest')}`}
                </button>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                <input type="checkbox" checked={closeAfter} onChange={e => setCloseAfter(e.target.checked)} />
                {t('ticket_view.reply_close_after')}
              </label>
            </div>
            <div className="flex gap-2">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                rows={2}
                placeholder={t('chat_view.message_placeholder')}
                className="input resize-none flex-1"
              />
              <button onClick={sendMessage} disabled={sending || !message.trim()} className="btn-primary self-end disabled:opacity-50">
                {sending ? t('ticket_view.reply_sending') : t('chat_view.send')}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 space-y-3">
          <div className="card">
            <h4 className="label mb-2">{t('chat_view.status_section')}</h4>
            <div className="flex gap-1">
              {[1, 2, 3].map(s => (
                <button
                  key={s}
                  onClick={() => changeStatus.mutate(s)}
                  className={`flex-1 text-xs py-1 rounded ${ticket.status === s ? STATUS_COLORS[s] : 'btn-secondary'}`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h4 className="label mb-0">{t('ticket_view.field_assigned')}</h4>
              <button onClick={() => setModal('przydziel')} className="text-xs text-blue-600 hover:underline">{t('ticket_view.assign')}</button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {przypisania.map(p => (
                <span key={p.id} className="flex items-center gap-1 badge-blue text-xs">
                  {p.imie} {p.nazwisko}
                  <button onClick={() => usunPrzydzial.mutate(p.user_id)} className="text-blue-400 hover:text-red-500">×</button>
                </span>
              ))}
              {zespoly.map(z => (
                <span key={z.id} className="flex items-center gap-1 badge-yellow text-xs">
                  👨‍👩‍👧 {z.nazwa}
                  <button onClick={() => usunPrzydzialZespol.mutate(z.zespol_id)} className="text-yellow-600 hover:text-red-500">×</button>
                </span>
              ))}
              {!przypisania.length && !zespoly.length && <span className="text-xs text-gray-400">{t('common.unassigned')}</span>}
            </div>
          </div>

          <div className="card text-sm space-y-1.5">
            <h4 className="label mb-1">{t('chat_view.visitor_section')}</h4>
            <p className="text-gray-700 dark:text-gray-200 break-words">{ticket.message_from || t('chat_view.anonymous_visitor')}</p>
            <p className="text-xs text-gray-400">{t('ticket_view.field_date')}: {formatDate(ticket.data_utworzenia)}</p>
            <div className="flex items-center gap-2">
              <span className="badge-blue text-xs">{PRIORITY_LABELS[ticket.priority] || 'P2'}</span>
              <SLABadge status={ticket.sla_status} secondsLeft={ticket.sla_seconds_left} />
            </div>
          </div>

          <LdapPanel ticket={ticket} onRefresh={() => qc.invalidateQueries(['ticket', id])} ldapCardConfig={ldapCardConfig} compact />

          <div className="card">
            <h4 className="label mb-2">{t('ticket_view.notes_title', { count: notatki.length })}</h4>
            {notatki.map(n => (
              <div key={n.id} className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2 mb-1.5 text-xs">
                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{n.tresc}</p>
                <p className="text-gray-400 mt-0.5">{formatDate(n.data)}</p>
              </div>
            ))}
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              rows={2}
              placeholder={t('ticket_view.note_placeholder')}
              className="input resize-y text-xs mt-1"
            />
            <button onClick={saveNote} disabled={savingNote} className="btn-secondary btn-sm mt-1">
              {savingNote ? t('ticket_view.note_saving') : t('ticket_view.note_btn')}
            </button>
          </div>

          {isAdmin && (
            <button
              onClick={() => { if (confirm(t('ticket_view.confirm_delete', { numer: ticket.numer }))) usunTicket.mutate(); }}
              className="btn-danger btn-sm w-full"
            >
              {t('common.delete')}
            </button>
          )}
        </div>
      </div>

      {modal === 'przydziel' && (
        <PrzydielModal ticketId={id} onClose={() => setModal(null)} onSuccess={() => qc.invalidateQueries(['ticket', id])} />
      )}
    </div>
  );
}
