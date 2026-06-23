import { useState, useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import useDateLocale from '../i18n/useDateLocale';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

function Stars({ rating }) {
  return (
    <span className="text-yellow-500 whitespace-nowrap" title={`${rating}/5`}>
      {'★'.repeat(rating)}<span className="text-gray-300 dark:text-gray-600">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

export default function Opinie() {
  const { t } = useTranslation();
  const locale = useDateLocale();
  const { isAdmin, kierownikZespolIds } = useAuth();
  const [selectedZespolId, setSelectedZespolId] = useState(
    !isAdmin && kierownikZespolIds.length ? kierownikZespolIds[0] : ''
  );
  const [page, setPage] = useState(1);
  const limit = 50;

  const formatDate = (ts) => {
    if (!ts) return '—';
    return format(new Date(ts * 1000), 'dd.MM.yyyy HH:mm', { locale });
  };

  const { data: zespoly } = useQuery({
    queryKey: ['zespoly'],
    queryFn: () => api.get('/zespoly').then((r) => r.data.data),
  });

  const myTeams = useMemo(
    () => (zespoly || []).filter((z) => isAdmin || kierownikZespolIds.includes(z.id)),
    [zespoly, isAdmin, kierownikZespolIds]
  );

  const zespolId = isAdmin ? selectedZespolId : (selectedZespolId || kierownikZespolIds[0]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['opinie', zespolId, page],
    queryFn: () => api.get('/opinie', { params: { page, limit, ...(zespolId ? { zespol_id: zespolId } : {}) } }).then((r) => r.data),
  });

  if (isError) return <Navigate to="/moje" replace />;

  const opinie = data?.data || [];
  const total = data?.total || 0;
  const pages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{t('opinie.title')}</h2>
        {(isAdmin || myTeams.length > 1) && (
          <select
            value={selectedZespolId}
            onChange={(e) => { setSelectedZespolId(e.target.value ? Number(e.target.value) : ''); setPage(1); }}
            className="input max-w-xs"
          >
            {isAdmin && <option value="">{t('opinie.filter_team_all')}</option>}
            {myTeams.map((z) => (
              <option key={z.id} value={z.id}>{z.nazwa}</option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">{t('opinie.loading')}</div>
      ) : opinie.length === 0 ? (
        <div className="card text-center py-16 text-gray-500 dark:text-gray-400">{t('opinie.empty')}</div>
      ) : (
        <>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b dark:bg-gray-800 dark:border-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('opinie.col_numer')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('opinie.col_temat')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('opinie.col_ocena')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('opinie.col_komentarz')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('opinie.col_data')}</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-800">
                {opinie.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Link to={`/tickets/${o.id}`} className="text-blue-600 dark:text-blue-300 hover:underline">#{o.numer}</Link>
                    </td>
                    <td className="px-3 py-2 max-w-[280px] truncate">{o.message_subject || '—'}</td>
                    <td className="px-3 py-2"><Stars rating={o.csat_rating} /></td>
                    <td className="px-3 py-2 max-w-[320px] truncate" title={o.csat_comment}>{o.csat_comment || '—'}</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">{formatDate(o.csat_submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('opinie.pagination', { total, page, pages })}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="btn-secondary btn-sm">←</button>
                <button onClick={() => setPage((p) => p + 1)} disabled={page === pages} className="btn-secondary btn-sm">→</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
