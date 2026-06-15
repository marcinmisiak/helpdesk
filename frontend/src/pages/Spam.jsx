import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import useDateLocale from '../i18n/useDateLocale';
import api from '../api/client';
import toast from 'react-hot-toast';

export default function Spam() {
  const { t } = useTranslation();
  const locale = useDateLocale();
  const qc = useQueryClient();
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const limit = 50;

  const formatDate = (ts) => {
    if (!ts) return '—';
    return format(new Date(ts * 1000), 'dd.MM.yyyy HH:mm', { locale });
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['spam', page],
    queryFn: () => api.get('/tickets/spam', { params: { page, limit } }).then(r => r.data),
  });

  const tickets = data?.data || [];
  const total = data?.total || 0;
  const pages = Math.ceil(total / limit);

  const toggleSelect = (id) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const selectAll = () =>
    setSelected(selected.length === tickets.length ? [] : tickets.map(ticket => ticket.id));

  const deleteSelected = async () => {
    if (!selected.length) return;
    if (!confirm(t('spam.confirm_delete_selected', { count: selected.length }))) return;
    await api.delete('/tickets/spam/masowe', { data: { ids: selected } });
    toast.success(t('spam.deleted', { count: selected.length }));
    setSelected([]);
    qc.invalidateQueries(['spam']);
    refetch();
  };

  const deleteAll = async () => {
    if (!total) return;
    if (!confirm(t('spam.confirm_delete_all', { total }))) return;
    const { data: res } = await api.delete('/tickets/spam/wszystkie');
    toast.success(t('spam.deleted', { count: res.deleted }));
    setSelected([]);
    qc.invalidateQueries(['spam']);
    refetch();
  };

  const notSpam = async (id) => {
    await api.post(`/tickets/${id}/nie-spam`);
    toast.success(t('spam.marked_not_spam'));
    qc.invalidateQueries(['spam']);
    refetch();
  };

  if (isLoading) return <div className="text-center py-12 text-gray-500">{t('spam.loading')}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          {t('spam.title')}
          {total > 0 && <span className="ml-2 text-sm font-normal text-gray-500">({total})</span>}
        </h2>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <button onClick={deleteSelected} className="btn-danger">
              {t('spam.delete_selected', { count: selected.length })}
            </button>
          )}
          {total > 0 && (
            <button onClick={deleteAll} className="btn-danger">
              {t('spam.delete_all', { count: total })}
            </button>
          )}
          <button onClick={() => refetch()} className="btn-secondary">{t('spam.refresh')}</button>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="card text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">🎉</div>
          <div>{t('spam.empty')}</div>
        </div>
      ) : (
        <>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 w-8">
                    <input type="checkbox" onChange={selectAll} checked={selected.length === tickets.length && tickets.length > 0} />
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">{t('spam.col_from')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">{t('spam.col_subject')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">{t('spam.col_ai_reason')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">{t('spam.col_date')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">{t('spam.col_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tickets.map(ticket => (
                  <tr key={ticket.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(ticket.id)}
                        onChange={() => toggleSelect(ticket.id)}
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-700 max-w-[180px] truncate text-xs">
                      {ticket.message_from}
                    </td>
                    <td className="px-3 py-2 text-gray-800 max-w-[260px] truncate">
                      {ticket.message_subject || t('spam.no_subject')}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs max-w-[220px] truncate" title={ticket.ai_reason}>
                      {ticket.ai_reason || '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(ticket.data_utworzenia)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => notSpam(ticket.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {t('spam.not_spam')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-gray-500">{t('spam.pagination', { total, page, pages })}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="btn-secondary btn-sm">←</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page === pages} className="btn-secondary btn-sm">→</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
