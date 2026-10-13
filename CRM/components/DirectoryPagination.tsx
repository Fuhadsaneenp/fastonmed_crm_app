'use client';
export default function DirectoryPagination({ total, page, onChange }: { total: number; page: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / 20));
  return <nav className="crm-directory-pagination" aria-label="Directory pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '16px 20px', margin: '16px 0', border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
    <span style={{ fontSize: 12, color: '#64748b' }}>Showing {total ? (page - 1) * 20 + 1 : 0}–{Math.min(page * 20, total)} of {total}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button><span style={{ fontSize: 12 }}>Page {page} of {pages}</span><button type="button" className="btn btn-secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button></div>
  </nav>;
}
