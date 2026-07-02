import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import toast from 'react-hot-toast';

// Etykieta po lewej / pole po prawej na desktopie (sm i szersze), pod spodem na komórce.
function Field({ label, hint, children }) {
  return (
    <div className="sm:grid sm:grid-cols-[180px_1fr] sm:items-start gap-1 sm:gap-4">
      <label className="label sm:pt-2">{label}</label>
      <div>
        {children}
        {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      </div>
    </div>
  );
}

function ChannelModal({ channel, zespoly, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    nazwa: channel?.nazwa || '',
    zespol_id: channel?.zespol_id || '',
    typ: channel?.typ || 'chat',
    dozwolone_domeny: channel?.dozwolone_domeny || '',
    powitanie: channel?.powitanie || '',
    notification_email: channel?.notification_email || '',
    imap_server: channel?.imap_server || '',
    imap_port: channel?.imap_port || '',
    imap_login: channel?.imap_login || '',
    imap_password: '',
    imap_path: channel?.imap_path || '',
    imap_delete_after_fetch: !!channel?.imap_delete_after_fetch,
    imap_fetch_seen: !!channel?.imap_fetch_seen,
    auto_close_ticket: !!channel?.auto_close_ticket,
    ms_graph_enabled: !!channel?.ms_graph_enabled,
    ms_graph_mailbox: channel?.ms_graph_mailbox || '',
  });

  const isEdit = !!channel;

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const testImap = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post('/kanaly-czatu/imap-test', {
        id: channel?.id,
        imap_server: form.imap_server,
        imap_port: form.imap_port,
        imap_login: form.imap_login,
        imap_password: form.imap_password,
        imap_path: form.imap_path,
      });
      setTestResult({ ok: true, msg: data.message });
    } catch (err) {
      setTestResult({ ok: false, msg: err.response?.data?.error || t('chat_channels.error_test') });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    if (!form.nazwa.trim()) return toast.error(t('chat_channels.error_no_name'));
    if (!form.zespol_id) return toast.error(t('chat_channels.error_no_team'));
    try {
      if (isEdit) {
        await api.put(`/kanaly-czatu/${channel.id}`, form);
        toast.success(t('chat_channels.saved'));
      } else {
        await api.post('/kanaly-czatu', form);
        toast.success(t('chat_channels.created'));
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || t('chat_channels.error_save'));
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col dark:bg-gray-800">
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700 shrink-0">
          <h3 className="font-semibold dark:text-gray-100">{isEdit ? t('chat_channels.modal_edit_title') : t('chat_channels.modal_new_title')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <Field label={t('chat_channels.field_name')}>
            <input value={form.nazwa} onChange={set('nazwa')} className="input" />
          </Field>
          <Field label={t('chat_channels.field_team')}>
            <select value={form.zespol_id} onChange={set('zespol_id')} className="input">
              <option value="">{t('chat_channels.field_team_choose')}</option>
              {zespoly?.map((z) => (
                <option key={z.id} value={z.id}>{z.nazwa}</option>
              ))}
            </select>
          </Field>
          <Field label={t('chat_channels.field_type')}>
            <select value={form.typ} onChange={set('typ')} className="input">
              <option value="chat">{t('chat_channels.field_type_chat')}</option>
              <option value="email">{t('chat_channels.field_type_email')}</option>
            </select>
          </Field>
          <Field label={t('chat_channels.field_notification_email')} hint={t('chat_channels.field_notification_email_hint')}>
            <input
              type="email"
              value={form.notification_email}
              onChange={set('notification_email')}
              placeholder="zespol@example.com"
              className="input"
            />
          </Field>
          {form.typ === 'chat' ? (
            <>
              <Field label={t('chat_channels.field_domains')} hint={t('chat_channels.field_domains_hint')}>
                <textarea
                  value={form.dozwolone_domeny}
                  onChange={set('dozwolone_domeny')}
                  rows={3}
                  placeholder={t('chat_channels.field_domains_placeholder')}
                  className="input resize-y"
                />
              </Field>
              <Field label={t('chat_channels.field_welcome')}>
                <input value={form.powitanie} onChange={set('powitanie')} className="input" />
              </Field>
            </>
          ) : (
            <>
              <Field label={t('chat_channels.field_connection')}>
                <select
                  value={form.ms_graph_enabled ? 'graph' : 'imap'}
                  onChange={(e) => setForm((f) => ({ ...f, ms_graph_enabled: e.target.value === 'graph' }))}
                  className="input"
                >
                  <option value="imap">{t('chat_channels.field_connection_imap')}</option>
                  <option value="graph">{t('chat_channels.field_connection_graph')}</option>
                </select>
              </Field>
              {form.ms_graph_enabled ? (
                <Field label={t('chat_channels.field_ms_graph_mailbox')} hint={t('chat_channels.field_ms_graph_mailbox_hint')}>
                  <input value={form.ms_graph_mailbox} onChange={set('ms_graph_mailbox')} className="input" placeholder="it@example.com" />
                </Field>
              ) : (
                <>
                  <Field label={t('chat_channels.field_imap_server')}>
                    <input value={form.imap_server} onChange={set('imap_server')} className="input" placeholder="imap.example.com" />
                  </Field>
                  <Field label={t('chat_channels.field_imap_port')}>
                    <input type="number" value={form.imap_port} onChange={set('imap_port')} className="input" placeholder="993" />
                  </Field>
                  <Field label={t('chat_channels.field_imap_login')}>
                    <input value={form.imap_login} onChange={set('imap_login')} className="input" />
                  </Field>
                  <Field label={t('chat_channels.field_imap_password')} hint={t('chat_channels.field_imap_password_hint')}>
                    <input type="password" autoComplete="new-password" value={form.imap_password} onChange={set('imap_password')} className="input" />
                  </Field>
                  <Field label={t('chat_channels.field_imap_path')}>
                    <input value={form.imap_path} onChange={set('imap_path')} className="input" placeholder="INBOX" />
                  </Field>
                  <Field label={t('chat_channels.field_imap_delete_after_fetch')}>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        id="imap_delete_after_fetch"
                        checked={form.imap_delete_after_fetch}
                        onChange={(e) => setForm((f) => ({ ...f, imap_delete_after_fetch: e.target.checked }))}
                        className="mt-0.5"
                      />
                      <label htmlFor="imap_delete_after_fetch" className="text-xs text-gray-400 cursor-pointer">
                        {t('chat_channels.field_imap_delete_after_fetch_hint')}
                      </label>
                    </div>
                  </Field>
                  <Field label={t('chat_channels.field_imap_fetch_seen')}>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        id="imap_fetch_seen"
                        checked={form.imap_fetch_seen}
                        onChange={(e) => setForm((f) => ({ ...f, imap_fetch_seen: e.target.checked }))}
                        className="mt-0.5"
                      />
                      <label
                        htmlFor="imap_fetch_seen"
                        className={`text-xs cursor-pointer ${form.imap_fetch_seen && !form.imap_delete_after_fetch ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}
                      >
                        {t('chat_channels.field_imap_fetch_seen_hint')}
                      </label>
                    </div>
                  </Field>
                  <Field label={t('chat_channels.field_auto_close_ticket')}>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        id="auto_close_ticket"
                        checked={form.auto_close_ticket}
                        onChange={(e) => setForm((f) => ({ ...f, auto_close_ticket: e.target.checked }))}
                        className="mt-0.5"
                      />
                      <label htmlFor="auto_close_ticket" className="text-xs text-gray-400 cursor-pointer">
                        {t('chat_channels.field_auto_close_ticket_hint')}
                      </label>
                    </div>
                  </Field>
                  <Field label="">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={testImap}
                        disabled={testing || !form.imap_server || !form.imap_login}
                        className="btn-secondary btn-sm"
                      >
                        {testing ? t('chat_channels.testing') : t('chat_channels.test_connection')}
                      </button>
                      {testResult && (
                        <span className={`text-sm ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                          {testResult.ok ? '✓' : '✕'} {testResult.msg}
                        </span>
                      )}
                    </div>
                  </Field>
                </>
              )}
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t dark:border-gray-700 shrink-0">
          <button onClick={onClose} className="btn-secondary">{t('chat_channels.cancel')}</button>
          <button onClick={save} className="btn-primary">{t('chat_channels.save')}</button>
        </div>
      </div>
    </div>
  );
}

function EmbedCodeModal({ channel, onClose }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState('bubble');

  const bubbleSnippet = `<script src="${window.location.origin}/widget.js" data-channel="${channel.channel_key}"></script>`;
  const iframeSnippet = `<iframe src="${window.location.origin}/chat/${channel.channel_key}" style="width:100%;height:600px;border:none;" title="Czat"></iframe>`;
  const snippet = mode === 'bubble' ? bubbleSnippet : iframeSnippet;

  const copy = () => {
    navigator.clipboard.writeText(snippet);
    toast.success(t('chat_channels.copied'));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg dark:bg-gray-800">
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
          <h3 className="font-semibold dark:text-gray-100">{t('chat_channels.embed_title')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="flex border-b dark:border-gray-700">
          <button
            onClick={() => setMode('bubble')}
            className={`flex-1 px-3 py-2 text-sm ${mode === 'bubble' ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-gray-500'}`}
          >
            {t('chat_channels.embed_mode_bubble')}
          </button>
          <button
            onClick={() => setMode('iframe')}
            className={`flex-1 px-3 py-2 text-sm ${mode === 'iframe' ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-gray-500'}`}
          >
            {t('chat_channels.embed_mode_iframe')}
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            {mode === 'bubble' ? t('chat_channels.embed_hint_bubble') : t('chat_channels.embed_hint_iframe')}
          </p>
          <textarea readOnly value={snippet} rows={3} className="input font-mono text-xs" onClick={(e) => e.target.select()} />
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary">{t('chat_channels.cancel')}</button>
          <button onClick={copy} className="btn-primary">{t('chat_channels.copy')}</button>
        </div>
      </div>
    </div>
  );
}

export default function KanalyCzatu() {
  const { t } = useTranslation();
  const [modal, setModal] = useState(null);
  const [embedModal, setEmbedModal] = useState(null);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['kanaly-czatu'],
    queryFn: () => api.get('/kanaly-czatu').then((r) => r.data.data),
  });

  const { data: zespoly } = useQuery({
    queryKey: ['zespoly'],
    queryFn: () => api.get('/zespoly').then((r) => r.data.data),
  });

  const channels = data || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter((c) => c.nazwa.toLowerCase().includes(q));
  }, [channels, search]);

  const remove = async (channel) => {
    if (!confirm(t('chat_channels.confirm_delete', { name: channel.nazwa }))) return;
    try {
      await api.delete(`/kanaly-czatu/${channel.id}`);
      toast.success(t('chat_channels.deleted'));
      qc.invalidateQueries(['kanaly-czatu']);
    } catch (err) {
      toast.error(err.response?.data?.error || t('chat_channels.error_save'));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{t('chat_channels.title')}</h2>
        <button onClick={() => setModal('new')} className="btn-primary">{t('chat_channels.add')}</button>
      </div>
      <div className="mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('chat_channels.search_placeholder')}
          className="input max-w-sm"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">{t('chat_channels.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">{t('chat_channels.empty')}</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b dark:bg-gray-800 dark:border-gray-700">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('chat_channels.col_name')}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('chat_channels.col_type')}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('chat_channels.col_team')}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('chat_channels.col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-800">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-3 py-2 font-medium">{c.nazwa}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                    {c.typ === 'email' ? `✉️ ${t('chat_channels.field_type_email')}` : `💬 ${t('chat_channels.field_type_chat')}`}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{c.zespol_nazwa || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {c.typ !== 'email' && (
                      <button onClick={() => setEmbedModal(c)} className="btn-secondary btn-sm mr-2">{t('chat_channels.embed_btn')}</button>
                    )}
                    <button onClick={() => setModal(c)} className="btn-secondary btn-sm mr-2">{t('chat_channels.edit')}</button>
                    <button onClick={() => remove(c)} className="btn-danger btn-sm">{t('chat_channels.delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ChannelModal
          channel={modal === 'new' ? null : modal}
          zespoly={zespoly}
          onClose={() => setModal(null)}
          onSuccess={() => qc.invalidateQueries(['kanaly-czatu'])}
        />
      )}
      {embedModal && <EmbedCodeModal channel={embedModal} onClose={() => setEmbedModal(null)} />}
    </div>
  );
}
