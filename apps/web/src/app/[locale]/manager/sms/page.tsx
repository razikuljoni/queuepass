'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import BranchPicker, { useBranches } from '@/components/BranchPicker';

type Usage = { sent: number; delivered: number; failed: number; pending: number; totalCostBdt: number; balanceBdt: number; lowBalance: boolean };
type Failed = { id: string; event: string; body: string; attempts: number; createdAt: string; token: { number: string; phone: string } };

export default function SmsPage() {
  const { branches, branchId, pick } = useBranches();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [failed, setFailed] = useState<Failed[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!branchId) return;
    Promise.all([
      api<Usage>(`/sms/usage?branchId=${branchId}`, { auth: true }),
      api<Failed[]>(`/sms/failed?branchId=${branchId}`, { auth: true }),
    ]).then(([u, f]) => { setUsage(u); setFailed(f); }).catch((e) => setError((e as Error).message));
  }, [branchId]);

  return (
    <>
      <BranchPicker branchId={branchId} branches={branches} onPick={pick} />
      {error && <div className="error">{error}</div>}
      {usage?.lowBalance && <div className="error">Low SMS balance — top up from the Billing tab.</div>}
      {usage && (
        <div className="grid grid-4" style={{ marginTop: 16 }}>
          <div className="card stat"><div className="label">Sent</div><div className="value mono">{usage.sent}</div></div>
          <div className="card stat"><div className="label">Delivered</div><div className="value mono">{usage.delivered}</div></div>
          <div className="card stat"><div className="label">Failed</div><div className="value mono">{usage.failed}</div></div>
          <div className="card stat"><div className="label">Pending</div><div className="value mono">{usage.pending}</div></div>
          <div className="card stat"><div className="label">Cost (৳)</div><div className="value">৳{usage.totalCostBdt}</div></div>
          <div className="card stat"><div className="label">Balance (৳)</div><div className="value">৳{usage.balanceBdt}</div></div>
        </div>
      )}
      <h2>Failed SMS (DLQ)</h2>
      <div className="card">
        <table>
          <thead><tr><th>Token</th><th>Phone</th><th>Event</th><th>Attempts</th><th>Body</th><th>When</th></tr></thead>
          <tbody>
            {failed.map((f) => (
              <tr key={f.id}>
                <td className="mono"><strong>{f.token.number}</strong></td>
                <td className="mono">{f.token.phone}</td>
                <td>{f.event}</td>
                <td>{f.attempts}</td>
                <td className="small">{f.body}</td>
                <td className="small muted">{new Date(f.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {failed.length === 0 && <tr><td colSpan={6} className="muted">No failed SMS.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
