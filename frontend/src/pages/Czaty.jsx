import { useTranslation } from 'react-i18next';
import TicketList from './TicketList';

export default function Czaty() {
  const { t } = useTranslation();
  return <TicketList title={t('nav.chats')} queryParams={{ zrodlo: 'live_chat,messenger' }} />;
}
