/**
 * 添付「勘定科目一覧」（弥生ダイレクト想定の3桁コード表）に沿った科目名・区分。
 * 財務区分は集計ロジック用5分類。表示名は PDF の勘定科目名に準拠。
 */
import { query } from '../db/pool.js';

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type YayoiDivisionSeed = {
  divisionCode: string;
  divisionName: string;
  accountType: AccountType;
};

export const YAYOI_DIVISIONS: YayoiDivisionSeed[] = [
  { divisionCode: 'Y01', divisionName: '現金預金', accountType: 'asset' },
  { divisionCode: 'Y02', divisionName: '売上債権', accountType: 'asset' },
  { divisionCode: 'Y03', divisionName: '当座資産', accountType: 'asset' },
  { divisionCode: 'Y04', divisionName: '棚卸資産', accountType: 'asset' },
  { divisionCode: 'Y05', divisionName: 'その他流動資産', accountType: 'asset' },
  { divisionCode: 'Y06', divisionName: '有形固定資産', accountType: 'asset' },
  { divisionCode: 'Y07', divisionName: '無形固定資産', accountType: 'asset' },
  { divisionCode: 'Y08', divisionName: '投資その他の資産・繰延資産', accountType: 'asset' },
  { divisionCode: 'Y10', divisionName: '仕入債務', accountType: 'liability' },
  { divisionCode: 'Y11', divisionName: 'その他流動負債', accountType: 'liability' },
  { divisionCode: 'Y12', divisionName: '固定負債', accountType: 'liability' },
  { divisionCode: 'Y13', divisionName: '引当金（負債）', accountType: 'liability' },
  { divisionCode: 'Y20', divisionName: '純資産', accountType: 'equity' },
  { divisionCode: 'Y30', divisionName: '売上高', accountType: 'revenue' },
  { divisionCode: 'Y31', divisionName: '売上控除・返戻高', accountType: 'expense' },
  { divisionCode: 'Y32', divisionName: '商品売上原価', accountType: 'expense' },
  { divisionCode: 'Y33', divisionName: '製造原価', accountType: 'expense' },
  { divisionCode: 'Y34', divisionName: '販売費及び一般管理費', accountType: 'expense' },
  { divisionCode: 'Y35', divisionName: '営業外収益', accountType: 'revenue' },
  { divisionCode: 'Y36', divisionName: '営業外費用', accountType: 'expense' },
  { divisionCode: 'Y37', divisionName: '特別利益', accountType: 'revenue' },
  { divisionCode: 'Y38', divisionName: '特別損失', accountType: 'expense' },
  { divisionCode: 'Y39', divisionName: '法人税等', accountType: 'expense' },
  { divisionCode: 'Y40', divisionName: '諸口・その他', accountType: 'asset' },
];

export function yayoiDivisionCodeForAccount(accountCode: string): string {
  const n = parseInt(accountCode, 10);
  if (!Number.isFinite(n) || !/^\d{3}$/.test(accountCode)) return 'Y40';

  if (n >= 111 && n <= 149) return 'Y01';
  if (n >= 150 && n <= 160) return 'Y02';
  if (n === 161) return 'Y03';
  if (n >= 171 && n <= 178) return 'Y04';
  if (n >= 181 && n <= 199) return 'Y05';
  if (n >= 211 && n <= 229) return 'Y06';
  if (n >= 231 && n <= 239) return 'Y07';
  if (n >= 241 && n <= 291) return 'Y08';
  if (n >= 301 && n <= 312) return 'Y10';
  if (n >= 321 && n <= 339) return 'Y11';
  if (n >= 340 && n <= 351) return 'Y12';
  if (n >= 359 && n <= 362) return 'Y13';
  if (n >= 411 && n <= 452) return 'Y20';
  if (n === 511 || n === 517) return 'Y30';
  if (n === 521 || n === 523) return 'Y31';
  if (n >= 531 && n <= 591) return 'Y32';
  if (n >= 601 && n <= 699) return 'Y33';
  if (n >= 711 && n <= 791) return 'Y34';
  if (n >= 811 && n <= 819) return 'Y35';
  if (n >= 821 && n <= 899) return 'Y36';
  if (n >= 911 && n <= 919) return 'Y37';
  if (n >= 921 && n <= 928) return 'Y38';
  if (n >= 931 && n <= 932) return 'Y39';
  return 'Y40';
}

