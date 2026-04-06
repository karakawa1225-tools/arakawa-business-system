import { Router } from 'express';
import { pool, query } from '../db/pool.js';
import { requireStaff, blockViewerWrite, type AuthedRequest } from '../middleware/auth.js';

export const travelExpenseRouter = Router();
travelExpenseRouter.use(requireStaff);

const STATUSES = new Set(['draft', 'submitted', 'approved']);
const CATEGORIES = new Set(['transport', 'lodging', 'per_diem', 'meals', 'other']);

type LineInput = { category: string; description?: string | null; amount: number };

function parseLines(raw: unknown): LineInput[] | null {
  if (!Array.isArray(raw)) return null;
  const out: LineInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const o = item as Record<string, unknown>;
    const cat = typeof o.category === 'string' ? o.category : '';
    if (!CATEGORIES.has(cat)) return null;
    const amt = Number(o.amount ?? 0);
    if (!Number.isFinite(amt) || amt < 0) return null;
    out.push({
      category: cat,
      description: typeof o.description === 'string' ? o.description : o.description == null ? '' : String(o.description),
      amount: amt,
    });
  }
  return out;
}

travelExpenseRouter.get('/regulation', async (req: AuthedRequest, res) => {
  const r = await query<{ supplement_text: string }>(
    `SELECT supplement_text FROM company_travel_regulation WHERE company_id = $1`,
    [req.staff!.companyId]
  );
  res.json({ supplementText: r.rows[0]?.supplement_text ?? '' });
});

travelExpenseRouter.patch('/regulation', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as { supplementText?: string };
  const text = typeof b.supplementText === 'string' ? b.supplementText : '';
  await query(
    `INSERT INTO company_travel_regulation (company_id, supplement_text, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (company_id) DO UPDATE SET supplement_text = EXCLUDED.supplement_text, updated_at = NOW()`,
    [req.staff!.companyId, text]
  );
  res.json({ ok: true });
});

travelExpenseRouter.get('/claims', async (req: AuthedRequest, res) => {
  const r = await query(
    `SELECT c.*,
            (SELECT COALESCE(SUM(amount), 0) FROM travel_expense_lines WHERE claim_id = c.id) AS lines_total
     FROM travel_expense_claims c
     WHERE c.company_id = $1
     ORDER BY c.updated_at DESC`,
    [req.staff!.companyId]
  );
  res.json(r.rows);
});

travelExpenseRouter.get('/claims/:id', async (req: AuthedRequest, res) => {
  const cr = await query(`SELECT * FROM travel_expense_claims WHERE id = $1 AND company_id = $2`, [
    req.params.id,
    req.staff!.companyId,
  ]);
  if (!cr.rows[0]) {
    res.status(404).json({ error: '見つかりません' });
    return;
  }
  const lr = await query(
    `SELECT * FROM travel_expense_lines WHERE claim_id = $1 ORDER BY sort_order, id`,
    [req.params.id]
  );
  res.json({ ...cr.rows[0], lines: lr.rows });
});

