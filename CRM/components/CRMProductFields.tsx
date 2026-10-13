'use client';

import { useEffect, useState } from 'react';
import CustomLightSelect from './CustomLightSelect';
import AddTraderCompanyModal from './AddTraderCompanyModal';
import { Plus, Trash2, Building2, Truck, ShieldCheck, StickyNote } from 'lucide-react';
import styles from './CRMProductFields.module.css';
import { getStoredCompanies } from '@/lib/trader-store';
import type { ProcurementCompany, ProductTraderOffer } from '@/types';

export type CRMProductData = {
  model?: string;
  purchaseCost?: number;
  vatStatus?: string;
  amcAvailable?: boolean;
  traders?: ProductTraderOffer[];
  traderCompanyId?: string;
  traderCompanyName?: string;
  supplier?: string;
  deliveryLeadTime?: string;
  traderPriceMin?: number;
  traderPriceMax?: number;
};

export function productTraderOffers(product: CRMProductData): ProductTraderOffer[] {
  if (Array.isArray(product.traders)) return product.traders;
  return product.traderCompanyId ? [{
    traderCompanyId: product.traderCompanyId,
    traderCompanyName: product.traderCompanyName || product.supplier || '',
    offeringPrice: product.purchaseCost ?? 0,
    deliveryLeadTime: product.deliveryLeadTime || '',
    traderPriceMin: product.traderPriceMin,
    traderPriceMax: product.traderPriceMax,
  }] : [];
}

