import { Router } from 'express';
import { requireStaff, type AuthedRequest } from '../middleware/auth.js';
import { getDashboardStats } from '../services/dashboard.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireStaff);

dashboardRouter.get('/stats', async (req: AuthedRequest, res) => {
  const stats = await getDashboardStats(req.staff!.companyId);
  res.json(stats);
});
