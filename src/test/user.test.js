import { describe, expect, test } from '@jest/globals';
import { postAndParse, randomValue } from './utils.js';

const EXPIRES_IN = '3600';

describe('users', () => {
  // Random username for all the following tests, highly unlikely we'll create
  // the same user twice
  const rnd = randomValue();
  const name = `user${rnd}`;
  const username = `user${rnd}`;
  const password = '1234567890';

  test('Create user, missing data', async () => {
    const data = null;
    const { result, status } = await postAndParse('/users/register', data);

    expect(status).toBe(400);
    expect(result.errors.length).toBe(4);
  });

  test('Create user, success', async () => {
    const data = { name, username, password };
    const { result, status } = await postAndParse('/users/register', data);

    expect(status).toBe(201);
    expect(result.name).toBe(name);
    expect(result.username).toBe(username);
    expect(result.password).toBeUndefined();
  });

  test('Create user, exists', async () => {
    const data = { name, username, password };
    const { result, status } = await postAndParse('/users/register', data);

    // Assumes tests run in order
    expect(status).toBe(400);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].msg).toEqual('username already exists');
  });

  test('Login user, no data', async () => {
    const data = null;
    const { result, status } = await postAndParse('/users/login', data);

    expect(status).toBe(400);
    expect(result.errors.length).toBe(2);
  });

  test('Login user, username & no pass', async () => {
    const data = { username: 'foobar' };
    const { result, status } = await postAndParse('/users/login', data);

    expect(status).toBe(400);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].msg).toBe('password is required, min 1 characters, max 256 characters');
  });

  test('Login user, success', async () => {
    const data = { username, password };
    const { result, status } = await postAndParse('/users/login', data);

    expect(status).toBe(200);
    expect(result.expiresIn).toBe(parseInt(EXPIRES_IN, 10));
    expect(result.token.length).toBeGreaterThanOrEqual(20); // 20 is random
    expect(result.user.admin).toBe(false);
    expect(result.user.name).toBe(name);
    expect(result.user.username).toBe(username);
    expect(result.user.password).toBeUndefined();
  });
});
