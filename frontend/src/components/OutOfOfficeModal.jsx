import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import toast from 'react-hot-toast';

function tsToDate(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

export default function OutOfOfficeModal({ user, onClose, onSaved }) {
  const { t } = useTranslation();
  const [od, setOd] = useState(tsToDate(user?.poza_biurem_od));
  const [doDate, setDoDate] = useState(tsToDate(user?.poza_biurem_do));
  const [powod, setPowod] = useState(user?.poza_biurem_powod || '');
  const [pending, setPending] = useState(false);

  const hasExisting = !!(user?.poza_biurem_od && user?.poza_biurem_do);

  const submit = async (payload) => {
    setPending(true);
    try {
      const { data } = await api.put('/users/me/poza-biurem', payload);
      onSaved({
        poza_biurem_od: data.poza_biurem_od,
        poza_biurem_do: data.poza_biurem_do,
        poza_biurem_powod: data.poza_biurem_powod,
        poza_biurem_zrodlo: data.poza_biurem_zrodlo,
        poza_biurem_aktywne: data.poza_biurem_aktywne,
      });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setPending(false);
    }
  };

  const save = () => {
    if (!od || !doDate) return toast.error(t('profile.ooo_error_dates'));
    const odTs = Math.floor(new Date(od).getTime() / 1000);
    const doDateObj = new Date(doDate);
    doDateObj.setHours(23, 59, 59);
    const doTs = Math.floor(doDateObj.getTime() / 1000);
    if (odTs > doTs) return toast.error(t('profile.ooo_error_order'));
    submit({ od: odTs, do: doTs, powod }).then(() => toast.success(t('profile.ooo_saved')));
  };

  const clear = () => {
    submit({ od: null, do: null, powod: null }).then(() => toast.success(t('profile.ooo_cleared')));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-sm border dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-800">
          <h3 className="font-semibold">{t('profile.ooo_title')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl">×</button>
        </div>
        {user?.poza_biurem_zrodlo === 'microsoft' && (
          <div className="mx-4 mt-3 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-1.5">
            {t('profile.ooo_synced_hint')}
          </div>
        )}
        <div className="p-4 space-y-3">
          <div>
            <label className="label">{t('profile.ooo_from')}</label>
            <input type="date" value={od} onChange={e => setOd(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">{t('profile.ooo_to')}</label>
            <input type="date" value={doDate} onChange={e => setDoDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">{t('profile.ooo_reason')}</label>
            <input
              type="text"
              value={powod}
              onChange={e => setPowod(e.target.value.slice(0, 255))}
              placeholder={t('profile.ooo_reason_placeholder')}
              className="input"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t dark:border-gray-800">
          {hasExisting
            ? <button onClick={clear} disabled={pending} className="btn-danger">{t('profile.ooo_clear')}</button>
            : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
            <button onClick={save} disabled={pending} className="btn-primary">{t('common.save')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