/** コメント行（※）は PDF に合わせ科目名のみ */
const YAYOI_ACCOUNT_LINES = `
111	現金
112	小口現金
121	当座預金
131	普通預金
139	納税準備預金
140	貯蓄預金
141	通知預金
142	他流動性預金
143	定期預金
148	定期積金
149	他固定性預金
150	受取手形
152	売掛金
159	貸倒引当金
161	有価証券
171	商品
175	製品
176	原材料
177	仕掛品
178	貯蔵品
181	前渡金
182	立替金
183	短期貸付金
184	未収入金
185	前払費用
186	繰延税金資産
187	仮払金
188	他流動資産
191	仮払消費税等
197	未収消費税等
199	貸倒引当金
211	建物
212	建物付属設備
213	構築物
214	機械装置
215	車両運搬具
216	工具器具備品
218	他有形固定資産
221	土地
222	建設仮勘定
227	減価償却累計額
229	減損損失累計額
231	借地権
232	電話加入権
233	他無形固定資産
237	償却累計額
239	減損損失累計額
241	投資有価証券
242	出資金
243	長期貸付金
244	差入保証金
245	長期前払費用
246	繰延税金資産
247	その他の投資
248	保険積立金
259	貸倒引当金
291	他繰延資産
301	支払手形
312	買掛金
321	短期借入金
322	未払金
323	未払費用
324	前受金
325	前受収益
326	預り金
327	未払事業税等
328	未払法人税等
329	繰延税金負債
331	仮受金
332	他流動負債
335	仮受消費税等
336	未払消費税等
337	賞与引当金
338	割引手形
339	裏書手形
340	長期借入金
342	繰延税金負債
351	他固定負債
359	退職給付引当金
362	他引当金
411	資本金
421	資本準備金
422	資本金減少差益
423	自己株処分差益
431	利益準備金
432	別途積立金
437	繰越利益剰余金
441	土地再評価差額
442	他有価評価差額
443	自己株式
451	本店
452	支店
511	売上高
517	非課税売上高
521	売上値引戻り高
523	売上割戻し高
531	期首商品棚卸高
541	商品仕入高
544	非課税仕入高
551	仕入値引戻し高
553	仕入割戻し高
561	期末商品棚卸高
571	期首製品棚卸高
591	期末製品棚卸高
601	(製)期首原材料
611	(製)原材料仕入
616	(製)非課税材料仕入
621	(製)原材仕値引
628	(製)材料割戻し
631	(製)期末材棚卸
641	(製)賃金
642	(製)賞与
643	(製)雑給
644	(製)退職金
645	(製)法定福利費
646	(製)福利厚生費
647	(製)他の労務費
651	(製)外注加工費
661	(製)他製造経費
671	(製)動力用光熱費
672	(製)賃借料
673	(製)保険料
674	(製)修繕維持費
675	(製)減価償却費
676	(製)運賃
677	(製)消耗品費
678	(製)水道光熱費
679	(製)交際接待費
681	(製)旅費交通費
682	(製)通信費
683	(製)租税公課
688	(製)リース料
689	(製)雑費
691	(製)期首仕掛品
694	(製)期末仕掛品
699	(製)他勘定振替
711	役員報酬
712	給与手当
713	賞与
721	雑給
722	退職金
723	法定福利費
724	福利厚生費
725	退職給付引当金繰入
726	旅費交通費
727	通信費
728	販売手数料
731	運賃
732	広告宣伝費
733	交際接待費
734	会議費
735	燃料費
736	水道光熱費
737	消耗品費
738	租税公課
739	新聞図書費
741	支払手数料
742	諸会費
743	寄付金
744	リース料
745	外注費
746	支払報酬
747	地代家賃
751	賃借料
752	保険料
753	修繕維持費
754	事務用消耗品費
755	他一般管理費
763	減価償却費
764	貸倒引当金繰入
765	賞与引当金繰入
781	貸倒損失
791	雑費
811	受取利息
812	受取配当金
813	他営業外収益
815	有価証券売却益
818	仕入割引
819	雑収入
821	支払利息
822	他営業外費用
823	有価証券売却損
824	手形売却損
829	貸倒損失
859	売上割引
899	雑損失
911	固定資産売却益
912	他特別利益
914	貸倒引当金戻入
915	前期損益修正益
918	投資有価証券売却益
919	償却債権取立益
921	固定資産売却損
922	他特別損失
924	固定資産除却損
925	前期損益修正損
927	投資有価証券売却損
928	減損損失
931	法人税等
932	法人税等調整額
999	諸口
`.trim();

