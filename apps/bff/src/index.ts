import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import chatRouter from './routes/chat';
import conversationsRouter from './routes/conversations';
import { runMigrations, runSeed } from './db/migrate';

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors({ origin: process.env.WEB_URL ?? 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/conversations', conversationsRouter);

async function start() {
  await runMigrations();
  await runSeed();
  app.listen(port, () => console.log(`[bff] running on http://localhost:${port}`));
}

start().catch((err) => {
  console.error('[bff] startup failed:', err);
  process.exit(1);
});
