BEGIN;

CREATE TABLE IF NOT EXISTS article_sauvegarde (
  id_user                   UUID        NOT NULL REFERENCES utilisateur(id_user)  ON DELETE CASCADE,
  id_article                UUID        NOT NULL REFERENCES article(id_article)   ON DELETE CASCADE,
  saved_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_expiration_originale TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id_user, id_article)
);

CREATE INDEX idx_sauvegarde_id_user    ON article_sauvegarde(id_user);
CREATE INDEX idx_sauvegarde_id_article ON article_sauvegarde(id_article);


CREATE TABLE IF NOT EXISTS article_note (
  id_note    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  id_user    UUID         NOT NULL REFERENCES utilisateur(id_user)  ON DELETE CASCADE,
  id_article UUID         NOT NULL REFERENCES article(id_article)   ON DELETE CASCADE,
  contenu    TEXT         NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_note_user_article UNIQUE (id_user, id_article)
);

CREATE INDEX idx_article_note_id_user    ON article_note(id_user);
CREATE INDEX idx_article_note_id_article ON article_note(id_article);

CREATE TRIGGER trg_article_note_updated_at
  BEFORE UPDATE ON article_note
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;