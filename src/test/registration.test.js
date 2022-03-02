import { describe, expect, it } from '@jest/globals';
import { validationResult } from 'express-validator';
import {
  registrationValidationMiddleware,
  xssSanitizationMiddleware,
} from '../lib/validation';

// https://stackoverflow.com/questions/28769200/unit-testing-validation-with-express-validator
async function applyAllMiddlewares(req, middlewares) {
  await Promise.all(
    middlewares.map(async (middleware) => {
      await middleware(req, {}, () => undefined);
    })
  );
}

describe('registration', () => {
  it('validates', async () => {
    const req = {
      body: {
        name: '',
      },
    };

    await applyAllMiddlewares(
      req,
      registrationValidationMiddleware('description')
    );

    const validation = validationResult(req);

    expect(validation.isEmpty()).toBe(false);
  });

  it('sanitizes', async () => {
    const req = {
      body: {
        name: '<script>alert(1)</script>',
      },
    };

    await applyAllMiddlewares(req, xssSanitizationMiddleware('description'));

    expect(req.body.name).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
