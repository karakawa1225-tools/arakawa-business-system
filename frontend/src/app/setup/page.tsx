'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Step = 0 | 1 | 2 | 3 | 4 | 5;

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [company, setCompany] = useState({ name: '', address: '', phone: '' });
  const [bank, setBank] = useState({ name: '', bankName: '', branchName: '', accountNumber: '', holderName: '' });
  const [tax, setTax] = useState({ defaultTaxRate: 10 });
  const [user, setUser] = useState({ email: '', password: '', name: '' });

  useEffect(() => {
    api<{ needsSetup: boolean; setupCompleted: boolean; step: number }>('/api/setup/status', {
      token: false,
    })
      .then((s) => {
        setErr('');
        if (s.setupCompleted) {
          router.replace('/login');
          return;
        }
        // setup_step が 0 のときも数値として復帰する（falsy 判定バグを避ける）
        if (!s.needsSetup && typeof s.step === 'number') {
          setStep(Math.min(5, Math.max(0, s.step)) as Step);
        }
        setLoading(false);
      })
      .catch((e: unknown) => {
        setLoading(false);
        setErr(
          e instanceof Error
            ? e.message
            : 'セットアップ情報を取得できませんでした。Express の http://127.0.0.1:4000/health が動いているか確認し、フロントは一度再起動（npm run dev:3001）してください。'
        );
      });
  }, [router]);

  async function run(fn: () => Promise<void>) {
    setErr('');
    try {
      await fn();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'エラー');
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">読み込み中…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-lg">
        <h1 className="text-xl font-semibold text-navy-950">初回セットアップ</h1>
        <p className="mt-1 text-sm text-gunmetal-600">STEP {step + 1} / 5</p>

        <div className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
          {step === 0 && (
            <>
              <h2 className="font-medium text-navy-900">STEP1 会社情報</h2>
              <input
                required
                placeholder="会社名 *"
                value={company.name}
                onChange={(e) => setCompany({ ...company, name: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder="住所"
                value={company.address}
                onChange={(e) => setCompany({ ...company, address: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder="電話"
                value={company.phone}
                onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() =>
                  run(async () => {
                    await api('/api/setup/company', {
                      method: 'POST',
                      body: JSON.stringify({
                        name: company.name.trim(),
                        address: company.address.trim() || undefined,
                        phone: company.phone.trim() || undefined,
                      }),
                      token: false,
                    });
                    setStep(1);
                  })
                }
                className="w-full rounded-lg bg-navy-900 py-2 text-sm text-white"
              >
                次へ
              </button>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="font-medium text-navy-900">STEP2 銀行口座</h2>
              <input
                placeholder="口座表示名"
                value={bank.name}
                onChange={(e) => setBank({ ...bank, name: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder="銀行名"
                value={bank.bankName}
                onChange={(e) => setBank({ ...bank, bankName: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder="支店名"
                value={bank.branchName}
                onChange={(e) => setBank({ ...bank, branchName: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder="口座番号"
                value={bank.accountNumber}
                onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder="口座名義"
                value={bank.holderName}
                onChange={(e) => setBank({ ...bank, holderName: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(0)} className="flex-1 rounded-lg border py-2 text-sm">
                  戻る
                </button>
                <button
                  type="button"
                  onClick={() =>
                    run(async () => {
                      await api('/api/setup/bank', {
                        method: 'POST',
                        body: JSON.stringify(bank),
                        token: false,
                      });
                      setStep(2);
                    })
                  }
                  className="flex-1 rounded-lg bg-navy-900 py-2 text-sm text-white"
                >
                  次へ
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-medium text-navy-900">STEP3 税率設定</h2>
              <label className="text-sm text-gunmetal-600">標準税率 (%)</label>
              <input
                type="number"
                value={tax.defaultTaxRate}
                onChange={(e) => setTax({ defaultTaxRate: Number(e.target.value) })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(1)} className="flex-1 rounded-lg border py-2 text-sm">
                  戻る
                </button>
                <button
                  type="button"
                  onClick={() =>
                    run(async () => {
                      await api('/api/setup/tax', {
                        method: 'POST',
                        body: JSON.stringify(tax),
                        token: false,
                      });
                      setStep(3);
                    })
                  }
                  className="flex-1 rounded-lg bg-navy-900 py-2 text-sm text-white"
                >
                  次へ
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="font-medium text-navy-900">STEP4 管理者ユーザー</h2>
              <input
                placeholder="氏名"
                value={user.name}
                onChange={(e) => setUser({ ...user, name: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder="メール"
                type="email"
                value={user.email}
                onChange={(e) => setUser({ ...user, email: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder="パスワード"
                type="password"
                value={user.password}
                onChange={(e) => setUser({ ...user, password: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(2)} className="flex-1 rounded-lg border py-2 text-sm">
                  戻る
                </button>
                <button
                  type="button"
                  onClick={() =>
                    run(async () => {
                      await api('/api/setup/user', {
                        method: 'POST',
                        body: JSON.stringify(user),
                        token: false,
                      });
                      setStep(4);
                    })
                  }
                  className="flex-1 rounded-lg bg-navy-900 py-2 text-sm text-white"
                >
                  次へ
                </button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="font-medium text-navy-900">STEP5 初期マスタ</h2>
              <p className="text-sm text-gunmetal-600">勘定科目（売上・仕入・旅費交通費など）を登録します。</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(3)} className="flex-1 rounded-lg border py-2 text-sm">
                  戻る
                </button>
                <button
                  type="button"
                  onClick={() =>
                    run(async () => {
                      await api('/api/setup/masters', { method: 'POST', body: '{}', token: false });
                      await api('/api/setup/complete', { method: 'POST', body: '{}', token: false });
                      setStep(5);
                    })
                  }
                  className="flex-1 rounded-lg bg-navy-900 py-2 text-sm text-white"
                >
                  完了
                </button>
              </div>
            </>
          )}

          {step === 5 && (
            <div className="text-center">
              <p className="text-navy-900">セットアップが完了しました。</p>
              <Link href="/login" className="mt-4 inline-block text-sm text-navy-800 underline">
                ログインへ
              </Link>
            </div>
          )}

          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
      </div>
    </div>
  );
}
