import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import toast from 'react-hot-toast';

export default function PrzydielModal({ ticketId, onClose, onSuccess }) {
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
