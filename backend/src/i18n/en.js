'use strict';

module.exports = {
  // Subjects
  subject_new_ticket: '[{appName}] New ticket #{numer}',
  subject_new_ticket_channel: '[{appName}] New ticket #{numer} — team {team}',
  subject_unassigned_single: '[{appName}] {count} unassigned ticket — requires assignment',
  subject_unassigned_plural: '[{appName}] {count} unassigned tickets — require assignment',
  subject_unassigned_channel_single: '[{appName}] {count} unassigned ticket in team {team}',
  subject_unassigned_channel_plural: '[{appName}] {count} unassigned tickets in team {team}',
  subject_pending_single: '[{appName}] Reminder: {count} ticket waiting for reply',
  subject_pending_plural: '[{appName}] Reminder: {count} tickets waiting for reply',
  subject_close_reminder_with_subject: '[{appName}] Has your ticket #{numer} been resolved? — {subject}',
  subject_close_reminder: '[{appName}] Has your ticket #{numer} been resolved?',
  subject_assigned: '[{appName}] You have been assigned to ticket #{numer}',
  subject_unassigned_from: '[{appName}] You have been removed from ticket #{numer}',
  subject_closed_by_requester: '[{appName}] Ticket #{numer} closed by requester',
  subject_internal_note: '[{appName}] New internal note on ticket #{numer}',
  subject_reset_password: 'Password reset — {appName}',

  // Email body
  greeting_day: 'Hello{name},',
  greeting_day_with_name: 'Hello, {name},',
  greeting_formal: 'Dear Sir/Madam,',
  greeting_formal_name: 'Dear {name},',

  new_ticket_intro: 'A new ticket has been received in the help desk system (source: <strong>{source}</strong>).',
  new_ticket_channel_intro: 'A new ticket has been received for team <strong>{team}</strong> (source: <strong>{source}</strong>). No one from the team is currently logged in.',
  source_web_form: 'web form',
  source_email: 'email',
  source_live_chat: 'live chat',
  col_ticket_no: 'Ticket no.',
  col_from: 'From',
  col_subject: 'Subject',
  col_team: 'Team',
  col_assigned_by: 'Assigned by',
  col_removed_by: 'Removed by',
  btn_view_ticket: 'View ticket',
  btn_view_tickets: 'View ticket list',
  btn_view_my: 'View my tickets',

  unassigned_intro: 'There {count_verb} <strong>{count} {unit}</strong> without an assigned agent for more than {hours} hours.',
  unassigned_channel_intro: 'Team <strong>{team}</strong> has <strong>{count} {unit}</strong> without an assigned agent for more than {hours} hours.',
  unassigned_unit_1: 'ticket',
  unassigned_unit_234: 'tickets',
  unassigned_unit_many: 'tickets',

  pending_intro: 'You have <strong>{count} {unit}</strong> with new correspondence that has not been replied to for more than {hours} hours.',
  pending_unit_1: 'ticket',
  pending_unit_234: 'tickets',
  pending_unit_many: 'tickets',

  close_reminder_intro: 'We would like to inform you that your ticket <strong>#{numer}</strong> is still open in our system.',
  close_reminder_body: 'If your issue has been resolved, please close the ticket by clicking the button below:',
  btn_close_ticket: 'Close ticket',
  close_reminder_ignore: 'If the issue still requires attention, please ignore this message — the ticket will remain open. You can also add additional information by clicking the link above.',

  assigned_intro: 'You have been assigned to a ticket in the help desk system.',
  unassigned_from_intro: 'You have been removed from the list of assignees for a ticket in the help desk system.',
  closed_by_requester_intro: 'The requester has closed ticket <strong>#{numer}</strong> — "{subject}".',

  reset_password_intro: 'We received a request to reset the password for the {appName} account associated with this email address.',
  reset_password_body: 'To set a new password, please click the button below:',
  btn_reset_password: 'Reset password',
  reset_password_expire: 'The link is valid for {hours} hours. If you did not request a password reset, you can ignore this message.',

  subject_status_otp: 'Access code for ticket #{numer} — {appName}',
  status_otp_intro: 'We received an attempt to view the status of ticket <strong>#{numer}</strong>. To confirm it’s you, enter the code below on the status page:',
  status_otp_expire: 'The code is valid for {minutes} minutes. If you did not try to view this ticket’s status, you can ignore this message.',

  // Ticket receipt confirmation (public form)
  subject_ticket_received: 'Confirmation of ticket receipt #{numer}',
  ticket_received_intro: 'We confirm that your request has been received by our support system.',
  ticket_received_col_number: 'Ticket number',
  ticket_received_col_category: 'Category',
  ticket_received_col_content: 'Ticket content',
  ticket_received_footer: 'Our team will handle your request and respond as soon as possible.',
  ticket_received_note: 'Please keep the ticket number for any future correspondence.',

  // Requester reply — worker notification
  public_reply_intro: 'The requester added a message to ticket <strong>#{numer}</strong>.',

  // New internal note — notification for assigned workers
  internal_note_intro: '<strong>{author}</strong> added an internal note to ticket <strong>#{numer}</strong>.',

  // Ticket table in emails
  col_waiting: 'Waiting',
  no_subject: '(no subject)',

  // Satisfaction survey (CSAT)
  subject_satisfaction_survey: '[{appName}] Rate the support for ticket #{numer}',
  survey_intro: 'Your ticket <strong>#{numer}</strong> has been closed. We would appreciate a moment of your time to rate the quality of our support.',
  btn_rate_survey: 'Rate the support',
};
