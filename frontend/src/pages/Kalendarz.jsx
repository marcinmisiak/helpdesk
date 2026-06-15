import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useDateLocale from '../i18n/useDateLocale';
import api from '../api/client';

export default function Kalendarz() {
  const { t } = useTranslation();
  const locale = useDateLocale();
  const [month, setMonth] = useState(new Date());

  const { data } = useQuery({
    queryKey: ['odlozone'],
    queryFn: () => api.get('/tickets/odlozone').then(r => r.data),
  });

  const tickets = data?.data || [];
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });

  const ticketsForDay = (day) =>
    tickets.filter(ticket => ticket.odlozony_data && isSameDay(new Date(ticket.odlozony_data * 1000), day));

  const startDow = startOfMonth(month).getDay() || 7;
  const dayLabels = t('calendar.days_short', { returnObjects: true });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">
          {t('calendar.title')} — {format(month, 'LLLL yyyy', { locale })}
        </h2>
        <div className="flex gap-2">
          <button onClick={() => setMonth(m => subMonths(m, 1))} className="btn-secondary">←</button>
          <button onClick={() => setMonth(new Date())} className="btn-secondary">{t('calendar.today')}</button>
          <button onClick={() => setMonth(m => addMonths(m, 1))} className="btn-secondary">→</button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="grid grid-cols-7 text-center border-b dark:border-gray-700">
          {(Array.isArray(dayLabels) ? dayLabels : ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz']).map(d => (
            <div key={d} className="py-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: startDow - 1 }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] border-r border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800" />
          ))}
          {days.map(day => {
            const dayTickets = ticketsForDay(day);
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[80px] border-r border-b dark:border-gray-700 p-1 ${isToday ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
              >
                <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-600 dark:text-blue-300' : 'text-gray-600 dark:text-gray-300'}`}>
                  {format(day, 'd')}
                </div>
                {dayTickets.map(ticket => (
                  <Link
                    key={ticket.id}
                    to={`/tickets/${ticket.id}`}
                    className="block text-xs bg-yellow-200 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-200 rounded px-1 py-0.5 mb-0.5 truncate hover:bg-yellow-300 dark:hover:bg-yellow-900/50"
                    title={ticket.message_subject}
                  >
                    #{ticket.numer} {ticket.message_subject}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
