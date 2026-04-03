import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Must mock before importing the router
vi.mock('../services/scheduler.js', () => ({
  startScheduler: vi.fn(),
  registerSchedule: vi.fn(),
  unregisterSchedule: vi.fn(),
  updateSchedule: vi.fn(),
  computeNextRun: vi.fn(),
}));

// Import auth middleware first to get the Request type augmentation
import '../middleware/auth.js';
import authRouter from './auth.js';
import { authMiddleware } from '../middleware/auth.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api', authMiddleware);
  app.get('/api/protected', (_req, res) => {
    res.json({ message: 'success', user: (_req as unknown as { user: unknown }).user });
  });
  return app;
}

describe('auth routes', () => {
  describe('POST /api/auth/register', () => {
    it('registers a new user', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123', name: 'Test User' });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.user.name).toBe('Test User');
      expect(res.body.user.password_hash).toBeUndefined();
    });

    it('rejects duplicate email', async () => {
      const app = createApp();
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'dup@test.com', password: 'password123', name: 'User 1' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'dup@test.com', password: 'password456', name: 'User 2' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already registered');
    });

    it('rejects missing fields', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
    });

    it('rejects short passwords', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: '123', name: 'User' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('6 characters');
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      const app = createApp();
      // Register first
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'login@test.com', password: 'password123', name: 'Login User' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@test.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('login@test.com');
    });

    it('rejects invalid password', async () => {
      const app = createApp();
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'wrong@test.com', password: 'password123', name: 'User' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrong@test.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
    });

    it('rejects non-existent user', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'noone@test.com', password: 'password123' });

      expect(res.status).toBe(401);
    });
  });

  describe('auth middleware', () => {
    it('blocks requests without token', async () => {
      const app = createApp();
      const res = await request(app).get('/api/protected');
      expect(res.status).toBe(401);
    });

    it('allows requests with valid token', async () => {
      const app = createApp();
      const reg = await request(app)
        .post('/api/auth/register')
        .send({ email: 'auth@test.com', password: 'password123', name: 'Auth User' });

      const res = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${reg.body.token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('auth@test.com');
    });

    it('rejects invalid token', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });
});
