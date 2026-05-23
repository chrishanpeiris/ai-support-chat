import { Router, Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth';
import {
  listConversations,
  getConversation,
  getMessages,
  deleteConversation,
} from '../services/conversation.service';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const conversations = await listConversations(req.userId!);
  res.json(conversations);
});

router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const conv = await getConversation(req.params.id, req.userId!);
  if (!conv) return res.status(404).json({ error: 'Not found' });

  const messages = await getMessages(conv.id);
  res.json({ ...conv, messages });
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  await deleteConversation(req.params.id, req.userId!);
  res.status(204).end();
});

export default router;
