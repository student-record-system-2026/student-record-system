'use strict';

/**
 * Express application (single deployable monolith, SADS 2.2).
 * Request path: Presentation/UI -> Controller/API (routes + controllers) -> Business/Service
 * -> Data Access (repositories) -> PostgreSQL.
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const config = require('./config');
const { pool } = require('./db/pool');
const apiRoutes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.session.cookieSecure) app.set('trust proxy', 1);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '100kb' }));

  // Server-side sessions (SADS 3.6 NFR-8): the cookie holds only a signed session id;
  // the session itself lives in PostgreSQL and is destroyed on logout.
  app.use(
    session({
      name: config.session.cookieName,
      secret: config.session.secret,
      store: new PgSession({ pool, tableName: 'user_sessions', createTableIfMissing: false }),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.session.cookieSecure,
        maxAge: config.session.ttlMinutes * 60 * 1000,
      },
    })
  );

  // API responses must never be cached, so "Back" after logout cannot show protected data (NFR-8).
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');
    next();
  });

  app.use('/api', apiRoutes);
  app.use('/api', notFoundHandler);

  // Optional: serve the production build of the frontend (npm run build in /frontend).
  const dist = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
