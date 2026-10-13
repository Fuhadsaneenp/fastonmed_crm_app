'use client';

import Link from 'next/link';
import SpecificationFields from './SpecificationFields';
import { categoryNames } from '@/lib/product-categories';
import CRMProductFields, { productTraderOffers, type CRMProductData } from '@/components/CRMProductFields';
import { getStoredProducts, saveStoredProducts, getStoredBrands, addStoredCategory, addStoredBrand } from '@/lib/trader-store';
import { getWooCommerceProducts } from '@/lib/woocommerce/catalog-store';
import type { Product as StoredProduct } from '@/types';
import ProductDescription from '@/components/ProductDescription';
import { ensureValidAuthToken } from '@/lib/api-client';
import { useEffect, useMemo, useRef, useState, ChangeEvent } from 'react';
import {
  Edit3,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  X,
  Layers,
  RotateCcw,
  Sparkles,
  Link2,
  Highlighter,
  Strikethrough,
  Code,
  Quote,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Image as ImageIcon,
  FolderOpen,
  Check,
  Eye,
  Smartphone,
  Monitor,
  ExternalLink,
  ShieldCheck,
  Truck,
  MessageCircle,
  ShoppingBag,
  FileText,
  AlertTriangle,
  Globe,
  Tag,
  Package,
  CheckCircle2,
} from 'lucide-react';

export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'list'
  | 'quote'
  | 'code'
  | 'image';

export type Block = { id: string; type: BlockType; content: string };

type Product = Record<string, any> & CRMProductData & {
  id: string;
  name: string;
  slug: string;
  sku: string;
  category: string;
  brand: string;
  status: string;
  image?: string;
  imageAlt?: string;
  galleryImages?: string[];
  galleryAlts?: Record<string, string>;
  regularPrice?: number;
  salePrice?: number;
  sellingPrice?: number;
  inStock?: number;
  stockStatus?: string;
  description?: string;
  shortDescription?: string;
  specifications?: Record<string, string>;
  tags?: string[];
  purchaseMode?: string;
  warrantyPeriod?: string;
  seoTitle?: string;
  seoDescription?: string;
  createdAt?: string;
  updatedAt?: string;
};

interface MediaItem {
  url: string;
  name: string;
  category: 'uploads' | 'products' | 'showcase' | 'library';
  mtime?: number;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const block = (type: BlockType = 'paragraph'): Block => ({ id: uid(), type, content: '' });

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const decodeHtml = (html?: string): string => {
  if (!html) return '';
  return html
    .replace(/&amp;/g, '&')
    .replace(/&#038;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
};

const serializeBlocks = (blocks: Block[]): string =>
  blocks
    .map((b) => {
      const s = b.content;
      if (b.type === 'heading' || b.type === 'heading2') return `<h2>${s}</h2>`;
      if (b.type === 'heading3') return `<h3>${s}</h3>`;
      if (b.type === 'heading4') return `<h4>${s}</h4>`;
      if (b.type === 'quote') return `<blockquote>${s}</blockquote>`;
      if (b.type === 'list') {
        const lines = s
          .replace(/<br\s*[\/]?>/gi, '\n')
          .replace(/<\/?[^>]+(>|$)/g, '\n')
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean);
        return `<ul>${lines.map((x) => `<li>${x}</li>`).join('')}</ul>`;
      }
      if (b.type === 'code') return `<pre><code>${s}</code></pre>`;
      if (b.type === 'image') return s ? `<img src="${s}" alt="Product visual" />` : '';
      return `<p>${s}</p>`;
    })
    .join('\n');

const deserializeToBlocks = (htmlOrText?: string): Block[] => {
  if (!htmlOrText || !htmlOrText.trim()) {
    return [{ id: uid(), type: 'paragraph', content: '' }];
  }
  const trimmed = htmlOrText.trim();

  // If pure text without any HTML tags
  if (!/<[a-z][\s\S]*>/i.test(trimmed)) {
    const paragraphs = trimmed.split(/\n\s*\n/).filter(Boolean);
    if (!paragraphs.length) return [{ id: uid(), type: 'paragraph', content: '' }];
    return paragraphs.map((p) => ({
      id: uid(),
      type: 'paragraph',
      content: p.replace(/\n/g, '<br/>'),
    }));
  }

  // Parse HTML tags
  if (typeof window !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, 'text/html');
      const nodes = Array.from(doc.body.childNodes);
      const blocks: Block[] = [];

      for (const node of nodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tag = el.tagName.toLowerCase();
          if (tag === 'h2') {
            blocks.push({ id: uid(), type: 'heading2', content: el.innerHTML });
          } else if (tag === 'h3') {
            blocks.push({ id: uid(), type: 'heading3', content: el.innerHTML });
          } else if (tag === 'h4') {
            blocks.push({ id: uid(), type: 'heading4', content: el.innerHTML });
          } else if (tag === 'blockquote') {
            blocks.push({ id: uid(), type: 'quote', content: el.innerHTML });
          } else if (tag === 'pre') {
            blocks.push({ id: uid(), type: 'code', content: el.innerHTML });
          } else if (tag === 'ul' || tag === 'ol') {
            const items = Array.from(el.querySelectorAll('li'))
              .map((li) => li.innerHTML)
              .join('<br/>');
            blocks.push({ id: uid(), type: 'list', content: items || el.innerHTML });
          } else if (tag === 'img') {
            const src = (el as HTMLImageElement).getAttribute('src') || '';
            blocks.push({ id: uid(), type: 'image', content: src });
          } else {
            blocks.push({ id: uid(), type: 'paragraph', content: el.innerHTML });
          }
        } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
          blocks.push({ id: uid(), type: 'paragraph', content: node.textContent.trim() });
        }
      }

      if (blocks.length > 0) return blocks;
    } catch {}
  }

  return [{ id: uid(), type: 'paragraph', content: trimmed }];
};

const getBlockTypeMeta = (type: BlockType) => {
  switch (type) {
    case 'heading':
    case 'heading2':
      return { label: 'Heading 2', icon: <span style={{ fontWeight: 800 }}>H2</span> };
    case 'heading3':
      return { label: 'Heading 3', icon: <span style={{ fontWeight: 800 }}>H3</span> };
    case 'heading4':
      return { label: 'Heading 4', icon: <span style={{ fontWeight: 800 }}>H4</span> };
    case 'list':
      return { label: 'Bullet List', icon: <List size={15} /> };
    case 'quote':
      return { label: 'Quote', icon: <Quote size={15} /> };
    case 'code':
      return { label: 'Code Block', icon: <Code size={15} /> };
    case 'image':
      return { label: 'Image', icon: <ImageIcon size={15} /> };
    default:
      return { label: 'Paragraph', icon: <AlignLeft size={15} /> };
  }
};

const productCreatedAt = (product: Product): string =>
  product.createdAt || product.wordpressSource?.createdAt || product.updatedAt || '';

