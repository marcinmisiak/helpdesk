import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function TicketNew() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin, isKierownik, kierownikZespolIds } = useAuth();

  const [typ, setTyp] = useState('zgloszenie');
  const [form, setForm] = useState({
    message_from: '', message_to: '', message_subject: '', tresc: '', message_cc: '', priority: '2',
    zespol_id: '', assign_user_ids: [], deadline: '',
  });
  const [saving, setSaving] = useState(false);

  const { data: zespoly } = useQuery({
    queryKey: ['zespoly'],
    queryFn: () => api.get('/zespoly').then(r => r.data.data),
    enabled: typ !== 'zgloszenie',
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data.data),
    enabled: typ === 'zadanie',
  });

  // Do "pomoc" dostępne są wszystkie zespoły — pracownik może poprosić o pomoc dowolny zespół.
  // Do "zadanie" tylko własne zespoły (admin: wszystkie, kierownik: te którymi kieruje) — nie da
  // się przydzielać zadań pracownikom zespołu, którym się nie kieruje.
  const teamsForType = useMemo(() => {
    if (!zespoly) return [];
    if (typ === 'pomoc') return zespoly;
    return zespoly.filter(z => isAdmin || kierownikZespolIds.includes(z.id));
  }, [zespoly, typ, isAdmin, kierownikZespolIds]);

  const teamMembers = useMemo(() => {
    if (!users || !form.zespol_id) return [];
    const team = zespoly?.find(z => String(z.id) === String(form.zespol_id));
    const ids = team?.czlonkowie_ids ? team.czlonkowie_ids.split(',').map(Number) : [];
    return users.filter(u => ids.includes(u.id));
  }, [users, zespoly, form.zespol_id]);

  const changeTyp = (nextTyp) => {
    setTyp(nextTyp);
    setForm(f => ({ ...f, zespol_id: '', assign_user_ids: [] }));
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const toggleAssignee = (id) => {
    setForm(f => ({
      ...f,
      assign_user_ids: f.assign_user_ids.includes(id)
        ? f.assign_user_ids.filter(x => x !== id)
        : [...f.assign_user_ids, id],
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.message_subject.trim()) return toast.error(t('ticket_new.error_required'));
    if (typ === 'zgloszenie' && !form.message_from.trim()) return toast.error(t('ticket_new.error_required'));
    if ((typ === 'pomoc' || typ === 'zadanie') && !form.zespol_id) return toast.error(t('ticket_new.error_team_required'));
    if (typ === 'zadanie' && !form.assign_user_ids.length) return toast.error(t('ticket_new.error_assignees_required'));

    setSaving(true);
    try {
      const payload = {
        typ,
        message_subject: form.message_subject,
        tresc: form.tresc,
        priority: form.priority,
      };
      if (typ === 'zgloszenie') {
        payload.message_from = form.message_from;
        payload.message_to = form.message_to;
        payload.message_cc = form.message_cc;
      } else {
        payload.zespol_id = form.zespol_id;
      }
      if (typ === 'zadanie') {
        payload.assign_user_ids = form.assign_user_ids;
        if (form.deadline) payload.sla_response_deadline = Math.floor(new Date(form.deadline).getTime() / 1000);
      }

      const { data } = await api.post('/tickets', payload);
      toast.success(t('ticket_new.success'));
      navigate(`/tickets/${data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || t('ticket_new.error_default'));
      setSaving(false);
    }
  };

  const TYPE_OPTIONS = [
    { value: 'zgloszenie', label: t('ticket_new.type_zgloszenie'), hint: t('ticket_new.type_zgloszenie_hint') },
    { value: 'pomoc', label: t('ticket_new.type_pomoc'), hint: t('ticket_new.type_pomoc_hint') },
    ...(isAdmin || isKierownik ? [
      { value: 'zadanie', label: t('ticket_new.type_zadanie'), hint: t('ticket_new.type_zadanie_hint') },
    ] : []),
  ];

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-4">{t('ticket_new.title')}</h2>

      <div className="card mb-4">
        <label className="label mb-2">{t('ticket_new.type_label')}</label>
        <div className="grid gap-2 sm:grid-cols-3">
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => changeTyp(opt.value)}
              className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                typ === opt.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="font-medium text-gray-900 dark:text-gray-100">{opt.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.hint}</div>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="card space-y-4">
        {typ === 'zgloszenie' && (
          <>
            <div>
              <label className="label">{t('ticket_new.from_label')}</label>
              <input value={form.message_from} onChange={set('message_from')} className="input" required />
            </div>
            <div>
              <label className="label">{t('ticket_new.to_label')}</label>
              <input value={form.message_to} onChange={set('message_to')} className="input" />
            </div>
            <div>
              <label className="label">{t('ticket_new.cc_label')}</label>
              <input value={form.message_cc} onChange={set('message_cc')} className="input" />
            </div>
          </>
        )}

        {(typ === 'pomoc' || typ === 'zadanie') && (
          <div>
            <label className="label">{t('ticket_new.team_label')}</label>
            <select value={form.zespol_id} onChange={set('zespol_id')} className="input" required>
              <option value="">{t('ticket_new.team_placeholder')}</option>
              {teamsForType.map(z => <option key={z.id} value={z.id}>{z.nazwa}</option>)}
            </select>
          </div>
        )}

        {typ === 'zadanie' && form.zespol_id && (
          <div>
            <label className="label">{t('ticket_new.assign_label')}</label>
            {teamMembers.length === 0 ? (
              <p className="text-sm text-gray-400">{t('ticket_new.assign_none')}</p>
            ) : (
              <div className="space-y-1 border rounded-lg p-2 dark:border-gray-700 max-h-48 overflow-y-auto">
                {teamMembers.map(u => (
                  <label key={u.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.assign_user_ids.includes(u.id)}
                      onChange={() => toggleAssignee(u.id)}
                    />
                    {u.imie} {u.nazwisko}
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">{t('ticket_new.assign_hint')}</p>
          </div>
        )}

        <div>
          <label className="label">{t('ticket_new.subject_label')}</label>
          <input value={form.message_subject} onChange={set('message_subject')} className="input" required />
        </div>
        <div>
          <label className="label">{t('ticket_new.priority_label')}</label>
          <select value={form.priority} onChange={set('priority')} className="input">
            <option value="1">{t('ticket_new.priority_p1')}</option>
            <option value="2">{t('ticket_new.priority_p2')}</option>
            <option value="3">{t('ticket_new.priority_p3')}</option>
          </select>
        </div>

        {typ === 'zadanie' && (
          <div>
            <label className="label">{t('ticket_new.deadline_label')}</label>
            <input type="datetime-local" value={form.deadline} onChange={set('deadline')} className="input max-w-xs" />
            <p className="text-xs text-gray-400 mt-1">{t('ticket_new.deadline_hint')}</p>
          </div>
        )}

        <div>
          <label className="label">{t('ticket_new.content_label')}</label>
          <textarea value={form.tresc} onChange={set('tresc')} rows={8} className="input resize-y" />
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">{t('ticket_new.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? t('ticket_new.submitting') : t('ticket_new.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
