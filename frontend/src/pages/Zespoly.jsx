import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import toast from 'react-hot-toast';

function TeamModal({ team, users, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    nazwa: team?.nazwa || '',
    opis: team?.opis || '',
    user_ids: team?.czlonkowie_ids ? team.czlonkowie_ids.split(',').map(Number) : [],
  });

  const isEdit = !!team;

  const toggleMember = (id) => {
    setForm((f) => ({
      ...f,
      user_ids: f.user_ids.includes(id) ? f.user_ids.filter((x) => x !== id) : [...f.user_ids, id],
    }));
  };

  const save = async () => {
    if (!form.nazwa.trim()) return toast.error(t('teams.error_no_name'));
    try {
      if (isEdit) {
        await api.put(`/zespoly/${team.id}`, form);
        toast.success(t('teams.saved'));
      } else {
        await api.post('/zespoly', form);
        toast.success(t('teams.created'));
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || t('teams.error_save'));
    }
  };

  const workers = users?.filter((u) => ['admin', 'pracownik'].includes(u.rola)) || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md dark:bg-gray-800">
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
          <h3 className="font-semibold dark:text-gray-100">{isEdit ? t('teams.modal_edit_title') : t('teams.modal_new_title')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="label">{t('teams.field_name')}</label>
            <input value={form.nazwa} onChange={(e) => setForm((f) => ({ ...f, nazwa: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="label">{t('teams.field_description')}</label>
            <input value={form.opis} onChange={(e) => setForm((f) => ({ ...f, opis: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="label">{t('teams.field_members')}</label>
            <div className="border rounded max-h-56 overflow-y-auto dark:border-gray-700">
              {workers.map((u) => (
                <label key={u.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                  <input
                    type="checkbox"
                    checked={form.user_ids.includes(u.id)}
                    onChange={() => toggleMember(u.id)}
                  />
                  {u.imie} {u.nazwisko} ({u.email})
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary">{t('teams.cancel')}</button>
          <button onClick={save} className="btn-primary">{t('teams.save')}</button>
        </div>
      </div>
    </div>
  );
}

export default function Zespoly() {
  const { t } = useTranslation();
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['zespoly'],
    queryFn: () => api.get('/zespoly').then((r) => r.data.data),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data.data),
  });

  const teams = data || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((z) => z.nazwa.toLowerCase().includes(q));
  }, [teams, search]);

  const remove = async (team) => {
    if (!confirm(t('teams.confirm_delete', { name: team.nazwa }))) return;
    try {
      await api.delete(`/zespoly/${team.id}`);
      toast.success(t('teams.deleted'));
      qc.invalidateQueries(['zespoly']);
    } catch (err) {
      toast.error(err.response?.data?.error || t('teams.error_save'));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{t('teams.title')}</h2>
        <button onClick={() => setModal('new')} className="btn-primary">{t('teams.add')}</button>
      </div>
      <div className="mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('teams.search_placeholder')}
          className="input max-w-sm"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">{t('teams.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">{t('teams.empty')}</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b dark:bg-gray-800 dark:border-gray-700">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('teams.col_name')}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('teams.col_members')}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('teams.col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-800">
              {filtered.map((z) => (
                <tr key={z.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-3 py-2 font-medium">{z.nazwa}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{z.czlonkowie || t('teams.no_members')}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => setModal(z)} className="btn-secondary btn-sm mr-2">{t('teams.edit')}</button>
                    <button onClick={() => remove(z)} className="btn-danger btn-sm">{t('teams.delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <TeamModal
          team={modal === 'new' ? null : modal}
          users={users}
          onClose={() => setModal(null)}
          onSuccess={() => qc.invalidateQueries(['zespoly'])}
        />
      )}
    </div>
  );
}
