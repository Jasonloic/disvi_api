BEGIN;


CREATE TYPE role_enum        AS ENUM ('Admin', 'Veilleur');
CREATE TYPE type_source_enum AS ENUM ('Web', 'RSS', 'API_Social');
CREATE TYPE zone_enum        AS ENUM ('nationale', 'internationale');
CREATE TYPE type_lieu_enum   AS ENUM ('pays', 'region', 'departement', 'ville', 'village');
CREATE TYPE statut_note_enum AS ENUM ('en_generation', 'genere', 'envoye');
CREATE TYPE type_periode_enum AS ENUM ('quotidienne', 'hebdo', 'mensuelle');
CREATE TYPE type_alerte_enum AS ENUM ('in_app', 'flambeau');


CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TABLE IF NOT EXISTS utilisateur (
  id_user      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(255)  NOT NULL UNIQUE,
  mot_de_passe VARCHAR(255)  NOT NULL,
  role         role_enum     NOT NULL DEFAULT 'Veilleur',
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_utilisateur_updated_at
  BEFORE UPDATE ON utilisateur
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


CREATE TABLE IF NOT EXISTS source (
  id_source       SERIAL           PRIMARY KEY,
  nom_source      VARCHAR(100)     NOT NULL,
  type_source     type_source_enum NOT NULL,
  url_source      VARCHAR(1000),
  config_auth     JSONB,
  frequence_check INT,
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN source.config_auth IS
  'Clés API / tokens. À chiffrer au repos en production (pgcrypto ou vault).';
COMMENT ON COLUMN source.url_source IS
  'URL effective du flux RSS ou du profil réseau social.';

CREATE TRIGGER trg_source_updated_at
  BEFORE UPDATE ON source
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


CREATE TABLE IF NOT EXISTS auteur (
  id_auteur     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  id_source     INT          NOT NULL REFERENCES source(id_source) ON DELETE CASCADE,
  handle_social VARCHAR(100),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auteur_id_source     ON auteur(id_source);
CREATE INDEX idx_auteur_handle_social ON auteur(handle_social);


CREATE TABLE IF NOT EXISTS article (
  id_article       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  id_source        INT           NOT NULL REFERENCES source(id_source) ON DELETE CASCADE,
  id_auteur        UUID          REFERENCES auteur(id_auteur) ON DELETE SET NULL,
  titre            VARCHAR(500)  NOT NULL,
  contenu_brut     TEXT,
  url_origine      VARCHAR(1000) UNIQUE,
  vignette         VARCHAR(1000),
  date_publication TIMESTAMPTZ,
  date_expiration  TIMESTAMPTZ   NOT NULL DEFAULT NOW() + INTERVAL '90 days',
  est_indexe       BOOLEAN       NOT NULL DEFAULT FALSE,
  zone             zone_enum,
  pays             VARCHAR(100),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_article_date_expiration ON article(date_expiration);
CREATE INDEX idx_article_id_source       ON article(id_source);
CREATE INDEX idx_article_zone            ON article(zone);
CREATE INDEX idx_article_date_publication ON article(date_publication DESC);


CREATE INDEX idx_article_fts ON article
  USING GIN (to_tsvector('french', coalesce(titre, '') || ' ' || coalesce(contenu_brut, '')));

CREATE TABLE IF NOT EXISTS analyse_ia (
  id_article      UUID         PRIMARY KEY REFERENCES article(id_article) ON DELETE CASCADE,
  resume_auto     TEXT,
  score_confiance FLOAT        CHECK (score_confiance >= 0 AND score_confiance <= 1),
  entites_nommees JSONB,
  zone_inferee    zone_enum,
  pays_infere     VARCHAR(100),
  est_valide      BOOLEAN      NOT NULL DEFAULT FALSE,
  correction      TEXT,
  id_validateur   UUID         REFERENCES utilisateur(id_user) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN analyse_ia.entites_nommees IS
  'Schéma : {"organisations":[...],"personnes":[...],"lieux":[{"nom","type","pays","zone"}]}';

CREATE TRIGGER trg_analyse_ia_updated_at
  BEFORE UPDATE ON analyse_ia
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


CREATE TABLE IF NOT EXISTS entite_geo (
  id_lieu      SERIAL           PRIMARY KEY,
  nom          VARCHAR(200)     NOT NULL,
  nom_local    VARCHAR(200),
  type_lieu    type_lieu_enum   NOT NULL,
  region_admin VARCHAR(100),
  pays         VARCHAR(100)     NOT NULL DEFAULT 'Cameroun',
  zone         zone_enum        NOT NULL DEFAULT 'nationale',
  latitude     FLOAT,
  longitude    FLOAT,
  source_ref   VARCHAR(50)
);

CREATE INDEX idx_entite_geo_nom  ON entite_geo(nom);
CREATE INDEX idx_entite_geo_zone ON entite_geo(zone);

CREATE TABLE IF NOT EXISTS entite_geo_variante (
  variante      VARCHAR(300) PRIMARY KEY,
  id_lieu       INT          NOT NULL REFERENCES entite_geo(id_lieu) ON DELETE CASCADE,
  variante_norm VARCHAR(300) NOT NULL
);

CREATE INDEX idx_entite_geo_variante_norm ON entite_geo_variante(variante_norm);


CREATE TABLE IF NOT EXISTS categorie (
  id_cat   SERIAL       PRIMARY KEY,
  nom_cat  VARCHAR(100) NOT NULL UNIQUE
);


CREATE TABLE IF NOT EXISTS art_cat (
  id_article UUID NOT NULL REFERENCES article(id_article)   ON DELETE CASCADE,
  id_cat     INT  NOT NULL REFERENCES categorie(id_cat)     ON DELETE CASCADE,
  PRIMARY KEY (id_article, id_cat)
);


CREATE TABLE IF NOT EXISTS note (
  id_note         UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  id_createur     UUID              NOT NULL REFERENCES utilisateur(id_user) ON DELETE RESTRICT,
  titre_note      VARCHAR(255),
  type_periode    type_periode_enum NOT NULL,
  date_debut      TIMESTAMPTZ       NOT NULL,
  date_fin        TIMESTAMPTZ       NOT NULL,
  zone            zone_enum,
  pays            VARCHAR(100),
  nb_informations INT,
  statut          statut_note_enum  NOT NULL DEFAULT 'en_generation',
  date_generation TIMESTAMPTZ,
  url_document    VARCHAR(500),
  config_filtres  JSONB,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_note_dates CHECK (date_fin >= date_debut)
);

CREATE INDEX idx_note_statut      ON note(statut);
CREATE INDEX idx_note_id_createur ON note(id_createur);

CREATE TRIGGER trg_note_updated_at
  BEFORE UPDATE ON note
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


CREATE TABLE IF NOT EXISTS note_article (
  id_note    UUID NOT NULL REFERENCES note(id_note)       ON DELETE CASCADE,
  id_article UUID NOT NULL REFERENCES article(id_article) ON DELETE CASCADE,
  PRIMARY KEY (id_note, id_article)
);


CREATE TABLE IF NOT EXISTS alerte (
  id_alerte       BIGSERIAL        PRIMARY KEY,
  type_alerte     type_alerte_enum NOT NULL,
  id_article      UUID             REFERENCES article(id_article) ON DELETE CASCADE,
  id_rapport      UUID             REFERENCES note(id_note)       ON DELETE CASCADE,
  id_destinataire UUID             NOT NULL REFERENCES utilisateur(id_user) ON DELETE CASCADE,
  statut_envoi    BOOLEAN          NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_alerte_source CHECK (
    (id_article IS NOT NULL AND id_rapport IS NULL) OR
    (id_article IS NULL     AND id_rapport IS NOT NULL)
  )
);

CREATE INDEX idx_alerte_id_destinataire ON alerte(id_destinataire);
CREATE INDEX idx_alerte_statut_envoi    ON alerte(statut_envoi) WHERE statut_envoi = FALSE;

COMMIT;