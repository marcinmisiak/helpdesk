-- Łączenie zgłoszeń (scalanie duplikatów w jeden ticket)
ALTER TABLE ticket ADD COLUMN merged_into_id INT NULL DEFAULT NULL;
ALTER TABLE ticket ADD KEY idx_merged_into_id (merged_into_id);
