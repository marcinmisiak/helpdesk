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
import AITagBadge from '../components/AITagBadge';

// Wymusza białe tło i czarny tekst wewnątrz iframe z treścią e-mail.
function wrapEmailHtml(html) {
  const css = `<style>html,body{background:#ffffff!important;color:#111111!important;font-family:sans-serif;margin:0;padding:8px}*{max-width:100%!important;box-sizing:border-box}img{height:auto}</style>`;
  if (html.includes('</head>')) return html.replace('</head>', css + '</head>');
  if (html.includes('<body')) return html.replace(/(<body[^>]*>)/i, '$1' + css);
  return css + html;
}

const STATUS_COLORS = { 1: 'badge-red', 2: 'badge-yellow', 3: 'badge-gray' };
const PRIORITY_LABELS = { 1: 'P1', 2: 'P2', 3: 'P3' };

// ─── Detekcja potencjalnych danych osobowych / poufnych ───────────────────────
const SENSITIVE_PATTERNS = [
  /has[łl]o\s*[:=]/i,
  /password\s*[:=]/i,
  /passwd\s*[:=]/i,
  /pin\s*[:=]\s*\d/i,
  /\bpesel\b/i,
  /\b\d{11}\b/,
  /\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b/,
  /numer\s+konta\s*[:=]/i,
  /iban\s*[:=]/i,
  /\bPL\d{26}\b/,
  /login\s*[:=]/i,
  /user(name)?\s*[:=]/i,
  /u[żz]ytkownik\s*[:=]/i,
  /token\s*[:=]/i,
  /secret\s*[:=]/i,
  /klucz\s+(api|prywatny)\s*[:=]/i,
];

function detectSensitiveData(text) {
  if (!text) return false;
  return SENSITIVE_PATTERNS.some(re => re.test(text));
}

const FRONTEND_URL = window.location.origin;