travelExpenseRouter.post('/claims', blockViewerWrite, async (req: AuthedRequest, res) => {
  const b = req.body as {
    applicantName: string;
    department?: string | null;
    destination: string;
    purpose: string;
    dateStart: string;
    dateEnd: string;
    status?: string;
    notes?: string | null;
    lines?: unknown;
  };
  const lines = parseLines(b.lines);
  if (lines === null) {
    res.status(400).json({ error: 'lines は { category, description?, amount } の配列で指定してください' });
    return;
  }
  if (!b.applicantName?.trim() || !b.destination?.trim() || !b.purpose?.trim()) {
    res.status(400).json({ error: '申請者名・行先・目的は必須です' });
    return;
  }
  const status = b.status && STATUSES.has(b.status) ? b.status : 'draft';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO travel_expense_claims
        (company_id, applicant_name, department, destination, purpose, date_start, date_end, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6::date,$7::date,$8,$9)
       RETURNING *`,
      [
        req.staff!.companyId,
        b.applicantName.trim(),
        b.department?.trim() || null,
        b.destination.trim(),
        b.purpose.trim(),
        b.dateStart,
        b.dateEnd,
        status,
        b.notes?.trim() || null,
      ]
    );
    const claim = ins.rows[0] as { id: string };
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i]!;
      await client.query(
        `INSERT INTO travel_expense_lines (claim_id, category, description, amount, sort_order)
         VALUES ($1,$2,$3,$4,$5)`,
        [claim.id, ln.category, ln.description || null, ln.amount, i]
      );
    }
    await client.query('COMMIT');
    const full = await query(
      `SELECT * FROM travel_expense_lines WHERE claim_id = $1 ORDER BY sort_order, id`,
      [claim.id]
    );
    res.status(201).json({ ...ins.rows[0], lines: full.rows });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

travelExpenseRouter.patch('/claims/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  const ex = await query(`SELECT id FROM travel_expense_claims WHERE id = $1 AND company_id = $2`, [
    req.params.id,
    req.staff!.companyId,
  ]);
  if (!ex.rows[0]) {
    res.status(404).json({ error: '見つかりません' });
    return;
  }
  const b = req.body as {
    applicantName?: string;
    department?: string | null;
    destination?: string;
    purpose?: string;
    dateStart?: string;
    dateEnd?: string;
    status?: string;
    notes?: string | null;
    lines?: unknown;
  };

  const claimId = req.params.id;
  const companyId = req.staff!.companyId;

  const parts: string[] = [];
  const params: unknown[] = [];
  let n = 1;
  if (b.applicantName !== undefined) {
    parts.push(`applicant_name = $${n++}`);
    params.push(b.applicantName.trim());
  }
  if (b.department !== undefined) {
    parts.push(`department = $${n++}`);
    params.push(b.department?.trim() || null);
  }
  if (b.destination !== undefined) {
    parts.push(`destination = $${n++}`);
    params.push(b.destination.trim());
  }
  if (b.purpose !== undefined) {
    parts.push(`purpose = $${n++}`);
    params.push(b.purpose.trim());
  }
  if (b.dateStart !== undefined) {
    parts.push(`date_start = $${n++}::date`);
    params.push(b.dateStart);
  }
  if (b.dateEnd !== undefined) {
    parts.push(`date_end = $${n++}::date`);
    params.push(b.dateEnd);
  }
  if (b.status !== undefined) {
    if (!STATUSES.has(b.status)) {
      res.status(400).json({ error: 'status が不正です' });
      return;
    }
    parts.push(`status = $${n++}`);
    params.push(b.status);
  }
  if (b.notes !== undefined) {
    parts.push(`notes = $${n++}`);
    params.push(b.notes?.trim() || null);
  }

  const hasScalars = parts.length > 0;
  const hasLines = b.lines !== undefined;
  if (!hasScalars && !hasLines) {
    const cr0 = await query(`SELECT * FROM travel_expense_claims WHERE id = $1 AND company_id = $2`, [claimId, companyId]);
    const lr0 = await query(
      `SELECT * FROM travel_expense_lines WHERE claim_id = $1 ORDER BY sort_order, id`,
      [claimId]
    );
    res.json({ ...cr0.rows[0], lines: lr0.rows });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (hasScalars) {
      parts.push(`updated_at = NOW()`);
      params.push(claimId, companyId);
      await client.query(
        `UPDATE travel_expense_claims SET ${parts.join(', ')} WHERE id = $${n++} AND company_id = $${n++}`,
        params
      );
    } else if (hasLines) {
      await client.query(`UPDATE travel_expense_claims SET updated_at = NOW() WHERE id = $1 AND company_id = $2`, [
        claimId,
        companyId,
      ]);
    }

    if (hasLines) {
      const lines = parseLines(b.lines);
      if (lines === null) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'lines が不正です' });
        return;
      }
      await client.query(`DELETE FROM travel_expense_lines WHERE claim_id = $1`, [claimId]);
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i]!;
        await client.query(
          `INSERT INTO travel_expense_lines (claim_id, category, description, amount, sort_order)
           VALUES ($1,$2,$3,$4,$5)`,
          [claimId, ln.category, ln.description || null, ln.amount, i]
        );
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const cr = await query(`SELECT * FROM travel_expense_claims WHERE id = $1 AND company_id = $2`, [
    req.params.id,
    req.staff!.companyId,
  ]);
  const lr = await query(
    `SELECT * FROM travel_expense_lines WHERE claim_id = $1 ORDER BY sort_order, id`,
    [req.params.id]
  );
  res.json({ ...cr.rows[0], lines: lr.rows });
});

travelExpenseRouter.delete('/claims/:id', blockViewerWrite, async (req: AuthedRequest, res) => {
  const r = await query(`DELETE FROM travel_expense_claims WHERE id = $1 AND company_id = $2 RETURNING id`, [
    req.params.id,
    req.staff!.companyId,
  ]);
  if (!r.rows[0]) {
    res.status(404).json({ error: '見つかりません' });
    return;
  }
  res.status(204).send();
});
