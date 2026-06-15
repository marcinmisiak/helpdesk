import { formatDistanceStrict } from 'date-fns';
import { useTranslation } from 'react-i18next';
import useDateLocale from '../i18n/useDateLocale';

const CLASSES = {
  ok: 'badge-green',
  warning: 'badge-yellow',
  breach: 'badge-red',
};

export default function SLABadge({ status = 'ok', secondsLeft = null }) {
  const { t } = useTranslation();
  const locale = useDateLocale();

  const label = t(`sla.${status}`, { defaultValue: t('sla.ok') });
  const cls = CLASSES[status] || CLASSES.ok;

  let suffix = '';
  if (typeof secondsLeft === 'number' && Number.isFinite(secondsLeft)) {
    if (secondsLeft > 0) {
      suffix = `, ${formatDistanceStrict(0, secondsLeft * 1000, { locale })}`;
    } else if (secondsLeft <= 0) {
      suffix = t('sla.overdue');
    }
  }

  return (
    <span className={cls} title={label}>
      {label}{suffix}
    </span>
  );
}
