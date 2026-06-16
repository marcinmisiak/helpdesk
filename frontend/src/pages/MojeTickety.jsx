import { useTranslation } from 'react-i18next';
import TicketList from './TicketList';

export default function MojeTickety() {
  const { t } = useTranslation();
  return <TicketList title={t('nav.my_tickets')} queryParams={{ moje: '1' }} />;
}
