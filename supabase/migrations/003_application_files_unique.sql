-- One file record per field per application (allows upsert on file replace)
ALTER TABLE application_files ADD CONSTRAINT application_files_application_field_unique UNIQUE (application_id, field_id);
