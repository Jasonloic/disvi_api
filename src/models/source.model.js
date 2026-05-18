const { pool }  = require('../config/database');
const cache     = require('../services/cache.service');

const SELECT_FIELDS = `
  id_source, nom_source, type_source, url_source,
  config_auth, frequence_check, id_user, created_at, updated_at
`;

async function findAllSources(idUser) {
  const key = cache.keys.sourcesUser(idUser);
  const { data } = await cache.getOrSet(key, cache.TTL.SOURCES_USER, async () => {
    const { rows } = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM source
       WHERE id_user = $1 ORDER BY created_at DESC`,
      [idUser]
    );
    return rows;
  });
  return data;
}

async function findSourceById(id, idUser) {
  const key = cache.keys.sourceDetail(id, idUser);
  const { data } = await cache.getOrSet(key, cache.TTL.SOURCE_DETAIL, async () => {
    const { rows } = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM source
       WHERE id_source = $1 AND id_user = $2`,
      [id, idUser]
    );
    return rows[0] ?? null;
  });
  return data;
}

async function findSourceByUrl(urlSource, idUser) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM source
     WHERE url_source = $1 AND id_user = $2`,
    [urlSource, idUser]
  );
  return rows[0] ?? null;
}

async function createRSSSource({ nom_source, url_source, frequence_check, id_user }) {
  const { rows } = await pool.query(
    `INSERT INTO source (nom_source, type_source, url_source, frequence_check, id_user)
     VALUES ($1, 'RSS', $2, $3, $4)
     RETURNING ${SELECT_FIELDS}`,
    [nom_source, url_source, frequence_check ?? 60, id_user]
  );
  await cache.invalidate.source(rows[0].id_source, id_user);
  return rows[0];
}

async function createSocialSource({ nom_source, config_auth, frequence_check, id_user }) {
  const { rows } = await pool.query(
    `INSERT INTO source (nom_source, type_source, config_auth, frequence_check, id_user)
     VALUES ($1, 'API_Social', $2, $3, $4)
     RETURNING ${SELECT_FIELDS}`,
    [nom_source, config_auth ? JSON.stringify(config_auth) : null, frequence_check ?? 1, id_user]
  );
  await cache.invalidate.source(rows[0].id_source, id_user);
  return rows[0];
}

async function updateSource(id, idUser, dto) {
  const fields = [];
  const values = [];
  let   idx    = 1;

  if (dto.nom_source      !== undefined) { fields.push(`nom_source = $${idx++}`);      values.push(dto.nom_source); }
  if (dto.url_source      !== undefined) { fields.push(`url_source = $${idx++}`);      values.push(dto.url_source); }
  if (dto.frequence_check !== undefined) { fields.push(`frequence_check = $${idx++}`); values.push(dto.frequence_check); }
  if (dto.config_auth     !== undefined) { fields.push(`config_auth = $${idx++}`);     values.push(JSON.stringify(dto.config_auth)); }

  if (fields.length === 0) return findSourceById(id, idUser);

  values.push(id, idUser);
  const { rows } = await pool.query(
    `UPDATE source SET ${fields.join(', ')}
     WHERE id_source = $${idx++} AND id_user = $${idx++}
     RETURNING ${SELECT_FIELDS}`,
    values
  );
  if (rows[0]) await cache.invalidate.source(id, idUser);
  return rows[0] ?? null;
}

async function deleteSource(id, idUser) {
  const { rowCount } = await pool.query(
    'DELETE FROM source WHERE id_source = $1 AND id_user = $2',
    [id, idUser]
  );
  if ((rowCount ?? 0) > 0) await cache.invalidate.source(id, idUser);
  return (rowCount ?? 0) > 0;
}

async function findAllRSSSources() {
  const { rows } = await pool.query(
    `SELECT id_source, nom_source, url_source, frequence_check, id_user
     FROM source
     WHERE type_source = 'RSS' AND url_source IS NOT NULL`
  );
  return rows;
}

module.exports = {
  findAllSources,
  findSourceById,
  findSourceByUrl,
  createRSSSource,
  createSocialSource,
  updateSource,
  deleteSource,
  findAllRSSSources,
};