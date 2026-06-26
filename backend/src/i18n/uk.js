'use strict';

module.exports = {
  // Subjects
  subject_new_ticket: '[{appName}] Нова заявка #{numer}',
  subject_new_ticket_channel: '[{appName}] Нова заявка #{numer} — команда {team}',
  subject_unassigned_single: '[{appName}] {count} заявка без відповідального — потребує призначення',
  subject_unassigned_plural: '[{appName}] {count} заявок без відповідального — потребують призначення',
  subject_unassigned_channel_single: '[{appName}] {count} заявка без відповідального в команді {team}',
  subject_unassigned_channel_plural: '[{appName}] {count} заявок без відповідального в команді {team}',
  subject_pending_single: '[{appName}] Нагадування: {count} заявка очікує відповіді',
  subject_pending_plural: '[{appName}] Нагадування: {count} заявок очікують відповіді',
  subject_close_reminder_with_subject: '[{appName}] Заявку #{numer} вирішено? — {subject}',
  subject_close_reminder: '[{appName}] Заявку #{numer} вирішено?',
  subject_assigned: '[{appName}] Вам призначено заявку #{numer}',
  subject_unassigned_from: '[{appName}] Вас видалено із заявки #{numer}',
  subject_closed_by_requester: '[{appName}] Заявку #{numer} закрито заявником',
  subject_reset_password: 'Скидання пароля — {appName}',

  // Email body
  greeting_day: 'Доброго дня{name},',
  greeting_day_with_name: 'Доброго дня, {name},',
  greeting_formal: 'Шановний/-а,',
  greeting_formal_name: 'Шановний/-а {name},',

  new_ticket_intro: 'У системі підтримки отримано нову заявку (джерело: <strong>{source}</strong>).',
  new_ticket_channel_intro: 'До команди <strong>{team}</strong> надійшла нова заявка (джерело: <strong>{source}</strong>). Наразі ніхто з команди не увійшов у систему.',
  source_web_form: 'веб-форма',
  source_email: 'електронна пошта',
  source_live_chat: 'чат',
  col_ticket_no: 'Номер заявки',
  col_from: 'Від',
  col_subject: 'Тема',
  col_team: 'Команда',
  col_assigned_by: 'Призначив',
  col_removed_by: 'Видалив',
  btn_view_ticket: 'Переглянути заявку',
  btn_view_tickets: 'Переглянути список заявок',
  btn_view_my: 'Переглянути мої заявки',

  unassigned_intro: 'У системі є <strong>{count} {unit}</strong> без відповідального вже більше {hours} год.',
  unassigned_channel_intro: 'У команді <strong>{team}</strong> є <strong>{count} {unit}</strong> без відповідального вже більше {hours} год.',
  unassigned_unit_1: 'заявка',
  unassigned_unit_234: 'заявки',
  unassigned_unit_many: 'заявок',

  pending_intro: 'У вас є <strong>{count} {unit}</strong> з новим листуванням без відповіді протягом більше {hours} год.',
  pending_unit_1: 'заявка',
  pending_unit_234: 'заявки',
  pending_unit_many: 'заявок',

  close_reminder_intro: 'Повідомляємо, що ваша заявка <strong>#{numer}</strong> все ще відкрита в нашій системі.',
  close_reminder_body: 'Якщо ваше питання вирішено, закрийте заявку, натиснувши кнопку нижче:',
  btn_close_ticket: 'Закрити заявку',
  close_reminder_ignore: 'Якщо питання ще потребує уваги — проігноруйте це повідомлення, заявка залишиться відкритою. Ви також можете додати додаткову інформацію, перейшовши за посиланням вище.',

  assigned_intro: 'Вам призначено заявку в системі підтримки.',
  unassigned_from_intro: 'Вас видалено зі списку відповідальних за заявку в системі підтримки.',
  closed_by_requester_intro: 'Заявник закрив заявку <strong>#{numer}</strong> — «{subject}».',

  reset_password_intro: 'Ми отримали запит на скидання пароля для облікового запису {appName}, пов\'язаного з цією адресою електронної пошти.',
  reset_password_body: 'Щоб встановити новий пароль, натисніть кнопку нижче:',
  btn_reset_password: 'Скинути пароль',
  reset_password_expire: 'Посилання дійсне протягом {hours} год. Якщо ви не запитували скидання пароля — проігноруйте цей лист.',

  // Ticket receipt confirmation (public form)
  subject_ticket_received: 'Підтвердження отримання заявки #{numer}',
  ticket_received_intro: 'Підтверджуємо, що ваш запит отримано нашою системою підтримки.',
  ticket_received_col_number: 'Номер заявки',
  ticket_received_col_category: 'Категорія',
  ticket_received_col_content: 'Зміст заявки',
  ticket_received_footer: 'Наша команда розгляне ваш запит і відповість якнайшвидше.',
  ticket_received_note: 'Будь ласка, збережіть номер заявки для подальшого листування.',

  // Requester reply — worker notification
  public_reply_intro: 'Заявник додав повідомлення до заявки <strong>#{numer}</strong>.',

  // Ticket table in emails
  col_waiting: 'Очікує',
  no_subject: '(без теми)',

  // Опитування задоволеності (CSAT)
  subject_satisfaction_survey: '[{appName}] Оцініть обробку заявки #{numer}',
  survey_intro: 'Вашу заявку <strong>#{numer}</strong> закрито. Просимо приділити хвилину часу та оцінити якість нашої підтримки.',
  btn_rate_survey: 'Оцінити підтримку',
};