function SensitiveDataWarning({ ticketId, onRedacted }) {
  const { t } = useTranslation();
  const [redacting, setRedacting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleRedact = async () => {
    if (!confirm(t('ticket_view.confirm_redact'))) return;
    setRedacting(true);
    try {
      await api.post(`/tickets/${ticketId}/redact`);
      toast.success(t('ticket_view.toast_redacted'));
      onRedacted();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setRedacting(false);
    }
  };

  return (
    <div className="mb-3 flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg px-4 py-3">
      <span className="text-xl flex-shrink-0 mt-0.5">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{t('ticket_view.sensitive_title')}</p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{t('ticket_view.sensitive_desc')}</p>
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={handleRedact}
            disabled={redacting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            🗑️ {redacting ? t('ticket_view.redacting') : t('ticket_view.redact_btn')}
          </button>
          <button onClick={() => setDismissed(true)} className="text-xs text-amber-600 dark:text-amber-400 hover:underline">
            {t('ticket_view.ignore')}
          </button>
        </div>
      </div>
    </div>
  );
}

function AutorTokenPanel({ ticket, onRefresh }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [copied, setCopied] = useState(false);

  const token = ticket.autor_token;
  const link = token ? `${FRONTEND_URL}/status/${token}` : null;

  const generate = async () => {
    setLoading(true);
    try {
      await api.post(`/tickets/${ticket.id}/autor-token`, { sendEmail });
      toast.success(sendEmail ? t('ticket_view.toast_generated_with_email') : t('ticket_view.toast_generated'));
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const revoke = async () => {
    if (!confirm(t('ticket_view.confirm_revoke'))) return;
    setLoading(true);
    try {
      await api.delete(`/tickets/${ticket.id}/autor-token`);
      toast.success(t('ticket_view.toast_revoked'));
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="card mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm">🔗 {t('ticket_view.token_title')}</h3>
        {token && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{t('ticket_view.token_active')}</span>
        )}
      </div>
      {token ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input readOnly value={link} className="input flex-1 text-xs font-mono bg-gray-50" />
            <button onClick={copyLink} className="btn-secondary btn-sm whitespace-nowrap">
              {copied ? t('ticket_view.token_copied') : t('ticket_view.token_copy')}
            </button>
            <a href={link} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm whitespace-nowrap">
              {t('ticket_view.token_open')}
            </a>
          </div>
          <button onClick={revoke} disabled={loading} className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50">
            {t('ticket_view.token_revoke')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">{t('ticket_view.token_desc')}</p>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={e => setSendEmail(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-gray-700 dark:text-gray-300">{t('ticket_view.token_send_email')}</span>
          </label>
          <button onClick={generate} disabled={loading} className="btn-secondary btn-sm disabled:opacity-50">
            {loading ? t('ticket_view.token_generating') : t('ticket_view.token_generate')}
          </button>
        </div>
      )}
    </div>
  );
}

function matchLdapLabel(ticket, labelCfg) {
  let extra = {};
  try { extra = ticket.ldap_data ? JSON.parse(ticket.ldap_data) : {}; } catch {}
  const val = labelCfg.condition_field === 'ldap_ou'
    ? ticket.ldap_ou
    : extra[labelCfg.condition_field];
  return val === labelCfg.condition_value;
}

function buildLdapLink(template, extra) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, key) => extra[key] ?? '');
}

function LdapPanel({ ticket, onRefresh, ldapCardConfig }) {
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try { await api.post(`/tickets/${ticket.id}/ldap-refresh`); onRefresh(); }
    catch { onRefresh(); }
    finally { setRefreshing(false); }
  };

  const ou = ticket.ldap_ou;
  if (ou === null || ou === undefined) return null;
  if (ldapCardConfig && !ldapCardConfig.ldap_card_enabled) return null;

  let extra = {};
  try { extra = ticket.ldap_data ? JSON.parse(ticket.ldap_data) : {}; } catch {}

  const notFound = ou === 'not_found';
  const labels = ldapCardConfig?.ldap_labels || [];
  const matched = labels.find(l => matchLdapLabel(ticket, l)) || null;

  const icon = matched?.icon || '👤';
  const labelText = matched?.label || (notFound ? t('ticket_view.ldap_not_found') : ou);
  const linkUrl = matched?.link_template ? buildLdapLink(matched.link_template, extra) : '';
  const linkText = matched?.link_label || t('ticket_view.ldap_open_link');

  const ldapAttrs = t('ticket_view.ldap_attrs', { returnObjects: true }) || {};
  const LDAP_ATTR_LABELS = {
    cn: 'CN', uid: 'UID',
    givenName: ldapAttrs.givenName, sn: ldapAttrs.sn,
    displayName: ldapAttrs.displayName, mail: ldapAttrs.mail,
    telephoneNumber: ldapAttrs.telephoneNumber, mobile: ldapAttrs.mobile,
    l: ldapAttrs.l, description: ldapAttrs.description,
    department: ldapAttrs.department, title: ldapAttrs.title,
    employeeType: ldapAttrs.employeeType, eduPersonAffiliation: ldapAttrs.eduPersonAffiliation,
    studid: ldapAttrs.studid, osobaid: ldapAttrs.osobaid, prow_id: ldapAttrs.prow_id,
  };

  const rows = Object.entries(LDAP_ATTR_LABELS)
    .map(([key, label]) => ({ key, label, val: extra[key] }))
    .filter(r => r.val);

  const cardColor = matched
    ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
    : notFound
      ? 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
      : 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700';

  const badgeColor = matched
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-800/50 dark:text-blue-300'
    : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300';

  return (
    <div className={`mb-4 rounded-lg border text-sm ${cardColor}`}>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-inherit">
        <span className="text-xl flex-shrink-0">{icon}</span>
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>{labelText}</span>
          {ticket.ldap_name && (
            <span className="font-semibold text-gray-800 dark:text-gray-100">{ticket.ldap_name}</span>
          )}
          {ticket.ldap_num && (() => {
            let albumNum = null;
            try { albumNum = ticket.ldap_data ? JSON.parse(ticket.ldap_data).uid : null; } catch {}
            const display = albumNum || ticket.ldap_num;
            const label = albumNum ? 'Numer albumu:' : 'ID:';
            return (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {label} <span className="font-mono font-medium text-gray-700 dark:text-gray-200">{display}</span>
              </span>
            );
          })()}
          {linkUrl && (
            <a href={linkUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
              {linkText}
            </a>
          )}
        </div>
        <button onClick={refresh} disabled={refreshing} title={t('ticket_view.ldap_refresh')}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-40 text-base leading-none flex-shrink-0">
          {refreshing ? '⟳' : '↻'}
        </button>
      </div>
      {!notFound && rows.length > 0 && (
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 px-4 py-3 text-xs">
          {rows.map(({ key, label, val }) => (
            <div key={key}>
              <dt className="text-gray-400 dark:text-gray-500">{label}</dt>
              <dd className="font-medium text-gray-700 dark:text-gray-200 break-words">{val}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function OdpowiedzModal({ ticket, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [to, setTo] = useState(ticket.message_from || '');
  const [cc, setCc] = useState(ticket.message_cc || '');
  const [tresc, setTresc] = useState('');
  const [zamknij, setZamknij] = useState(false);
  const [closeNotify, setCloseNotify] = useState(true);
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [files, setFiles] = useState([]);

  const { data: templates } = useQuery({
    queryKey: ['szablony'],
    queryFn: () => api.get('/szablony').then(r => r.data.data),
  });

  const applyTemplate = (e) => {
    const id = e.target.value;
    e.target.value = '';
    if (!id) return;
    const tpl = templates?.find(s => String(s.id) === id);
    if (!tpl) return;
    if (tresc && !confirm(t('ticket_view.reply_template_confirm_replace'))) return;
    setTresc(tpl.tresc);
  };

  const addFiles = (newFiles) => setFiles(prev => [...prev, ...Array.from(newFiles)]);
  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const send = async () => {
    if (!to || !tresc) return toast.error(t('ticket_view.reply_error_fields'));
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('to', to);
      formData.append('cc', cc);
      formData.append('tresc', tresc);
      formData.append('html', `<p>${tresc.replace(/\n/g, '<br/>')}</p>`);
      formData.append('zamknij', zamknij ? '1' : '0');
      formData.append('close_notify', zamknij && closeNotify ? '1' : '0');
      files.forEach(f => formData.append('files', f));

      const { data: resp } = await api.post(`/tickets/${ticket.id}/odpowiedz`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (resp.mailError) {
        toast.error(t('ticket_view.toast_reply_mail_error', { error: resp.mailError }), { duration: 8000 });
      } else {
        toast.success(zamknij ? t('ticket_view.toast_reply_sent_closed') : t('ticket_view.toast_reply_sent'));
      }
      if (resp.statusChanged) {
        const statusName = resp.newStatus === 2 ? t('ticket_view.status_inprogress') : resp.newStatus === 3 ? t('ticket_view.status_closed') : t('ticket_view.status_new');
        toast.success(t('ticket_view.toast_status_changed_to', { status: statusName }));
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setSending(false);
    }
  };

  const suggestAi = async () => {
    setAiLoading(true);
    try {
      const { data } = await api.post(`/tickets/${ticket.id}/ai-reply`);
      setTresc(data.suggestion);
      toast.success(t('ticket_view.toast_ai_suggestion'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('ticket_view.toast_ai_error'));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl border dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold">{t('ticket_view.reply_title', { numer: ticket.numer })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl">×</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="label">{t('ticket_view.reply_to')}</label>
            <input value={to} onChange={e => setTo(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">CC</label>
            <input value={cc} onChange={e => setCc(e.target.value)} className="input" placeholder={t('common.optional', 'opcjonalnie')} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">{t('ticket_view.reply_content')}</label>
              <div className="flex items-center gap-3">
                {templates?.length > 0 && (
                  <select
                    onChange={applyTemplate}
                    defaultValue=""
                    title={t('ticket_view.reply_template_label')}
                    className="text-xs border rounded px-1 py-0.5 dark:bg-gray-800 dark:border-gray-700"
                  >
                    <option value="">{`📋 ${t('ticket_view.reply_template_label')}`}</option>
                    {templates.map(tpl => (
                      <option key={tpl.id} value={tpl.id}>{tpl.nazwa}</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={suggestAi}
                  disabled={aiLoading}
                  className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200 flex items-center gap-1 disabled:opacity-50"
                  title={t('ticket_view.reply_ai_suggest')}
                >
                  {aiLoading ? `⏳ ${t('ticket_view.reply_ai_loading')}` : `🤖 ${t('ticket_view.reply_ai_suggest')}`}
                </button>
              </div>
            </div>
            <textarea
              value={tresc}
              onChange={e => setTresc(e.target.value)}
              rows={10}
              className="input resize-y"
              placeholder={t('ticket_view.reply_placeholder')}
            />
            {tresc && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{t('ticket_view.reply_ai_disclaimer')}</p>}
          </div>
          <div>
            <label className="label">{t('ticket_view.reply_attachments')}</label>
            <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 hover:border-blue-400 transition-colors text-sm text-gray-600 dark:text-gray-400">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span>{t('ticket_view.reply_add_files')}</span>
              <input type="file" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, idx) => (
                  <li key={idx} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800 rounded px-3 py-1.5">
                    <span className="truncate max-w-[380px]">{f.name} <span className="text-gray-400">({(f.size / 1024).toFixed(0)} KB)</span></span>
                    <button onClick={() => removeFile(idx)} className="ml-2 text-red-400 hover:text-red-600 font-bold leading-none flex-shrink-0">×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={zamknij}
                onChange={e => { setZamknij(e.target.checked); if (!e.target.checked) setCloseNotify(true); }}
                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('ticket_view.reply_close_after')}</span>
            </label>
            {zamknij && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={closeNotify}
                  onChange={e => setCloseNotify(e.target.checked)}
                  className="w-3.5 h-3.5 border-gray-300 text-blue-600"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('ticket_view.reply_close_notify')}</span>
              </label>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
            <button onClick={send} disabled={sending} className={zamknij ? 'btn-success' : 'btn-primary'}>
              {sending ? t('ticket_view.reply_sending') : zamknij ? t('ticket_view.reply_send_close') : t('ticket_view.reply_send')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrzydielModal({ ticketId, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('worker');
  const [userId, setUserId] = useState('');
  const [zespolId, setZespolId] = useState('');
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data.data),
  });
  const { data: zespoly } = useQuery({
    queryKey: ['zespoly'],
    queryFn: () => api.get('/zespoly').then(r => r.data.data),
  });

  const assign = async () => {
    if (tab === 'worker') {
      if (!userId) return toast.error(t('ticket_view.assign_error'));
      try {
        await api.post(`/tickets/${ticketId}/przydziel`, { user_id: userId });
        toast.success(t('ticket_view.assign'));
        onSuccess();
        onClose();
      } catch (err) {
        toast.error(err.response?.data?.error || t('common.error'));
      }
    } else {
      if (!zespolId) return toast.error(t('ticket_view.assign_team_error'));
      try {
        await api.post(`/tickets/${ticketId}/przydziel-zespol`, { zespol_id: zespolId });
        toast.success(t('ticket_view.toast_team_assigned'));
        onSuccess();
        onClose();
      } catch (err) {
        toast.error(err.response?.data?.error || t('common.error'));
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-sm border dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold">{t('ticket_view.assign_title')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl">×</button>
        </div>
        <div className="flex border-b dark:border-gray-800">
          <button
            onClick={() => setTab('worker')}
            className={`flex-1 px-3 py-2 text-sm ${tab === 'worker' ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-gray-500'}`}
          >
            {t('ticket_view.assign_tab_worker')}
          </button>
          <button
            onClick={() => setTab('team')}
            className={`flex-1 px-3 py-2 text-sm ${tab === 'team' ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-gray-500'}`}
          >
            {t('ticket_view.assign_tab_team')}
          </button>
        </div>
        <div className="p-4">
          {tab === 'worker' ? (
            <>
              <label className="label">{t('ticket_view.assign_worker')}</label>
              <select value={userId} onChange={e => setUserId(e.target.value)} className="input">
                <option value="">{t('ticket_view.assign_choose')}</option>
                {users?.filter(u => ['admin', 'pracownik'].includes(u.rola)).map(u => (
                  <option key={u.id} value={u.id}>{u.imie} {u.nazwisko} ({u.email})</option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label className="label">{t('ticket_view.assign_team_label')}</label>
              <select value={zespolId} onChange={e => setZespolId(e.target.value)} className="input">
                <option value="">{t('ticket_view.assign_team_choose')}</option>
                {zespoly?.map(z => (
                  <option key={z.id} value={z.id}>{z.nazwa}</option>
                ))}
              </select>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t">
          <button onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
          <button onClick={assign} className="btn-primary">{t('ticket_view.assign')}</button>
        </div>
      </div>
    </div>
  );
}

function PrzekazModal({ ticket, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [emailDo, setEmailDo] = useState('');
  const [wiadomosc, setWiadomosc] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!emailDo) return toast.error(t('ticket_view.forward_error'));
    setSending(true);
    try {
      const { data } = await api.post(`/tickets/${ticket.id}/przekaz`, {
        email_do: emailDo,
        wiadomosc: wiadomosc || null,
      });
      if (data.mailError) {
        toast.error(`${t('common.error')}: ${data.mailError}`, { duration: 8000 });
      } else {
        toast.success(t('ticket_view.toast_forwarded', { email: emailDo }));
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg border dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
          <h3 className="font-semibold">{t('ticket_view.forward_title', { numer: ticket.numer })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="label">{t('ticket_view.forward_email_label')}</label>
            <input
              type="email"
              value={emailDo}
              onChange={e => setEmailDo(e.target.value)}
              className="input"
              placeholder="odbiorca@example.com"
              autoFocus
            />
          </div>
          <div>
            <label className="label">
              {t('ticket_view.forward_msg_label')} <span className="text-gray-400 font-normal">{t('ticket_view.forward_optional')}</span>
            </label>
            <textarea
              value={wiadomosc}
              onChange={e => setWiadomosc(e.target.value)}
              rows={4}
              className="input resize-y"
              placeholder={t('ticket_view.forward_msg_placeholder')}
            />
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded p-3 text-xs text-amber-800 dark:text-amber-300">
            {t('ticket_view.forward_info')}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
          <button onClick={send} disabled={sending || !emailDo} className="btn-primary">
            {sending ? t('ticket_view.forward_sending') : `📤 ${t('ticket_view.forward_btn')}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScalModal({ ticket, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [targetNumer, setTargetNumer] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!targetNumer.trim()) return toast.error(t('ticket_view.merge_error'));
    setSending(true);
    try {
      const { data } = await api.post(`/tickets/${ticket.id}/merge`, { targetNumer: targetNumer.trim() });
      toast.success(t('ticket_view.toast_merged', { numer: data.targetNumer }));
      onSuccess(data.targetId);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-sm border dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
          <h3 className="font-semibold">{t('ticket_view.merge_title', { numer: ticket.numer })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="label">{t('ticket_view.merge_target_label')}</label>
            <input
              value={targetNumer}
              onChange={e => setTargetNumer(e.target.value)}
              className="input"
              placeholder={t('ticket_view.merge_target_placeholder')}
              autoFocus
            />
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded p-3 text-xs text-amber-800 dark:text-amber-300">
            {t('ticket_view.merge_info')}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
          <button onClick={send} disabled={sending || !targetNumer.trim()} className="btn-primary">
            {sending ? t('ticket_view.merge_sending') : t('ticket_view.merge_btn')}
          </button>
        </div>
      </div>
    </div>
  );
}

function OdlozModal({ ticketId, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [date, setDate] = useState('');

  const save = async () => {
    if (!date) return toast.error(t('ticket_view.defer_error'));
    const ts = Math.floor(new Date(date).getTime() / 1000);
    try {
      await api.post(`/tickets/${ticketId}/odloz`, { data: ts });
      toast.success(t('ticket_view.toast_deferred'));
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-sm border dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold">{t('ticket_view.defer_title')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl">×</button>
        </div>
        <div className="p-4">
          <label className="label">{t('ticket_view.defer_date')}</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" />
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t">
          <button onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
          <button onClick={save} className="btn-warning">{t('ticket_view.defer_btn')}</button>
        </div>
      </div>
    </div>
  );
}

function NotatkaForm({ ticketId, onSuccess }) {
  const { t } = useTranslation();
  const [tresc, setTresc] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!tresc.trim()) return;
    setSaving(true);
    try {
      await api.post('/notatki', { ticket_id: ticketId, tresc });
      setTresc('');
      onSuccess();
      toast.success(t('ticket_view.toast_note_added'));
    } catch {
      toast.error(t('ticket_view.toast_note_error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2">
      <textarea
        value={tresc}
        onChange={e => setTresc(e.target.value)}
        rows={3}
        className="input resize-y"
        placeholder={t('ticket_view.note_placeholder')}
      />
      <button onClick={save} disabled={saving} className="btn-secondary btn-sm mt-1">
        {saving ? t('ticket_view.note_saving') : t('ticket_view.note_btn')}
      </button>
    </div>
  );
}

export default function TicketView() {
  const { t } = useTranslation();
  const locale = useDateLocale();
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin } = useAuth();

  const [modal, setModal] = useState(null);

  const formatDate = (ts) => {
    if (!ts) return '—';
    return format(new Date(ts * 1000), 'dd.MM.yyyy HH:mm', { locale });
  };

  const STATUS_LABELS = {
    1: t('ticket_view.status_new'),
    2: t('ticket_view.status_inprogress'),
    3: t('ticket_view.status_closed'),
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.get(`/tickets/${id}`).then(r => r.data),
  });

  const { data: ldapCardConfig } = useQuery({
    queryKey: ['ldap-card-config'],
    queryFn: () => api.get('/ustawienia/ldap-card-config').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closeNotify, setCloseNotify] = useState(true);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const statusPickerRef = useRef(null);
  useEffect(() => {
    if (!showStatusPicker) return;
    const handler = (e) => { if (statusPickerRef.current && !statusPickerRef.current.contains(e.target)) setShowStatusPicker(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStatusPicker]);

  const changeStatus = useMutation({
    mutationFn: (status) => api.post(`/tickets/${id}/status`, { status }),
    onSuccess: () => { toast.success(t('ticket_view.toast_status_changed')); setShowStatusPicker(false); qc.invalidateQueries(['ticket', id]); qc.invalidateQueries(['tickets']); },
    onError: (err) => toast.error(err.response?.data?.error || t('common.error')),
  });

  const zamknij = useMutation({
    mutationFn: (sendNotification) => api.post(`/tickets/${id}/zamknij`, { send_notification: sendNotification }),
    onSuccess: () => { toast.success(t('ticket_view.toast_closed')); setShowCloseConfirm(false); qc.invalidateQueries(['ticket', id]); qc.invalidateQueries(['tickets']); },
    onError: (err) => toast.error(err.response?.data?.error || t('common.error')),
  });

  const otworz = useMutation({
    mutationFn: () => api.post(`/tickets/${id}/otworz`),
    onSuccess: () => { toast.success(t('ticket_view.toast_reopened')); qc.invalidateQueries(['ticket', id]); qc.invalidateQueries(['tickets']); },
    onError: (err) => toast.error(err.response?.data?.error || t('common.error')),
  });

  const przywroc = useMutation({
    mutationFn: () => api.post(`/tickets/${id}/przywroc`),
    onSuccess: () => { toast.success(t('ticket_view.toast_restored')); qc.invalidateQueries(['ticket', id]); },
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
    onSuccess: () => { toast.success(t('ticket_view.toast_deleted')); navigate('/tickets'); },
    onError: (err) => toast.error(err.response?.data?.error || t('common.error')),
  });

  if (isLoading) return <div className="text-center py-12 text-gray-500 dark:text-gray-400">{t('common.loading')}</div>;
  if (error) return <div className="text-center py-12 text-red-500">{t('ticket_view.error_loading')}</div>;

  const { ticket, korespondencja, notatki, pliki, przypisania, zespoly } = data;
  const isOpen = ticket.status !== 3;

  return (
    <div>
      {/* Breadcrumb + akcje */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/tickets" className="text-blue-600 hover:underline">{t('nav.tickets')}</Link>
          <span>›</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">#{ticket.numer}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <NavButtons id={id} navigate={navigate} t={t} />

          <button onClick={() => setModal('odpowiedz')} className="btn-primary">
            {t('ticket_view.reply')}
          </button>
          <button onClick={() => setModal('przekaz')} className="btn-secondary">
            📤 {t('ticket_view.forward_btn')}
          </button>
          <button onClick={() => setModal('przydziel')} className="btn-secondary">
            {t('ticket_view.assign')}
          </button>
          {!ticket.merged_into_id && (
            <button onClick={() => setModal('scal')} className="btn-secondary">
              {t('ticket_view.merge_btn')}
            </button>
          )}
          {ticket.odlozony ? (
            <button onClick={() => przywroc.mutate()} className="btn-warning">
              {t('ticket_view.restore')}
            </button>
          ) : (
            <button onClick={() => setModal('odloz')} className="btn-warning">
              {t('ticket_view.defer')}
            </button>
          )}
          {isOpen ? (
            showCloseConfirm ? (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5">
                <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={closeNotify}
                    onChange={e => setCloseNotify(e.target.checked)}
                    className="w-3.5 h-3.5"
                  />
                  {t('ticket_view.send_email_to_requester')}
                </label>
                <button
                  onClick={() => zamknij.mutate(closeNotify)}
                  disabled={zamknij.isPending}
                  className="btn-danger btn-sm"
                >
                  {zamknij.isPending ? '...' : t('ticket_view.close')}
                </button>
                <button onClick={() => setShowCloseConfirm(false)} className="btn-secondary btn-sm">{t('common.cancel')}</button>
              </div>
            ) : (
              <button onClick={() => setShowCloseConfirm(true)} className="btn-danger">
                {t('ticket_view.close')}
              </button>
            )
          ) : (
            <>
              <button onClick={() => otworz.mutate()} className="btn-success">
                {t('ticket_view.reopen')}
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    if (confirm(t('ticket_view.confirm_delete', { numer: ticket.numer }))) {
                      usunTicket.mutate();
                    }
                  }}
                  disabled={usunTicket.isPending}
                  className="btn-danger btn-sm"
                  title={t('ticket_view.confirm_delete', { numer: ticket.numer })}
                >
                  {usunTicket.isPending ? '...' : `🗑️ ${t('common.delete')}`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {ticket.merged_into_id && (
        <div className="mb-4 flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg px-4 py-3 text-sm">
          <span>🔗</span>
          <span className="text-blue-800 dark:text-blue-300">
            {t('ticket_view.merged_into_banner')}{' '}
            <Link to={`/tickets/${ticket.merged_into_id}`} className="font-semibold underline hover:no-underline">
              #{ticket.merged_into_numer || ticket.merged_into_id}
            </Link>
          </span>
        </div>
      )}

      {ticket.merged_from?.length > 0 && (
        <div className="mb-4 flex items-start gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-sm">
          <span>🔗</span>
          <div className="text-gray-700 dark:text-gray-300">
            <span>{t('ticket_view.merged_from_banner')}</span>{' '}
            {ticket.merged_from.map((m, idx) => (
              <span key={m.id}>
                {idx > 0 && ', '}
                <Link to={`/tickets/${m.id}`} className="font-semibold text-blue-600 dark:text-blue-400 underline hover:no-underline">
                  #{m.numer}
                </Link>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Szczegóły ticketu */}
      <div className="card mb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{ticket.message_subject || t('common.no_subject')}</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="relative" ref={statusPickerRef}>
                <button
                  onClick={() => setShowStatusPicker(v => !v)}
                  className={`${STATUS_COLORS[ticket.status]} cursor-pointer hover:opacity-80 transition-opacity select-none`}
                  title={t('ticket_view.toast_status_changed')}
                >
                  {STATUS_LABELS[ticket.status]} ▾
                </button>
                {showStatusPicker && (
                  <div className="absolute left-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden min-w-[130px]">
                    {[1, 2, 3].map(s => (
                      <button
                        key={s}
                        disabled={s === ticket.status || changeStatus.isPending}
                        onClick={() => changeStatus.mutate(s)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          s === ticket.status
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-default'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
                        }`}
                      >
                        <span className={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {ticket.odlozony && (
                <span className="badge-yellow">{t('ticket_view.deferred_until', { date: formatDate(ticket.odlozony_data) })}</span>
              )}
            </div>
          </div>
          <span className="text-sm text-gray-400 dark:text-gray-500">#{ticket.numer}</span>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
          <div><dt className="label">{t('ticket_view.field_from')}</dt><dd className="text-gray-700 dark:text-gray-200">{ticket.message_from}</dd></div>
          <div><dt className="label">{t('ticket_view.field_to')}</dt><dd className="text-gray-700 dark:text-gray-200">{ticket.message_to}</dd></div>
          <div><dt className="label">{t('ticket_view.field_priority')}</dt><dd className="text-gray-700 dark:text-gray-200">{PRIORITY_LABELS[ticket.priority] || 'P2'}</dd></div>
          <div>
            <dt className="label">{t('ticket_view.field_sla_status')}</dt>
            <dd className="text-gray-700 dark:text-gray-200">
              <SLABadge status={ticket.sla_status} secondsLeft={ticket.sla_seconds_left} />
            </dd>
          </div>
          <div><dt className="label">{t('ticket_view.field_sla_response')}</dt><dd className="text-gray-700 dark:text-gray-200">{formatDate(ticket.sla_response_deadline)}</dd></div>
          <div><dt className="label">{t('ticket_view.field_sla_resolution')}</dt><dd className="text-gray-700 dark:text-gray-200">{formatDate(ticket.sla_resolution_deadline)}</dd></div>
          <div><dt className="label">{t('ticket_view.field_first_response')}</dt><dd className="text-gray-700 dark:text-gray-200">{formatDate(ticket.first_response_at)}</dd></div>
          <div>
            <dt className="label">{t('ticket_view.field_ai_tag')}</dt>
            <dd className="flex items-center gap-2">
              <AITagBadge tag={ticket.ai_tag} reason={ticket.ai_reason} />
              {ticket.ai_reason && <span className="text-xs text-gray-500 dark:text-gray-400">{ticket.ai_reason}</span>}
              <button
                onClick={() => api.post(`/tickets/${ticket.id}/classify`).then(() => { toast.success(t('ticket_view.toast_reclassify_success')); qc.invalidateQueries(['ticket', ticket.id]); }).catch(() => toast.error(t('ticket_view.toast_reclassify_error')))}
                className="text-xs text-blue-600 dark:text-blue-300 hover:underline ml-1"
              >
                {t('ticket_view.reclassify')}
              </button>
            </dd>
          </div>
          {ticket.message_cc && <div><dt className="label">CC</dt><dd className="text-gray-700 dark:text-gray-200">{ticket.message_cc}</dd></div>}
          <div><dt className="label">{t('ticket_view.field_date')}</dt><dd className="text-gray-700 dark:text-gray-200">{formatDate(ticket.data_utworzenia)}</dd></div>
          {ticket.data_otwarcia && <div><dt className="label">{t('ticket_view.field_opened')}</dt><dd className="text-gray-700 dark:text-gray-200">{formatDate(ticket.data_otwarcia)}</dd></div>}
          {ticket.data_zamkniecia && <div><dt className="label">{t('ticket_view.field_closed_at')}</dt><dd className="text-gray-700 dark:text-gray-200">{formatDate(ticket.data_zamkniecia)}</dd></div>}
          {przypisania?.length > 0 && (
            <div className="col-span-2">
              <dt className="label">{t('ticket_view.field_assigned')}</dt>
              <dd className="flex flex-wrap gap-2">
                {przypisania.map(p => (
                  <span key={p.id} className="flex items-center gap-1 badge-blue">
                    {p.imie} {p.nazwisko}
                    {isAdmin && (
                      <button
                        onClick={() => usunPrzydzial.mutate(p.user_id)}
                        className="text-blue-400 hover:text-red-500 ml-1"
                        title={t('ticket_view.toast_unassigned')}
                      >×</button>
                    )}
                  </span>
                ))}
              </dd>
            </div>
          )}
          {zespoly?.length > 0 && (
            <div className="col-span-2">
              <dt className="label">{t('ticket_view.field_assigned_teams')}</dt>
              <dd className="flex flex-wrap gap-2">
                {zespoly.map(z => (
                  <span key={z.id} className="flex items-center gap-1 badge-yellow" title={t('ticket_view.team_ticket_badge')}>
                    👨‍👩‍👧 {z.nazwa}
                    {isAdmin && (
                      <button
                        onClick={() => usunPrzydzialZespol.mutate(z.zespol_id)}
                        className="text-yellow-600 hover:text-red-500 ml-1"
                        title={t('ticket_view.toast_team_unassigned')}
                      >×</button>
                    )}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>

        <LdapPanel ticket={ticket} onRefresh={() => qc.invalidateQueries(['ticket', id])} ldapCardConfig={ldapCardConfig} />

        {isAdmin && detectSensitiveData(ticket.tresc) && (
          <SensitiveDataWarning ticketId={ticket.id} onRedacted={() => qc.invalidateQueries(['ticket', id])} />
        )}

        {ticket.html ? (
          <div className="border rounded dark:border-gray-700 overflow-hidden">
            <iframe
              srcDoc={wrapEmailHtml(ticket.html)}
              className="w-full min-h-[200px] bg-white"
              style={{ height: '300px' }}
              sandbox="allow-same-origin"
              title={t('ticket_view.corr_iframe_title')}
            />
          </div>
        ) : ticket.tresc ? (
          <pre className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded p-3 text-sm whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-100">{ticket.tresc}</pre>
        ) : null}

        {pliki?.length > 0 && (
          <div className="mt-3">
            <p className="label">{t('ticket_view.attachments')}</p>
            <div className="flex flex-wrap gap-2">
              {pliki.map(p => (
                <a
                  key={p.id}
                  href={`${import.meta.env.VITE_API_URL?.replace('/api', '')}/pliki/${p.filepath}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary btn-sm"
                >
                  📎 {p.originalname || p.filepath.split('/').pop()}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <AutorTokenPanel ticket={ticket} onRefresh={() => qc.invalidateQueries(['ticket', id])} />

      {korespondencja?.length > 0 && (
        <div className="card mb-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold">{t('ticket_view.correspondence_title', { count: korespondencja.length })}</h3>
            {korespondencja.filter(k => !k.przeczytane).length > 0 && (
              <span className="inline-flex items-center justify-center text-xs font-bold bg-blue-500 text-white rounded-full min-w-[20px] h-5 px-1.5">
                {korespondencja.filter(k => !k.przeczytane).length}
              </span>
            )}
          </div>
          <div className="space-y-4">
            {korespondencja.map(k => (
              <KorespondencjaItem
                key={k.id}
                k={k}
                isAdmin={isAdmin}
                onRead={() => qc.invalidateQueries(['ticket', id])}
                onRefresh={() => qc.invalidateQueries(['ticket', id])}
              />
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="font-semibold mb-3">{t('ticket_view.notes_title', { count: notatki?.length || 0 })}</h3>
        {notatki?.map(n => (
          <div key={n.id} className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3 mb-2 text-sm">
            <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{n.tresc}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatDate(n.data)}</p>
          </div>
        ))}
        <NotatkaForm ticketId={id} onSuccess={refetch} />
      </div>

      {modal === 'odpowiedz' && (
        <OdpowiedzModal ticket={ticket} onClose={() => setModal(null)} onSuccess={() => { qc.invalidateQueries(['ticket', id]); }} />
      )}
      {modal === 'przydziel' && (
        <PrzydielModal ticketId={id} onClose={() => setModal(null)} onSuccess={() => { qc.invalidateQueries(['ticket', id]); qc.invalidateQueries(['tickets']); }} />
      )}
      {modal === 'odloz' && (
        <OdlozModal ticketId={id} onClose={() => setModal(null)} onSuccess={() => { qc.invalidateQueries(['ticket', id]); }} />
      )}
      {modal === 'przekaz' && (
        <PrzekazModal ticket={ticket} onClose={() => setModal(null)} onSuccess={() => { qc.invalidateQueries(['ticket', id]); }} />
      )}
      {modal === 'scal' && (
        <ScalModal
          ticket={ticket}
          onClose={() => setModal(null)}
          onSuccess={(targetId) => { qc.invalidateQueries(['tickets']); navigate(`/tickets/${targetId}`); }}
        />
      )}
    </div>
  );
}

function KorespondencjaItem({ k, onRead, onRefresh, isAdmin }) {
  const { t } = useTranslation();
  const locale = useDateLocale();
  const [expanded, setExpanded] = useState(false);
  const [przeczytane, setPrzeczytane] = useState(!!k.przeczytane);
  const [redacting, setRedacting] = useState(false);

  const TYP_CONFIG = {
    forward: {
      icon: '📤',
      label: t('ticket_view.typ_forward'),
      headerBg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-700',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    },
    forward_reply: {
      icon: '↩️',
      label: t('ticket_view.typ_forward_reply'),
      headerBg: 'bg-purple-50 dark:bg-purple-900/20',
      border: 'border-purple-200 dark:border-purple-700',
      badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    },
    received: {
      icon: '📨',
      label: t('ticket_view.typ_received'),
      headerBg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-700',
      badge: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    },
    reply: {
      icon: '📧',
      label: null,
      headerBg: 'bg-gray-50 dark:bg-gray-800',
      border: 'border-gray-200 dark:border-gray-700',
      badge: null,
    },
    bounce: {
      icon: '⚠️',
      label: t('ticket_view.typ_bounce'),
      headerBg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-300 dark:border-red-700',
      badge: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    },
    merged: {
      icon: '🔗',
      label: t('ticket_view.typ_merged'),
      headerBg: 'bg-teal-50 dark:bg-teal-900/20',
      border: 'border-teal-200 dark:border-teal-700',
      badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
    },
  };

  const cfg = TYP_CONFIG[k.typ] || TYP_CONFIG.reply;
  const hasSensitive = detectSensitiveData(k.tresc);

  const handleToggle = async () => {
    const nowExpanded = !expanded;
    setExpanded(nowExpanded);
    if (nowExpanded && !przeczytane) {
      setPrzeczytane(true);
      try { await api.patch(`/korespondencja/${k.id}/przeczytane`); onRead?.(); } catch {}
    }
  };

  const handleRedact = async (e) => {
    e.stopPropagation();
    if (!confirm(t('ticket_view.confirm_redact'))) return;
    setRedacting(true);
    try {
      await api.post(`/korespondencja/${k.id}/redact`);
      toast.success(t('ticket_view.toast_korr_redacted'));
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setRedacting(false);
    }
  };

  return (
    <div className={`border ${cfg.border} rounded overflow-hidden`}>
      <div
        className={`flex items-center justify-between px-3 py-2 ${cfg.headerBg} cursor-pointer hover:brightness-95`}
        onClick={handleToggle}
      >
        <div className="text-sm flex items-center gap-2 min-w-0">
          {!przeczytane && (
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" title={t('ticket_view.unread_title')} />
          )}
          <span>{cfg.icon}</span>
          {cfg.badge && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${cfg.badge}`}>
              {cfg.label}
            </span>
          )}
          <span className={`truncate ${!przeczytane ? 'font-bold text-gray-900 dark:text-gray-100' : 'font-medium'}`}>
            {k.message_from || `${k.imie} ${k.nazwisko}`}
          </span>
          {k.message_to && (
            <span className="text-gray-500 dark:text-gray-400 truncate">→ {k.message_to}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {k.data ? format(new Date(k.data * 1000), 'dd.MM.yyyy HH:mm', { locale }) : ''}
          </span>
          <span className="text-gray-400 dark:text-gray-500">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {k.mail_error && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-700 text-xs text-red-700 dark:text-red-300">
          <span className="flex-shrink-0 font-bold">✗ {t('ticket_view.delivery_error')}</span>
          <span>{k.mail_error}</span>
        </div>
      )}
      {expanded && (
        <div className="p-3">
          {isAdmin && hasSensitive && (
            <div className="mb-2 flex items-center gap-2 bg-amber-50 border border-amber-300 rounded px-3 py-2 text-xs">
              <span>⚠️</span>
              <span className="text-amber-800 font-medium flex-1">{t('ticket_view.korr_sensitive_title')}</span>
              <button
                onClick={handleRedact}
                disabled={redacting}
                className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium disabled:opacity-50"
              >
                {redacting ? t('ticket_view.redacting') : `🗑️ ${t('ticket_view.korr_redact')}`}
              </button>
            </div>
          )}
          {k.html ? (
            <iframe
              srcDoc={wrapEmailHtml(k.html)}
              className="w-full bg-white"
              style={{ height: '250px' }}
              sandbox="allow-same-origin"
              title={t('ticket_view.corr_iframe_title')}
            />
          ) : (
            <pre className="text-sm whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-200">{k.tresc}</pre>
          )}
          {k.pliki?.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('ticket_view.korr_attachments', { count: k.pliki.length })}</p>
              <div className="flex flex-wrap gap-2">
                {k.pliki.map(p => (
                  <a
                    key={p.id}
                    href={`${import.meta.env.VITE_API_URL?.replace('/api', '')}/pliki/${p.filepath}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded px-2 py-1"
                  >
                    📎 {p.originalname || p.filepath.split('/').pop()}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NavButtons({ id, navigate, t }) {
  const prevQ = useQuery({
    queryKey: ['ticket-prev', id],
    queryFn: () => api.get(`/tickets/${id}/prev`).then(r => r.data),
  });
  const nextQ = useQuery({
    queryKey: ['ticket-next', id],
    queryFn: () => api.get(`/tickets/${id}/next`).then(r => r.data),
  });

  return (
    <>
      <button
        onClick={() => prevQ.data?.id && navigate(`/tickets/${prevQ.data.id}`)}
        disabled={!prevQ.data?.id}
        className="btn-secondary btn-sm"
        title={t('ticket_view.prev_title')}
      >{t('ticket_view.prev')}</button>
      <button
        onClick={() => nextQ.data?.id && navigate(`/tickets/${nextQ.data.id}`)}
        disabled={!nextQ.data?.id}
        className="btn-secondary btn-sm"
        title={t('ticket_view.next_title')}
      >{t('ticket_view.next')}</button>
    </>
  );
}
