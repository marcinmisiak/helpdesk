'use strict';

module.exports = {
  // Tematy
  subject_new_ticket: '[{appName}] Nowe zgłoszenie #{numer}',
  subject_new_ticket_channel: '[{appName}] Nowe zgłoszenie #{numer} — zespół {team}',
  subject_unassigned_single: '[{appName}] {count} nieodebrane zgłoszenie — wymaga przypisania',
  subject_unassigned_plural: '[{appName}] {count} nieodebrane zgłoszenia — wymagają przypisania',
  subject_unassigned_channel_single: '[{appName}] {count} nieodebrane zgłoszenie w zespole {team}',
  subject_unassigned_channel_plural: '[{appName}] {count} nieodebrane zgłoszenia w zespole {team}',
  subject_pending_single: '[{appName}] Przypomnienie: {count} zgłoszenie czeka na odpowiedź',
  subject_pending_plural: '[{appName}] Przypomnienie: {count} zgłoszeń czeka na odpowiedź',
  subject_close_reminder_with_subject: '[{appName}] Czy Twoje zgłoszenie #{numer} zostało rozwiązane? — {subject}',
  subject_close_reminder: '[{appName}] Czy Twoje zgłoszenie #{numer} zostało rozwiązane?',
  subject_assigned: '[{appName}] Przypisano Cię do zgłoszenia #{numer}',
  subject_unassigned_from: '[{appName}] Usunięto Cię z przypisanych do zgłoszenia #{numer}',
  subject_closed_by_requester: '[{appName}] Zgłoszenie #{numer} zamknięte przez zgłaszającego',
  subject_reset_password: 'Resetowanie hasła — {appName}',

  // Treści maili
  greeting_day: 'Dzień dobry{name},',
  greeting_day_with_name: 'Dzień dobry, {name},',
  greeting_formal: 'Szanowni Państwo,',
  greeting_formal_name: 'Szanowna Pani / Szanowny Panie {name},',

  new_ticket_intro: 'Do systemu helpdesk wpłynęło nowe zgłoszenie (źródło: <strong>{source}</strong>).',
  new_ticket_channel_intro: 'Do zespołu <strong>{team}</strong> wpłynęło nowe zgłoszenie (źródło: <strong>{source}</strong>). Nikt z zespołu nie jest obecnie zalogowany w systemie.',
  source_web_form: 'formularz WWW',
  source_email: 'email',
  source_live_chat: 'czat na żywo',
  col_ticket_no: 'Nr zgłoszenia',
  col_from: 'Od',
  col_subject: 'Temat',
  col_team: 'Zespół',
  col_assigned_by: 'Przypisał/a',
  col_removed_by: 'Usunął/a',
  btn_view_ticket: 'Przejdź do zgłoszenia',
  btn_view_tickets: 'Przejdź do listy zgłoszeń',
  btn_view_my: 'Przejdź do moich zgłoszeń',

  unassigned_intro: 'W systemie czeka <strong>{count} {unit}</strong> bez przypisanego pracownika od ponad {hours} godzin.',
  unassigned_channel_intro: 'W zespole <strong>{team}</strong> czeka <strong>{count} {unit}</strong> bez przypisanego pracownika od ponad {hours} godzin.',
  unassigned_unit_1: 'zgłoszenie',
  unassigned_unit_234: 'zgłoszenia',
  unassigned_unit_many: 'zgłoszeń',

  pending_intro: 'Masz <strong>{count} {unit}</strong> z nową korespondencją, na którą nie udzielono odpowiedzi od ponad {hours} godzin.',
  pending_unit_1: 'zgłoszenie',
  pending_unit_234: 'zgłoszenia',
  pending_unit_many: 'zgłoszeń',

  close_reminder_intro: 'Uprzejmie informujemy, że Państwa zgłoszenie nr <strong>#{numer}</strong> jest nadal otwarte w naszym systemie.',
  close_reminder_body: 'Jeżeli problem został rozwiązany, prosimy o zamknięcie zgłoszenia klikając poniższy przycisk:',
  btn_close_ticket: 'Zamknij zgłoszenie',
  close_reminder_ignore: 'Jeżeli sprawa nadal wymaga uwagi, prosimy o ignorowanie tej wiadomości — zgłoszenie pozostanie otwarte. Można również dodać dodatkowe informacje klikając powyższy link.',

  assigned_intro: 'Zostałeś/aś przypisany/a do zgłoszenia w systemie helpdesk.',
  unassigned_from_intro: 'Zostałeś/aś usunięty/a z listy przypisanych do zgłoszenia w systemie helpdesk.',
  closed_by_requester_intro: 'Zgłaszający zamknął zgłoszenie <strong>#{numer}</strong> — „{subject}".',

  reset_password_intro: 'Otrzymaliśmy prośbę o zresetowanie hasła do konta w systemie {appName} przypisanego do tego adresu email.',
  reset_password_body: 'Aby ustawić nowe hasło, prosimy kliknąć poniższy przycisk:',
  btn_reset_password: 'Resetuj hasło',
  reset_password_expire: 'Link jest ważny przez {hours} godzin. Jeśli nie prosiłeś/aś o resetowanie hasła, możesz zignorować tę wiadomość.',

  // Potwierdzenie przyjęcia zgłoszenia (publiczny formularz)
  subject_ticket_received: 'Potwierdzenie przyjęcia zgłoszenia nr #{numer}',
  ticket_received_intro: 'Uprzejmie informujemy, że Państwa zgłoszenie zostało przyjęte przez nasz system obsługi zgłoszeń.',
  ticket_received_col_number: 'Numer zgłoszenia',
  ticket_received_col_category: 'Kategoria',
  ticket_received_col_content: 'Treść zgłoszenia',
  ticket_received_footer: 'Nasz zespół zajmie się Państwa zgłoszeniem i udzieli odpowiedzi tak szybko, jak to będzie możliwe.',
  ticket_received_note: 'Prosimy zachować numer zgłoszenia do ewentualnej korespondencji.',

  // Odpowiedź zgłaszającego — powiadomienie dla pracownika
  public_reply_intro: 'Zgłaszający dodał wiadomość do zgłoszenia <strong>#{numer}</strong>.',

  // Tabela ticketów w mailach
  col_waiting: 'Czeka',
  no_subject: '(brak tematu)',

  // Ankieta satysfakcji (CSAT)
  subject_satisfaction_survey: '[{appName}] Oceń obsługę zgłoszenia #{numer}',
  survey_intro: 'Państwa zgłoszenie nr <strong>#{numer}</strong> zostało zamknięte. Prosimy o chwilę czasu i ocenę jakości naszej obsługi.',
  btn_rate_survey: 'Oceń obsługę',
};
