import { triggerBlobDownload } from '@/lib/downloadBlob';

const BOM = '\uFEFF';

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8' });
  triggerBlobDownload(blob, filename);
}

/** 列の意味と取込用キー（Excel 向け UTF-8 BOM 付き） */
export function downloadCustomerMasterDescriptionCsv() {
  downloadCsv(
    'customer-master-column-guide.csv',
    [
      '列名（取込CSVの1行目）,日本語名,必須,説明,記入例',
      'customer_code,顧客コード,必須,社内で重複しないコード（半角英数推奨）,C001',
      'company_name,会社名,必須,正式社名,株式会社サンプル',
      'contact_name,担当者,任意,窓口担当者名,山田太郎',
      'phone,電話,任意,ハイフン可,03-1234-5678',
      'email,メール,任意,,sample@example.com',
      'address,住所,任意,複数行はセル内改行可,東京都…',
      'closing_day,締日,任意,数値のみ（例: 25）,25',
      'payment_terms,支払サイト,任意,例: 月末締め翌月末払い,月末締め翌月末払い',
      'notes,備考,任意,社内向けメモ,',
    ].join('\r\n')
  );
}

export function downloadCustomerImportTemplateCsv() {
  downloadCsv(
    'customer-import-template.csv',
    [
      'customer_code,company_name,contact_name,phone,email,address,closing_day,payment_terms,notes',
      'C001,株式会社サンプル,山田太郎,03-0000-0000,,東京都千代田区,25,月末締め翌月末払い,',
    ].join('\r\n')
  );
}

export function downloadSupplierMasterDescriptionCsv() {
  downloadCsv(
    'supplier-master-column-guide.csv',
    [
      '列名（取込CSVの1行目）,日本語名,必須,説明,記入例',
      'supplier_code,仕入先コード,必須,社内で重複しないコード,S001',
      'name,仕入先名,必須,正式名称,○○商事株式会社',
      'phone,電話,任意,,03-1111-2222',
      'address,住所,任意,,大阪府…',
      'payment_terms,支払条件,任意,,月末締め翌月10日払い',
      'bank_name,銀行名,任意,振込先,みずほ銀行',
      'bank_branch,支店名,任意,,本店',
      'bank_account_number,口座番号,任意,半角数字,1234567',
      'bank_account_holder,口座名義,任意,カナ可,カ）サンプル',
    ].join('\r\n')
  );
}

export function downloadSupplierImportTemplateCsv() {
  downloadCsv(
    'supplier-import-template.csv',
    ['supplier_code,name,phone,address,payment_terms,bank_name,bank_branch,bank_account_number,bank_account_holder', 'S001,○○商事,03-0000-0000,,月末締め,,,,'].join('\r\n')
  );
}

export function downloadProductMasterDescriptionCsv() {
  downloadCsv(
    'product-master-column-guide.csv',
    [
      '列名（取込CSVの1行目）,日本語名,必須,説明,記入例',
      'product_code,商品コード,必須,社内で重複しないコード,PRD-001',
      'name,商品名,必須,,M10 ボルト',
      'category,カテゴリ,任意,検索・整理用,ねじ',
      'manufacturer,メーカー,任意,,○○工業',
      'manufacturer_part_no,メーカー品番,任意,,ABC-123',
      'trusco_order_code,トラスコ発注コード,任意,,',
      'supplier_code,仕入先コード,任意,仕入先マスタに登録済みのコードと一致させる,S001',
      'purchase_price,仕入価格（税抜）,任意,数値のみ,100',
      'sale_price,販売価格（税抜）,任意,数値のみ,150',
      'spec_text,仕様・備考,任意,改行はセル内改行で,ステンレス製',
      ',,,,',
      '※商品画像はCSVでは取り込めません。登録後に画面から追加してください。,,,,',
    ].join('\r\n')
  );
}

export function downloadProductImportTemplateCsv() {
  downloadCsv(
    'product-import-template.csv',
    [
      'product_code,name,category,manufacturer,manufacturer_part_no,trusco_order_code,supplier_code,purchase_price,sale_price,spec_text',
      'PRD-001,サンプル商品,ねじ,,,,S001,100,150,メモ',
    ].join('\r\n')
  );
}
