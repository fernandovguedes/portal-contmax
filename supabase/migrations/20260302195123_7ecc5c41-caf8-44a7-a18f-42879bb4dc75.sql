ALTER TABLE empresas 
  ADD COLUMN numero_questor_confirmado boolean NOT NULL DEFAULT false;

UPDATE empresas SET numero_questor_confirmado = true;