import bcrypt from 'bcrypt';
import xss from 'xss';
import { query } from './db.js';

const {
  BCRYPT_ROUNDS: bcryptRounds = 1,
} = process.env;

export async function createUser(username, name, password) {
  const hashedPassword = await bcrypt.hash(password, parseInt(bcryptRounds, 10));

  const q = `
    INSERT INTO
      users (username, name, password)
    VALUES
      ($1, $2, $3)
    RETURNING *`;

  const values = [xss(username), xss(name), hashedPassword];
  const result = await query(
    q,
    values,
  );

  return result.rows[0];
}

export async function comparePasswords(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch (e) {
    console.error('Gat ekki borið saman lykilorð', e);
  }

  return false;
}

export async function listUsers(req, res) {

  const users = await query('SELECT id, username FROM users;');

  return res.json(users.rows)
}

export async function getUser(req, res) {
  const userQuery = 'select id, name, username, password, admin from users where id=$1';
  const params = [req.params.id]
  const users = await query(userQuery, params);

  return res.json(users.rows);
}

export async function findByUsername(username) {
  const q = 'SELECT * FROM users WHERE username = $1';

  try {
    const result = await query(q, [username]);

    if (result.rowCount === 1) {
      return result.rows[0];
    }
  } catch (e) {
    console.error('unable to query user by username');
    return null;
  }

  return false;
}

export async function findById(id) {
  const q = 'SELECT * FROM users WHERE id = $1';

  try {
    const result = await query(q, [id]);

    if (result.rowCount === 1) {
      return result.rows[0];
    }
  } catch (e) {
    console.error('Gat ekki fundið notanda eftir id');
  }

  return null;
}


