import { Router, Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth';
import { streamChat } from '../services/llm.service';
import { createConversation, getConversation } from '../services/conversation.service';

const router = Router();

router.post('/stream', authenticate, async (req: AuthRequest, res: Response) => {
  const { conversationId, message } = req.body as {
    conversationId?: string;
    message: string;
  };

  if (!message?.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    let activeId = conversationId;

    if (!activeId) {
      const conv = await createConversation(req.userId!, message.slice(0, 60));
      activeId = conv.id;
    } else {
      const conv = await getConversation(activeId, req.userId!);
      if (!conv) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Conversation not found' })}\n\n`);
        return res.end();
      }
    }

    await streamChat(activeId, message, req.userId!, res);
  } catch (err) {
    console.error('[chat] stream error:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Internal server error' })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
