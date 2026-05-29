const PDFDocument = require('pdfkit');
const { pool }    = require('../config/database');
const fs          = require('fs');
const path        = require('path');

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'rapports');
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

async function selectionnerArticles({ periode, id_cat, zone, limit = 50, idUser }) {
  const now = new Date();
  let dateDebut;

  if (periode === 'quotidienne') {
    dateDebut = new Date(now);
    dateDebut.setDate(now.getDate() - 1);
  } else if (periode === 'hebdo') {
    dateDebut = new Date(now);
    dateDebut.setDate(now.getDate() - 7);
  } else if (periode === 'mensuelle') {
    dateDebut = new Date(now);
    dateDebut.setMonth(now.getMonth() - 1);
  } else {
    throw new Error('Période invalide. Valeurs acceptées : quotidienne, hebdo, mensuelle.');
  }

  const params  = [dateDebut.toISOString(), limit];
  const filters = [`a.date_publication >= $1`, `a.date_expiration > NOW()`];
  let   idx     = 3;

  // Filtre par utilisateur via url_source (articles partagés entre users)
  if (idUser) {
    filters.push(`EXISTS (
      SELECT 1 FROM source s_user
      WHERE s_user.url_source = src.url_source
        AND s_user.id_user = $${idx++}
    )`);
    params.push(idUser);
  }

  if (id_cat) {
    filters.push(`EXISTS (
      SELECT 1 FROM art_cat ac
      WHERE ac.id_article = a.id_article AND ac.id_cat = $${idx++}
    )`);
    params.push(id_cat);
  }

  if (zone) {
    filters.push(`a.zone = $${idx++}`);
    params.push(zone);
  }

  const where = filters.join(' AND ');
  console.log('[RAPPORT] params:', params);
  console.log('[RAPPORT] where:', where);
  const { rows } = await pool.query(
      `SELECT
         a.id_article,
         a.titre,
         a.description,
         a.url_origine,
         a.date_publication,
         a.zone,
         a.pays,
         src.nom_source,
         ai.resume_auto,
         ai.score_confiance,
         ai.entites_nommees,
         COALESCE(
             array_agg(DISTINCT c.nom_cat) FILTER (WHERE c.nom_cat IS NOT NULL),
             '{}'
         ) AS categories
       FROM article a
              JOIN source src ON src.id_source = a.id_source
              LEFT JOIN analyse_ia ai ON ai.id_article = a.id_article
              LEFT JOIN art_cat ac    ON ac.id_article = a.id_article
              LEFT JOIN categorie c   ON c.id_cat = ac.id_cat
       WHERE ${where}
       GROUP BY
         a.id_article, a.titre, a.description, a.url_origine,
         a.date_publication, a.zone, a.pays,
         src.nom_source, ai.resume_auto, ai.score_confiance, ai.entites_nommees
       ORDER BY a.date_publication DESC NULLS LAST
         LIMIT $2`,
      params
  );

  return { articles: rows, dateDebut, dateFin: now };
}

// Remplacer la fonction genererPDF dans rapport.service.js

