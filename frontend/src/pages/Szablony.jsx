import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import toast from 'react-hot-toast';

function TemplateModal({ template, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    nazwa: template?.nazwa || '',
    tresc: template?.tresc || '',
    kolejnosc: template?.kolejnosc ?? 0,
  });

  const isEdit = !!template;

  const save = async () => {
    if (!form.nazwa.trim() || !form.tresc.trim()) {
      return toast.error(t('templates.error_save'));
    }
    try {
      if (isEdit) {
        await api.put(`/szablony/${template.id}`, form);
        toast.success(t('templates.saved'));
      } else {
        await api.post('/szablony', form);
        toast.success(t('templates.created'));
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || t('templates.error_save'));
    }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg dark:bg-gray-800">
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
          <h3 className="font-semibold dark:text-gray-100">{isEdit ? t('templates.modal_edit_title') : t('templates.modal_new_title')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="label">{t('templates.field_name')}</label>
            <input value={form.nazwa} onChange={set('nazwa')} className="input" />
          </div>
          <div>
            <label className="label">{t('templates.field_content')}</label>
            <textarea value={form.tresc} onChange={set('tresc')} rows={8} className="input resize-y" />
          </div>
          <div>
            <label className="label">{t('templates.field_order')}</label>
            <input type="number" value={form.kolejnosc} onChange={set('kolejnosc')} className="input max-w-[120px]" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary">{t('templates.cancel')}</button>
          <button onClick={save} className="btn-primary">{t('templates.save')}</button>
        </div>
      </div>
    </div>
  );
}

export default function Szablony() {
  const { t } = useTranslation();
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['szablony'],
    queryFn: () => api.get('/szablony').then(r => r.data.data),
  });

  const templates = data || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(s => s.nazwa.toLowerCase().includes(q));
  }, [templates, search]);

  const remove = async (tpl) => {
    if (!confirm(t('templates.confirm_delete', { name: tpl.nazwa }))) return;
    try {
      await api.delete(`/szablony/${tpl.id}`);
      toast.success(t('templates.deleted'));
      qc.invalidateQueries(['szablony']);
    } catch (err) {
      toast.error(err.response?.data?.error || t('templates.error_save'));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{t('templates.title')}</h2>
        <button onClick={() => setModal('new')} className="btn-primary">{t('templates.add')}</button>
      </div>
      <div className="mb-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('templates.search_placeholder')}
          className="input max-w-sm"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">{t('templates.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">{t('templates.empty')}</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b dark:bg-gray-800 dark:border-gray-700">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('templates.col_name')}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('templates.col_content')}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('templates.col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-800">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-3 py-2 font-medium">{s.nazwa}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300 max-w-md truncate">{s.tresc}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => setModal(s)} className="btn-secondary btn-sm mr-2">{t('templates.edit')}</button>
                    <button onClick={() => remove(s)} className="btn-danger btn-sm">{t('templates.delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <TemplateModal
          template={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSuccess={() => qc.invalidateQueries(['szablony'])}
        />
      )}
    </div>
  );
}