export default function CRMProductFields({ product, sellingPrice, onChange }: {
  product: CRMProductData;
  sellingPrice: number;
  onChange: (changes: Partial<CRMProductData>) => void;
}) {
  const [companies, setCompanies] = useState<ProcurementCompany[]>([]);
  const [addingTrader, setAddingTrader] = useState<{ index: number; name: string } | null>(null);
  useEffect(() => {
    const refresh = () => setCompanies(getStoredCompanies());
    refresh();
    window.addEventListener('fastonmed_companies_updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('fastonmed_companies_updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  const offers = productTraderOffers(product);
  const updateOffer = (index: number, changes: Partial<ProductTraderOffer>) => {
    onChange({ traders: offers.map((offer, i) => i === index ? { ...offer, ...changes } : offer) });
  };
  const cost = Number(product.purchaseCost || 0);
  const margin = sellingPrice > 0 && Number.isFinite(cost)
    ? `${(((sellingPrice - cost) / sellingPrice) * 100).toFixed(1)}%` : '—';

  return <>
    <div className="tk-panel">
      <h3>CRM commercial details</h3>
      <label>Model<input value={product.model || ''} onChange={e => onChange({ model: e.target.value })} /></label>
      <label>Purchase cost (AED)<input type="number" min="0" step="0.01" value={product.purchaseCost ?? ''} onChange={e => onChange({ purchaseCost: Number(e.target.value) })} /></label>
      <label>VAT status<select value={product.vatStatus || '5% Standard Rate (UAE VAT)'} onChange={e => onChange({ vatStatus: e.target.value })}>
        {[...new Set(['5% Standard Rate (UAE VAT)', '5% Standard Rate', '0% Zero-Rated', 'Exempt', 'Inclusive of 5% VAT', ...(product.vatStatus ? [product.vatStatus] : [])])].map(value => <option key={value}>{value}</option>)}
      </select></label>
      <p>Gross margin: <strong>{margin}</strong></p>
      <label style={{ display: 'flex', alignItems: 'center' }}><input style={{ width: 'auto' }} type="checkbox" checked={product.amcAvailable ?? false} onChange={e => onChange({ amcAvailable: e.target.checked })} /> AMC eligible for this equipment</label>
    </div>
    <section className={`tk-panel ${styles.panel}`} id="traders" aria-labelledby="trader-heading">
      <header className={styles.heading}>
        <span className={styles.sectionIcon}><Building2 size={19} /></span>
        <div><h3 id="trader-heading">Trader offers</h3><p>Compare suppliers, pricing and delivery.</p></div>
        <span className={styles.count}>{offers.length}</span>
      </header>
      {offers.length === 0 && <div className={styles.empty}>
        <Building2 size={27} strokeWidth={1.5} />
        <strong>Add your first trader</strong>
        <p>Keep supplier offers together for this product. You can also add them later.</p>
      </div>}
      <div className={styles.offerList}>
        {offers.map((offer, index) => <article key={index} className={styles.offer} aria-label={`Trader offer ${index + 1}`}>
          <div className={styles.offerHeader}>
            <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
            <div className={styles.offerTitle}><strong>{offer.traderCompanyName || 'New trader offer'}</strong><span>{offer.traderCompanyId ? 'Assigned supplier' : 'Choose a supplier below'}</span></div>
            <button type="button" className={styles.remove} aria-label={`Remove trader ${offer.traderCompanyName || index + 1}`} title="Remove trader" onClick={() => onChange({ traders: offers.filter((_, i) => i !== index) })}><Trash2 size={15} /></button>
          </div>
          <div className={styles.offerBody}>
            <div className={styles.field}>
              <span className={styles.fieldTitle}>Trader company</span>
              <CustomLightSelect
                value={offer.traderCompanyId}
                placeholder="Search or select trader"
                searchable
                clearable={false}
                options={[
                  ...(offer.traderCompanyId && !companies.some(c => c.id === offer.traderCompanyId) ? [{ value: offer.traderCompanyId, label: offer.traderCompanyName || offer.traderCompanyId }] : []),
                  ...companies.filter(c => c.id === offer.traderCompanyId || !offers.some(o => o.traderCompanyId === c.id)).map(c => ({ value: c.id, label: c.name, subtext: c.uaeOffice })),
                ]}
                onChange={value => {
                  const company = companies.find(c => c.id === value);
                  updateOffer(index, { traderCompanyId: value, traderCompanyName: company?.name || '' });
                }}
                onAddNew={name => setAddingTrader({ index, name: name || '' })}
                addNewLabel="+ Add trader company"
                buttonStyle={{ width: '100%', minHeight: 40, borderRadius: 8, fontSize: 12, borderColor: '#dfe7e3' }}
                menuStyle={{ width: '100%', minWidth: 0 }}
              />
            </div>
            <label className={`${styles.field} ${styles.priceField}`}>Offering price
              <span className={styles.priceInput}><span>AED</span><input aria-label={`Offering price for trader ${index + 1} in AED`} type="number" min="0" step="0.01" placeholder="0.00" value={offer.offeringPrice ?? ''} onChange={e => updateOffer(index, { offeringPrice: Number(e.target.value) })} /></span>
            </label>
            <div className={styles.terms}>
              <label className={styles.field}><span className={styles.fieldTitle}><Truck size={14} /> Delivery lead time</span><input value={offer.deliveryLeadTime || ''} placeholder="e.g. 3–5 days" onChange={e => updateOffer(index, { deliveryLeadTime: e.target.value })} /></label>
              <label className={styles.field}><span className={styles.fieldTitle}><ShieldCheck size={14} /> Warranty</span><input value={offer.warrantyPeriod || ''} placeholder="e.g. 1 year" onChange={e => updateOffer(index, { warrantyPeriod: e.target.value })} /></label>
            </div>
            <details className={styles.notes} open={offer.notes ? true : undefined}>
              <summary><StickyNote size={14} /> Supplier notes <span>Optional</span></summary>
              <label className={styles.field}><span className={styles.srOnly}>Notes for trader {index + 1}</span><textarea rows={3} placeholder="Availability, terms or other details…" value={offer.notes || ''} onChange={e => updateOffer(index, { notes: e.target.value })} /></label>
            </details>
          </div>
        </article>)}
      </div>
      <button type="button" className={styles.add} onClick={() => onChange({ traders: [...offers, { traderCompanyId: '', traderCompanyName: '', deliveryLeadTime: '', warrantyPeriod: '' }] })}><Plus size={17} /> {offers.length ? 'Add another trader' : 'Add trader offer'}</button>
      <button type="button" className={styles.createCompany} onClick={() => setAddingTrader({ index: offers.length, name: '' })}><Building2 size={15} /> Add trader company</button>
    </section>
    {addingTrader && <AddTraderCompanyModal
      initialName={addingTrader.name}
      onClose={() => setAddingTrader(null)}
      onCreated={company => {
        setCompanies(getStoredCompanies());
        const newOffer = { traderCompanyId: company.id, traderCompanyName: company.name, deliveryLeadTime: company.deliveryLeadTime || '', warrantyPeriod: '' };
        if (addingTrader.index < offers.length) updateOffer(addingTrader.index, newOffer);
        else onChange({ traders: [...offers, newOffer] });
      }}
    />}
  </>;
}
