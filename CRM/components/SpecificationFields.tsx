'use client';
const labels = ['Product Category', 'Brand / Manufacturer', 'SKU / Catalog ID', 'Regulatory Compliance', 'Warranty', 'Supply Voltage / Power', 'Clinical Application', 'After-Sales Service'];
export default function SpecificationFields({ value, onChange, excludedLabels = [] }: { value: string; onChange: (value: string) => void; excludedLabels?: string[] }) {
  const entries = value.split('\n').filter(line => line.includes(':')).map(line => {
    const index = line.indexOf(':');
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  });
  const visibleLabels = labels.filter(label => !excludedLabels.includes(label));
  const values = Object.fromEntries(entries);
  const update = (label: string, next: string) => {
    const updated = entries.filter(([key]) => key !== label);
    if (next) updated.push([label, next]);
    onChange(updated.map(([key, val]) => `${key}: ${val}`).join('\n'));
  };
  return <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
    <legend style={{ fontWeight: 700, marginBottom: 8 }}>Technical specifications</legend>
    <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Only completed fields appear on the product page. Leave a value blank to hide that row.</p>
    <div data-mobile-grid="stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: 16 }}>
      {visibleLabels.map(label => <label key={label}>{label}<input value={values[label] || ''} onChange={event => update(label, event.target.value)} placeholder="Leave blank to hide" /></label>)}
    </div>
    <label style={{ display: 'block', marginTop: 20 }}>Additional specifications <small>One per line: Label: Value</small>
      <textarea rows={4} value={entries.filter(([key]) => !labels.includes(key) && !excludedLabels.includes(key)).map(([key, val]) => `${key}: ${val}`).join('\n')} onChange={event => onChange([...entries.filter(([key]) => (labels.includes(key) || excludedLabels.includes(key))).map(([key, val]) => `${key}: ${val}`), event.target.value].filter(Boolean).join('\n'))} />
    </label>
  </fieldset>;
}
