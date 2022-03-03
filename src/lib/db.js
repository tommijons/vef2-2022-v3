import { readFile } from 'fs/promises';
import pg from 'pg';
import xss from 'xss';
import { slugify } from './slugify.js';

const SCHEMA_FILE = './sql/schema.sql';
const DROP_SCHEMA_FILE = './sql/drop.sql';

const { DATABASE_URL: connectionString, NODE_ENV: nodeEnv = 'development' } =
  process.env;

if (!connectionString) {
  console.error('vantar DATABASE_URL í .env');
  process.exit(-1);
}

// Notum SSL tengingu við gagnagrunn ef við erum *ekki* í development
// mode, á heroku, ekki á local vél
const ssl = nodeEnv === 'production' ? { rejectUnauthorized: false } : false;

const pool = new pg.Pool({ connectionString, ssl });

pool.on('error', (err) => {
  console.error('Villa í tengingu við gagnagrunn, forrit hættir', err);
  process.exit(-1);
});

export async function query(q, values = []) {
  let client;
  try {
    client = await pool.connect();
  } catch (e) {
    console.error('unable to get client from pool', e);
    return null;
  }

  try {
    const result = await client.query(q, values);
    return result;
  } catch (e) {
    if (nodeEnv !== 'test') {
      console.error('unable to query', e);
    }
    return null;
  } finally {
    client.release();
  }
}

export async function createSchema(schemaFile = SCHEMA_FILE) {
  const data = await readFile(schemaFile);

  return query(data.toString('utf-8'));
}

export async function dropSchema(dropFile = DROP_SCHEMA_FILE) {
  const data = await readFile(dropFile);

  return query(data.toString('utf-8'));
}

export function isString(s) {
  return typeof s === 'string';
}


export async function singleQuery(_query, values = []) {
  const result = await query(_query, values);

  if (result.rows && result.rows.length === 1) {
    return result.rows[0];
  }

  return null;
}

export async function deleteQuery(_query, values = []) {
  const result = await query(_query, values);

  return result.rowCount;
}

export async function conditionalUpdate(table, id, fields, values) {
  const filteredFields = fields.filter((i) => typeof i === 'string');
  const filteredValues = values
    .filter((i) => typeof i === 'string'
      || typeof i === 'number'
      || i instanceof Date);
  if (filteredFields.length === 0) {
    return false;
  }
  if (filteredFields.length !== filteredValues.length) {
    throw new Error('fields and values must be of equal length');
  }
  // id is field = 1
  const updates = filteredFields.map((field, i) => `${field} = $${i + 2}`);
  const q = `
      UPDATE ${table}
        SET ${updates.join(', ')}
      WHERE
        id = $1
      RETURNING *
      `;
  const queryValues = [id].concat(filteredValues);
  console.info('Conditional update', q, queryValues);
  const result = await query(q, queryValues);
  return result;
}

export async function createEvent(req, res) {
  const {
    name, description,
  } = req.body;
  const slug = slugify(name);
  try {
    const event = await singleQuery(
      `
      INSERT INTO events
        (name, slug, description)
      VALUES
        ($1, $2, $3)
      RETURNING id, name, slug, description;
    `,
      [xss(name), xss(slug), xss(description)]
    );
    return res.status(201).json(event);
  } catch (e) {
    console.error('gat ekki búið til viðburð', e);
  }
  return res.status(500).json(null);
}

export async function deleteEvent(req, res) {
  const { id } = req.params;

  try {
    const deletionRowCount = await deleteQuery(
      'DELETE FROM events WHERE id = $1;', [id],
    );

    if (deletionRowCount === 0) {
      return res.status(404).end();
    }

    return res.status(200).json({});
  } catch (e) {
    console.error('gat ekki eytt viðburði', e);
  }
  return res.status(500).json(null);
}

export async function updateEvent(req, res) {
  const { id } = req.params;
  const { name, description } = req.body;
  const slug = slugify(name);
  const event = { name, slug, description };

  const fields = [
    isString(event.name) ? 'title' : null,
    isString(event.slug) ? 'slug' : null,
    isString(event.description) ? 'description' : null
  ]
  const values = [
    isString(event.name) ? xss(event.name) : null,
    isString(event.slug) ? xss(event.slug) : null,
    isString(event.description) ? xss(event.description) : null
  ];

  if (!fields.filter(Boolean).length === 0) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  fields.push('updated');
  values.push(new Date());

  const result = await conditionalUpdate('event', id, fields, values);

  return res.status(201).json(result.rows[0]);

}

export async function listEvents(req, res) {

  const events = await query('SELECT id, name, slug, description, created, updated FROM events;');

  return res.json(events.rows)
}

export async function listEvent(req, res) {
  const eventQuery = `
  SELECT
    id, name, slug, description, created, updated
  FROM
    events
  WHERE id = $1
`;
  const params = [req.params.id]
  try {
    const events = await query(eventQuery, params);
    return res.json(events.rows);
  } catch (e) {
    console.error('viðburður fannst ekki', e);
  }
  return res.status(404).json({ error: 'no event found' })
}

export async function createRegisteration(req, res) {
  const {
    name, comment, event,
  } = req.body;

  try {
    const registeration = await singleQuery(
      `
      INSERT INTO registrations
        (name, comment, event)
      VALUES
        ($1, $2, $3)
      RETURNING id, name, comment, event;
    `,
      [xss(name), xss(comment), event]
    );
    return res.status(201).json(registeration);
  } catch (e) {
    console.error('mistókst að skrá á viðburð', e);
  }
  return res.status(500).json(null);
}

export async function deleteRegisteration(req, res) {
  const { id } = req.params;

  try {
    const deletionRowCount = await deleteQuery(
      'DELETE FROM registrations WHERE id = $1;', [id],
    );

    if (deletionRowCount === 0) {
      return res.status(404).end();
    }

    return res.status(200).json({});
  } catch (e) {
    console.error('gat ekki eytt skráningu', e);
  }
  return res.status(500).json(null);
}

export async function end() {
  await pool.end();
}
