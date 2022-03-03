import express from 'express';
import jwt from 'jsonwebtoken';
import { catchErrors } from '../lib/catch-errors.js';
import {
  createEvent,
  createRegisteration,
  deleteEvent,
  deleteRegisteration,
  listEvent,
  listEvents,
  updateEvent
} from '../lib/db.js';
import { validationCheck } from '../lib/helpers.js';
import { jwtOptions, requireAdmin, requireAuthentication, tokenOptions } from '../lib/passport.js';
import {
  createUser, findById, findByUsername, getUser, listUsers
} from '../lib/users.js';
import {
  passwordValidator,
  usernameAndPaswordValidValidator,
  usernameDoesNotExistValidator,
  usernameValidator
} from '../lib/validation.js';



export const indexRouter = express.Router();

async function registerRoute(req, res) {
  const { username, name, password = '' } = req.body;

  const result = await createUser(username, name, password);

  delete result.password;

  return res.status(201).json(result);
}

async function loginRoute(req, res) {
  const { username } = req.body;

  const user = await findByUsername(username);

  if (!user) {
    console.error('Unable to find user', username);
    return res.status(500).json({});
  }

  const payload = { id: user.id };
  const token = jwt.sign(payload, jwtOptions.secretOrKey, tokenOptions);
  delete user.password;

  return res.json({
    user,
    token,
    expiresIn: tokenOptions.expiresIn,
  });
}

async function currentUserRoute(req, res) {
  const { user: { id } = {} } = req;

  const user = await findById(id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  delete user.password;

  return res.json(user);
}

indexRouter.get('/', async (req, res) => res.json({
  users: '/users',
  events: '/events',
}));

indexRouter.get('/users', requireAdmin, requireAuthentication, catchErrors(listUsers));

indexRouter.get(
  '/users/me',
  requireAuthentication,
  catchErrors(currentUserRoute),
);
indexRouter.get('/users/:id', requireAuthentication, requireAdmin, catchErrors(getUser));
indexRouter.post(
  '/users/register',
  usernameValidator,
  passwordValidator,
  usernameDoesNotExistValidator,
  validationCheck,
  catchErrors(registerRoute),
);
indexRouter.post(
  '/users/login',
  usernameValidator,
  passwordValidator,
  usernameAndPaswordValidValidator,
  validationCheck,
  catchErrors(loginRoute),
);

indexRouter.get('/events', catchErrors(listEvents));
indexRouter.get('/events/:id', catchErrors(listEvent));
indexRouter.post('/events',
  requireAuthentication,
  validationCheck,
  usernameValidator,
  catchErrors(createEvent));
indexRouter.delete('/events/:id',
  requireAuthentication,
  catchErrors(deleteEvent));
indexRouter.patch('events/:id', catchErrors(updateEvent));

indexRouter.post('/registrations',
  usernameValidator,
  validationCheck,
  requireAuthentication,
  catchErrors(createRegisteration));
indexRouter.delete('/registrations/:id',
  requireAuthentication,
  catchErrors(deleteRegisteration));
