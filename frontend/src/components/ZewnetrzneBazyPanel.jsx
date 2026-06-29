import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import toast from 'react-hot-toast';

const EMPTY_SOURCE = {
  nazwa: '', silnik: 'mysql', host: '', port: '', baza: '',
  login: '', haslo: '', tabela: '', kolumna_email: '', mapowanie_pol: [], aktywna: true,
};

function FieldMappingEditor({ mapping, onChange, t }) {
  const update = (i, key, val) => onChange(mapping.map((m, idx) => (idx === i ? { ...m, [key]: val } : m)));
  const remove = (i) => onChange(mapping.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= mapping.length) return;
    const arr = [...mapping];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange(arr);
  };
  const add = () => onChange([...mapping, { column: '', label: '' }]);

  return (
    <div className="space-y-1.5">
      {mapping.length === 0 && (
        <p className="text-xs text-gray-400 italic py-1">{t('external_db.field_mapping_empty')}</p>
      )}
      {mapping.map((m, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={m.column}
            onChange={(e) => update(i, 'column', e.target.value)}
            className="input py-1 text-sm font-mono flex-1"
            placeholder={t('external_db.field_mapping_column')}
          />
          <input
            value={m.label}
            onChange={(e) => update(i, 'label', e.target.value)}
            className="input py-1 text-sm flex-1"
            placeholder={t('external_db.field_mapping_label')}
          />
          <button onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs px-1">↑</button>
          <button onClick={() => move(i, 1)} disabled={i === mapping.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs px-1">↓</button>
          <button onClick={() => remove(i)} className="text-xs text-red-500 hover:underline px-1">{t('external_db.delete')}</button>
        </div>
      ))}
      <button onClick={add} className="btn-secondary btn-sm w-full mt-1">{t('external_db.field_mapping_add')}</button>
    </div>
  );
}

