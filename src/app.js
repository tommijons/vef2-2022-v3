import dotenv from 'dotenv';
import express from 'express';
import passport from './lib/login.js';
import { indexRouter } from './routes/index-routes.js';

dotenv.config();

const {
  PORT: port = 3000,
  DATABASE_URL: connectionString,
} = process.env;

if (!connectionString) {
  console.error('Vantar gögn í env');
  process.exit(1);
}

const app = express();

// Sér um að req.body innihaldi gögn úr formi
app.use(express.urlencoded({ extended: true }));

app.use(express.json());
app.use(passport.initialize());

app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PATCH') {
    if (
      req.headers['content-type']
      && (
        req.headers['content-type'] !== 'application/json'
        && !req.headers['content-type'].startsWith('multipart/form-data;')
      )) {
      return res.status(400).json({ error: 'body must be json or form-data' });
    }
  }
  return next();
});

app.use('/', indexRouter);

/** Middleware sem sér um 404 villur. */
app.use((req, res, next) => { // eslint-disable-line
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => { // eslint-disable-line
  console.error(err);

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid json' });
  }

  return res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.info(`Server running at http://localhost:${port}/`);
});
