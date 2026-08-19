import { useTranslation } from 'react-i18next';
import TicketList from './TicketList';

export default function MojeZespoly() {
  const { t } = useTranslation();
  return <TicketList title={t('nav.my_teams')} queryParams={{ moje_zespoly: '1' }} />;
}