async function genererPDF({ articles, dateDebut, dateFin, periode, categorie, zone, idNote }) {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks = [];

    doc.on('data',  (chunk) => chunks.push(chunk));
    doc.on('end',   () => {
      const buffer   = Buffer.concat(chunks);
      const filename = `rapport_${idNote}_${Date.now()}.pdf`;
      const filepath = path.join(STORAGE_DIR, filename);
      try { fs.writeFileSync(filepath, buffer); }
      catch (err) { return reject(err); }
      resolve({ buffer, filename, filepath });
    });
    doc.on('error', reject);

    // Palette extraite du design system CSS (hsl → hex)
    const VERT        = '#007A5D'; // --primary
    const VERT_DEEP   = '#005B46'; // --primary-deep
    const VERT_GLOW   = '#00A37D'; // --primary-glow
    const VERT_LIGHT  = '#10CFA3'; // --highlight
    const FOREGROUND  = '#1D3D36'; // --foreground
    const BACKGROUND  = '#F0F8F5'; // --background
    const SECONDARY   = '#DCEEE7'; // --secondary
    const MUTED       = '#556C67'; // --muted-foreground
    const BORDER      = '#CDDFD7'; // --border
    const BLANC       = '#FFFFFF';
    const OR          = '#FCD116'; // drapeau camerounais — accent
    const ROUGE       = '#CE1126'; // drapeau camerounais — accent 2

    const largeur = doc.page.width - 100;

    // ── En-tête ──────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 110).fill(VERT_DEEP);

    // Bande tricolore camerounaise (vert / rouge / or)
    const bW = doc.page.width / 3;
    doc.rect(0, 110, bW,       6).fill('#007A5D');
    doc.rect(bW, 110, bW,      6).fill(ROUGE);
    doc.rect(bW * 2, 110, bW,  6).fill(OR);

    doc.fillColor(BLANC).fontSize(20).font('Helvetica-Bold')
        .text('Sentinelle 237', 50, 28, { width: largeur });
    doc.fontSize(11).font('Helvetica')
        .text('Plateforme de Veille Stratégique Intelligente', 50, 52);
    doc.fontSize(10).fillColor(VERT_LIGHT)
        .text('Note de Synthèse', 50, 70);
    doc.fontSize(9).fillColor(SECONDARY)
        .text(
            `Générée le ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
            50, 88
        );

    // ── Fiche paramètres ─────────────────────────────────────────────────────
    doc.moveDown(2);
    const formatDate   = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const periodeLabel = { quotidienne: 'Dernières 24 heures', hebdo: 'Dernière semaine', mensuelle: 'Dernier mois' }[periode] || periode;

    const yCard = doc.y;
    doc.rect(50, yCard, largeur, 76).fill(SECONDARY).stroke(BORDER);

    // Ligne verte gauche
    doc.rect(50, yCard, 4, 76).fill(VERT);

    const col1 = 64, col2 = 180;
    doc.fillColor(FOREGROUND).fontSize(9).font('Helvetica-Bold');
    doc.text('Période',    col1, yCard + 12);
    doc.text('Du / Au',    col1, yCard + 27);
    doc.text('Catégorie',  col1, yCard + 42);
    doc.text('Zone',       col1, yCard + 57);

    doc.font('Helvetica').fillColor(VERT_DEEP);
    doc.text(periodeLabel,                                        col2, yCard + 12);
    doc.text(`${formatDate(dateDebut)} → ${formatDate(dateFin)}`, col2, yCard + 27);
    doc.text(categorie || 'Toutes catégories',                    col2, yCard + 42);
    doc.text(zone      || 'Nationale + Internationale',           col2, yCard + 57);

    doc.moveDown(3.5);

    // ── Statistiques ─────────────────────────────────────────────────────────
    const nbArticles = articles.length;
    const sources    = [...new Set(articles.map(a => a.nom_source))];

    // Titre section
    doc.fillColor(VERT).fontSize(12).font('Helvetica-Bold').text('Statistiques', 50, doc.y);
    doc.rect(50, doc.y + 2, largeur, 1.5).fill(VERT_LIGHT);
    doc.moveDown(1);

    const stats  = [
      { label: 'Articles',    valeur: nbArticles,                        color: VERT_DEEP },
      { label: 'Sources',     valeur: sources.length,                    color: VERT },
    ];

    const carteW = largeur / stats.length - 5;
    let   xCarte = 50;
    const yCarte = doc.y;

    for (const stat of stats) {
      // Fond carte
      doc.rect(xCarte, yCarte, carteW, 54).fill(stat.color);
      // Bord bas coloré
      doc.rect(xCarte, yCarte + 50, carteW, 4).fill(OR);

      doc.fillColor(BLANC).fontSize(20).font('Helvetica-Bold')
          .text(String(stat.valeur), xCarte, yCarte + 9, { width: carteW, align: 'center' });
      doc.fontSize(8).font('Helvetica')
          .text(stat.label, xCarte, yCarte + 34, { width: carteW, align: 'center' });

      xCarte += carteW + 6;
    }

    doc.moveDown(4.5);
    doc.fillColor(MUTED).fontSize(8).font('Helvetica-Oblique')
        .text(`Sources : ${sources.slice(0, 8).join(', ')}${sources.length > 8 ? '…' : ''}`, 50, doc.y);
    doc.moveDown(1.5);

    // ── Liste articles ────────────────────────────────────────────────────────
    doc.fillColor(VERT).fontSize(12).font('Helvetica-Bold').text('Articles sélectionnés', 50, doc.y);
    doc.rect(50, doc.y + 2, largeur, 1.5).fill(VERT_LIGHT);
    doc.moveDown(1);

    for (let i = 0; i < articles.length; i++) {
      const art = articles[i];

      if (doc.y > doc.page.height - 160) {
        doc.addPage();
        doc.y = 50;
      }

      const yArt = doc.y;
      const bgRow = i % 2 === 0 ? BACKGROUND : BLANC;
      doc.rect(50, yArt, largeur, 20).fill(bgRow);

      // Numéro + source
      doc.fillColor(VERT_DEEP).fontSize(9).font('Helvetica-Bold')
          .text(`${i + 1}.`, 55, yArt + 5, { width: 20 });
      doc.fillColor(VERT).fontSize(9).font('Helvetica-Bold')
          .text(art.nom_source || '', 76, yArt + 5, { width: 200 });

      // Date
      const dateStr = art.date_publication
          ? new Date(art.date_publication).toLocaleDateString('fr-FR') : '';
      doc.fillColor(MUTED).fontSize(8).font('Helvetica')
          .text(dateStr, 50 + largeur - 80, yArt + 6, { width: 80, align: 'right' });

      doc.moveDown(0.15);

      // Titre article
      doc.fillColor(FOREGROUND).fontSize(10).font('Helvetica-Bold')
          .text(art.titre || '', 55, doc.y + 3, { width: largeur - 10 });
      doc.moveDown(0.4);

      // Résumé
      const texte = art.resume_auto || art.description || '';
      if (texte) {
        doc.fillColor(MUTED).fontSize(9).font('Helvetica')
            .text(texte.slice(0, 380), 55, doc.y, { width: largeur - 10 });
        doc.moveDown(0.3);
      }

      // Catégories — badges verts
      if (art.categories?.length > 0 && art.categories[0] !== '') {
        const cats = art.categories.slice(0, 4);
        let xCat = 55;
        const yCat = doc.y;
        for (const cat of cats) {
          const catW = cat.length * 5.5 + 10;
          doc.rect(xCat, yCat, catW, 12).fill(SECONDARY).stroke(BORDER);
          doc.fillColor(VERT_DEEP).fontSize(7).font('Helvetica')
              .text(cat, xCat + 4, yCat + 2);
          xCat += catW + 4;
        }
        doc.moveDown(1.2);
      }

      // URL
      if (art.url_origine) {
        doc.fillColor(VERT_GLOW).fontSize(7).font('Helvetica')
            .text(art.url_origine.slice(0, 90), 55, doc.y, { link: art.url_origine });
        doc.moveDown(0.3);
      }

      // Score confiance — barre colorée
      if (art.score_confiance != null) {
        const sc = Number(art.score_confiance);
        const scColor = sc >= 0.7 ? VERT_GLOW : sc >= 0.4 ? OR : ROUGE;
        doc.fillColor(scColor).fontSize(8).font('Helvetica')
            .text(`Indice de confiance : ${(sc * 100).toFixed(0)} %`, 55, doc.y);
      }

      doc.moveDown(0.8);
      doc.rect(50, doc.y, largeur, 0.5).fill(BORDER);
      doc.moveDown(0.5);
    }

    // ── Pied de page ─────────────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);

      // Bande tricolore bas
      const bWf = doc.page.width / 3;
      doc.rect(0,        doc.page.height - 28, bWf,  28).fill(VERT_DEEP);
      doc.rect(bWf,      doc.page.height - 28, bWf,  28).fill(ROUGE);
      doc.rect(bWf * 2,  doc.page.height - 28, bWf,  28).fill(OR);

      doc.fillColor(BLANC).fontSize(8).font('Helvetica')
          .text(
              `Sentinelle 237 — Veille Stratégique  |  Page ${i - range.start + 1} / ${range.count}`,
              50, doc.page.height - 18,
              { width: largeur, align: 'center' }
          );
    }

    doc.flushPages();
    doc.end();
  });
}

async function sauvegarderRapport({ idCreateur, titre, periode, zone, idCat, dateDebut, dateFin, nbArticles }) {
  const { rows } = await pool.query(
      `INSERT INTO note
       (id_createur, titre_note, type_periode, date_debut, date_fin, zone, nb_informations, statut)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'genere')
         RETURNING id_note, titre_note, statut, created_at`,
      [idCreateur, titre, periode, dateDebut, dateFin, zone || null, nbArticles]
  );
  return rows[0];
}

async function lierArticlesRapport(idNote, articles) {
  if (articles.length === 0) return;
  const values = articles.map((a, i) => `($1, $${i + 2})`).join(', ');
  const params = [idNote, ...articles.map(a => a.id_article)];
  await pool.query(
      `INSERT INTO note_article (id_note, id_article) VALUES ${values} ON CONFLICT DO NOTHING`,
      params
  );
}

async function listerRapports(idCreateur, { limit = 20, offset = 0 } = {}) {
  const { rows } = await pool.query(
      `SELECT id_note, titre_note, type_periode, date_debut, date_fin,
         zone, nb_informations, statut, created_at
       FROM note
       WHERE id_createur = $1
       ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
      [idCreateur, limit, offset]
  );
  return rows;
}

async function getRapportById(idNote, idCreateur) {
  const { rows } = await pool.query(
      `SELECT n.*, array_agg(na.id_article) AS articles_ids
       FROM note n
              LEFT JOIN note_article na ON na.id_note = n.id_note
       WHERE n.id_note = $1 AND n.id_createur = $2
       GROUP BY n.id_note`,
      [idNote, idCreateur]
  );
  return rows[0] ?? null;
}

async function updateUrlDocument(idNote, filename) {
  await pool.query(
      'UPDATE note SET url_document = $1 WHERE id_note = $2',
      [filename, idNote]
  );
}

async function getFilePath(idNote, idCreateur) {
  const { rows } = await pool.query(
      'SELECT url_document FROM note WHERE id_note = $1 AND id_createur = $2',
      [idNote, idCreateur]
  );
  if (!rows[0]?.url_document) return null;
  return path.join(STORAGE_DIR, rows[0].url_document);
}

module.exports = {
  selectionnerArticles,
  genererPDF,
  sauvegarderRapport,
  lierArticlesRapport,
  listerRapports,
  getRapportById,
  updateUrlDocument,
  getFilePath,
};