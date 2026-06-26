-- Zdjęcie profilowe użytkownika — ścieżka relatywna do UPLOAD_DIR (np. "avatars/user-6-...jpg"),
-- serwowana publicznie pod /pliki/ tak samo jak inne pliki (potrzebne na publicznym /status/:token i w mailach).
ALTER TABLE user ADD COLUMN avatar_path VARCHAR(255) DEFAULT NULL;
