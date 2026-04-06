import { Router } from 'express';
import { requireStaff, type AuthedRequest } from '../middleware/auth.js';

export const reportsRouter = Router();
reportsRouter.use(requireStaff);

/** Puppeteer は重いため起動時 import しない（listen 遅延で Next プロキシが 502 になるのを防ぐ） */
reportsRouter.get('/expense-settlement/:year/:month', async (req: AuthedRequest, res) => {
  const year = parseInt(String(req.params.year), 10);
  const month = parseInt(String(req.params.month), 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ error: '年月が不正です' });
    return;
  }
  try {
    const { buildExpenseSettlementPdf } = await import('../services/expensePdf.js');
    const pdf = await buildExpenseSettlementPdf(req.staff!.companyId, year, month);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="expense-${year}-${String(month).padStart(2, '0')}.pdf"`
    );
    res.send(pdf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'PDFの生成に失敗しました' });
  }
});

/** 月次経費精算 CSV（Puppeteer なし・軽量） */
reportsRouter.get('/expense-settlement/:year/:month/csv', async (req: AuthedRequest, res) => {
  const year = parseInt(String(req.params.year), 10);
  const month = parseInt(String(req.params.month), 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ error: '年月が不正です' });
    return;
  }
  try {
    const { buildExpenseSettlementCsv } = await import('../services/reportCsv.js');
    const buf = await buildExpenseSettlementCsv(req.staff!.companyId, year, month);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="expense-${year}-${String(month).padStart(2, '0')}.csv"`
    );
    res.send(buf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'CSVの生成に失敗しました' });
  }
});

reportsRouter.get('/bank-inout/:year/:month', async (req: AuthedRequest, res) => {
  const year = parseInt(String(req.params.year), 10);
  const month = parseInt(String(req.params.month), 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ error: '年月が不正です' });
    return;
  }
  try {
    const { buildBankInOutPdf } = await import('../services/bankInOutPdf.js');
    const pdf = await buildBankInOutPdf(req.staff!.companyId, year, month);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="bank-inout-${year}-${String(month).padStart(2, '0')}.pdf"`
    );
    res.send(pdf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'PDFの生成に失敗しました' });
  }
});

reportsRouter.get('/bank-inout/:year/:month/csv', async (req: AuthedRequest, res) => {
  const year = parseInt(String(req.params.year), 10);
  const month = parseInt(String(req.params.month), 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ error: '年月が不正です' });
    return;
  }
  try {
    const { buildBankInOutCsv } = await import('../services/reportCsv.js');
    const buf = await buildBankInOutCsv(req.staff!.companyId, year, month);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="bank-inout-${year}-${String(month).padStart(2, '0')}.csv"`
    );
    res.send(buf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'CSVの生成に失敗しました' });
  }
});

reportsRouter.get('/ar/:year/:month', async (req: AuthedRequest, res) => {
  const year = parseInt(String(req.params.year), 10);
  const month = parseInt(String(req.params.month), 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ error: '年月が不正です' });
    return;
  }
  try {
    const { buildArLedgerMonthlyPdf } = await import('../services/arLedgerPdf.js');
    const pdf = await buildArLedgerMonthlyPdf(req.staff!.companyId, year, month);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ar-${year}-${String(month).padStart(2, '0')}.pdf"`
    );
    res.send(pdf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'PDFの生成に失敗しました' });
  }
});

reportsRouter.get('/ar/:year/:month/csv', async (req: AuthedRequest, res) => {
  const year = parseInt(String(req.params.year), 10);
  const month = parseInt(String(req.params.month), 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ error: '年月が不正です' });
    return;
  }
  try {
    const { buildArLedgerMonthlyCsv } = await import('../services/reportCsv.js');
    const buf = await buildArLedgerMonthlyCsv(req.staff!.companyId, year, month);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ar-${year}-${String(month).padStart(2, '0')}.csv"`
    );
    res.send(buf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'CSVの生成に失敗しました' });
  }
});

reportsRouter.get('/ap/:year/:month', async (req: AuthedRequest, res) => {
  const year = parseInt(String(req.params.year), 10);
  const month = parseInt(String(req.params.month), 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ error: '年月が不正です' });
    return;
  }
  try {
    const { buildApLedgerMonthlyPdf } = await import('../services/apLedgerPdf.js');
    const pdf = await buildApLedgerMonthlyPdf(req.staff!.companyId, year, month);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ap-${year}-${String(month).padStart(2, '0')}.pdf"`
    );
    res.send(pdf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'PDFの生成に失敗しました' });
  }
});

reportsRouter.get('/ap/:year/:month/csv', async (req: AuthedRequest, res) => {
  const year = parseInt(String(req.params.year), 10);
  const month = parseInt(String(req.params.month), 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ error: '年月が不正です' });
    return;
  }
  try {
    const { buildApLedgerMonthlyCsv } = await import('../services/reportCsv.js');
    const buf = await buildApLedgerMonthlyCsv(req.staff!.companyId, year, month);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ap-${year}-${String(month).padStart(2, '0')}.csv"`
    );
    res.send(buf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'CSVの生成に失敗しました' });
  }
});

/** 月別給与明細一覧表（会社全体・控除内訳） */
reportsRouter.get('/payroll-monthly-detail/:year/:month', async (req: AuthedRequest, res) => {
  const year = parseInt(String(req.params.year), 10);
  const month = parseInt(String(req.params.month), 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ error: '年月が不正です' });
    return;
  }
  try {
    const { buildPayrollMonthlyDetailListPdf } = await import('../services/payrollReportPdf.js');
    const pdf = await buildPayrollMonthlyDetailListPdf(req.staff!.companyId, year, month);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payroll-monthly-detail-${year}-${String(month).padStart(2, '0')}.pdf"`
    );
    res.send(pdf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'PDFの生成に失敗しました' });
  }
});

reportsRouter.get('/payroll-monthly-detail/:year/:month/csv', async (req: AuthedRequest, res) => {
  const year = parseInt(String(req.params.year), 10);
  const month = parseInt(String(req.params.month), 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ error: '年月が不正です' });
    return;
  }
  try {
    const { buildPayrollMonthlyDetailListCsv } = await import('../services/reportCsv.js');
    const buf = await buildPayrollMonthlyDetailListCsv(req.staff!.companyId, year, month);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payroll-monthly-detail-${year}-${String(month).padStart(2, '0')}.csv"`
    );
    res.send(buf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'CSVの生成に失敗しました' });
  }
});

/** 給与・手取り 年度一覧表（暦年1〜12月） */
reportsRouter.get('/payroll-annual-calendar/:year', async (req: AuthedRequest, res) => {
  const year = parseInt(String(req.params.year), 10);
  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    res.status(400).json({ error: '年度（年）が不正です' });
    return;
  }
  try {
    const { buildPayrollAnnualCalendarPdf } = await import('../services/payrollReportPdf.js');
    const pdf = await buildPayrollAnnualCalendarPdf(req.staff!.companyId, year);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-annual-${year}.pdf"`);
    res.send(pdf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'PDFの生成に失敗しました' });
  }
});

reportsRouter.get('/payroll-annual-calendar/:year/csv', async (req: AuthedRequest, res) => {
  const year = parseInt(String(req.params.year), 10);
  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    res.status(400).json({ error: '年度（年）が不正です' });
    return;
  }
  try {
    const { buildPayrollAnnualCalendarCsv } = await import('../services/reportCsv.js');
    const buf = await buildPayrollAnnualCalendarCsv(req.staff!.companyId, year);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-annual-${year}.csv"`);
    res.send(buf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'CSVの生成に失敗しました' });
  }
});