const productCreatedTime = (product: Product): number => {
  const value = productCreatedAt(product);
  if (!value) return 0;
  const parsed = Date.parse(value.includes('T') ? value : value.replace(' ', 'T'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatProductDate = (product: Product): { date: string; time: string } => {
  const timestamp = productCreatedTime(product);
  if (!timestamp) return { date: '—', time: '' };
  const date = new Date(timestamp);
  return {
    date: new Intl.DateTimeFormat('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date),
    time: new Intl.DateTimeFormat('en-AE', { hour: '2-digit', minute: '2-digit' }).format(date),
  };
};

const blank = (): Product => ({
  id: `prod-${Date.now()}`,
  name: '',
  slug: '',
  sku: '',
  category: '',
  brand: '',
  status: 'draft',
  image: '',
  imageAlt: '',
  galleryImages: [],
  galleryAlts: {},
  regularPrice: 0,
  salePrice: 0,
  sellingPrice: 0,
  inStock: 0,
  stockStatus: 'instock',
  description: '',
  shortDescription: '',
  specifications: {},
  tags: [],
  purchaseMode: 'cart',
  warrantyPeriod: '',
  seoTitle: '',
  seoDescription: '',
});

const PAGE_SIZE = 25;

function SearchableCombobox({
  value,
  onChange,
  options,
  placeholder,
  counts,
  allowCustom = true,
  onAdd,
  addLabel,
}: {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder: string;
  counts?: Record<string, number>;
  allowCustom?: boolean;
  onAdd?: (name: string) => void;
  addLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, search]);

  const exactMatch = options.some(
    (o) => o.toLowerCase() === search.trim().toLowerCase()
  );

  return (
    <div className="tk-searchable-combobox" ref={containerRef}>
      <button
        type="button"
        className={`tk-combobox-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <span style={{ color: value ? '#0f172a' : '#94a3b8', fontWeight: value ? 500 : 400 }}>
          {value || placeholder}
        </span>
        <ChevronDown
          size={14}
          color="#64748b"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
        />
      </button>

      {open && (
        <div className="tk-combobox-dropdown">
          <div className="tk-combobox-search-bar">
            <Search size={13} color="#94a3b8" />
            <input
              type="text"
              className="tk-combobox-search-input"
              placeholder={`Search ${placeholder.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button
                type="button"
                style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0 }}
                onClick={() => setSearch('')}
              >
                <X size={12} color="#94a3b8" />
              </button>
            )}
          </div>

          <div className="tk-combobox-list">
            {filtered.length === 0 && !search && (
              <div style={{ padding: '12px 10px', fontSize: '11.5px', color: '#94a3b8', textAlign: 'center' }}>
                No options available
              </div>
            )}
            {filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`tk-combobox-item ${opt === value ? 'selected' : ''}`}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                  setSearch('');
                }}
              >
                <span>{opt}</span>
                {counts && counts[opt] !== undefined && (
                  <span className="tk-combobox-item-count">{counts[opt]}</span>
                )}
              </button>
            ))}
          </div>

          {onAdd && <button type="button" className="tk-combobox-create-new" style={{ width: '100%', border: 0, textAlign: 'left' }} onClick={() => {
            onAdd(search.trim());
            setOpen(false);
            setSearch('');
          }}><Plus size={13} /> {addLabel}</button>}
          {!onAdd && allowCustom && search.trim() && !exactMatch && (
            <div
              className="tk-combobox-create-new"
              onClick={() => {
                onChange(search.trim());
                setOpen(false);
                setSearch('');
              }}
            >
              <Plus size={13} />
              <span>Use &quot;{search.trim()}&quot; as new</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProductManager({
  mode,
  id,
  initialStatus = 'published',
}: {
  mode: 'list' | 'editor';
  id?: string;
  initialStatus?: 'all' | 'published' | 'draft' | 'trash';
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [databaseBrands, setDatabaseBrands] = useState<string[]>([]);
  const [newTaxonomy, setNewTaxonomy] = useState<{ kind: 'category' | 'brand'; name: string } | null>(null);
  const [taxonomySaving, setTaxonomySaving] = useState(false);
  const [taxonomyError, setTaxonomyError] = useState('');
  const [databaseCategories, setDatabaseCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');
  const [categoriesRevision, setCategoriesRevision] = useState(0);
  const [product, setProduct] = useState<Product>(blank());
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [message, setMessage] = useState('');
  const [specText, setSpecText] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'trash'>(initialStatus);
  const [loading, setLoading] = useState(true);
  const [productLoadError, setProductLoadError] = useState('');
  const [productLoaded, setProductLoaded] = useState(false);
  const [loadRevision, setLoadRevision] = useState(0);

  // Description Editor State
  const [descriptionMode, setDescriptionMode] = useState<'visual' | 'html'>('visual');
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const editorCanvasRef = useRef<HTMLDivElement>(null);
  const loadedDescriptionRef = useRef('');
  const editorImageInputRef = useRef<HTMLInputElement>(null);

  // SEO Modal State
  const [seoModalOpen, setSeoModalOpen] = useState(false);
  const [draftSeoTitle, setDraftSeoTitle] = useState('');
  const [draftSeoSlug, setDraftSeoSlug] = useState('');
  const [draftSeoDesc, setDraftSeoDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Media Library & Uploads State
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<'main' | 'gallery' | 'editor' | null>(null);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'products' | 'showcase' | 'library' | 'uploads'>('all');
  const [mediaSearch, setMediaSearch] = useState('');
  const [selectedMediaUrl, setSelectedMediaUrl] = useState<string>('');
  const [modalAltText, setModalAltText] = useState('');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [activePreviewImage, setActivePreviewImage] = useState<string>('');
  const [mediaTab, setMediaTab] = useState<'library' | 'upload'>('library');
  const [isUploading, setIsUploading] = useState(false);
  const [showDirectUrlInput, setShowDirectUrlInput] = useState(false);
  const [isDraggingMain, setIsDraggingMain] = useState(false);
  const [isDraggingGallery, setIsDraggingGallery] = useState(false);

  // File input refs
  const mainImageInputRef = useRef<HTMLInputElement>(null);
  const galleryImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    let freshReceived = false;
    const controller = new AbortController();
    setLoading(true);
    setProductLoadError('');
    setProductLoaded(!id);
    setProduct(blank());
    setSpecText('');
    loadedDescriptionRef.current = '';

    const hydrateProduct = (all: Product[]) => {
      const selected = all.find(item => item.id === id || item.slug === id);
      if (!selected) return false;
      setProduct({ ...blank(), ...selected, category: selected.category || selected.specifications?.['Product Category'] || '', brand: selected.brand || selected.specifications?.['Brand / Manufacturer'] || '', regularPrice: selected.regularPrice ?? selected.sellingPrice ?? 0 });
      loadedDescriptionRef.current = selected.description || '';
      setProductLoaded(true);
      setSpecText(Object.entries(selected.specifications || {}).map(([key, value]) => `${key}: ${value}`).join('\n'));
      return true;
    };

    // Show the catalogue record already viewed in the list while verifying it.
    const cached = getStoredProducts() as Product[];
    setProducts(cached);
    if (id) {
      hydrateProduct(cached);
      void getWooCommerceProducts().then(all => {
        if (active && !freshReceived && all.length) {
          hydrateProduct(all as Product[]);
        }
      }).catch(() => {});
    }

    fetch('/api/products', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Could not load the shared product catalog.');
        const data = await response.json();
        if (data.success === false || (!Array.isArray(data) && !Array.isArray(data.products))) {
          throw new Error('Could not load the shared product catalog.');
        }
        return (Array.isArray(data) ? data : data.products) as Product[];
      })
      .then(all => {
        if (!active) return;
        freshReceived = true;
        setProducts(all);
        if (id && !hydrateProduct(all)) {
          setProductLoaded(false);
          throw new Error('This product was not found in the shared catalog. Return to the catalog and select it again.');
        }
      })
      .catch(error => {
        if (active) {
          freshReceived = true;
          setProductLoadError(error.message || 'Could not load product details. Please retry.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const timeout = setTimeout(() => controller.abort(), 30000);
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [id, loadRevision]);

  useEffect(() => {
    if (editorCanvasRef.current) editorCanvasRef.current.innerHTML = loadedDescriptionRef.current;
  }, [loading, productLoaded]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/shared-data/product-categories', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Could not load categories from the database.');
        const result = await response.json();
        if (result.success === false || !Array.isArray(result.data)) throw new Error('Could not load categories from the database.');
        return categoryNames(result.data);
      })
      .then(names => {
        setDatabaseCategories(names);
        setCategoriesError('');
      })
      .catch(error => {
        if (!controller.signal.aborted) setCategoriesError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCategoriesLoading(false);
      });
    const refresh = () => {
      setCategoriesLoading(true);
      setCategoriesRevision(revision => revision + 1);
    };
    window.addEventListener('fastonmed_categories_updated', refresh);
    return () => {
      controller.abort();
      window.removeEventListener('fastonmed_categories_updated', refresh);
    };
  }, [categoriesRevision]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/shared-data/product-brands', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Could not load brands.');
        const result = await response.json();
        if (!controller.signal.aborted) setDatabaseBrands([...getStoredBrands(), ...categoryNames(result.data)]);
      }).catch(() => { if (!controller.signal.aborted) setDatabaseBrands(getStoredBrands()); });
    return () => controller.abort();
  }, []);

  const addTaxonomy = async () => {
    if (!newTaxonomy || taxonomySaving) return;
    const name = newTaxonomy.name.trim();
    if (!name) { setTaxonomyError(`Enter a ${newTaxonomy.kind} name.`); return; }
    setTaxonomySaving(true);
    setTaxonomyError('');
    try {
      const existing = (newTaxonomy.kind === 'category' ? categories : brands).find(value => value.toLowerCase() === name.toLowerCase());
      const selected = existing || name;
      if (!existing) {
        const response = await fetch(`/api/shared-data/product-${newTaxonomy.kind === 'category' ? 'categories' : 'brands'}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: [name] }),
        });
        const result = await response.json();
        if (!response.ok || !result.success || !Array.isArray(result.data)) throw new Error(`Could not save ${newTaxonomy.kind}. Please retry.`);
        if (newTaxonomy.kind === 'category') {
          setDatabaseCategories(categoryNames(result.data));
          addStoredCategory(name);
        } else {
          setDatabaseBrands(categoryNames(result.data));
          addStoredBrand(name);
        }
      }
      setProduct(current => ({ ...current, [newTaxonomy.kind]: selected }));
      setNewTaxonomy(null);
    } catch (error) {
      setTaxonomyError(error instanceof Error ? error.message : 'Could not save. Please retry.');
    } finally { setTaxonomySaving(false); }
  };

  // Load website media library list when modal opens
  const fetchMediaList = async () => {
    setMediaLoading(true);
    try {
      const res = await fetch('/api/product-media');
      const data = await res.json();
      if (data.success && Array.isArray(data.media)) {
        setMediaList(data.media);
      }
    } catch (e) {
      console.warn('Failed to load media list:', e);
    } finally {
      setMediaLoading(false);
    }
  };

  const openMediaModal = (target: 'main' | 'gallery' | 'editor') => {
    setMediaTarget(target);
    setSelectedMediaUrl('');
    setModalAltText('');
    setMediaModalOpen(true);
    fetchMediaList();
  };

  // Upload file helper: uploads to /api/product-media with FileReader DataURL fallback
  const uploadFileToMedia = async (file: File): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/product-media', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await ensureValidAuthToken() || ''}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        return data.url;
      }
      throw new Error(data.error || 'Image upload failed');
    } catch (e) {
      throw e;
    }
  };

  // Drag & drop handlers for main and gallery images
  const handleMainDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingMain(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadFileToMedia(file);
      setProduct((prev) => ({ ...prev, image: url }));
      setMessage('Main image uploaded successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      alert(`Upload failed: ${err.message || err}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGalleryDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingGallery(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    setIsUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const url = await uploadFileToMedia(file);
        uploadedUrls.push(url);
      }
      setProduct((prev) => ({
        ...prev,
        galleryImages: [...(prev.galleryImages || []), ...uploadedUrls],
      }));
      setMessage(`Added ${uploadedUrls.length} gallery image(s)!`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      alert(`Gallery upload failed: ${err.message || err}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle uploading main product image directly from computer
  const handleMainImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadFileToMedia(file);
      setProduct((prev) => ({ ...prev, image: url }));
      setMessage('Main image uploaded successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      alert(`Upload failed: ${err.message || err}`);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Handle uploading gallery images from computer (supports multiple)
  const handleGalleryUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const url = await uploadFileToMedia(file);
        uploadedUrls.push(url);
      }
      setProduct((prev) => ({
        ...prev,
        galleryImages: [...(prev.galleryImages || []), ...uploadedUrls],
      }));
      setMessage(`Added ${uploadedUrls.length} gallery image(s)!`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      alert(`Gallery upload failed: ${err.message || err}`);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const insertImageIntoEditor = (url: string) => {
    if (!url) return;
    if (editorCanvasRef.current) {
      editorCanvasRef.current.focus();
      document.execCommand(
        'insertHTML',
        false,
        `<p><img src="${url}" alt="Product illustration" style="max-width: 100%; border-radius: 8px; margin: 14px 0; display: block;" /></p><p></p>`
      );
      setProduct((prev) => ({
        ...prev,
        description: editorCanvasRef.current?.innerHTML || prev.description,
      }));
    }
  };

  const executeEditorCommand = (command: string, value: string | undefined = undefined) => {
    if (editorCanvasRef.current) {
      editorCanvasRef.current.focus();
      document.execCommand(command, false, value);
      setProduct((prev) => ({
        ...prev,
        description: editorCanvasRef.current?.innerHTML || prev.description,
      }));
    }
  };

  const handleFormatBlock = (tag: string) => {
    if (editorCanvasRef.current) {
      editorCanvasRef.current.focus();
      if (tag === 'ul') {
        document.execCommand('insertUnorderedList', false);
      } else if (tag === 'ol') {
        document.execCommand('insertOrderedList', false);
      } else if (tag === 'blockquote') {
        document.execCommand('formatBlock', false, '<blockquote>');
      } else {
        document.execCommand('formatBlock', false, `<${tag}>`);
      }
      setProduct((prev) => ({
        ...prev,
        description: editorCanvasRef.current?.innerHTML || prev.description,
      }));
      setFormatMenuOpen(false);
    }
  };

  const handleEditorLink = () => {
    const url = prompt('Enter web link URL (https://...):');
    if (url) {
      executeEditorCommand('createLink', url);
    }
  };

  const handleEditorImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadFileToMedia(file);
      insertImageIntoEditor(url);
      setMessage('Image inserted into description!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      alert(`Image upload failed: ${err.message || err}`);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Confirm selection from Media Library Modal
  const handleInsertSelectedMedia = () => {
    if (!selectedMediaUrl) return;
    const trimmedAlt = modalAltText.trim();
    if (mediaTarget === 'main') {
      setProduct((prev) => ({
        ...prev,
        image: selectedMediaUrl,
        imageAlt: trimmedAlt || prev.imageAlt || '',
      }));
    } else if (mediaTarget === 'gallery') {
      setProduct((prev) => ({
        ...prev,
        galleryImages: [...(prev.galleryImages || []), selectedMediaUrl],
        galleryAlts: {
          ...(prev.galleryAlts || {}),
          ...(trimmedAlt ? { [selectedMediaUrl]: trimmedAlt } : {}),
        },
      }));
    } else if (mediaTarget === 'editor') {
      insertImageIntoEditor(selectedMediaUrl);
    }
    setModalAltText('');
    setMediaModalOpen(false);
  };

  // Handle upload within Media Library Modal
  const handleModalFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const url = await uploadFileToMedia(file);
      await fetchMediaList();
      setSelectedMediaUrl(url);
      setMediaTab('library');
      setMessage('Uploaded to library and selected!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      alert(`Upload failed: ${err.message || err}`);
    } finally {
      setIsUploading(false);
    }
  };

  // SEO Snippet Modal Helpers
  const openSeoModal = () => {
    setDraftSeoTitle(product.seoTitle || product.name || '');
    setDraftSeoSlug(product.slug || slugify(product.name) || '');
    setDraftSeoDesc(product.seoDescription || product.shortDescription || '');
    setSeoModalOpen(true);
  };

  const applySeoChanges = async () => {
    const updatedSeo = {
      seoTitle: draftSeoTitle.trim(),
      slug: draftSeoSlug.trim() || slugify(product.name),
      seoDescription: draftSeoDesc.trim(),
    };
    setProduct((prev) => ({
      ...prev,
      ...updatedSeo,
    }));
    const success = await saveProduct(updatedSeo);
    if (success) {
      setSeoModalOpen(false);
      setMessage('SEO Snippet & Product saved successfully!');
      setTimeout(() => setMessage(''), 3500);
    }
  };

  // Reset page to 1 whenever search query or category filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [query, selectedCategory, statusFilter]);

  const productStatus = (p: Product) => {
    if (p.status === 'trash') return 'trash';
    if (p.status === 'draft' || p.status === 'auto-draft') return 'draft';
    return 'published';
  };

  const statusCounts = useMemo(() => ({
    all: products.length,
    published: products.filter((p) => productStatus(p) === 'published').length,
    draft: products.filter((p) => productStatus(p) === 'draft').length,
    trash: products.filter((p) => productStatus(p) === 'trash').length,
  }), [products]);

  // Decoded category counts & existing brands
  const { categories, categoryCounts, brands } = useMemo(() => {
    const counts: Record<string, number> = {};
    const brandSet = new Set<string>([...databaseBrands, product.brand || ''].map(decodeHtml).filter(Boolean));
    for (const p of products) {
      const productCategories = [...new Set([
        ...categoryNames([p.category]),
        ...categoryNames(p.categories),
      ].map(name => decodeHtml(name)))];
      for (const cat of productCategories) counts[cat] = (counts[cat] || 0) + 1;
      const b = decodeHtml(p.brand?.trim());
      if (b) brandSet.add(b);
    }
    const catSet = new Set([...databaseCategories.map(name => decodeHtml(name)), ...Object.keys(counts), ...categoryNames([product.category]).map(name => decodeHtml(name))]);
    const cats = Array.from(catSet).sort((a, b) => a.localeCompare(b));
    const sortedBrands = Array.from(brandSet).sort((a, b) => a.localeCompare(b));
    return { categories: cats, categoryCounts: counts, brands: sortedBrands };
  }, [products, databaseCategories, databaseBrands, product.category, product.brand]);

  // Filtered products list
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (statusFilter !== 'all' && productStatus(p) !== statusFilter) return false;
      const pCat = decodeHtml(p.category?.trim()) || 'Uncategorized';
      if (selectedCategory && pCat !== selectedCategory) {
        return false;
      }
      if (q) {
        const pName = decodeHtml(p.name || '').toLowerCase();
        const pSku = (p.sku || '').toLowerCase();
        const pBrand = decodeHtml(p.brand || '').toLowerCase();
        if (!pName.includes(q) && !pSku.includes(q) && !pBrand.includes(q) && !pCat.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => productCreatedTime(b) - productCreatedTime(a));
  }, [products, query, selectedCategory, statusFilter]);

  // 25 items per page pagination
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
  const paginated = useMemo(
    () => filtered.slice(startIndex, endIndex),
    [filtered, startIndex, endIndex]
  );

  const allCurrentPageSelected =
    paginated.length > 0 && paginated.every((p) => selectedIds.includes(p.id));
  const someCurrentPageSelected =
    paginated.some((p) => selectedIds.includes(p.id));

  const toggleSelectCurrentPage = () => {
    const pageIds = paginated.map((p) => p.id);
    if (allCurrentPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    setSelectedIds(filtered.map((p) => p.id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const updateProductStatus = async (item: Product, status: string) => {
    const updated = { ...item, status, updatedAt: new Date().toISOString() };
    const response = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
    if (!response.ok) throw new Error('Product status could not be updated');
    setProducts((current) => current.map((p) => p.id === item.id ? updated : p));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const permanent = statusFilter === 'trash';
    const confirmMsg =
      selectedIds.length === 1
        ? permanent ? 'Permanently delete 1 selected product? This cannot be undone.' : 'Move 1 selected product to Trash?'
        : permanent ? `Permanently delete ${selectedIds.length} selected products? This cannot be undone.` : `Move ${selectedIds.length} selected products to Trash?`;
    if (!confirm(confirmMsg)) return;

    setIsDeletingBulk(true);
    try {
      if (permanent) {
        await Promise.all(selectedIds.map((pid) => fetch(`/api/products?id=${encodeURIComponent(pid)}`, { method: 'DELETE' })));
        setProducts((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
      } else {
        const chosen = products.filter((p) => selectedIds.includes(p.id));
        await Promise.all(chosen.map((p) => updateProductStatus(p, 'trash')));
      }
      setMessage(permanent ? `Permanently deleted ${selectedIds.length} product(s)` : `Moved ${selectedIds.length} product(s) to Trash`);
      setSelectedIds([]);
      setTimeout(() => setMessage(''), 4000);
    } catch (err: any) {
      alert(`Bulk delete failed: ${err?.message || err}`);
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const remove = async (item: Product) => {
    if (statusFilter === 'trash') {
      if (!confirm('Permanently delete this product? This cannot be undone.')) return;
      await fetch(`/api/products?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      setProducts((v) => v.filter((p) => p.id !== item.id));
    } else {
      if (!confirm('Move this product to Trash?')) return;
      await updateProductStatus(item, 'trash');
    }
    setSelectedIds((prev) => prev.filter((id) => id !== item.id));
  };

  // Save product (editor mode)
  const saveProduct = async (override?: Partial<Product>): Promise<boolean> => {
    if (loading || (id && (!productLoaded || productLoadError))) return false;
    setIsSaving(true);
    try {
      if (!product.name.trim()) {
        alert('Please enter a product name');
        return false;
      }
      const traders = productTraderOffers(product);
      if (traders.some(offer => !offer.traderCompanyId || !Number.isFinite(Number(offer.offeringPrice ?? 0)) || Number(offer.offeringPrice ?? 0) < 0)) {
        alert('Select a company and enter a valid offering price for each trader, or remove the unused trader row.');
        return false;
      }
      if (new Set(traders.map(offer => offer.traderCompanyId)).size !== traders.length) {
        alert('Each trader company can only be assigned once.');
        return false;
      }
      if ([product.purchaseCost, product.regularPrice, product.salePrice, product.inStock].some(value => value != null && (!Number.isFinite(Number(value)) || Number(value) < 0))) {
        alert('Prices and stock must be valid non-negative numbers.');
        return false;
      }
      const specifications = Object.fromEntries(
        specText
          .split('\n')
          .map((x) => x.split(':'))
          .filter((x) => x.length > 1)
          .map(([k, ...v]) => [k.trim(), v.join(':').trim()])
      );

      const finalDescription =
        descriptionMode === 'visual'
          ? (editorCanvasRef.current?.innerHTML ?? product.description ?? '')
          : (product.description || '');

      const base = {
        ...product,
        ...(override || {}),
      };

      if ('Product Category' in specifications) specifications['Product Category'] = base.category || '';
      if ('Brand / Manufacturer' in specifications) specifications['Brand / Manufacturer'] = base.brand || '';

      const ready = {
        ...base,
        name: base.name.trim(),
        traders,
        traderCompanyId: traders[0]?.traderCompanyId || '',
        traderCompanyName: traders[0]?.traderCompanyName || '',
        supplier: traders[0]?.traderCompanyName || '',
        deliveryLeadTime: traders[0]?.deliveryLeadTime || '',
        traderPriceMin: traders[0]?.traderPriceMin ?? traders[0]?.offeringPrice ?? 0,
        traderPriceMax: traders[0]?.traderPriceMax ?? traders[0]?.offeringPrice ?? 0,
        purchaseCost: Number(base.purchaseCost || 0),
        slug: base.slug || slugify(base.name),
        sku: base.sku || `FOM-${Date.now()}`,
        image: base.image || '',
        imageAlt: base.imageAlt || '',
        galleryImages: (base.galleryImages || []).filter(Boolean),
        galleryAlts: base.galleryAlts || {},
        regularPrice: Number(base.regularPrice || 0),
        salePrice: Number(base.salePrice || 0) || null,
        sellingPrice: Number(base.salePrice || base.regularPrice || 0),
        inStock: Number(base.inStock || 0),
        description: finalDescription,
        specifications,
        updatedAt: new Date().toISOString(),
        createdAt: base.createdAt || new Date().toISOString(),
      };

      const r = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ready),
      });
      if (!r.ok) {
        alert('Could not save product');
        return false;
      }
      const data = await r.json();
      const saved = data.product || ready;
      setProduct(saved);
      const cached = getStoredProducts();
      saveStoredProducts([saved as StoredProduct, ...cached.filter(item => item.id !== saved.id)]);
      setProducts((current) => {
        const idx = current.findIndex((p) => p.id === saved.id || (saved.slug && p.slug === saved.slug));
        if (idx >= 0) {
          const updated = [...current];
          updated[idx] = saved;
          return updated;
        }
        return [saved, ...current];
      });
      setMessage('Product saved successfully!');
      setTimeout(() => setMessage(''), 3000);
      return true;
    } catch (err: any) {
      alert(`Save failed: ${err.message || err}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Filter media items in modal
  const filteredMedia = useMemo(() => {
    let list = mediaList;
    if (mediaFilter !== 'all') {
      list = list.filter((m) => m.category === mediaFilter);
    }
    if (mediaSearch.trim()) {
      const q = mediaSearch.trim().toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.url.toLowerCase().includes(q));
    }
    return list;
  }, [mediaList, mediaFilter, mediaSearch]);

  if (mode === 'list') {
    return (
      <div style={{ maxWidth: '100%', margin: '0 auto' }}>
        <Title
          title="Products"
          action={
            <Link className="tk-page-action" href="/products/new">
              <Plus size={15} /> Add Product
            </Link>
          }
        />

        <div style={{ padding: '24px 28px' }}>
          {message && <div className="tk-save-message">{message}</div>}

          <div className="tk-minimal-card">
            {/* Status Filter Tabs */}
            <div className="tk-minimal-tabs">
              <button
                type="button"
                className={`tk-minimal-tab-btn ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                All <span className="tk-minimal-tab-count">{statusCounts.all.toLocaleString()}</span>
              </button>
              <button
                type="button"
                className={`tk-minimal-tab-btn ${statusFilter === 'published' ? 'active' : ''}`}
                onClick={() => setStatusFilter('published')}
              >
                Published <span className="tk-minimal-tab-count">{statusCounts.published.toLocaleString()}</span>
              </button>
              <button
                type="button"
                className={`tk-minimal-tab-btn ${statusFilter === 'draft' ? 'active' : ''}`}
                onClick={() => setStatusFilter('draft')}
              >
                Drafts <span className="tk-minimal-tab-count">{statusCounts.draft.toLocaleString()}</span>
              </button>
              <button
                type="button"
                className={`tk-minimal-tab-btn ${statusFilter === 'trash' ? 'active' : ''}`}
                onClick={() => setStatusFilter('trash')}
              >
                Trash <span className="tk-minimal-tab-count">{statusCounts.trash.toLocaleString()}</span>
              </button>
            </div>

            {/* Search and Category Filters */}
            <div className="tk-minimal-toolbar">
              <div className="tk-minimal-search">
                <Search size={15} color="#94a3b8" />
                <input
                  placeholder="Search products by name, SKU, brand..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    style={{ border: 0, background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <select
                className="tk-minimal-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Bulk Selection Bar */}
            {selectedIds.length > 0 && (
              <div className="tk-selection-bar" style={{ margin: '12px 18px' }}>
                <div className="tk-selection-info">
                  <span>
                    <strong>{selectedIds.length}</strong> product{selectedIds.length === 1 ? '' : 's'} selected
                  </span>
                  {selectedIds.length < filtered.length && (
                    <button type="button" className="tk-select-all-btn" onClick={selectAllFiltered}>
                      Select all {filtered.length} matching
                    </button>
                  )}
                  <button type="button" className="tk-clear-select-btn" onClick={clearSelection}>
                    Clear
                  </button>
                </div>
                <div className="tk-selection-actions">
                  <button
                    type="button"
                    className="tk-bulk-trash-btn"
                    onClick={handleBulkDelete}
                    disabled={isDeletingBulk}
                  >
                    <Trash2 size={13} />
                    {statusFilter === 'trash' ? 'Delete Permanently' : 'Move to Trash'}
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table data-mobile-cards="true" className="tk-minimal-table">
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        className="tk-checkbox"
                        checked={allCurrentPageSelected}
                        ref={(input) => {
                          if (input) input.indeterminate = !allCurrentPageSelected && someCurrentPageSelected;
                        }}
                        onChange={toggleSelectCurrentPage}
                      />
                    </th>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right', paddingRight: '20px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                        Loading products...
                      </td>
                    </tr>
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                        No products found.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((p) => {
                      const isChecked = selectedIds.includes(p.id);
                      const { date, time } = formatProductDate(p);
                      return (
                        <tr key={p.id} className={isChecked ? 'tk-row-selected' : ''}>
                          <td data-label="" style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              className="tk-checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectRow(p.id)}
                            />
                          </td>
                          <td data-label="Product">
                            <div className="tk-minimal-product-cell">
                              {p.image ? (
                                <img src={p.image} alt={decodeHtml(p.name)} className="tk-minimal-thumb" />
                              ) : (
                                <div className="tk-minimal-no-thumb">No img</div>
                              )}
                              <div>
                                <Link href={`/products/${p.id}`} className="tk-minimal-product-title">
                                  {decodeHtml(p.name)}
                                </Link>
                                <div className="tk-minimal-brand">
                                  {decodeHtml(p.brand) ? `Brand: ${decodeHtml(p.brand)}` : '—'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td data-label="SKU">
                            {p.sku ? (
                              <span className="tk-minimal-sku">{p.sku}</span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>
                          <td data-label="Category">
                            <span style={{ color: '#475569', fontSize: '12.5px' }}>
                              {decodeHtml(p.category) || '—'}
                            </span>
                          </td>
                          <td data-label="Price">
                            <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                              AED {Number(p.salePrice || p.regularPrice || 0).toLocaleString()}
                            </strong>
                          </td>
                          <td data-label="Stock">
                            <span style={{ color: (p.inStock || 0) > 0 ? '#0f172a' : '#dc2626', fontWeight: 500 }}>
                              {p.inStock || 0}
                            </span>
                          </td>
                          <td data-label="Status">
                            <span className={`tk-minimal-badge ${productStatus(p)}`}>
                              {productStatus(p)}
                            </span>
                          </td>
                          <td data-label="Date" style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: '12px', color: '#334155', fontWeight: 500 }}>{date}</div>
                            <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>{time}</div>
                          </td>
                          <td data-label="Actions" style={{ textAlign: 'right', paddingRight: '16px' }}>
                            <div style={{ display: 'inline-flex', gap: 4 }}>
                              <Link
                                href={`/products/${p.id}`}
                                className="tk-minimal-action-btn"
                                title="Edit Product"
                              >
                                <Edit3 size={14} />
                              </Link>
                              <button
                                type="button"
                                className="tk-minimal-action-btn danger"
                                onClick={() => remove(p)}
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="tk-minimal-pagination">
                <span>
                  Showing <strong>{startIndex + 1}</strong>–<strong>{endIndex}</strong> of <strong>{totalItems.toLocaleString()}</strong> products
                </span>
                <div className="tk-minimal-page-nav">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="tk-minimal-action-btn"
                    style={{ border: '1px solid #e2e8f0', width: 'auto', padding: '0 10px', height: '30px', fontSize: '12px' }}
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <span style={{ padding: '0 8px', fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="tk-minimal-action-btn"
                    style={{ border: '1px solid #e2e8f0', width: 'auto', padding: '0 10px', height: '30px', fontSize: '12px' }}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Hidden file inputs for direct computer upload
  return (
    <div>
      <input
        ref={mainImageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleMainImageUpload}
      />
      <input
        ref={galleryImageInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleGalleryUpload}
      />
      <input
        ref={editorImageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleEditorImageUpload}
      />

      <Title
        title={id ? 'Edit Product' : 'Add Product'}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => {
                setActivePreviewImage(product.image || (product.galleryImages && product.galleryImages[0]) || '');
                setPreviewDevice('desktop');
                setPreviewModalOpen(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 7,
                fontSize: '13px',
                fontWeight: 600,
                color: '#0d9488',
                background: '#f0fdfa',
                border: '1px solid #99f6e4',
                cursor: 'pointer',
              }}
            >
              <Eye size={15} /> Preview Storefront
            </button>
            <button
              className="tk-page-action"
              onClick={() => saveProduct()}
              disabled={loading || !!(id && (!productLoaded || productLoadError)) || isUploading || isSaving}
            >
              <Save size={15} /> {isSaving ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        }
      />

      <main className="tk-editor-page">
        {message && <div className="tk-save-message">{message}</div>}

        {loading && <div role="status" className="tk-save-message">{id ? (productLoaded ? 'Refreshing product details…' : 'Loading product details…') : 'Loading catalog options…'}</div>}
        {productLoadError && <div role="alert" className="tk-save-message">
          {productLoadError} <button type="button" onClick={() => setLoadRevision(value => value + 1)}>Retry</button>
        </div>}
        <div className="tk-product-editor" inert={loading || !!(id && (!productLoaded || productLoadError))} style={id && !productLoaded ? { display: 'none' } : undefined}>
          {/* Main Column */}
          <section className="tk-panel tk-editor-main">
            <h3>Product details</h3>
            <label>
              Product name
              <input
                className="tk-title-input"
                value={product.name}
                onChange={(e) =>
                  setProduct({
                    ...product,
                    name: e.target.value,
                    slug: product.slug || slugify(e.target.value),
                  })
                }
                placeholder="Product name"
              />
            </label>

            <div className="tk-two-fields">
              <label>
                SKU
                <input
                  value={product.sku}
                  onChange={(e) => setProduct({ ...product, sku: e.target.value })}
                  placeholder="SKU identifier"
                />
              </label>
              <label>
                URL slug
                <input
                  value={product.slug}
                  onChange={(e) => setProduct({ ...product, slug: slugify(e.target.value) })}
                  placeholder="product-url-slug"
                />
              </label>
            </div>

            <label>
              Short description (Storefront excerpt & Quick View summary)
              <textarea
                rows={3}
                value={product.shortDescription || ''}
                onChange={(e) => setProduct({ ...product, shortDescription: e.target.value })}
                placeholder="Brief summary for catalog cards and search..."
              />
            </label>

            {/* Rich Unified Single-Canvas Product Description */}
            <div className="tk-desc-card">
              <div className="tk-desc-card-header">
                <div>
                  <h3>Product Description</h3>
                  <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: '#64748b' }}>
                    Clinical features, specifications, and details.
                  </p>
                </div>
                <div className="tk-desc-mode-toggle">
                  <button
                    type="button"
                    className={`tk-desc-mode-btn ${descriptionMode === 'visual' ? 'active' : ''}`}
                    onClick={() => {
                      setDescriptionMode('visual');
                      setTimeout(() => {
                        if (editorCanvasRef.current) {
                          editorCanvasRef.current.innerHTML = product.description || '';
                        }
                      }, 0);
                    }}
                  >
                    Visual Editor
                  </button>
                  <button
                    type="button"
                    className={`tk-desc-mode-btn ${descriptionMode === 'html' ? 'active' : ''}`}
                    onClick={() => {
                      if (editorCanvasRef.current) {
                        setProduct((p) => ({
                          ...p,
                          description: editorCanvasRef.current?.innerHTML || p.description,
                        }));
                      }
                      setDescriptionMode('html');
                    }}
                  >
                    HTML Code
                  </button>
                </div>
              </div>

              {descriptionMode === 'visual' ? (
                <div className="tk-unified-editor">
                  {/* Clean Formatting Toolbar */}
                  <div className="tk-unified-toolbar">
                    {/* Format Block (Paragraph, Headings, Lists, Quote) */}
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        className={`tk-unified-toolbar-btn ${formatMenuOpen ? 'active' : ''}`}
                        onClick={() => setFormatMenuOpen(!formatMenuOpen)}
                      >
                        <AlignLeft size={13} />
                        <span>Style</span>
                        <ChevronDown size={11} />
                      </button>

                      {formatMenuOpen && (
                        <div
                          className="fm-toolbar-dropdown"
                          style={{ minWidth: 160, position: 'absolute', top: '100%', left: 0, zIndex: 50 }}
                        >
                          <button
                            type="button"
                            className="fm-dropdown-item"
                            onClick={() => handleFormatBlock('p')}
                          >
                            <AlignLeft size={13} />
                            <span>Paragraph</span>
                          </button>
                          <button
                            type="button"
                            className="fm-dropdown-item"
                            onClick={() => handleFormatBlock('h2')}
                          >
                            <b>H2</b>
                            <span>Heading 2</span>
                          </button>
                          <button
                            type="button"
                            className="fm-dropdown-item"
                            onClick={() => handleFormatBlock('h3')}
                          >
                            <b>H3</b>
                            <span>Heading 3</span>
                          </button>
                          <button
                            type="button"
                            className="fm-dropdown-item"
                            onClick={() => handleFormatBlock('h4')}
                          >
                            <b>H4</b>
                            <span>Heading 4</span>
                          </button>
                          <button
                            type="button"
                            className="fm-dropdown-item"
                            onClick={() => handleFormatBlock('ul')}
                          >
                            <List size={13} />
                            <span>Bullet List</span>
                          </button>
                          <button
                            type="button"
                            className="fm-dropdown-item"
                            onClick={() => handleFormatBlock('ol')}
                          >
                            <ListOrdered size={13} />
                            <span>Numbered List</span>
                          </button>
                          <button
                            type="button"
                            className="fm-dropdown-item"
                            onClick={() => handleFormatBlock('blockquote')}
                          >
                            <Quote size={13} />
                            <span>Quote</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="tk-unified-toolbar-sep" />

                    {/* Bold */}
                    <button
                      type="button"
                      className="tk-unified-toolbar-btn"
                      title="Bold"
                      onClick={() => executeEditorCommand('bold')}
                    >
                      <b style={{ fontSize: 13 }}>B</b>
                    </button>

                    {/* Italic */}
                    <button
                      type="button"
                      className="tk-unified-toolbar-btn"
                      title="Italic"
                      onClick={() => executeEditorCommand('italic')}
                    >
                      <i style={{ fontFamily: 'serif', fontSize: 14 }}>I</i>
                    </button>

                    {/* Underline */}
                    <button
                      type="button"
                      className="tk-unified-toolbar-btn"
                      title="Underline"
                      onClick={() => executeEditorCommand('underline')}
                    >
                      <u style={{ fontSize: 13 }}>U</u>
                    </button>

                    {/* Strikethrough */}
                    <button
                      type="button"
                      className="tk-unified-toolbar-btn"
                      title="Strikethrough"
                      onClick={() => executeEditorCommand('strikeThrough')}
                    >
                      <Strikethrough size={13} />
                    </button>

                    <div className="tk-unified-toolbar-sep" />

                    {/* Link */}
                    <button
                      type="button"
                      className="tk-unified-toolbar-btn"
                      title="Insert Link"
                      onClick={handleEditorLink}
                    >
                      <Link2 size={13} />
                    </button>

                    {/* Highlight */}
                    <button
                      type="button"
                      className="tk-unified-toolbar-btn"
                      title="Highlight Text"
                      onClick={() => executeEditorCommand('hiliteColor', '#fef08a')}
                    >
                      <Highlighter size={13} color="#ca8a04" />
                    </button>

                    <div className="tk-unified-toolbar-sep" />

                    {/* Alignment */}
                    <button
                      type="button"
                      className="tk-unified-toolbar-btn"
                      title="Align Left"
                      onClick={() => executeEditorCommand('justifyLeft')}
                    >
                      <AlignLeft size={13} />
                    </button>
                    <button
                      type="button"
                      className="tk-unified-toolbar-btn"
                      title="Align Center"
                      onClick={() => executeEditorCommand('justifyCenter')}
                    >
                      <AlignCenter size={13} />
                    </button>
                    <button
                      type="button"
                      className="tk-unified-toolbar-btn"
                      title="Align Right"
                      onClick={() => executeEditorCommand('justifyRight')}
                    >
                      <AlignRight size={13} />
                    </button>

                    <div className="tk-unified-toolbar-sep" />

                    {/* Insert Image */}
                    <button
                      type="button"
                      className="tk-unified-toolbar-btn"
                      title="Upload Image from Computer"
                      onClick={() => editorImageInputRef.current?.click()}
                    >
                      <Upload size={13} />
                      <span>Upload Image</span>
                    </button>
                    <button
                      type="button"
                      className="tk-unified-toolbar-btn"
                      title="Insert Image from Website Library"
                      onClick={() => openMediaModal('editor')}
                    >
                      <FolderOpen size={13} />
                      <span>Media Library</span>
                    </button>

                    <div className="tk-unified-toolbar-sep" />

                    {/* Clear Formatting */}
                    <button
                      type="button"
                      className="tk-unified-toolbar-btn"
                      title="Clear Formatting"
                      onClick={() => executeEditorCommand('removeFormat')}
                    >
                      <X size={13} />
                    </button>
                  </div>

                  {/* Single Unified ContentEditable Canvas */}
                  <div
                    ref={editorCanvasRef}
                    className="tk-unified-canvas"
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder="Write rich product description, clinical applications, bullet points, and key details..."
                    onInput={() => {
                      if (editorCanvasRef.current) {
                        setProduct((prev) => ({
                          ...prev,
                          description: editorCanvasRef.current?.innerHTML || '',
                        }));
                      }
                    }}
                  />
                </div>
              ) : (
                <textarea
                  rows={16}
                  value={product.description || ''}
                  onChange={(e) => setProduct({ ...product, description: e.target.value })}
                  style={{
                    width: '100%',
                    fontFamily: 'monospace',
                    fontSize: '12.5px',
                    lineHeight: '1.6',
                    padding: '14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    outline: 'none',
                  }}
                  placeholder="<p>Write raw HTML product description...</p>"
                />
              )}
            </div>

            <h3>Product data</h3>
            <div className="tk-two-fields">
              <label>
                Regular price (AED)
                <input
                  type="number"
                  value={product.regularPrice || 0}
                  onChange={(e) =>
                    setProduct({ ...product, regularPrice: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Sale price (AED)
                <input
                  type="number"
                  value={product.salePrice || 0}
                  onChange={(e) =>
                    setProduct({ ...product, salePrice: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Stock quantity
                <input
                  type="number"
                  value={product.inStock || 0}
                  onChange={(e) =>
                    setProduct({ ...product, inStock: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Stock status
                <select
                  value={product.stockStatus || 'instock'}
                  onChange={(e) => setProduct({ ...product, stockStatus: e.target.value })}
                >
                  <option value="instock">In stock</option>
                  <option value="outofstock">Out of stock</option>
                  <option value="onbackorder">On backorder</option>
                </select>
              </label>
            </div>

            <SpecificationFields value={specText} onChange={setSpecText} excludedLabels={['Product Category', 'Brand / Manufacturer']} />
          </section>

          {/* Sidebar */}
          <aside className="tk-editor-side">
            {/* Publish Panel */}
            <div className="tk-panel">
              <h3>Publish</h3>
              <label>
                Status
                <select
                  value={product.status || 'draft'}
                  onChange={(e) => setProduct({ ...product, status: e.target.value })}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </label>
              <label>
                Purchase mode
                <select
                  value={product.purchaseMode || 'cart'}
                  onChange={(e) => setProduct({ ...product, purchaseMode: e.target.value })}
                >
                  <option value="cart">Add to cart</option>
                  <option value="quote">Request quote</option>
                  <option value="enquire">Enquiry only</option>
                </select>
              </label>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => {
                    setActivePreviewImage(product.image || (product.galleryImages && product.galleryImages[0]) || '');
                    setPreviewDevice('desktop');
                    setPreviewModalOpen(true);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: 6,
                    background: '#f0fdfa',
                    border: '1px solid #ccfbf1',
                    color: '#0d9488',
                    cursor: 'pointer',
                  }}
                >
                  <Eye size={14} color="#0d9488" /> Preview Storefront
                </button>
              </div>
            </div>

            <CRMProductFields
              product={product}
              sellingPrice={Number(product.salePrice || product.regularPrice || 0)}
              onChange={(changes) => setProduct(current => ({ ...current, ...changes }))}
            />

            {/* Organisation Panel */}
            <div className="tk-panel" style={{ overflow: 'visible' }}>
              <h3>Organisation</h3>
              {newTaxonomy && <div role="group" aria-label={`Add ${newTaxonomy.kind}`} style={{ padding: 14, marginBottom: 16, border: '1px solid #99dace', borderRadius: 8, background: '#f0fdfa' }}>
                <label htmlFor="new-taxonomy-name">New {newTaxonomy.kind} name</label>
                <input id="new-taxonomy-name" autoFocus value={newTaxonomy.name} disabled={taxonomySaving} onChange={event => setNewTaxonomy({ ...newTaxonomy, name: event.target.value })} onKeyDown={event => {
                  if (event.key === 'Enter') { event.preventDefault(); void addTaxonomy(); }
                  if (event.key === 'Escape' && !taxonomySaving) setNewTaxonomy(null);
                }} />
                {taxonomyError && <p role="alert" style={{ color: '#b45309', fontSize: 12 }}>{taxonomyError}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" className="tk-page-action" disabled={taxonomySaving} onClick={() => void addTaxonomy()}>{taxonomySaving ? 'Saving…' : `Add ${newTaxonomy.kind}`}</button>
                  <button type="button" disabled={taxonomySaving} onClick={() => setNewTaxonomy(null)}>Cancel</button>
                </div>
              </div>}
              <label>
                Category
                <SearchableCombobox
                  value={product.category || ''}
                  onChange={(cat) => setProduct({ ...product, category: cat })}
                  options={categories}
                  counts={categoryCounts}
                  allowCustom={false}
                  addLabel="Add category"
                  onAdd={name => { setTaxonomyError(''); setNewTaxonomy({ kind: 'category', name }); }}
                  placeholder={categoriesLoading ? 'Loading categories...' : 'Select category'}
                />
                {categoriesError && <span role="alert" style={{ color: '#b45309', fontWeight: 400 }}>
                  {categoriesError} <button type="button" onClick={() => {
                    setCategoriesLoading(true);
                    setCategoriesRevision(revision => revision + 1);
                  }}>Retry</button>
                </span>}
              </label>
              <label>
                Brand
                <SearchableCombobox
                  value={product.brand || ''}
                  onChange={(b) => setProduct({ ...product, brand: b })}
                  options={brands}
                  placeholder="Select brand"
                  allowCustom={false}
                  addLabel="Add brand"
                  onAdd={name => { setTaxonomyError(''); setNewTaxonomy({ kind: 'brand', name }); }}
                />
              </label>
              <label>
                Tags <small>Comma separated</small>
                <input
                  value={(product.tags || []).join(', ')}
                  onChange={(e) =>
                    setProduct({
                      ...product,
                      tags: e.target.value
                        .split(',')
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Enter tags separated by comma"
                />
              </label>
              <label>
                Warranty
                <input
                  value={product.warrantyPeriod || ''}
                  onChange={(e) => setProduct({ ...product, warrantyPeriod: e.target.value })}
                  placeholder="Warranty period"
                />
              </label>
            </div>

            {/* Minimalist Product Media Studio Panel */}
            <div className="tk-panel">
              <div className="tk-media-panel-header">
                <div className="tk-media-panel-title">
                  <ImageIcon size={16} color="#0d9488" />
                  <span>Product Media</span>
                </div>
                <span className="tk-media-badge-count">
                  {(product.image ? 1 : 0) + (product.galleryImages || []).length} media
                </span>
              </div>

              {/* Main / Cover Image */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="tk-media-section-label">Featured Image</span>
                  <button
                    type="button"
                    style={{ border: 0, background: 'none', color: '#0d9488', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                    onClick={() => setShowDirectUrlInput(!showDirectUrlInput)}
                  >
                    {showDirectUrlInput ? 'Close URL' : '+ Image URL'}
                  </button>
                </div>

                {product.image ? (
                  <div>
                    <div className="tk-main-preview-studio">
                      <img src={product.image} alt={product.imageAlt || product.name || 'Cover product'} className="tk-main-preview-img" />
                      <span className="tk-main-preview-tag">Cover Photo</span>
                      <div className="tk-main-preview-actions">
                        <button
                          type="button"
                          className="tk-main-preview-action-btn"
                          title="Change photo from computer"
                          onClick={() => mainImageInputRef.current?.click()}
                        >
                          <Upload size={12} /> Replace
                        </button>
                        <button
                          type="button"
                          className="tk-main-preview-action-btn"
                          title="Pick from website library"
                          onClick={() => openMediaModal('main')}
                        >
                          <FolderOpen size={12} /> Library
                        </button>
                        <button
                          type="button"
                          className="tk-main-preview-action-btn is-delete"
                          title="Remove image"
                          onClick={() => setProduct({ ...product, image: '', imageAlt: '' })}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Featured Image Alt Text Field */}
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                          Featured Alt Text <span style={{ color: '#0d9488' }}>(SEO & Accessibility)</span>
                        </label>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                          {(product.imageAlt || '').length}/120
                        </span>
                      </div>
                      <input
                        type="text"
                        value={product.imageAlt || ''}
                        onChange={(e) => setProduct({ ...product, imageAlt: e.target.value })}
                        placeholder="e.g. Cederroth Protection Kit front box packaging"
                        maxLength={120}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '6px 9px',
                          fontSize: '11.5px',
                          border: '1px solid #cbd5e1',
                          borderRadius: 5,
                          background: '#ffffff',
                          color: '#1e293b',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    className={`tk-media-dropzone ${isDraggingMain ? 'is-dragging' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingMain(true);
                    }}
                    onDragLeave={() => setIsDraggingMain(false)}
                    onDrop={handleMainDrop}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return;
                      mainImageInputRef.current?.click();
                    }}
                  >
                    <div className="tk-media-icon-bubble">
                      <ImageIcon size={20} />
                    </div>
                    <div className="tk-media-dropzone-heading">
                      {isDraggingMain ? 'Drop image here!' : 'Drop main image here'}
                    </div>
                    <div className="tk-media-dropzone-hint">
                      or choose from your files or library
                    </div>
                    <div className="tk-media-action-row">
                      <button
                        type="button"
                        className="tk-media-btn-comp"
                        onClick={(e) => {
                          e.stopPropagation();
                          mainImageInputRef.current?.click();
                        }}
                      >
                        <Upload size={12} /> Computer
                      </button>
                      <button
                        type="button"
                        className="tk-media-btn-lib"
                        onClick={(e) => {
                          e.stopPropagation();
                          openMediaModal('main');
                        }}
                      >
                        <FolderOpen size={12} /> Library
                      </button>
                    </div>
                  </div>
                )}

                {showDirectUrlInput && (
                  <div className="tk-url-input-box">
                    <input
                      value={product.image || ''}
                      onChange={(e) => setProduct({ ...product, image: e.target.value })}
                      placeholder="Paste image URL (https://... or /products/...)"
                    />
                    {product.image && (
                      <button
                        type="button"
                        style={{ border: 0, background: 'none', color: '#0d9488', cursor: 'pointer', padding: '0 4px' }}
                        onClick={() => setShowDirectUrlInput(false)}
                        title="Done"
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Gallery Photos */}
              <div className="tk-gallery-container">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="tk-media-section-label">Gallery Photos</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      ({(product.galleryImages || []).length})
                    </span>
                  </div>
                </div>

                <div className="tk-gallery-layout">
                  {(product.galleryImages || []).map((imgUrl, idx) => (
                    <div key={idx} className="tk-gallery-card">
                      <img src={imgUrl} alt={product.galleryAlts?.[imgUrl] || `Gallery ${idx + 1}`} />
                      <span className="tk-gallery-card-badge">#{idx + 1}</span>
                      <button
                        type="button"
                        className="tk-gallery-card-del"
                        title="Remove photo"
                        onClick={() => {
                          const updated = (product.galleryImages || []).filter((_, i) => i !== idx);
                          const newAlts = { ...(product.galleryAlts || {}) };
                          delete newAlts[imgUrl];
                          setProduct({ ...product, galleryImages: updated, galleryAlts: newAlts });
                        }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}

                  {/* Add Slot directly inside the grid */}
                  <div
                    className={`tk-gallery-add-slot ${isDraggingGallery ? 'is-dragging' : ''}`}
                    title="Click or drop photos here"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingGallery(true);
                    }}
                    onDragLeave={() => setIsDraggingGallery(false)}
                    onDrop={handleGalleryDrop}
                    onClick={() => galleryImageInputRef.current?.click()}
                  >
                    <Plus size={16} />
                    <span>Add</span>
                  </div>
                </div>

                <div className="tk-media-action-row" style={{ justifyContent: 'stretch', marginBottom: (product.galleryImages || []).length > 0 ? 10 : 0 }}>
                  <button
                    type="button"
                    className="tk-media-btn-comp"
                    style={{ flex: 1 }}
                    onClick={() => galleryImageInputRef.current?.click()}
                  >
                    <Upload size={12} /> Add Files
                  </button>
                  <button
                    type="button"
                    className="tk-media-btn-lib"
                    style={{ flex: 1 }}
                    onClick={() => openMediaModal('gallery')}
                  >
                    <FolderOpen size={12} /> From Library
                  </button>
                </div>

                {/* Gallery Images Alt Text Inputs */}
                {(product.galleryImages || []).length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                        Gallery Alt Texts <span style={{ color: '#0d9488' }}>(SEO & Screen Readers)</span>
                      </span>
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                        {(product.galleryImages || []).length} photos
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', paddingRight: 2 }}>
                      {(product.galleryImages || []).map((imgUrl, idx) => (
                        <div
                          key={`${imgUrl}-${idx}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '4px 8px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 6,
                          }}
                        >
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#0d9488', minWidth: 20 }}>
                            #{idx + 1}
                          </span>
                          <img
                            src={imgUrl}
                            alt=""
                            style={{
                              width: 26,
                              height: 26,
                              objectFit: 'contain',
                              background: '#fff',
                              borderRadius: 4,
                              border: '1px solid #cbd5e1',
                              flexShrink: 0,
                            }}
                          />
                          <input
                            type="text"
                            value={product.galleryAlts?.[imgUrl] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setProduct({
                                ...product,
                                galleryAlts: {
                                  ...(product.galleryAlts || {}),
                                  [imgUrl]: val,
                                },
                              });
                            }}
                            placeholder={`Alt text for photo #${idx + 1}...`}
                            maxLength={120}
                            style={{
                              flex: 1,
                              fontSize: '11px',
                              padding: '4px 7px',
                              border: '1px solid #cbd5e1',
                              borderRadius: 4,
                              background: '#ffffff',
                              color: '#1e293b',
                              outline: 'none',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Product Storefront Live Preview Modal */}
      {previewModalOpen && (() => {
        const currentMainImg = activePreviewImage || product.image || (product.galleryImages && product.galleryImages[0]) || '';
        const currentDesc = descriptionMode === 'visual'
          ? (editorCanvasRef.current?.innerHTML ?? product.description ?? '')
          : (product.description || '');
        const allPreviewImages = Array.from(new Set([product.image, ...(product.galleryImages || [])].filter(Boolean) as string[]));
        const specsEntries = Object.entries(
          Object.fromEntries(
            specText
              .split('\n')
              .map((x) => x.split(':'))
              .filter((x) => x.length > 1)
              .map(([k, ...v]) => [k.trim(), v.join(':').trim()])
          )
        );

        return (
          <div
            className="fm-preview-modal-backdrop"
            onClick={() => setPreviewModalOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(5px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: previewDevice === 'mobile' ? '410px' : '1120px',
                maxWidth: '96vw',
                height: '92vh',
                background: '#ffffff',
                borderRadius: previewDevice === 'mobile' ? 28 : 16,
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                border: previewDevice === 'mobile' ? '8px solid #1e293b' : '1px solid #e2e8f0',
              }}
            >
              {/* Header Toolbar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#0f172a',
                    }}
                  >
                    <Eye size={16} color="#0d9488" />
                    <span>Storefront Preview</span>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: product.status === 'published' ? '#ecfdf5' : '#fef3c7',
                      color: product.status === 'published' ? '#047857' : '#92400e',
                      border: product.status === 'published' ? '1px solid #a7f3d0' : '1px solid #fde68a',
                    }}
                  >
                    {product.status === 'published' ? '● Published' : '○ Draft Preview'}
                  </span>
                </div>

                {/* Device Toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: '#e2e8f0',
                    padding: 3,
                    borderRadius: 8,
                    gap: 2,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('desktop')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: 'none',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: previewDevice === 'desktop' ? '#ffffff' : 'transparent',
                      color: previewDevice === 'desktop' ? '#0f172a' : '#64748b',
                      boxShadow: previewDevice === 'desktop' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    <Monitor size={13} /> Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('mobile')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: 'none',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: previewDevice === 'mobile' ? '#ffffff' : 'transparent',
                      color: previewDevice === 'mobile' ? '#0f172a' : '#64748b',
                      boxShadow: previewDevice === 'mobile' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    <Smartphone size={13} /> Mobile
                  </button>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {product.slug && (
                    <a
                      href={`https://www.fastonmed.com/product/${product.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '11.5px',
                        color: '#0d9488',
                        textDecoration: 'none',
                        fontWeight: 600,
                        padding: '5px 10px',
                        borderRadius: 6,
                        background: '#f0fdfa',
                        border: '1px solid #ccfbf1',
                      }}
                    >
                      Open Live Tab <ExternalLink size={12} />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      await saveProduct({ status: 'published' });
                      setPreviewModalOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: '#0d9488',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <CheckCircle2 size={13} /> Publish Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewModalOpen(false)}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: '#64748b',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Scrollable Storefront Simulation Body */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: previewDevice === 'mobile' ? '16px' : '28px 36px',
                  background: '#fafafa',
                }}
              >
                {/* Storefront Navigation Bar Pill Mockup */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 14px',
                    background: '#ffffff',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    marginBottom: 16,
                    fontSize: '11.5px',
                    color: '#64748b',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <span style={{ fontWeight: 800, color: '#0d9488', letterSpacing: '0.5px' }}>FASTONMED</span>
                    <span>/</span>
                    <span>{product.category || 'Medical Equipment'}</span>
                    <span>/</span>
                    <span style={{ color: '#0f172a', fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {product.name || 'Product'}
                    </span>
                  </div>
                  <span style={{ fontSize: '10.5px', color: '#94a3b8', flexShrink: 0 }}>Preview Mode • fastonmed.com</span>
                </div>

                {/* Main Product Showcase Card */}
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: 14,
                    border: '1px solid #e2e8f0',
                    padding: previewDevice === 'mobile' ? '18px' : '28px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    marginBottom: 20,
                  }}
                >
                  <div data-mobile-grid="stack"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: previewDevice === 'mobile' ? '1fr' : '1.1fr 1fr',
                      gap: previewDevice === 'mobile' ? 20 : 36,
                    }}
                  >
                    {/* Left Column: Image Gallery */}
                    <div>
                      {/* Primary Display Frame */}
                      <div
                        style={{
                          width: '100%',
                          height: previewDevice === 'mobile' ? '280px' : '380px',
                          background: '#f8fafc',
                          borderRadius: 10,
                          border: '1px solid #f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          overflow: 'hidden',
                          padding: 16,
                        }}
                      >
                        {currentMainImg ? (
                          <img
                            src={currentMainImg}
                            alt={
                              (currentMainImg === product.image ? product.imageAlt : product.galleryAlts?.[currentMainImg]) ||
                              product.imageAlt ||
                              product.name ||
                              'Product preview'
                            }
                            style={{
                              maxWidth: '100%',
                              maxHeight: '100%',
                              objectFit: 'contain',
                            }}
                          />
                        ) : (
                          <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                            <ImageIcon size={44} strokeWidth={1.5} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                            <p style={{ margin: 0, fontSize: '12px' }}>No featured image uploaded yet</p>
                          </div>
                        )}

                        {/* Alt text tag if present */}
                        {((currentMainImg === product.image ? product.imageAlt : product.galleryAlts?.[currentMainImg]) || product.imageAlt) && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 8,
                              left: 8,
                              background: 'rgba(15, 23, 42, 0.75)',
                              color: '#ffffff',
                              fontSize: '10px',
                              padding: '2px 8px',
                              borderRadius: 4,
                              maxWidth: '90%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title="Image Alt Tag (SEO)"
                          >
                            Alt: {(currentMainImg === product.image ? product.imageAlt : product.galleryAlts?.[currentMainImg]) || product.imageAlt}
                          </div>
                        )}
                      </div>

                      {/* Thumbnail Strip */}
                      {allPreviewImages.length > 1 && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: 12,
                            overflowX: 'auto',
                            paddingBottom: 4,
                          }}
                        >
                          {allPreviewImages.map((img, i) => {
                            const isSelected = img === currentMainImg;
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setActivePreviewImage(img)}
                                style={{
                                  width: 56,
                                  height: 56,
                                  padding: 3,
                                  borderRadius: 6,
                                  border: isSelected ? '2px solid #0d9488' : '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  opacity: isSelected ? 1 : 0.7,
                                }}
                              >
                                <img src={img} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Right Column: Details & Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {/* Brand and Verification */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: '#0d9488',
                            letterSpacing: '0.8px',
                          }}
                        >
                          {product.brand || 'FASTONMED PARTNER'}
                        </span>
                        <span
                          style={{
                            fontSize: '10.5px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: '#f0fdfa',
                            color: '#0f766e',
                            padding: '2px 8px',
                            borderRadius: 999,
                            border: '1px solid #ccfbf1',
                          }}
                        >
                          <ShieldCheck size={11} /> Clinical Grade
                        </span>
                      </div>

                      {/* Title */}
                      <h1
                        style={{
                          fontSize: previewDevice === 'mobile' ? '18px' : '22px',
                          fontWeight: 700,
                          color: '#0f172a',
                          lineHeight: 1.3,
                          margin: '0 0 10px',
                        }}
                      >
                        {product.name || 'Untitled Medical Product'}
                      </h1>

                      {/* SKU & Category Row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '11.5px', color: '#64748b', marginBottom: 14 }}>
                        <span>SKU: <strong style={{ color: '#334155' }}>{product.sku || 'FOM-AUTO'}</strong></span>
                        <span>•</span>
                        <span>Category: <strong style={{ color: '#334155' }}>{product.category || 'General'}</strong></span>
                      </div>

                      {/* Pricing Block */}
                      <div
                        style={{
                          padding: '12px 16px',
                          background: '#f8fafc',
                          borderRadius: 10,
                          border: '1px solid #f1f5f9',
                          marginBottom: 16,
                        }}
                      >
                        {product.salePrice && product.salePrice > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                            <span style={{ fontSize: '24px', fontWeight: 800, color: '#0d9488' }}>
                              AED {Number(product.salePrice).toLocaleString()}
                            </span>
                            {product.regularPrice && product.regularPrice > product.salePrice && (
                              <>
                                <span style={{ fontSize: '15px', color: '#94a3b8', textDecoration: 'line-through' }}>
                                  AED {Number(product.regularPrice).toLocaleString()}
                                </span>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: '#dc2626',
                                    background: '#fee2e2',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                  }}
                                >
                                  Save {Math.round((1 - product.salePrice / product.regularPrice) * 100)}%
                                </span>
                              </>
                            )}
                          </div>
                        ) : product.regularPrice && product.regularPrice > 0 ? (
                          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                            AED {Number(product.regularPrice).toLocaleString()}
                          </div>
                        ) : (
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#0d9488' }}>
                            Price on Enquiry / Request Quote (RFQ)
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: '11.5px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              fontWeight: 600,
                              color: product.stockStatus === 'outofstock' ? '#dc2626' : '#16a34a',
                            }}
                          >
                            <span
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: '50%',
                                background: product.stockStatus === 'outofstock' ? '#dc2626' : '#16a34a',
                              }}
                            />
                            {product.stockStatus === 'outofstock'
                              ? 'Out of Stock'
                              : product.inStock && product.inStock > 0
                              ? `In Stock (${product.inStock} units available)`
                              : 'In Stock (UAE Warehouse)'}
                          </span>
                          {product.warrantyPeriod && (
                            <>
                              <span style={{ color: '#cbd5e1' }}>•</span>
                              <span style={{ color: '#475569' }}>Warranty: {product.warrantyPeriod}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Short Description */}
                      {product.shortDescription && (
                        <p
                          style={{
                            fontSize: '13px',
                            color: '#475569',
                            lineHeight: 1.6,
                            margin: '0 0 16px',
                          }}
                        >
                          {product.shortDescription}
                        </p>
                      )}

                      {/* Call to Actions Preview */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button
                            type="button"
                            style={{
                              flex: 1,
                              padding: '12px',
                              background: '#0d9488',
                              color: '#ffffff',
                              fontWeight: 600,
                              fontSize: '13px',
                              borderRadius: 8,
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 8,
                            }}
                          >
                            <ShoppingBag size={15} />
                            {product.purchaseMode === 'quote'
                              ? 'Request Official Quote'
                              : product.purchaseMode === 'enquire'
                              ? 'Enquire on Availability'
                              : 'Add to Cart'}
                          </button>
                          <a
                            href="https://wa.me/971508893589"
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              padding: '12px 16px',
                              background: '#25D366',
                              color: '#ffffff',
                              fontWeight: 600,
                              fontSize: '13px',
                              borderRadius: 8,
                              border: 'none',
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                            }}
                          >
                            <MessageCircle size={15} /> WhatsApp
                          </a>
                        </div>

                        {/* Storefront Trust Highlights */}
                        <div data-mobile-grid="stack"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 8,
                            marginTop: 8,
                            paddingTop: 10,
                            borderTop: '1px solid #f1f5f9',
                            fontSize: '11px',
                            color: '#64748b',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Truck size={13} color="#0d9488" /> Fast UAE & GCC Delivery
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ShieldCheck size={13} color="#0d9488" /> Certified Biomedical Gear
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Technical Specifications Section */}
                {specsEntries.length > 0 && (
                  <div
                    style={{
                      background: '#ffffff',
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      padding: '18px 22px',
                      marginBottom: 18,
                    }}
                  >
                    <h3 style={{ fontSize: '14.5px', fontWeight: 700, color: '#0f172a', margin: '0 0 12px' }}>
                      Technical Specifications
                    </h3>
                    <div data-mobile-grid="stack"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: previewDevice === 'mobile' ? '1fr' : '1fr 1fr',
                        gap: '6px 20px',
                      }}
                    >
                      {specsEntries.map(([key, value]) => (
                        <div
                          key={key}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '6px 0',
                            borderBottom: '1px solid #f8fafc',
                            fontSize: '12px',
                          }}
                        >
                          <span style={{ color: '#64748b' }}>{key}</span>
                          <strong style={{ color: '#1e293b' }}>{value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description Section */}
                {currentDesc && (
                  <div
                    style={{
                      background: '#ffffff',
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      padding: '18px 22px',
                      fontSize: '13px',
                      color: '#334155',
                      lineHeight: 1.7,
                    }}
                  >
                    <h3 style={{ fontSize: '14.5px', fontWeight: 700, color: '#0f172a', margin: '0 0 12px' }}>
                      Product Description & Clinical Overview
                    </h3>
                    <ProductDescription content={currentDesc} />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Website Media Library & Upload Modal */}
      {mediaModalOpen && (
        <div className="fm-media-modal-backdrop" onClick={() => setMediaModalOpen(false)}>
          <div className="fm-media-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fm-media-modal-header">
              <h2>Select or Upload Image</h2>
              <button
                type="button"
                style={{ border: 0, background: 'none', cursor: 'pointer', color: '#64748b' }}
                onClick={() => setMediaModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="fm-media-modal-nav">
              <button
                type="button"
                className={`fm-media-nav-tab ${mediaTab === 'library' ? 'active' : ''}`}
                onClick={() => setMediaTab('library')}
              >
                Website Media Library ({mediaList.length})
              </button>
              <button
                type="button"
                className={`fm-media-nav-tab ${mediaTab === 'upload' ? 'active' : ''}`}
                onClick={() => setMediaTab('upload')}
              >
                Upload from Computer
              </button>
            </div>

            {mediaTab === 'library' ? (
              <>
                <div className="fm-media-modal-toolbar">
                  <div className="fm-media-search-box">
                    <Search size={15} />
                    <input
                      placeholder="Search website media by filename or path..."
                      value={mediaSearch}
                      onChange={(e) => setMediaSearch(e.target.value)}
                    />
                  </div>
                  <div className="fm-media-cats">
                    {(['all', 'products', 'uploads', 'showcase', 'library'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={`fm-media-cat-btn ${mediaFilter === cat ? 'active' : ''}`}
                        onClick={() => setMediaFilter(cat)}
                      >
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="fm-media-grid-scroll">
                  {mediaLoading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                      Loading website media files...
                    </div>
                  ) : filteredMedia.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                      No images found matching your search.
                    </div>
                  ) : (
                    <div className="fm-media-grid">
                      {filteredMedia.map((m) => {
                        const isSelected = selectedMediaUrl === m.url;
                        return (
                          <div
                            key={m.url}
                            className={`fm-media-card ${isSelected ? 'selected' : ''}`}
                            onClick={() => setSelectedMediaUrl(m.url)}
                          >
                            <img src={m.url} alt={m.name} loading="lazy" />
                            {isSelected && (
                              <div className="fm-media-card-badge">
                                <Check size={13} strokeWidth={3} />
                              </div>
                            )}
                            <div className="fm-media-card-title">{m.name}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ padding: '24px' }}>
                <label
                  className="fm-media-dropzone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleModalFileUpload(file);
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleModalFileUpload(file);
                    }}
                  />
                  <Upload size={42} />
                  <h4>Choose an image from your computer</h4>
                  <p>PNG, JPG, WEBP, or SVG accepted • Drag and drop or click to browse</p>
                  {isUploading && (
                    <div style={{ color: '#2563eb', fontWeight: 600, fontSize: 13 }}>
                      Uploading file...
                    </div>
                  )}
                </label>
              </div>
            )}

            <div className="fm-media-modal-footer">
              <div className="fm-media-footer-info" style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, marginRight: 12 }}>
                {selectedMediaUrl ? (
                  <>
                    <span style={{ fontSize: '11.5px', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Selected: <strong>{selectedMediaUrl.split('/').pop()}</strong>
                    </span>
                    <input
                      type="text"
                      value={modalAltText}
                      onChange={(e) => setModalAltText(e.target.value)}
                      placeholder="Image Alt Text (optional SEO description)..."
                      maxLength={120}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11.5px',
                        border: '1px solid #cbd5e1',
                        borderRadius: 4,
                        outline: 'none',
                        maxWidth: 320,
                        background: '#ffffff',
                        color: '#1e293b',
                      }}
                    />
                  </>
                ) : (
                  <span>Click an image to select it</span>
                )}
              </div>
              <div className="fm-media-footer-btns">
                <button
                  type="button"
                  className="fm-seo-cancel-btn"
                  onClick={() => setMediaModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="fm-seo-apply-btn"
                  disabled={!selectedMediaUrl}
                  style={{ opacity: selectedMediaUrl ? 1 : 0.5, cursor: selectedMediaUrl ? 'pointer' : 'not-allowed' }}
                  onClick={handleInsertSelectedMedia}
                >
                  Select & Insert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Title({
  title,
  action,
}: {
  title: string;
  action: React.ReactNode;
}) {
  return (
    <div className="tk-page-heading">
      <div>
        <h1>{title}</h1>
        <p>WooCommerce-style Fastonmed catalogue management.</p>
      </div>
      {action}
    </div>
  );
}
