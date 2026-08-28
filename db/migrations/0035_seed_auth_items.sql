INSERT IGNORE INTO `auth_item` (`name`, `type`, `description`, `rule_name`, `created_at`, `updated_at`) VALUES
('admin', 1, NULL, NULL, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('pracownik', 1, 'Pracownik może czytać tylko przydzielone tickiety', NULL, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('user', 1, NULL, NULL, UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
