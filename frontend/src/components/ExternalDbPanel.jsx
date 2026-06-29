import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../api/client';

function SourceCard({ source, cached, ticketId, onRefresh, t }) {
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try { await api.post(`/tickets/${ticketId}/external-db-refresh/${source.id}`); onRefresh(); }
    catch { onRefresh(); }
    finally { setRefreshing(false); }
  };

  const status = cached?.status; // undefined | 'found' | 'not_found' | 'error'
  const found = status === 'found';
  const notFound = status === 'not_found';
  const isError = status === 'error';

  const cardColor = found
    ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
    : isError
      ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
      : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700';

  const badgeColor = found
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-800/50 dark:text-blue-300'
    : isError
      ? 'bg-red-100 text-red-700 dark:bg-red-800/50 dark:text-red-300'
      : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300';

  const statusText = found
    ? t('ticket_view.external_db_found')
    : isError
      ? t('ticket_view.external_db_error')
      : notFound
        ? t('ticket_view.external_db_not_found')
        : t('ticket_view.external_db_pending');

  const fields = found && cached?.fields ? Object.entries(cached.fields) : [];

  return (
    <div className={`mb-4 rounded-lg border text-sm ${cardColor}`}>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-inherit">
        <span className="text-xl flex-shrink-0">🗄️</span>
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-800 dark:text-gray-100">{source.nazwa}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>{statusText}</span>
          {isError && cached?.error && (
            <span className="text-xs text-red-500 dark:text-red-400">{cached.error}</span>
          )}
        </div>
        <button onClick={refresh} disabled={refreshing} title={t('ticket_view.external_db_refresh')}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-40 text-base leading-none flex-shrink-0">
          {refreshing ? '⟳' : '↻'}
        </button>
      </div>
      {found && fields.length > 0 && (
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 px-4 py-3 text-xs">
          {fields.map(([label, val]) => (
            <div key={label}>
              <dt className="text-gray-400 dark:text-gray-500">{label}</dt>
              <dd className="font-medium text-gray-700 dark:text-gray-200 break-words">{val}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export default function ExternalDbPanel({ ticket, onRefresh }) {
  const { t } = useTranslation();
  const { data: sources } = useQuery({
    queryKey: ['zewnetrzne-bazy'],
    queryFn: () => api.get('/zewnetrzne-bazy').then((r) => r.data.data),
    staleTime: 60_000,
  });

  if (!ticket.message_from) return null;

  let cache = {};
  try { cache = ticket.external_db_data ? JSON.parse(ticket.external_db_data) : {}; } catch {}

  const activeSources = (sources || []).filter((s) => s.aktywna);
  if (!activeSources.length) return null;

  return (
    <>
      {activeSources.map((source) => (
        <SourceCard key={source.id} source={source} cached={cache[source.id]} ticketId={ticket.id} onRefresh={onRefresh} t={t} />
      ))}
    </>
  );
}
