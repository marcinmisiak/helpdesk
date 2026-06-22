import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import useDateLocale from '../i18n/useDateLocale';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import SLABadge from '../components/SLABadge';
import AITagBadge from '../components/AITagBadge';

const STATUS_COLORS = { 1: 'badge-blue', 2: 'badge-green', 3: 'badge-gray' };
const PRIORITY_LABELS = { 1: 'P1', 2: 'P2', 3: 'P3' };

function dateToTs(str) {
  if (!str) return undefined;
  return Math.floor(new Date(str).getTime() / 1000);
}

function tsToDate(ts) {
  if (!ts) return '';
  return format(new Date(ts * 1000), 'yyyy-MM-dd');
}

function BulkAssignModal({ count, users, zespoly, onClose, onAssign }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('worker');
  const [userId, setUserId] = useState('');
  const [zespolId, setZespolId] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    try {
      await onAssign(tab === 'worker' ? { user_id: userId } : { zespol_id: zespolId });
      onClose();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-sm border dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-800">
          <h3 className="font-semibold">{t('ticket_list.bulk_assign_title', { count })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="flex border-b dark:border-gray-800">
          <button
            onClick={() => setTab('worker')}
            className={`flex-1 px-3 py-2 text-sm ${tab === 'worker' ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-gray-500'}`}
          >
            {t('ticket_list.bulk_assign_tab_worker')}
          </button>
          <button
            onClick={() => setTab('team')}
            className={`flex-1 px-3 py-2 text-sm ${tab === 'team' ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-gray-500'}`}
          >
            {t('ticket_list.bulk_assign_tab_team')}
          </button>
        </div>
        <div className="p-4">
          {tab === 'worker' ? (
            <select value={userId} onChange={e => setUserId(e.target.value)} className="input">
              <option value="">{t('ticket_list.bulk_assign_choose_worker')}</option>
              {users?.filter(u => ['admin', 'pracownik'].includes(u.rola)).map(u => (
                <option key={u.id} value={u.id}>{u.imie} {u.nazwisko}</option>
              ))}
            </select>
          ) : (
            <select value={zespolId} onChange={e => setZespolId(e.target.value)} className="input">
              <option value="">{t('ticket_list.bulk_assign_choose_team')}</option>
              {zespoly?.map(z => (
                <option key={z.id} value={z.id}>{z.nazwa}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t dark:border-gray-800">
          <button onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
          <button onClick={submit} disabled={pending || (tab === 'worker' ? !userId : !zespolId)} className="btn-primary">
            {pending ? t('ticket_list.bulk_assigning') : t('ticket_view.assign')}
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkCategoryModal({ count, kategorie, onClose, onApply }) {
  const { t } = useTranslation();
  const [kategoriaId, setKategoriaId] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    try {
      await onApply(kategoriaId);
      onClose();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-sm border dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-800">
          <h3 className="font-semibold">{t('ticket_list.bulk_category_title', { count })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-4">
          <select value={kategoriaId} onChange={e => setKategoriaId(e.target.value)} className="input">
            <option value="">{t('ticket_list.bulk_category_choose')}</option>
            {kategorie?.map(k => (
              <option key={k.id} value={k.id}>{k.nazwa}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t dark:border-gray-800">
          <button onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
          <button onClick={submit} disabled={pending || !kategoriaId} className="btn-primary">
            {pending ? t('ticket_list.bulk_category_changing') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TicketList({ title, queryParams = {} }) {
  const { t } = useTranslation();
  const locale = useDateLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const qc = useQueryClient();
  const { isAdmin } = useAuth();

  const resolvedTitle = title || t('nav.tickets');

  const formatDate = (ts) => {
    if (!ts) return '—';
    return format(new Date(ts * 1000), 'dd.MM.yyyy HH:mm', { locale });
  };

  const STATUS_LABELS = {
    1: t('ticket_list.status_new'),
    2: t('ticket_list.status_assigned'),
    3: t('ticket_list.status_closed'),
  };

  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    przypisany: searchParams.get('przypisany') || '',
    data_od: searchParams.get('data_od') || '',
    data_do: searchParams.get('data_do') || '',
  });
  const [draftFilters, setDraftFilters] = useState(filters);

  const activeFilterCount = [
    filters.status, filters.priority, filters.przypisany, filters.data_od, filters.data_do
  ].filter(Boolean).length;

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => api.get('/users').then(r => r.data.data),
    enabled: isAdmin,
  });

  const { data: zespoly } = useQuery({
    queryKey: ['zespoly'],
    queryFn: () => api.get('/zespoly').then(r => r.data.data),
    enabled: isAdmin,
  });

  const { data: kategorie } = useQuery({
    queryKey: ['kategorie'],
    queryFn: () => api.get('/kategorie').then(r => r.data.data),
    enabled: isAdmin,
  });

  const [bulkModal, setBulkModal] = useState(null);

  const buildParams = (f) => {
    const p = { ...queryParams, page, limit };
    if (f.q) p.q = f.q;
    if (f.status) p.status = f.status;
    if (f.priority) p.priority = f.priority;
    if (f.przypisany) p.przypisany = f.przypisany;
    if (f.data_od) p.data_od = dateToTs(f.data_od);
    if (f.data_do) {
      const d = new Date(f.data_do);
      d.setHours(23, 59, 59);
      p.data_do = Math.floor(d.getTime() / 1000);
    }
    return p;
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tickets', queryParams, page, limit, filters],
    queryFn: () => api.get('/tickets', { params: buildParams(filters) }).then(r => r.data),
    refetchInterval: 30000,
  });

  const applyFilters = () => {
    setFilters(draftFilters);
    const next = new URLSearchParams();
    next.set('page', '1');
    if (draftFilters.q) next.set('q', draftFilters.q);
    if (draftFilters.status) next.set('status', draftFilters.status);
    if (draftFilters.priority) next.set('priority', draftFilters.priority);
    if (draftFilters.przypisany) next.set('przypisany', draftFilters.przypisany);
    if (draftFilters.data_od) next.set('data_od', draftFilters.data_od);
    if (draftFilters.data_do) next.set('data_do', draftFilters.data_do);
    setSearchParams(next);
  };

  const resetFilters = () => {
    const blank = { q: '', status: '', priority: '', przypisany: '', data_od: '', data_do: '' };
    setDraftFilters(blank);
    setFilters(blank);
    setSearchParams(new URLSearchParams({ page: '1' }));
  };

  const bulkClose = useMutation({
    mutationFn: (ids) => api.post('/tickets/masowe', { ids }),
    onSuccess: () => {
      toast.success(t('ticket_list.tickets_closed'));
      setSelected([]);
      qc.invalidateQueries(['tickets']);
    },
  });

  const bulkDelete = useMutation({
    mutationFn: (ids) => api.post('/tickets/masowe-usun', { ids }),
    onSuccess: ({ data: res }) => {
      const msg = res.skipped > 0
        ? t('ticket_list.deleted_with_skipped', { deleted: res.deleted, skipped: res.skipped })
        : t('ticket_list.deleted', { count: res.deleted });
      toast.success(msg);
      setSelected([]);
      qc.invalidateQueries(['tickets']);
    },
    onError: (err) => toast.error(err.response?.data?.error || t('ticket_list.delete_error')),
  });

  const bulkAssign = useMutation({
    mutationFn: (payload) => api.post('/tickets/masowe-przydziel', { ids: selected, ...payload }),
    onSuccess: ({ data: res }) => {
      toast.success(t('ticket_list.bulk_assigned', { count: res.count }));
      setSelected([]);
      qc.invalidateQueries(['tickets']);
    },
    onError: (err) => toast.error(err.response?.data?.error || t('common.error')),
  });

  const bulkCategory = useMutation({
    mutationFn: (kategoria_id) => api.post('/tickets/masowe-kategoria', { ids: selected, kategoria_id }),
    onSuccess: ({ data: res }) => {
      toast.success(t('ticket_list.bulk_category_changed', { count: res.count }));
      setSelected([]);
      qc.invalidateQueries(['tickets']);
    },
    onError: (err) => toast.error(err.response?.data?.error || t('common.error')),
  });

  const [bulkAiJob, setBulkAiJob] = useState(null);
  const pollRef = useRef(null);
  const isBulkRunning = Boolean(bulkAiJob?.running);

  const startBulkClassify = async () => {
    const { data: res } = await api.post('/tickets/klasyfikuj-masowo?tylko_nowe=1');
    if (res.alreadyRunning) {
      toast(t('ticket_list.ai_already_running'));
      setBulkAiJob(res.progress);
    } else if (res.total === 0) {
      toast.success(t('ticket_list.ai_already_classified'));
    } else {
      toast.success(t('ticket_list.ai_started', { count: res.total }));
      setBulkAiJob({ running: true, total: res.total, done: 0, errors: 0 });
    }
  };

  useEffect(() => {
    if (!isBulkRunning) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      if (bulkAiJob && !bulkAiJob.running) qc.invalidateQueries(['tickets']);
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const { data: res } = await api.get('/tickets/klasyfikuj-masowo/status');
        setBulkAiJob(res);
        if (!res.running) {
          toast.success(t('ticket_list.ai_done', { count: res.done }));
          qc.invalidateQueries(['tickets']);
        }
      } catch {
        // Ignore temporary polling errors
      }
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isBulkRunning, bulkAiJob, qc]);

  const toggleSelect = (id) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const selectAll = () =>
    setSelected(selected.length === data?.data?.length ? [] : data?.data?.map(ticket => ticket.id) || []);

  const setPage = (p) => setSearchParams(prev => { prev.set('page', p); return prev; });

  const tickets = data?.data || [];
  const total = data?.total || 0;
  const pages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {resolvedTitle}
          {total > 0 && <span className="ml-2 text-sm font-normal text-gray-500">({total})</span>}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowFilters(v => !v); if (!showFilters) setDraftFilters(filters); }}
            className={`btn-secondary flex items-center gap-1 ${activeFilterCount ? 'ring-2 ring-blue-400' : ''}`}
          >
            {t('ticket_list.filters')} {activeFilterCount > 0 && <span className="bg-blue-600 text-white rounded-full text-xs px-1.5">{activeFilterCount}</span>}
          </button>
          <button onClick={() => refetch()} className="btn-secondary">{t('ticket_list.refresh')}</button>
          {isAdmin && selected.length > 0 && (
            <>
              <button onClick={() => bulkClose.mutate(selected)} className="btn-danger">
                {t('ticket_list.close_selected', { count: selected.length })}
              </button>
              <button
                onClick={() => {
                  if (confirm(t('ticket_list.confirm_delete', { count: selected.length }))) {
                    bulkDelete.mutate(selected);
                  }
                }}
                disabled={bulkDelete.isPending}
                className="btn-danger"
              >
                {bulkDelete.isPending ? t('ticket_list.deleting') : t('ticket_list.delete_selected', { count: selected.length })}
              </button>
              <button onClick={() => setBulkModal('assign')} className="btn-secondary">
                {t('ticket_list.assign_selected', { count: selected.length })}
              </button>
              <button onClick={() => setBulkModal('category')} className="btn-secondary">
                {t('ticket_list.category_selected', { count: selected.length })}
              </button>
            </>
          )}
          {isAdmin && (
            <Link to="/tickets/nowy" className="btn-primary">{t('ticket_list.new_ticket')}</Link>
          )}
          {isAdmin && (
            <button
              onClick={startBulkClassify}
              disabled={bulkAiJob?.running}
              className="btn-secondary flex items-center gap-1"
              title={t('ticket_list.ai_classify')}
            >
              🤖 {bulkAiJob?.running ? t('ticket_list.ai_running', { done: bulkAiJob.done, total: bulkAiJob.total }) : t('ticket_list.ai_classify')}
            </button>
          )}
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card mb-4 p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="label">{t('ticket_list.filter_status')}</label>
              <input
                type="text"
                value={draftFilters.q}
                onChange={e => setDraftFilters(f => ({ ...f, q: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && applyFilters()}
                placeholder={t('ticket_list.search_placeholder')}
                className="input"
              />
            </div>
            <div>
              <label className="label">{t('ticket_list.filter_status')}</label>
              <select
                value={draftFilters.status}
                onChange={e => setDraftFilters(f => ({ ...f, status: e.target.value }))}
                className="input"
              >
                <option value="">{t('ticket_list.all_active')}</option>
                <option value="1">{t('ticket_list.status_new')}</option>
                <option value="2">{t('ticket_list.status_assigned')}</option>
                <option value="3">{t('ticket_list.status_closed')}</option>
              </select>
            </div>
            <div>
              <label className="label">{t('ticket_list.filter_priority')}</label>
              <select
                value={draftFilters.priority}
                onChange={e => setDraftFilters(f => ({ ...f, priority: e.target.value }))}
                className="input"
              >
                <option value="">{t('ticket_list.priority_all')}</option>
                <option value="1">{t('ticket_list.priority_p1')}</option>
                <option value="2">{t('ticket_list.priority_p2')}</option>
                <option value="3">{t('ticket_list.priority_p3')}</option>
              </select>
            </div>
            {isAdmin && (
              <div>
                <label className="label">{t('ticket_list.filter_assigned')}</label>
                <select
                  value={draftFilters.przypisany}
                  onChange={e => setDraftFilters(f => ({ ...f, przypisany: e.target.value }))}
                  className="input"
                >
                  <option value="">{t('ticket_list.assigned_all')}</option>
                  {users?.filter(u => ['admin', 'pracownik'].includes(u.rola)).map(u => (
                    <option key={u.id} value={u.id}>{u.imie} {u.nazwisko}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label">{t('ticket_list.filter_date_from')}</label>
              <input
                type="date"
                value={draftFilters.data_od}
                onChange={e => setDraftFilters(f => ({ ...f, data_od: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="label">{t('ticket_list.filter_date_to')}</label>
              <input
                type="date"
                value={draftFilters.data_do}
                onChange={e => setDraftFilters(f => ({ ...f, data_do: e.target.value }))}
                className="input"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={applyFilters} className="btn-primary btn-sm">{t('ticket_list.apply_filters')}</button>
            <button onClick={resetFilters} className="btn-secondary btn-sm">{t('ticket_list.reset_filters')}</button>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="flex flex-wrap gap-2 mb-3 text-xs">
          {filters.status && (
            <span className="badge-blue">{t('ticket_list.filter_label_status')}: {STATUS_LABELS[filters.status]}</span>
          )}
          {filters.priority && (
            <span className="badge-blue">{t('ticket_list.filter_label_priority')}: {PRIORITY_LABELS[filters.priority]}</span>
          )}
          {filters.przypisany && (
            <span className="badge-blue">
              {t('ticket_list.filter_label_assigned')}: {users?.find(u => String(u.id) === filters.przypisany)?.imie || filters.przypisany}
            </span>
          )}
          {filters.data_od && <span className="badge-blue">{t('ticket_list.filter_label_from')}: {filters.data_od}</span>}
          {filters.data_do && <span className="badge-blue">{t('ticket_list.filter_label_to')}: {filters.data_do}</span>}
          <button onClick={resetFilters} className="text-red-500 hover:text-red-700">{t('ticket_list.filter_clear')}</button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">{t('ticket_list.loading')}</div>
      ) : tickets.length === 0 ? (
        <div className="card text-center py-12 text-gray-500 dark:text-gray-400">{t('ticket_list.no_tickets')}</div>
      ) : (
        <>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b dark:bg-gray-800 dark:border-gray-700">
                <tr>
                  {isAdmin && (
                    <th className="px-3 py-2 text-left w-8">
                      <input type="checkbox" onChange={selectAll} checked={selected.length === tickets.length && tickets.length > 0} />
                    </th>
                  )}
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('ticket_list.col_no')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('ticket_list.col_from')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('ticket_list.col_subject')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('ticket_list.col_date')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('ticket_list.col_assigned')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('ticket_list.col_status')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('ticket_list.col_priority')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('ticket_list.col_sla')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('ticket_list.col_ai')}</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-800">
                {tickets.map(ticket => (
                  <tr
                    key={ticket.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                      ticket.podswietl
                        ? 'bg-orange-50 dark:bg-orange-900/20 border-l-4 border-l-orange-400 dark:border-l-orange-500'
                        : 'border-l-4 border-l-transparent'
                    }`}
                  >
                    {isAdmin && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.includes(ticket.id)}
                          onChange={() => toggleSelect(ticket.id)}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2 font-mono text-xs text-gray-500 dark:text-gray-400">
                      #{ticket.numer}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-200 max-w-[160px] truncate">
                      {ticket.message_from}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/tickets/${ticket.id}`}
                          className={`hover:underline dark:text-blue-300 ${
                            ticket.podswietl
                              ? 'text-orange-700 dark:text-orange-300 font-semibold'
                              : 'text-blue-600 font-medium'
                          }`}
                        >
                          {ticket.message_subject || t('ticket_list.no_subject')}
                        </Link>
                        {ticket.podswietl ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-800/40 dark:text-orange-300 whitespace-nowrap">
                            {t('ticket_list.new_message_badge')}
                          </span>
                        ) : null}
                        {ticket.odlozony ? (
                          <span className="badge-yellow">{t('ticket_list.deferred_badge', { date: formatDate(ticket.odlozony_data) })}</span>
                        ) : null}
                        {ticket.merged_into_id ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700 dark:bg-teal-800/40 dark:text-teal-300 whitespace-nowrap">
                            🔗 {t('ticket_list.merged_badge')}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                      {formatDate(ticket.data_utworzenia)}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300 text-xs">
                      {ticket.przypisani || t('common.unassigned')}
                      {ticket.zespoly_nazwy && (
                        <div className="mt-1">
                          <span className="badge-yellow" title={t('ticket_view.team_ticket_badge')}>
                            {t('ticket_list.team_badge', { name: ticket.zespoly_nazwy })}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={STATUS_COLORS[ticket.status]}>{STATUS_LABELS[ticket.status]}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className="badge-blue">{PRIORITY_LABELS[ticket.priority] || 'P2'}</span>
                    </td>
                    <td className="px-3 py-2">
                      <SLABadge status={ticket.sla_status} secondsLeft={ticket.sla_seconds_left} />
                    </td>
                    <td className="px-3 py-2">
                      <AITagBadge tag={ticket.ai_tag} reason={ticket.ai_reason} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t('ticket_list.pagination', { total, page, pages })}
            </span>
            {pages > 1 && (
              <div className="flex gap-1">
                <button onClick={() => setPage(page - 1)} disabled={page === 1} className="btn-secondary btn-sm">←</button>
                {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={p === page ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                  >
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage(page + 1)} disabled={page === pages} className="btn-secondary btn-sm">→</button>
              </div>
            )}
          </div>
        </>
      )}

      {bulkModal === 'assign' && (
        <BulkAssignModal
          count={selected.length}
          users={users}
          zespoly={zespoly}
          onClose={() => setBulkModal(null)}
          onAssign={(payload) => bulkAssign.mutateAsync(payload)}
        />
      )}
      {bulkModal === 'category' && (
        <BulkCategoryModal
          count={selected.length}
          kategorie={kategorie}
          onClose={() => setBulkModal(null)}
          onApply={(kategoriaId) => bulkCategory.mutateAsync(kategoriaId)}
        />
      )}
    </div>
  );
}
