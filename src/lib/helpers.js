import { validationResult } from 'express-validator';
import { constants } from 'fs';
import {
  access,
  mkdir, readdir as fsReadDir, readFile as fsReadFile,
  stat as fsStat, writeFile as fsWriteFile
} from 'fs/promises'; // eslint-disable-line import/no-unresolved

/**
 * Checks to see if there are validation errors or returns next middlware if not.
 * @param {object} req HTTP request
 * @param {object} res HTTP response
 * @param {function} next Next middleware
 * @returns Next middleware or validation errors.
 */
export function validationCheck(req, res, next) {
  const validation = validationResult(req);

  if (!validation.isEmpty()) {
    const notFoundError = validation.errors.find((error) => error.msg === 'not found');
    const serverError = validation.errors.find((error) => error.msg === 'server error');

    // We loose the actual error object of LoginError, match with error message
    // TODO brittle, better way?
    const loginError = validation.errors.find((error) =>
      error.msg === 'username or password incorrect');

    let status = 400;

    if (serverError) {
      status = 500;
    } else if (notFoundError) {
      status = 404;
    } else if (loginError) {
      status = 401;
    }

    // Strecthing the express-validator library...
    // @see auth/api.js
    const validationErrorsWithoutSkip = validation.errors.filter((error) => error.msg !== 'skip');

    return res.status(status).json({ errors: validationErrorsWithoutSkip });
  }

  return next();
}

/**
 * Checks if resource exists by running a lookup function for that resource. If
 * the resource exists, the function should return the resource, it'll be added
 * to the request object under `resource`.
 * @param {function} fn Function to lookup the resource
 * @returns {Promise<undefined|Error>} Rejected error if resource does not exist
 */
export function resourceExists(fn) {
  return (value, { req }) => fn(value, req)
    .then((resource) => {
      if (!resource) {
        return Promise.reject(new Error('not found'));
      }
      req.resource = resource;
      return Promise.resolve();
    })
    .catch((error) => {
      if (error.message === 'not found') {
        // This we just handled
        return Promise.reject(error);
      }

      // This is something we did *not* handle, treat as 500 error
      console.warn('Error from middleware:', error);
      return Promise.reject(new Error('server error'));
    });
}


export async function stat(file) {
  let result = null;
  try {
    result = await fsStat(file);
  } catch (e) {
    // empty
  }
  return result;
}

export async function exists(file) {
  let ok = true;
  try {
    await access(file, constants.F_OK);
  } catch (e) {
    ok = false;
  }
  return ok;
}

export async function isReadable(dir) {
  let readable = true;
  try {
    await access(dir, constants.R_OK);
  } catch (e) {
    readable = false;
  }

  return readable;
}

export async function readFile(file, encoding = 'utf8') {
  if (!(await isReadable(file))) {
    return null;
  }

  const content = await fsReadFile(file);

  if (!encoding) {
    return content;
  }

  return content.toString(encoding);
}

export async function createDir(dir) {
  await mkdir(dir, { recursive: true });
}

export async function writeFile(
  file,
  data,
  encoding = 'utf8',
) {
  return fsWriteFile(file, data, { encoding });
}

export async function isWriteable(dir) {
  let writeable = true;
  try {
    await access(dir, constants.W_OK);
  } catch (e) {
    writeable = false;
  }

  return writeable;
}

export async function prepareDir(dir) {
  if (!(await exists(dir))) {
    await createDir(dir);
  }
  return isWriteable(dir);
}

export async function readDir(dir) {
  let results = [];
  try {
    results = await fsReadDir(dir);
  } catch {
    // empty
  }
  return results;
}
