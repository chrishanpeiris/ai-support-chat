import { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  try {
    const { payload } = await jwtVerify(authHeader.slice(7), secret);
    req.userId = payload.sub as string;
    req.userEmail = payload.email as string;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
