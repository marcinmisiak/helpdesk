import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import useDateLocale from '../i18n/useDateLocale';
import api from '../api/client';
import toast from 'react-hot-toast';

export default function Odlozone() {
  const { t } = useTranslation();
  const locale = useDateLocale();
  const qc = useQueryClient();

  const formatDate = (ts) => {
    if (!ts) return '—';
    return format(new Date(ts * 1000), 'dd.MM.yyyy HH:mm', { locale });
  };

  const { data, isLoading } = useQuery({
    queryKey: ['odlozone'],
    queryFn: () => api.get('/tickets/odlozone').then(r => r.data),
  });

  const przywroc = useMutation({
    mutationFn: (id) => api.post(`/tickets/${id}/przywroc`),
    onSuccess: () => { toast.success(t('deferred.restored')); qc.invalidateQueries(['odlozone']); },
    onError: (err) => toast.error(err.response?.data?.error || t('deferred.error')),
  });

  const tickets = data?.data || [];

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{t('deferred.title')}</h2>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">{t('deferred.loading')}</div>
      ) : tickets.length === 0 ? (
        <div className="card text-center py-12 text-gray-500 dark:text-gray-400">{t('deferred.empty')}</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b dark:bg-gray-800 dark:border-gray-700">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('deferred.col_no')}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('deferred.col_subject')}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('deferred.col_deferred_until')}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('deferred.col_assigned')}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('deferred.col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-800">
              {tickets.map(ticket => (
                <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-3 py-2 font-mono text-xs text-gray-500 dark:text-gray-400">#{ticket.numer}</td>
                  <td className="px-3 py-2">
                    <Link to={`/tickets/${ticket.id}`} className="text-blue-600 dark:text-blue-300 hover:underline">
                      {ticket.message_subject || t('deferred.no_subject')}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{formatDate(ticket.odlozony_data)}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{ticket.przypisani || '—'}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => przywroc.mutate(ticket.id)}
                      className="btn-warning btn-sm"
                    >
                      {t('deferred.restore')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
