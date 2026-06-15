-- Helpdesk – pełny schemat bazy danych
-- Generowany z produkcyjnej bazy, kompatybilny z MariaDB 11+
-- Uruchamiany automatycznie przez MariaDB przy pierwszym starcie (pusty wolumen)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ─── Tabele pomocnicze Yii2 RBAC ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `auth_rule` (
  `name` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `data` blob DEFAULT NULL,
  `created_at` int DEFAULT NULL,
  `updated_at` int DEFAULT NULL,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `auth_item` (
  `name` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `type` smallint NOT NULL,
  `description` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `rule_name` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `data` blob DEFAULT NULL,
  `created_at` int DEFAULT NULL,
  `updated_at` int DEFAULT NULL,
  PRIMARY KEY (`name`),
  KEY `rule_name` (`rule_name`),
  KEY `idx-auth_item-type` (`type`),
  CONSTRAINT `auth_item_ibfk_1` FOREIGN KEY (`rule_name`) REFERENCES `auth_rule` (`name`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `auth_item_child` (
  `parent` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `child` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  PRIMARY KEY (`parent`,`child`),
  KEY `child` (`child`),
  CONSTRAINT `auth_item_child_ibfk_1` FOREIGN KEY (`parent`) REFERENCES `auth_item` (`name`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `auth_item_child_ibfk_2` FOREIGN KEY (`child`) REFERENCES `auth_item` (`name`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `auth_assignment` (
  `item_name` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `user_id` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `created_at` int DEFAULT NULL,
  PRIMARY KEY (`item_name`,`user_id`),
  KEY `idx-auth_assignment-user_id` (`user_id`),
  CONSTRAINT `auth_assignment_ibfk_1` FOREIGN KEY (`item_name`) REFERENCES `auth_item` (`name`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─── Użytkownicy ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(245) COLLATE utf8mb4_general_ci NOT NULL,
  `password` varchar(64) COLLATE utf8mb4_general_ci NOT NULL,
  `auth_key` varchar(32) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `access_token` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `imie` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `nazwisko` varchar(45) COLLATE utf8mb4_general_ci NOT NULL,
  `password_reset_token` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `verification_token` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` int DEFAULT NULL,
  `updated_at` int DEFAULT NULL,
  `created_at` int DEFAULT NULL,
  `powiadom_korespondencja` tinyint DEFAULT '1',
  `powiadom_nowy_ticket` tinyint DEFAULT '1',
  `gcmCurrentToken` varchar(345) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_UNIQUE` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `user_oauth` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `provider` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `provider_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_provider` (`provider`,`provider_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `user_presence` (
  `user_id` int NOT NULL,
  `last_seen_at` int NOT NULL,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `push_subscription` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `endpoint` text COLLATE utf8mb4_general_ci NOT NULL,
  `p256dh` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `auth` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_endpoint` (`endpoint`(500)),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─── Zgłoszenia ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `ticket` (
  `id` int NOT NULL AUTO_INCREMENT,
  `numer` varchar(6) COLLATE utf8mb4_general_ci NOT NULL,
  `data_utworzenia` int DEFAULT NULL,
  `data_otwarcia` int DEFAULT NULL,
  `data_zamkniecia` int DEFAULT NULL,
  `status` int DEFAULT NULL,
  `priority` tinyint NOT NULL DEFAULT '2',
  `sla_response_deadline` int DEFAULT NULL,
  `sla_resolution_deadline` int DEFAULT NULL,
  `first_response_at` int DEFAULT NULL,
  `sla_warning_sent_at` int DEFAULT NULL,
  `message_id` varchar(345) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `message_date` datetime DEFAULT NULL,
  `message_from` varchar(345) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `html` longtext COLLATE utf8mb4_general_ci DEFAULT NULL,
  `tresc` longtext COLLATE utf8mb4_general_ci DEFAULT NULL,
  `message_subject` varchar(345) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `odlozony` tinyint DEFAULT '0',
  `odlozony_data` int DEFAULT NULL,
  `podswietl` tinyint DEFAULT '1',
  `message_to` varchar(345) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `message_cc` varchar(1045) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ai_tag` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ai_reason` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `kategoria_id` int DEFAULT NULL,
  `zrodlo` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'email, web_form',
  `autor_token` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ldap_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ldap_ou` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ldap_num` varchar(30) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ldap_data` text COLLATE utf8mb4_general_ci DEFAULT NULL,
  `close_reminder_sent_at` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `numer_UNIQUE` (`numer`),
  UNIQUE KEY `index5` (`message_id`),
  KEY `index3` (`status`),
  KEY `index4` (`numer`),
  KEY `index6` (`odlozony`),
  KEY `idx_ticket_sla_response` (`status`,`sla_response_deadline`),
  KEY `idx_ticket_sla_resolution` (`status`,`sla_resolution_deadline`),
  KEY `idx_autor_token` (`autor_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `korespondencja` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` int NOT NULL,
  `data` int NOT NULL,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` int DEFAULT NULL,
  `updated_at` int DEFAULT NULL,
  `html` longtext COLLATE utf8mb4_general_ci DEFAULT NULL,
  `tresc` longtext COLLATE utf8mb4_general_ci DEFAULT NULL,
  `message_id` varchar(345) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `message_date` datetime DEFAULT NULL,
  `message_from` varchar(345) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `message_subject` varchar(345) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `message_to` varchar(1045) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `message_cc` varchar(1045) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `typ` varchar(20) COLLATE utf8mb4_general_ci DEFAULT 'reply',
  `przeczytane` tinyint(1) NOT NULL DEFAULT '0',
  `mail_error` text COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index3` (`message_id`),
  KEY `fk_korespondencja_ticket1_idx` (`ticket_id`),
  KEY `index4` (`message_from`),
  KEY `index5` (`message_date`),
  CONSTRAINT `fk_korespondencja_ticket1` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `notatka` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` int NOT NULL,
  `data` int NOT NULL,
  `tresc` text COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_notatka_ticket1_idx` (`ticket_id`),
  CONSTRAINT `fk_notatka_ticket1` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `user_has_ticket` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `ticket_id` int NOT NULL,
  `data` int NOT NULL,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` int DEFAULT NULL,
  `updated_at` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_user_has_ticket_ticket1_idx` (`ticket_id`),
  KEY `fk_user_has_ticket_user_idx` (`user_id`),
  CONSTRAINT `fk_user_has_ticket_ticket1` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`id`),
  CONSTRAINT `fk_user_has_ticket_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `plik` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tabela` int NOT NULL COMMENT '1-ticket, 2-korespondencja',
  `ticket_id` int NOT NULL,
  `filepath` varchar(445) COLLATE utf8mb4_general_ci NOT NULL,
  `originalname` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `index2` (`tabela`,`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─── Pozostałe tabele ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `adres` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(345) COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index2` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `alert` (
  `id` int NOT NULL AUTO_INCREMENT,
  `zrodlo_id` int NOT NULL,
  `zrodlo_tabela` int NOT NULL,
  `tresc` varchar(445) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `index2` (`zrodlo_id`,`zrodlo_tabela`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `kategoria_zgloszenia` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nazwa` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `opis` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `kolejnosc` int DEFAULT '0',
  `aktywna` tinyint DEFAULT '1',
  `created_at` int NOT NULL,
  `updated_at` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `level` int DEFAULT NULL,
  `category` varchar(255) COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `log_time` double DEFAULT NULL,
  `prefix` text COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `message` text COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_log_level` (`level`),
  KEY `idx_log_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;

CREATE TABLE IF NOT EXISTS `migration` (
  `version` varchar(180) COLLATE utf8mb4_general_ci NOT NULL,
  `apply_time` int DEFAULT NULL,
  PRIMARY KEY (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `spamer` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(345) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` int DEFAULT NULL,
  `updated_at` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `index2` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='lista spamerow';

CREATE TABLE IF NOT EXISTS `statystyka` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dane` text COLLATE utf8mb4_general_ci DEFAULT NULL,
  `data` varchar(25) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `nazwa` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `index2` (`nazwa`,`data`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─── Ustawienia ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `ustawienia` (
  `id` int NOT NULL AUTO_INCREMENT,
  `adminEmail` varchar(145) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `senderEmail` varchar(145) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `senderName` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `useFileTransport` tinyint DEFAULT '0',
  `encryption` varchar(10) COLLATE utf8mb4_general_ci DEFAULT 'tls',
  `host` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `port` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `username` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `password` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `app_name` varchar(45) COLLATE utf8mb4_general_ci DEFAULT 'Helpdesk',
  `user_passwordResetTokenExpire` int DEFAULT '3600',
  `user_passwordMinLength` int DEFAULT '8',
  `bsVersion` varchar(45) COLLATE utf8mb4_general_ci DEFAULT '4.x',
  `bsDependencyEnabled` tinyint DEFAULT '0',
  `icon-framework` varchar(5) COLLATE utf8mb4_general_ci DEFAULT 'fa',
  `zgoda1` text COLLATE utf8mb4_general_ci NOT NULL DEFAULT (''),
  `zgoda2` text COLLATE utf8mb4_general_ci NOT NULL DEFAULT (''),
  `zgoda3` text COLLATE utf8mb4_general_ci NOT NULL DEFAULT (''),
  `zgoda4` text COLLATE utf8mb4_general_ci NOT NULL DEFAULT (''),
  `rodo` text COLLATE utf8mb4_general_ci NOT NULL DEFAULT (''),
  `strona_startowa` text COLLATE utf8mb4_general_ci NOT NULL DEFAULT (''),
  `imapPath` varchar(45) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `imapLogin` varchar(45) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `imapPassword` varchar(45) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `serverEncoding` varchar(45) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'utf-8',
  `decodeMimeStr` varchar(6) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'true',
  `firstEmail` varchar(445) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `email_stopka` text COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email_receive` tinyint DEFAULT '1',
  `command_index` tinyint DEFAULT '0',
  `ticket_czas_ostrzezenia` int DEFAULT NULL,
  `ticket_czas_zamykania` int DEFAULT NULL,
  `email_ostrzeganie_zamykam` text COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email_zamykam` text COLLATE utf8mb4_general_ci DEFAULT NULL,
  `imapServer` varchar(245) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `imapPort` int DEFAULT NULL,
  `onesignal_app_id` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `onesignal_app_key_token` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `onesignal_app_user_token` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `powiadom_nadawce` tinyint DEFAULT '1',
  `ldap_enabled` tinyint DEFAULT '0',
  `ldap_host` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ldap_port` int DEFAULT '389',
  `ldap_base_dn` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ldap_bind_dn` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ldap_bind_password` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ldap_user_filter` varchar(255) COLLATE utf8mb4_general_ci DEFAULT '(mail={email})',
  `ldap_attr_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT 'cn',
  `ldap_attr_type` varchar(100) COLLATE utf8mb4_general_ci DEFAULT 'employeeType',
  `ldap_tls` tinyint DEFAULT '0',
  `formularz_publiczny` tinyint DEFAULT '1',
  `formularz_tytul` varchar(255) COLLATE utf8mb4_general_ci DEFAULT 'Formularz zgłoszenia',
  `logo_path` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `kontakt_telefony` text COLLATE utf8mb4_general_ci DEFAULT NULL,
  `kontakt_emaile` text COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ms_graph_enabled` tinyint(1) DEFAULT '0',
  `ms_graph_client_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ms_graph_client_secret` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ms_graph_tenant_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ms_graph_mailbox` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `clean_mailbox` tinyint(1) DEFAULT '0',
  `clean_mailbox_days` int DEFAULT '0',
  `strip_quoted_reply` tinyint(1) DEFAULT '1',
  `reminder_enabled` tinyint(1) DEFAULT '1',
  `reminder_delay_hours` int DEFAULT '24',
  `reminder_hour` int DEFAULT '8',
  `reminder_last_date` varchar(10) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `site_url` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `weekend_start_hour` tinyint DEFAULT '18',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ─── Dane startowe ───────────────────────────────────────────────────────────

-- Role RBAC wymagane przez auth_assignment
INSERT IGNORE INTO `auth_item` (`name`, `type`, `created_at`, `updated_at`)
VALUES
  ('admin',     1, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  ('pracownik', 1, UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- Wiersz konfiguracji (musi istnieć z id=1)
INSERT IGNORE INTO `ustawienia` (`id`, `app_name`) VALUES (1, 'Helpdesk');
