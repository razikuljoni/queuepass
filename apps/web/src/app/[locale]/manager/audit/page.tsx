'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import BranchPicker, { useBranches } from '@/components/BranchPicker';

type Row = { id: string; action: string; createdAt: string; actor: { name: string; email: string } | null; token: { number: string } | null; details: unknown };

export default function AuditPage() {
  const { branches, branchId, pick } = useBranches();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!branchId) return;
    api<Row[]>(`/manager/audit-log?branchId=${branchId}&limit=100`, { auth: true }).then(setRows).catch((e) => setError((e as Error).message));
  }, [branchId]);

  return (
    <>
      <BranchPicker branchId={branchId} branches={branches} onPick={pick} />
      {error && <div className="error">{error}</div>}
      <div className="card" style={{ marginTop: 16 }}>
        <table>
          <thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Token</th><th>Details</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="small muted">{new Date(r.createdAt).toLocaleString()}</td>
                <td><span className="badge">{r.action}</span></td>
                <td>{r.actor?.name ?? '—'} <span className="small muted">{r.actor?.email ?? ''}</span></td>
                <td className="mono">{r.token?.number ?? '—'}</td>
                <td className="small mono">{typeof r.details === 'object' ? JSON.stringify(r.details) : String(r.details ?? '')}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="muted">—</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
