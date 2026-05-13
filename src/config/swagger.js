const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title:       'DISVI — API de Veille Stratégique',
      version:     '1.0.0',
      description: 'Documentation de l\'API du dispositif de veille stratégique IE237',
      contact: {
        name: 'Équipe DISVI',
      },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Développement local' },
    ],
    components: {
      securitySchemes: {
        UserIdHeader: {
          type: 'apiKey',
          in:   'header',
          name: 'x-user-id',
          description: 'UUID de l\'utilisateur (temporaire — sera remplacé par JWT)',
        },
      },
      schemas: {
        Source: {
          type: 'object',
          properties: {
            id_source:       { type: 'integer', example: 1 },
            nom_source:      { type: 'string',  example: 'Journal du Cameroun' },
            type_source:     { type: 'string',  enum: ['Web', 'RSS', 'API_Social'] },
            url_source:      { type: 'string',  example: 'https://fr.journalducameroun.com/feed/' },
            config_auth:     { type: 'object',  nullable: true },
            frequence_check: { type: 'integer', example: 30 },
            created_at:      { type: 'string',  format: 'date-time' },
            updated_at:      { type: 'string',  format: 'date-time' },
          },
        },
        Article: {
          type: 'object',
          properties: {
            id_article:      { type: 'string', format: 'uuid' },
            id_source:       { type: 'integer' },
            titre:           { type: 'string' },
            description:     { type: 'string', nullable: true },
            contenu_brut:    { type: 'string', nullable: true },
            url_origine:     { type: 'string' },
            vignette:        { type: 'string', nullable: true },
            date_publication:{ type: 'string', format: 'date-time', nullable: true },
            date_expiration: { type: 'string', format: 'date-time' },
            zone:            { type: 'string', enum: ['nationale', 'internationale'], nullable: true },
            pays:            { type: 'string', nullable: true },
            nom_source:      { type: 'string' },
          },
        },
        Categorie: {
          type: 'object',
          properties: {
            id_cat:  { type: 'integer', example: 1 },
            nom_cat: { type: 'string',  example: 'Politique' },
          },
        },
        Note: {
          type: 'object',
          properties: {
            id_note:    { type: 'string', format: 'uuid' },
            id_user:    { type: 'string', format: 'uuid' },
            id_article: { type: 'string', format: 'uuid' },
            contenu:    { type: 'string', example: 'Article très pertinent.' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data:    { },
            error:   { type: 'string' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error:   { type: 'string',  example: 'Message d\'erreur' },
          },
        },
      },
    },
    tags: [
      { name: 'Sources',     description: 'Gestion des sources RSS et réseaux sociaux' },
      { name: 'Articles',    description: 'Consultation des articles collectés' },
      { name: 'Categories',  description: 'Gestion des catégories thématiques' },
      { name: 'Sauvegardes', description: 'Lire plus tard' },
      { name: 'Notes',       description: 'Notes personnelles sur les articles' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;