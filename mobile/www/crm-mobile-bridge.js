(() => {
  if (location.origin !== 'https://crm.fastonmed.com' || window.__fastonmedMobileReady) return;
  const send = message => {
    const payload = JSON.stringify(message);
    if (window.FastonMedNative) window.FastonMedNative.postMessage(payload);
    else if (window.webkit?.messageHandlers?.fastonmedNative) window.webkit.messageHandlers.fastonmedNative.postMessage(payload);
    else throw new Error('Native file support is unavailable.');
  };
  const available = window.FastonMedNative || window.webkit?.messageHandlers?.fastonmedNative;
  if (!available) return;
  window.__fastonmedMobileReady = true;
  const objects = new Map();
  const create = URL.createObjectURL.bind(URL);
  const revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = blob => { const url = create(blob); objects.set(url, blob); return url; };
  URL.revokeObjectURL = url => { objects.delete(url); revoke(url); };
  const originalClick = HTMLAnchorElement.prototype.click;
  async function exportFile(anchor) {
    // Capture the Blob before the CRM immediately revokes its temporary URL.
    const blob = objects.get(anchor.href) || await fetch(anchor.href).then(response => response.blob());
    if (blob.size > 20 * 1024 * 1024) throw new Error('This export exceeds the mobile 20 MB limit. Export a smaller selection or use the desktop CRM.');
    const reader = new FileReader();
    const data = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Unable to read this export. Please retry.'));
      reader.readAsDataURL(blob);
    });
    send({ action: 'save', name: anchor.download || 'FastonMed-export', mime: blob.type.split(';')[0] || 'application/octet-stream', data: data.slice(data.indexOf(',') + 1) });
  }
  const intercept = anchor => {
    if (anchor.download && /^(blob:|data:)/.test(anchor.href)) {
      void exportFile(anchor).catch(error => alert(error.message));
      return true;
    }
    return false;
  };
  HTMLAnchorElement.prototype.click = function () {
    if (!intercept(this)) originalClick.call(this);
  };
  document.addEventListener('click', event => {
    const anchor = event.target.closest?.('a[download]');
    if (anchor && intercept(anchor)) event.preventDefault();
  }, true);
  window.print = () => send({ action: 'print' });
})();
