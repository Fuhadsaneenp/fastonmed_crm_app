'use client';
import { createElement, useEffect, useState, type ReactNode } from 'react';
import styles from './ProductDescription.module.css';

const allowed = new Set(['p', 'strong', 'b', 'em', 'i', 'u', 's', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'img', 'div', 'span']);
const blocked = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input', 'button']);
function safeUrl(value: string) {
  const url = value.trim();
  return /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(url) ? url : undefined;
}
export default function ProductDescription({ content }: { content?: string }) {
  const [rendered, setRendered] = useState<ReactNode>(null);
  useEffect(() => {
    const document = new DOMParser().parseFromString(content || '', 'text/html');
    const render = (node: Node, key: number): ReactNode => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      if (node.nodeType !== Node.ELEMENT_NODE) return null;
      const element = node as Element;
      const tag = element.tagName.toLowerCase();
      if (blocked.has(tag)) return null;
      const children = Array.from(element.childNodes).map(render);
      if (!allowed.has(tag)) return children;
      const props: Record<string, unknown> = { key };
      if (tag === 'a') { props.href = safeUrl(element.getAttribute('href') || ''); props.rel = 'noopener noreferrer'; }
      if (tag === 'img') {
        props.src = safeUrl(element.getAttribute('src') || '');
        if (!props.src) return null;
        props.alt = element.getAttribute('alt') || ''; props.loading = 'lazy';
      }
      return createElement(tag, props, ...(['br', 'img'].includes(tag) ? [] : children));
    };
    setRendered(Array.from(document.body.childNodes).map(render));
  }, [content]);
  return <div className={styles.description}>{rendered}</div>;
}
