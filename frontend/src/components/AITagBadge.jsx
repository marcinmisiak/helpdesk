import { useTranslation } from 'react-i18next';

const CLS = {
  spam:    'bg-gray-100 text-gray-600',
  niskie:  'bg-green-100 text-green-700',
  normalne:'bg-blue-100 text-blue-700',
  pilne:   'bg-red-100 text-red-700',
};

const TAG_KEYS = {
  spam: 'spam',
  niskie: 'question',
  normalne: 'normal',
  pilne: 'urgent',
};

export default function AITagBadge({ tag, reason }) {
  const { t } = useTranslation();
  const cls = CLS[tag];
  if (!cls) return null;
  return (
    <span title={reason || ''} className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded ${cls}`}>
      🤖 {t(`ai_tag.${TAG_KEYS[tag] || tag}`, { defaultValue: tag })}
    </span>
  );
}