function parseAccountLines(): { code: string; name: string }[] {
  const out: { code: string; name: string }[] = [];
  for (const line of YAYOI_ACCOUNT_LINES.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const tab = t.indexOf('\t');
    if (tab === -1) continue;
    const code = t.slice(0, tab).trim();
    let name = t.slice(tab + 1).trim();
    if (!/^\d{3}$/.test(code)) continue;
    name = name.replace(/^※\s*/, '');
    out.push({ code, name });
  }
  return out;
}

export const YAYOI_ACCOUNTS: { code: string; name: string }[] = parseAccountLines();

export type ImportYayoiChartResult = {
  divisionsInserted: number;
  divisionsExisting: number;
  accountsInserted: number;
  accountsSkipped: number;
};

export async function importYayoiStyleChart(companyId: string): Promise<ImportYayoiChartResult> {
  let divisionsInserted = 0;
  let divisionsExisting = 0;

  for (const d of YAYOI_DIVISIONS) {
    const ex = await query(
      `SELECT id FROM chart_account_divisions WHERE company_id = $1 AND division_code = $2`,
      [companyId, d.divisionCode]
    );
    if (ex.rows.length > 0) {
      divisionsExisting++;
      continue;
    }
    await query(
      `INSERT INTO chart_account_divisions (company_id, division_code, division_name, account_type)
       VALUES ($1,$2,$3,$4::account_type)`,
      [companyId, d.divisionCode, d.divisionName, d.accountType]
    );
    divisionsInserted++;
  }

  const divIdByCode = new Map<string, string>();
  const divRows = await query<{ id: string; division_code: string }>(
    `SELECT id, division_code FROM chart_account_divisions WHERE company_id = $1`,
    [companyId]
  );
  for (const r of divRows.rows) {
    divIdByCode.set(r.division_code, r.id);
  }

  let accountsInserted = 0;
  let accountsSkipped = 0;

  for (const acc of YAYOI_ACCOUNTS) {
    const dCode = yayoiDivisionCodeForAccount(acc.code);
    const divisionId = divIdByCode.get(dCode);
    if (!divisionId) continue;

    const exists = await query(
      `SELECT 1 FROM chart_of_accounts WHERE company_id = $1 AND code = $2 LIMIT 1`,
      [companyId, acc.code]
    );
    if (exists.rows.length > 0) {
      accountsSkipped++;
      continue;
    }

    const divMeta = YAYOI_DIVISIONS.find((x) => x.divisionCode === dCode);
    const accountType = divMeta?.accountType ?? 'asset';

    await query(
      `INSERT INTO chart_of_accounts (company_id, division_id, code, name, account_type)
       VALUES ($1,$2,$3,$4,$5::account_type)`,
      [companyId, divisionId, acc.code, acc.name, accountType]
    );
    accountsInserted++;
  }

  return { divisionsInserted, divisionsExisting, accountsInserted, accountsSkipped };
}
