'use client';
import { useEffect, useState } from 'react';
import { api, type Branch } from '@/lib/api';

export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  useEffect(() => {
    api<Branch[]>('/branches', { auth: true }).then((b) => {
      setBranches(b);
      const saved = typeof window !== 'undefined' ? localStorage.getItem('qp_branch') : null;
      setBranchId(saved && b.some((x) => x.id === saved) ? saved : b[0]?.id ?? '');
    }).catch(() => {});
  }, []);
  const pick = (id: string) => { setBranchId(id); localStorage.setItem('qp_branch', id); };
  return { branches, branchId, pick };
}

export default function BranchPicker({ branchId, branches, onPick }: { branchId: string; branches: Branch[]; onPick: (id: string) => void }) {
  if (!branches.length) return null;
  return (
    <select value={branchId} onChange={(e) => onPick(e.target.value)} style={{ maxWidth: 320 }}>
      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
  );
}
