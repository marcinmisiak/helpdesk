import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import toast from 'react-hot-toast';

export default function TicketNew() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ message_from: '', message_to: '', message_subject: '', tresc: '', message_cc: '', priority: '2' });
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.message_from || !form.message_subject) return toast.error(t('ticket_new.error_required'));
    setSaving(true);
    try {
      const { data } = await api.post('/tickets', form);
      toast.success(t('ticket_new.success'));
      navigate(`/tickets/${data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || t('ticket_new.error_default'));
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-4">{t('ticket_new.title')}</h2>
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <label className="label">{t('ticket_new.from_label')}</label>
          <input value={form.message_from} onChange={set('message_from')} className="input" type="email" required />
        </div>
        <div>
          <label className="label">{t('ticket_new.to_label')}</label>
          <input value={form.message_to} onChange={set('message_to')} className="input" />
        </div>
        <div>
          <label className="label">{t('ticket_new.cc_label')}</label>
          <input value={form.message_cc} onChange={set('message_cc')} className="input" />
        </div>
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
        <div>
          <label className="label">{t('ticket_new.content_label')}</label>
          <textarea value={form.tresc} onChange={set('tresc')} rows={8} className="input resize-y" />
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => navigate('/tickets')} className="btn-secondary">{t('ticket_new.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? t('ticket_new.submitting') : t('ticket_new.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
