const PDFDocument = require('pdfkit');
const { pool }    = require('../config/database');
const fs          = require('fs');
const path        = require('path');

// Sélection des articles selon les critères

async function selectionnerArticles({ periode, id_cat, zone, limit = 50 }) {
  const now    = new Date();
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

  if (id_cat) {
    filters.push(`EXISTS (
      SELECT 1 FROM art_cat ac
      WHERE ac.id_article = a.id_article AND ac.id_cat = $${idx++}
    )`);
    params.splice(idx - 2, 0, id_cat);
  }

  if (zone) {
    filters.push(`a.zone = $${idx++}`);
    params.push(zone);
  }

  const where = filters.join(' AND ');

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

// Génération PDF

async function genererPDF({ articles, dateDebut, dateFin, periode, categorie, zone }) {
  return new Promise((resolve, reject) => {
    const doc      = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks   = [];

    doc.on('data',  (chunk) => chunks.push(chunk));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const BLEU_MARINE   = '#1F3864';
    const BLEU_CLAIR    = '#2E75B6';
    const GRIS_FONCE    = '#3B4151';
    const GRIS_CLAIR    = '#F5F5F5';
    const ORANGE        = '#D4501F';
    const BLANC         = '#FFFFFF';

    const largeur = doc.page.width - 100;

    //  En-tête

    doc.rect(0, 0, doc.page.width, 120).fill(BLEU_MARINE);

    doc.fillColor(BLANC)
       .fontSize(22)
       .font('Helvetica-Bold')
       .text('DISVI — Dispositif de Veille Stratégique', 50, 30, { width: largeur });

    doc.fontSize(13)
       .font('Helvetica')
       .text('Note de Synthèse', 50, 60);

    doc.fontSize(10)
       .text(
         `Générée le ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
         50, 80
       );

    // Bandeau orange
    doc.rect(0, 120, doc.page.width, 6).fill(ORANGE);

    // Paramètres du rapport

    doc.moveDown(2);

    const formatDate = (d) => new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    const periodeLabel = {
      quotidienne: 'Dernières 24 heures',
      hebdo:       'Dernière semaine',
      mensuelle:   'Dernier mois',
    }[periode] || periode;

    // Bloc paramètres
    doc.rect(50, doc.y, largeur, 70).fill(GRIS_CLAIR).stroke('#DDDDDD');

    const yParams = doc.y - 65;
    doc.fillColor(GRIS_FONCE).fontSize(10).font('Helvetica-Bold');
    doc.text('Période        :', 65, yParams + 10);
    doc.text('Du / Au        :', 65, yParams + 25);
    doc.text('Catégorie      :', 65, yParams + 40);
    doc.text('Zone           :', 65, yParams + 55);

    doc.font('Helvetica').fillColor(BLEU_CLAIR);
    doc.text(periodeLabel, 180, yParams + 10);
    doc.text(`${formatDate(dateDebut)} → ${formatDate(dateFin)}`, 180, yParams + 25);
    doc.text(categorie || 'Toutes catégories', 180, yParams + 40);
    doc.text(zone      || 'Nationale + Internationale', 180, yParams + 55);

    doc.moveDown(3);

    // Statistiques
    const nbArticles = articles.length;
    const sources    = [...new Set(articles.map(a => a.nom_source))];
    const nationals  = articles.filter(a => a.zone === 'nationale').length;
    const internat   = articles.filter(a => a.zone === 'internationale').length;
    const avgScore   = articles.filter(a => a.score_confiance)
      .reduce((s, a) => s + Number(a.score_confiance), 0) /
      (articles.filter(a => a.score_confiance).length || 1);

    // Titre section
    doc.fillColor(BLEU_MARINE).fontSize(13).font('Helvetica-Bold')
       .text('Statistiques', 50, doc.y);
    doc.rect(50, doc.y + 2, largeur, 1).fill(BLEU_MARINE);
    doc.moveDown(1);

    // Cartes statistiques
    const stats = [
      { label: 'Articles',    valeur: nbArticles },
      { label: 'Sources',     valeur: sources.length },
      { label: 'Nationales',  valeur: nationals },
      { label: 'Internat.',   valeur: internat },
      { label: 'Score moy.',  valeur: `${(avgScore * 100).toFixed(0)}%` },
    ];

    const carteW = largeur / stats.length - 5;
    let   xCarte = 50;
    const yCarte = doc.y;

    for (const stat of stats) {
      doc.rect(xCarte, yCarte, carteW, 50).fill(BLEU_MARINE);
      doc.fillColor(BLANC).fontSize(20).font('Helvetica-Bold')
         .text(String(stat.valeur), xCarte, yCarte + 8, { width: carteW, align: 'center' });
      doc.fontSize(8).font('Helvetica')
         .text(stat.label, xCarte, yCarte + 32, { width: carteW, align: 'center' });
      xCarte += carteW + 6;
    }

    doc.moveDown(4);

    // Sources mobilisées
    doc.fillColor(GRIS_FONCE).fontSize(9).font('Helvetica-Oblique')
       .text(`Sources mobilisées : ${sources.slice(0, 8).join(', ')}${sources.length > 8 ? '...' : ''}`, 50, doc.y);

    doc.moveDown(1.5);

    // Articles 

    doc.fillColor(BLEU_MARINE).fontSize(13).font('Helvetica-Bold')
       .text('Articles sélectionnés', 50, doc.y);
    doc.rect(50, doc.y + 2, largeur, 1).fill(BLEU_MARINE);
    doc.moveDown(1);

    for (let i = 0; i < articles.length; i++) {
      const art = articles[i];

      // Nouvelle page si nécessaire
      if (doc.y > doc.page.height - 150) {
        doc.addPage();
        doc.y = 50;
      }

      const yArt = doc.y;

      // Numéro + bandeau source
      doc.rect(50, yArt, largeur, 18).fill(i % 2 === 0 ? '#EEF2F7' : '#F8F9FB');

      doc.fillColor(BLEU_MARINE).fontSize(9).font('Helvetica-Bold')
         .text(`${i + 1}.`, 55, yArt + 4, { width: 20 });

      doc.fillColor(BLEU_CLAIR).fontSize(9).font('Helvetica-Bold')
         .text(art.nom_source || '', 75, yArt + 4, { width: 200 });

      // Date
      const dateStr = art.date_publication
        ? new Date(art.date_publication).toLocaleDateString('fr-FR')
        : '';
      doc.fillColor(GRIS_FONCE).fontSize(8).font('Helvetica')
         .text(dateStr, 50 + largeur - 80, yArt + 5, { width: 80, align: 'right' });

      // Zone badge
      if (art.zone) {
        const badgeColor = art.zone === 'nationale' ? '#27AE60' : '#8E44AD';
        doc.rect(50 + largeur - 170, yArt + 3, 80, 12).fill(badgeColor);
        doc.fillColor(BLANC).fontSize(7).font('Helvetica')
           .text(art.zone.toUpperCase(), 50 + largeur - 170, yArt + 5, { width: 80, align: 'center' });
      }

      doc.moveDown(0.1);

      // Titre
      doc.fillColor(GRIS_FONCE).fontSize(10).font('Helvetica-Bold')
         .text(art.titre || '', 55, doc.y + 4, { width: largeur - 10 });

      doc.moveDown(0.4);

      // Résumé IA ou description
      const texteResume = art.resume_auto || art.description || '';
      if (texteResume) {
        doc.fillColor('#555555').fontSize(9).font('Helvetica')
           .text(texteResume.slice(0, 400), 55, doc.y, { width: largeur - 10 });
        doc.moveDown(0.3);
      }

      // Catégories
      if (art.categories && art.categories.length > 0 && art.categories[0] !== '') {
        doc.fillColor(ORANGE).fontSize(8).font('Helvetica-Oblique')
           .text(`Catégories : ${art.categories.join(', ')}`, 55, doc.y);
        doc.moveDown(0.3);
      }

      // URL
      if (art.url_origine) {
        doc.fillColor(BLEU_CLAIR).fontSize(7).font('Helvetica')
           .text(art.url_origine.slice(0, 80), 55, doc.y, { link: art.url_origine });
        doc.moveDown(0.3);
      }

      // Score confiance
      if (art.score_confiance !== null && art.score_confiance !== undefined) {
        const sc = Number(art.score_confiance);
        doc.fillColor(sc >= 0.7 ? '#27AE60' : sc >= 0.4 ? '#F39C12' : '#E74C3C')
           .fontSize(8).font('Helvetica')
           .text(`Indice de confiance : ${(sc * 100).toFixed(0)}%`, 55, doc.y);
      }

      doc.moveDown(1);
      doc.rect(50, doc.y, largeur, 0.5).fill('#DDDDDD');
      doc.moveDown(0.5);
    }

    // Pied de page

    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill(BLEU_MARINE);
      doc.fillColor(BLANC).fontSize(8).font('Helvetica')
         .text(
           `DISVI — Dispositif de Veille Stratégique IE237  |  Page ${i + 1} / ${pageCount}`,
           50, doc.page.height - 25, { width: largeur, align: 'center' }
         );
    }

    doc.end();
  });
}

// Sauvegarder le rapport en base

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

module.exports = {
  selectionnerArticles,
  genererPDF,
  sauvegarderRapport,
  lierArticlesRapport,
  listerRapports,
  getRapportById,
};