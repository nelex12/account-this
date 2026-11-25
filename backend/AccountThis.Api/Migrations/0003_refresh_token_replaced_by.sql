ALTER TABLE refresh_tokens ADD COLUMN replaced_by BIGINT REFERENCES refresh_tokens(id);
