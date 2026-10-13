import { copyFile } from 'node:fs/promises';
await copyFile(new URL('../native/crm-mobile-bridge.js', import.meta.url), new URL('../www/crm-mobile-bridge.js', import.meta.url));
console.log('Mobile print/export support ready for native sync.');
