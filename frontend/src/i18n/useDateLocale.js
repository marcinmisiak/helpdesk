import { useTranslation } from 'react-i18next';
import { pl, enUS, uk } from 'date-fns/locale';

export default function useDateLocale() {
  const { i18n } = useTranslation();
  if (i18n.language?.startsWith('en')) return enUS;
  if (i18n.language?.startsWith('uk')) return uk;
  return pl;
}