function SourceModal({ source, onClose, onSuccess, t }) {
  const isNew = !source?.id;
  const [f, setF] = useState({ ...EMPTY_SOURCE, ...source, mapowanie_pol: source?.mapowanie_pol ? (() => { try { return JSON.parse(source.mapowanie_pol); } catch { return []; } })() : [] });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const ch = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const valid = f.nazwa.trim() && f.tabela.trim() && f.kolumna_email.trim();

  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, port: f.port ? parseInt(f.port, 10) : null };
      return isNew ? api.post('/zewnetrzne-bazy', body) : api.put(`/zewnetrzne-bazy/${source.id}`, body);
    },
    onSuccess: () => {
      toast.success(isNew ? t('external_db.created') : t('external_db.saved'));
      onSuccess();
    },
    onError: (err) => toast.error(err.response?.data?.error || t('external_db.error_save')),
  });

  const testConn = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const body = { ...f, port: f.port ? parseInt(f.port, 10) : null };
      const { data } = await api.post(`/zewnetrzne-bazy/${isNew ? 'new' : source.id}/test`, body);
      setTestResult({ ok: true, msg: data.message });
    } catch (err) {
      setTestResult({ ok: false, msg: err.response?.data?.error || t('external_db.test_fail') });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg border dark:border-gray-700 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b dark:border-gray-700">
          <h4 className="font-semibold text-sm">{isNew ? t('external_db.modal_new_title') : t('external_db.modal_edit_title')}</h4>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="label">{t('external_db.field_name')} <span className="text-red-500">*</span></label>
            <input value={f.nazwa} onChange={ch('nazwa')} className="input" placeholder="np. Dziekanat" />
          </div>

          <div>
            <label className="label">{t('external_db.field_engine')}</label>
            <select value={f.silnik} onChange={ch('silnik')} className="input">
              <option value="mysql">MySQL / MariaDB</option>
              <option value="firebird">Firebird</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('external_db.field_host')}</label>
              <input value={f.host} onChange={ch('host')} className="input" placeholder="127.0.0.1" />
            </div>
            <div>
              <label className="label">{t('external_db.field_port')}</label>
              <input type="number" value={f.port} onChange={ch('port')} className="input" placeholder={f.silnik === 'firebird' ? '3050' : '3306'} />
            </div>
          </div>

          <div>
            <label className="label">{f.silnik === 'firebird' ? t('external_db.field_database_firebird') : t('external_db.field_database_mysql')}</label>
            <input value={f.baza} onChange={ch('baza')} className="input font-mono text-sm" placeholder={f.silnik === 'firebird' ? '/dane/baza.fdb' : 'nazwa_bazy'} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('external_db.field_login')}</label>
              <input value={f.login} onChange={ch('login')} className="input" />
            </div>
            <div>
              <label className="label">{t('external_db.field_password')}</label>
              <input type="password" value={f.haslo} onChange={ch('haslo')} className="input" placeholder={t('external_db.field_password_hint')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('external_db.field_table')} <span className="text-red-500">*</span></label>
              <input value={f.tabela} onChange={ch('tabela')} className="input font-mono text-sm" />
            </div>
            <div>
              <label className="label">{t('external_db.field_email_column')} <span className="text-red-500">*</span></label>
              <input value={f.kolumna_email} onChange={ch('kolumna_email')} className="input font-mono text-sm" placeholder="email" />
            </div>
          </div>

          <div className="pt-2 border-t dark:border-gray-700">
            <label className="label mb-1.5">{t('external_db.field_mapping')}</label>
            <FieldMappingEditor mapping={f.mapowanie_pol} onChange={(m) => setF((p) => ({ ...p, mapowanie_pol: m }))} t={t} />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id="zb_aktywna" checked={!!f.aktywna} onChange={(e) => setF((p) => ({ ...p, aktywna: e.target.checked }))} />
            <label htmlFor="zb_aktywna" className="text-sm">{t('external_db.field_active')}</label>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button type="button" onClick={testConn} disabled={testing || !f.tabela.trim()} className="btn-secondary btn-sm">
              {testing ? t('external_db.testing') : t('external_db.test_connection')}
            </button>
            {testResult && (
              <span className={`text-sm ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.ok ? '✓' : '✕'} {testResult.msg}
              </span>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary btn-sm">{t('external_db.cancel')}</button>
          <button onClick={() => valid && save.mutate()} disabled={!valid || save.isPending} className="btn-primary btn-sm disabled:opacity-50">
            {t('external_db.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ZewnetrzneBazyPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null); // null=closed, {}=new, source=edit
  const [testingId, setTestingId] = useState(null);
  const [testResults, setTestResults] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ['zewnetrzne-bazy'],
    queryFn: () => api.get('/zewnetrzne-bazy').then((r) => r.data.data),
  });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/zewnetrzne-bazy/${id}`),
    onSuccess: () => {
      toast.success(t('external_db.deleted'));
      qc.invalidateQueries(['zewnetrzne-bazy']);
    },
    onError: (err) => toast.error(err.response?.data?.error || t('external_db.error_save')),
  });

  const testRow = async (source) => {
    setTestingId(source.id);
    setTestResults((r) => ({ ...r, [source.id]: null }));
    try {
      const { data } = await api.post(`/zewnetrzne-bazy/${source.id}/test`, {});
      setTestResults((r) => ({ ...r, [source.id]: { ok: true, msg: data.message } }));
    } catch (err) {
      setTestResults((r) => ({ ...r, [source.id]: { ok: false, msg: err.response?.data?.error || t('external_db.test_fail') } }));
    } finally {
      setTestingId(null);
    }
  };

  const rows = data || [];

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{t('external_db.title')}</h3>
        <button onClick={() => setEditing({})} className="btn-primary btn-sm">{t('external_db.add')}</button>
      </div>
      <p className="text-xs text-gray-500 mb-4">{t('external_db.description')}</p>

      {isLoading ? (
        <p className="text-sm text-gray-400">{t('external_db.loading')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">{t('external_db.col_name')}</th>
                <th className="pb-2 font-medium hidden sm:table-cell">{t('external_db.col_engine')}</th>
                <th className="pb-2 font-medium hidden md:table-cell">{t('external_db.col_host')}</th>
                <th className="pb-2 font-medium hidden md:table-cell">{t('external_db.col_table')}</th>
                <th className="pb-2 font-medium text-center w-20">{t('external_db.col_active')}</th>
                <th className="pb-2 w-48"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-gray-400">{t('external_db.empty')}</td></tr>
              )}
              {rows.map((s) => (
                <tr key={s.id} className={!s.aktywna ? 'opacity-50' : ''}>
                  <td className="py-2 pr-2 font-medium">{s.nazwa}</td>
                  <td className="py-2 pr-2 hidden sm:table-cell">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      {s.silnik === 'firebird' ? 'Firebird' : 'MySQL/MariaDB'}
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-gray-500 hidden md:table-cell">{s.host || '—'}</td>
                  <td className="py-2 pr-2 text-gray-500 font-mono text-xs hidden md:table-cell">{s.tabela}</td>
                  <td className="py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.aktywna ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.aktywna ? t('external_db.active_yes') : t('external_db.active_no')}
                    </span>
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-1 justify-end flex-wrap">
                      {testResults[s.id] && (
                        <span className={`text-xs ${testResults[s.id].ok ? 'text-green-600' : 'text-red-600'}`}>
                          {testResults[s.id].ok ? '✓' : '✕'}
                        </span>
                      )}
                      <button onClick={() => testRow(s)} disabled={testingId === s.id} className="text-xs text-gray-500 hover:underline px-1">
                        {testingId === s.id ? t('external_db.testing') : t('external_db.test_connection')}
                      </button>
                      <button onClick={() => setEditing(s)} className="text-xs text-blue-600 hover:underline px-1">{t('external_db.edit')}</button>
                      <button
                        onClick={() => window.confirm(t('external_db.confirm_delete', { name: s.nazwa })) && del.mutate(s.id)}
                        className="text-xs text-red-500 hover:underline px-1"
                      >{t('external_db.delete')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing !== null && (
        <SourceModal
          source={editing}
          t={t}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); qc.invalidateQueries(['zewnetrzne-bazy']); }}
        />
      )}
    </div>
  );
}
