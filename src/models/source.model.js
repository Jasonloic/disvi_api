const { pool } = require('../config/database');

const SELECT_FIELDS = `
  id_source, nom_source, type_source, url_source,
  config_auth, frequence_check, created_at, updated_at
`;

async function findAllSources() {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM source ORDER BY created_at DESC`
  );
  return rows;
}

async function findSourceById(id) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM source WHERE id_source = $1`,
    [id]
  );
  return rows[0] ?? null;
}

async function findSourceByUrl(urlSource) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM source WHERE url_source = $1`,
    [urlSource]
  );
  return rows[0] ?? null;
}

async function createRSSSource({ nom_source, url_source, frequence_check }) {
  const { rows } = await pool.query(
    `INSERT INTO source (nom_source, type_source, url_source, frequence_check)
     VALUES ($1, 'RSS', $2, $3)
     RETURNING ${SELECT_FIELDS}`,
    [nom_source, url_source, frequence_check ?? 60]
  );
  return rows[0];
}

async function createSocialSource({ nom_source, config_auth }) {
  const { rows } = await pool.query(
    `INSERT INTO source (nom_source, type_source, config_auth)
     VALUES ($1, 'API_Social', $2)
     RETURNING ${SELECT_FIELDS}`,
    [nom_source, config_auth ? JSON.stringify(config_auth) : null]
  );
  return rows[0];
}

async function updateSource(id, dto) {
  const fields  = [];
  const values  = [];
  let   idx     = 1;

  if (dto.nom_source      !== undefined) { fields.push(`nom_source = $${idx++}`);      values.push(dto.nom_source); }
  if (dto.url_source      !== undefined) { fields.push(`url_source = $${idx++}`);      values.push(dto.url_source); }
  if (dto.frequence_check !== undefined) { fields.push(`frequence_check = $${idx++}`); values.push(dto.frequence_check); }
  if (dto.config_auth     !== undefined) { fields.push(`config_auth = $${idx++}`);     values.push(JSON.stringify(dto.config_auth)); }

  if (fields.length === 0) return findSourceById(id);

  values.push(id);
  const { rows } = await pool.query(
    `UPDATE source SET ${fields.join(', ')}
     WHERE id_source = $${idx}
     RETURNING ${SELECT_FIELDS}`,
    values
  );
  return rows[0] ?? null;
}

async function deleteSource(id) {
  const { rowCount } = await pool.query(
    'DELETE FROM source WHERE id_source = $1',
    [id]
  );
  return (rowCount ?? 0) > 0;
}

module.exports = {
  findAllSources,
  findSourceById,
  findSourceByUrl,
  createRSSSource,
  createSocialSource,
  updateSource,
  deleteSource,
};