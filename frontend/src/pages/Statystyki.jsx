import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../api/client';

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function Stat({ label, value, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900',
    green: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900',
    gray: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-900',
  };
  return (
    <div className={`card border ${colors[color]} text-center`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm mt-1">{label}</div>
    </div>
  );
}

export default function Statystyki() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['statystyki'],
    queryFn: () => api.get('/statystyki').then(r => r.data),
  });

  if (isLoading) return <div className="text-center py-12 text-gray-500 dark:text-gray-400">{t('statistics.loading')}</div>;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{t('statistics.title')}</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label={t('statistics.new')} value={data.nowe} color="blue" />
        <Stat label={t('statistics.assigned')} value={data.przypisane} color="green" />
        <Stat label={t('statistics.closed')} value={data.zamkniete} color="gray" />
        <Stat label={t('statistics.deferred')} value={data.odlozone} color="yellow" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="MTTA" value={formatDuration(data.kpi?.mttaSeconds)} color="blue" />
        <Stat label="MTTR" value={formatDuration(data.kpi?.mttrSeconds)} color="green" />
        <Stat label={t('statistics.sla_response')} value={data.kpi?.responseCompliancePercent != null ? `${data.kpi.responseCompliancePercent}%` : '—'} color="gray" />
        <Stat label={t('statistics.sla_resolution')} value={data.kpi?.resolutionCompliancePercent != null ? `${data.kpi.resolutionCompliancePercent}%` : '—'} color="yellow" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label={t('statistics.sla_warning_open')} value={data.kpi?.warningOpen ?? 0} color="yellow" />
        <Stat label={t('statistics.sla_breach_open')} value={data.kpi?.breachOpen ?? 0} color="blue" />
        <Stat label={t('statistics.sla_response_eligible')} value={data.kpi?.responseEligible ?? 0} color="gray" />
        <Stat label={t('statistics.sla_resolution_eligible')} value={data.kpi?.resolutionEligible ?? 0} color="green" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold mb-3">{t('statistics.last_30_days')}</h3>
          {data.ostatnie30?.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-sm">{t('statistics.no_data')}</p>
          ) : (
            <div className="space-y-1">
              {data.ostatnie30?.map(row => (
                <div key={row.dzien} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-24">{row.dzien}</span>
                  <div
                    className="bg-blue-400 dark:bg-blue-500 h-4 rounded"
                    style={{ width: `${Math.min(row.cnt * 10, 200)}px` }}
                  />
                  <span className="text-xs">{row.cnt}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold mb-3">{t('statistics.top_workers')}</h3>
          {data.topPracownicy?.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-sm">{t('statistics.no_data')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-1 font-medium text-gray-600 dark:text-gray-300">{t('statistics.col_worker')}</th>
                  <th className="text-right py-1 font-medium text-gray-600 dark:text-gray-300">{t('statistics.col_tickets')}</th>
                </tr>
              </thead>
              <tbody>
                {data.topPracownicy?.map((row, i) => (
                  <tr key={i} className="border-b dark:border-gray-800 last:border-0">
                    <td className="py-1">{row.imie} {row.nazwisko}</td>
                    <td className="py-1 text-right font-bold">{row.cnt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card md:col-span-2">
          <h3 className="font-semibold mb-3">{t('statistics.workload')}</h3>
          {data.workload?.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-sm">{t('statistics.no_data')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-1 font-medium text-gray-600 dark:text-gray-300">{t('statistics.col_worker')}</th>
                  <th className="text-right py-1 font-medium text-gray-600 dark:text-gray-300">{t('statistics.col_all')}</th>
                  <th className="text-right py-1 font-medium text-gray-600 dark:text-gray-300">{t('statistics.col_overdue')}</th>
                </tr>
              </thead>
              <tbody>
                {data.workload?.map((row) => (
                  <tr key={row.id} className="border-b dark:border-gray-800 last:border-0">
                    <td className="py-1">{row.imie} {row.nazwisko}</td>
                    <td className="py-1 text-right font-bold">{row.wszystkie}</td>
                    <td className="py-1 text-right">{row.przeterminowane}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
