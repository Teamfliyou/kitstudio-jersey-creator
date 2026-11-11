/* ================= Bibliothèque de logos (IndexedDB) =================
   Import de fichiers / dossiers / glisser-déposer. SVG conservés tels quels (nettoyés),
   images raster réduites à 512 px max pour rester légères. */
const Lib = (() => {
  const DB = 'kitstudio', STORE = 'logos';
  const MAX_ITEMS = 500, MAX_SVG = 400 * 1024, MAX_RASTER = 8 * 1024 * 1024, MAX_PX = 512;
  let dbp = null, items = [], listeners = [];

  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  async function tx(mode, fn) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(STORE, mode);
      const rq = fn(t.objectStore(STORE));
      t.oncomplete = () => res(rq && rq.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }
  const emit = () => listeners.forEach(f => f(items));
  const sortItems = () => items.sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));

  async function load() {
    try { items = (await tx('readonly', st => st.getAll())) || []; } catch (e) { items = []; }
    sortItems(); emit(); return items;
  }

  function readDataURL(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  }
  function loadImage(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }

  // Retourne {id,name,src,kind} ou {skip:'raison'}
  async function fileToLogo(file) {
    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
    const isRaster = /^image\/(png|jpe?g|webp|gif)$/.test(file.type) || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
    if (!isSvg && !isRaster) return { skip: 'format' };
    const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'logo';
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    if (isSvg) {
      if (file.size > MAX_SVG) return { skip: 'trop lourd' };
      let txt = await file.text();
      if (!/<svg[\s>]/i.test(txt)) return { skip: 'svg invalide' };
      txt = txt.replace(/<script[\s\S]*?<\/script>/gi, '')
               .replace(/\s(on\w+)\s*=\s*("[^"]*"|'[^']*')/gi, '')
               .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
      return { id, name, kind: 'svg', src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(txt) };
    }
    if (file.size > MAX_RASTER) return { skip: 'trop lourd' };
    const img = await loadImage(await readDataURL(file));
    const k = Math.min(1, MAX_PX / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { id, name, kind: 'img', src: c.toDataURL('image/png') };
  }

  // Import d'une liste de File ; onProgress(done,total)
  async function importFiles(files, onProgress) {
    const list = [...files].filter(f => /\.(svg|png|jpe?g|webp|gif)$/i.test(f.name) || /^image\//.test(f.type));
    const res = { added: 0, skipped: 0, ignored: files.length - list.length, full: false };
    const known = new Set(items.map(i => i.name + '|' + i.src.length));
    let done = 0;
    for (const f of list) {
      if (items.length >= MAX_ITEMS) { res.full = true; res.skipped += list.length - done; break; }
      try {
        const lg = await fileToLogo(f);
        if (lg.skip) res.skipped++;
        else if (known.has(lg.name + '|' + lg.src.length)) res.skipped++;
        else { await tx('readwrite', st => st.put(lg)); items.push(lg); known.add(lg.name + '|' + lg.src.length); res.added++; }
      } catch (e) { res.skipped++; }
      onProgress && onProgress(++done, list.length);
    }
    sortItems(); emit();
    return res;
  }

  // Fichiers d'un glisser-déposer (gère les dossiers récursivement)
  async function filesFromDrop(dt) {
    const entries = [...(dt.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    if (!entries.length) return [...dt.files];
    const out = [];
    async function walk(e) {
      if (out.length > 1000) return;
      if (e.isFile) out.push(await new Promise(r => e.file(r, () => r(null))));
      else if (e.isDirectory) {
        const rd = e.createReader(); let batch;
        do { batch = await new Promise(r => rd.readEntries(r, () => r([]))); for (const c of batch) await walk(c); } while (batch.length);
      }
    }
    for (const e of entries) await walk(e);
    return out.filter(Boolean);
  }

  async function remove(id) { await tx('readwrite', st => st.delete(id)); items = items.filter(i => i.id !== id); emit(); }
  async function clear() { await tx('readwrite', st => st.clear()); items = []; emit(); }

  return {
    load, importFiles, filesFromDrop, remove, clear,
    get items() { return items; },
    onChange(f) { listeners.push(f); }
  };
})();
