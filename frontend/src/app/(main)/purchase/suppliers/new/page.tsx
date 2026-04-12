'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Card } from '@/components/ui/Card';
import { PcOnlyRegisterShell } from '@/components/masters/PcOnlyRegisterShell';
import { api } from '@/lib/api';

export default function NewSupplierPage() {
  const router = useRouter();
  const [f, setF] = useState({
    supplierCode: '',
    name: '',
    phone: '',
    address: '',
    paymentTerms: '',
    bankName: '',
    bankBranch: '',
    bankAccountNumber: '',
    bankAccountHolder: '',
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/api/suppliers', {
        method: 'POST',
        body: JSON.stringify({
          supplierCode: f.supplierCode,
          name: f.name,
          phone: f.phone || null,
          address: f.address || null,
          paymentTerms: f.paymentTerms || null,
          bankName: f.bankName || null,
          bankBranch: f.bankBranch || null,
          bankAccountNumber: f.bankAccountNumber || null,
          bankAccountHolder: f.bankAccountHolder || null,
        }),
      });
      router.push('/purchase/suppliers');
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : '登録に失敗しました');
    }
  }

  return (
    <>
      <PageTitle title="仕入先登録" />
      <PcOnlyRegisterShell listHref="/purchase/suppliers" resourceLabel="仕入先">
        <Card className="max-w-2xl">
          <form onSubmit={submit} className="space-y-3">
          <input
            required
            placeholder="仕入先コード *"
            className="w-full rounded border px-3 py-2 text-sm"
            value={f.supplierCode}
            onChange={(e) => setF({ ...f, supplierCode: e.target.value })}
          />
          <input
            required
            placeholder="仕入先名 *"
            className="w-full rounded border px-3 py-2 text-sm"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
          <input
            placeholder="電話"
            className="w-full rounded border px-3 py-2 text-sm"
            value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value })}
          />
          <textarea
            placeholder="住所"
            className="w-full rounded border px-3 py-2 text-sm"
            rows={2}
            value={f.address}
            onChange={(e) => setF({ ...f, address: e.target.value })}
          />
          <input
            placeholder="支払条件"
            className="w-full rounded border px-3 py-2 text-sm"
            value={f.paymentTerms}
            onChange={(e) => setF({ ...f, paymentTerms: e.target.value })}
          />
          <p className="text-xs font-medium text-gunmetal-600">振込先</p>
          <input
            placeholder="銀行名"
            className="w-full rounded border px-3 py-2 text-sm"
            value={f.bankName}
            onChange={(e) => setF({ ...f, bankName: e.target.value })}
          />
          <input
            placeholder="支店名"
            className="w-full rounded border px-3 py-2 text-sm"
            value={f.bankBranch}
            onChange={(e) => setF({ ...f, bankBranch: e.target.value })}
          />
          <input
            placeholder="口座番号"
            className="w-full rounded border px-3 py-2 text-sm"
            value={f.bankAccountNumber}
            onChange={(e) => setF({ ...f, bankAccountNumber: e.target.value })}
          />
          <input
            placeholder="口座名義"
            className="w-full rounded border px-3 py-2 text-sm"
            value={f.bankAccountHolder}
            onChange={(e) => setF({ ...f, bankAccountHolder: e.target.value })}
          />
          <div className="flex gap-2">
            <Link href="/purchase/suppliers" className="rounded border px-4 py-2 text-sm">
              戻る
            </Link>
            <button type="submit" className="rounded bg-navy-900 px-4 py-2 text-sm text-white">
              保存
            </button>
          </div>
          </form>
        </Card>
      </PcOnlyRegisterShell>
    </>
  );
}
