import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type StaffPayload, type CustomerPayload } from '../utils/jwt.js';

export type AuthedRequest = Request & {
  staff?: StaffPayload;
  customer?: CustomerPayload;
};

export function requireStaff(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) {
    res.status(401).json({ error: '認証が必要です' });
    return;
  }
  try {
    const p = verifyToken(h.slice(7));
    if (p.type !== 'staff') {
      res.status(403).json({ error: '社内ユーザーのみアクセス可能です' });
      return;
    }
    req.staff = p;
    next();
  } catch {
    res.status(401).json({ error: 'トークンが無効です' });
  }
}

export function requireCustomer(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) {
    res.status(401).json({ error: '認証が必要です' });
    return;
  }
  try {
    const p = verifyToken(h.slice(7));
    if (p.type !== 'customer') {
      res.status(403).json({ error: '顧客ポータルのみ' });
      return;
    }
    req.customer = p;
    next();
  } catch {
    res.status(401).json({ error: 'トークンが無効です' });
  }
}

/** 閲覧のみは GET のみ許可する例（必要に応じルートで使用） */
export function blockViewerWrite(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.staff?.role === 'viewer' && req.method !== 'GET') {
    res.status(403).json({ error: '閲覧のみのため変更できません' });
    return;
  }
  next();
}
