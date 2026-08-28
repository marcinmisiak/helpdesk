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
