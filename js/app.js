/* ================= KitStudio v3 – interface ================= */
const $ = (s, r = document) => r.querySelector(s);
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
    else if (k === 'class') e.className = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  kids.flat().forEach(c => e.append(c instanceof Node ? c : document.createTextNode(c)));
  return e;
}
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
};

/* ---------- état ---------- */
let S = clone(DEFAULT);
try { const raw = store.get('kitstudio.state'); if (raw) S = merge(clone(DEFAULT), JSON.parse(raw)); } catch (e) {}
try { const h = location.hash.match(/^#k=(.+)$/); if (h) S = merge(clone(DEFAULT), JSON.parse(decodeURIComponent(escape(atob(h[1]))))); } catch (e) {}

const rp = p => typeof p === 'function' ? p() : p;
const get = p => rp(p).split('.').reduce((o, k) => o[k], S);
function set(p, v) {
  const ks = rp(p).split('.'); let o = S;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = v;
  changed();
}
const syncs = [];

/* ---------- historique (annuler / rétablir) ---------- */
const H = { s: [], i: -1, t: 0 };
const snap = () => JSON.stringify(S);
function updHist() { $('#btnUndo').disabled = H.i <= 0; $('#btnRedo').disabled = H.i >= H.s.length - 1; }
function commit() {
  const x = snap(); if (H.s[H.i] === x) return;
  H.s = H.s.slice(0, H.i + 1); H.s.push(x);
  if (H.s.length > 50) H.s.shift();
  H.i = H.s.length - 1; updHist();
}
function undo() { clearTimeout(H.t); commit(); if (H.i > 0) { H.i--; restore(); } }
function redo() { clearTimeout(H.t); if (H.i < H.s.length - 1) { H.i++; restore(); } }
function restore() { S = merge(clone(DEFAULT), JSON.parse(H.s[H.i])); renderAll(); updHist(); }

/* ---------- boucle ---------- */
let mode = store.get('kitstudio.mode') === '3d' ? '3d' : '2d';
function render() {
  if (mode === '2d') $('#preview').innerHTML = renderSVG(S, S.view);
  else View3D.update(S);
}
function renderAll() { render(); syncs.forEach(f => f()); save(); }
function changed() { renderAll(); clearTimeout(H.t); H.t = setTimeout(commit, 400); }
function save() { store.set('kitstudio.state', snap()); }

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- composants ---------- */
function choice(path, options) {
  const w = el('div', { class: 'seg' });
  options.forEach(([v, l]) => { const b = el('button', { type: 'button', onclick: () => set(path, v) }, l); b.dataset.v = v; w.append(b); });
  syncs.push(() => [...w.children].forEach(b => b.classList.toggle('on', b.dataset.v === String(get(path)))));
  return w;
}
const row = (label, ctrl) => el('div', { class: 'row' }, el('label', {}, label), el('div', { class: 'grow' }, ctrl));
function range(path, label, min, max, step = 1, fmt = v => v) {
  const i = el('input', { type: 'range', min, max, step }), v = el('span', { class: 'val' });
  i.addEventListener('input', () => set(path, +i.value));
  syncs.push(() => { if (+i.value !== +get(path)) i.value = get(path); v.textContent = fmt(get(path)); });
  return el('div', { class: 'row' }, el('label', {}, label), el('div', { class: 'grow' }, i), v);
}
function toggle(path, label) {
  const i = el('input', { type: 'checkbox' }); i.addEventListener('change', () => set(path, i.checked));
  syncs.push(() => { i.checked = !!get(path); });
  return el('div', { class: 'row' }, el('label', { class: 'chk' }, i, label));
}
function textField(path, label, ph, tf = v => v, max = 24) {
  const i = el('input', { type: 'text', placeholder: ph || '', maxlength: max, spellcheck: 'false' });
  i.addEventListener('input', () => set(path, tf(i.value)));
  syncs.push(() => { if (i.value !== get(path)) i.value = get(path); });
  return row(label, i);
}
function colorField(path, label) {
  const b = el('b'), t = el('span');
  const btn = el('button', { type: 'button', class: 'sw', onclick: () => openPop(path, btn) }, b, t);
  syncs.push(() => { b.style.background = get(path); t.textContent = get(path).toUpperCase(); });
  return row(label, btn);
}
function select(path, label, options) {
  const s = el('select'); options.forEach(([v, l]) => s.append(el('option', { value: v }, l)));
  s.addEventListener('change', () => set(path, +s.value));
  syncs.push(() => { s.value = get(path); });
  return row(label, s);
}
const sec = (title, ...k) => el('div', { class: 'sec' }, el('h3', {}, title), ...k);
const cond = (node, fn) => { syncs.push(() => { node.style.display = fn(S.sp[spSlot]) ? '' : 'none'; }); return node; };

/* ---------- palette de couleurs ---------- */
const pop = $('#pop'); let popPath = null;
PALETTE.forEach(c => { const b = el('button', { type: 'button', title: c }); b.style.background = c; b.onclick = () => { if (popPath) { set(popPath, c); $('#popColor').value = c; $('#popHex').value = c; } }; $('#chips').append(b); });
function openPop(path, anchor) {
  popPath = path; pop.hidden = false;
  const r = anchor.getBoundingClientRect();
  const left = Math.min(Math.max(8, r.left), innerWidth - pop.offsetWidth - 8);
  let top = r.bottom + 6; if (top + pop.offsetHeight > innerHeight - 8) top = Math.max(8, r.top - pop.offsetHeight - 6);
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
  $('#popColor').value = get(path); $('#popHex').value = get(path);
}
$('#popColor').addEventListener('input', e => { if (popPath) set(popPath, e.target.value); $('#popHex').value = e.target.value; });
$('#popHex').addEventListener('input', e => { let v = e.target.value.trim(); if (v[0] !== '#') v = '#' + v; if (/^#[0-9a-f]{6}$/i.test(v)) { set(popPath, v.toLowerCase()); $('#popColor').value = v; } });
document.addEventListener('mousedown', e => { if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('.sw')) pop.hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') pop.hidden = true; });
$('#panes').addEventListener('scroll', () => pop.hidden = true, true);

/* ---------- onglets ---------- */
const ICONS = {
  style: '<path d="M8 3L3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-1 2-7 2-8 0z"/>',
  colors: '<path d="M12 3a9 9 0 100 18c1.6 0 2-1 1.5-2s0-2 1.5-2h2a3 3 0 003-3c0-5-4-11-8-11z"/><circle cx="8" cy="11" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10" r="1"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  crest: '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/>',
  sponsors: '<path d="M3 7h18v12H3zM8 7V5h8v2M3 12h18"/>',
  kit: '<path d="M6 4h12l1 16h-5l-2-8-2 8H5z"/>',
  gallery: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>'
};
const tabsDef = [];
const addTab = (id, label, sub, nodes) => tabsDef.push({ id, label, sub, nodes });

/* STYLE */
const presetGrid = el('div', { class: 'grid c4' });
PRESETS.forEach(p => {
  const t = el('button', { type: 'button', class: 'tile', onclick: () => { const keep = { view: S.view, kit3d: S.kit3d, sp: S.sp }; S = merge(clone(DEFAULT), clone(p.s)); S.view = keep.view; S.kit3d = keep.kit3d; S.sp = merge(clone(DEFAULT.sp), clone(keep.sp)); S.sp.chest.color = p.s.text.fill; changed(); } });
  t.innerHTML = renderSVG(p.s, 'front', { bare: true }) + `<div class="nm">${p.name}</div>`;
  presetGrid.append(t);
});
const patGrid = el('div', { class: 'grid c4' });
const patTiles = PATTERNS.map(([v, l]) => {
  const t = el('button', { type: 'button', class: 'tile', onclick: () => set('pattern', v) });
  const holder = el('div'); t.append(holder, el('div', { class: 'nm' }, l)); patGrid.append(t); return { t, holder, v };
});
syncs.push(() => patTiles.forEach(({ t, holder, v }) => { t.classList.toggle('on', S.pattern === v); holder.innerHTML = renderSVG({ ...S, pattern: v }, 'front', { bare: true }); }));
addTab('style', 'Style', 'Coupe, motif et préréglages', [
  sec('Préréglages', presetGrid),
  sec('Coupe',
    row('Encolure', choice('neck', [['round', 'Rond'], ['v', 'Col V'], ['polo', 'Polo']])),
    row('Manches', choice('sleeve', [['short', 'Courtes'], ['long', 'Longues']]))),
  sec('Motif', patGrid, range('density', 'Densité', 3, 15, 1), toggle('shoulderOn', 'Épaulettes')),
]);

/* COULEURS */
addTab('colors', 'Couleurs', 'Palette du maillot', [
  sec('Motif',
    colorField('colors.c1', 'Couleur 1'), colorField('colors.c2', 'Couleur 2'), colorField('colors.c3', 'Détails'),
    el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn sm', onclick: () => { const c = S.colors;[c.c1, c.c2] = [c.c2, c.c1]; changed(); } }, '⇄ Inverser 1 / 2'))),
  sec('Finitions',
    colorField('collar', 'Col'), colorField('trim', 'Poignets'), colorField('shoulder', 'Épaulettes'),
    toggle('sleeveSolid', 'Manches unies'), colorField('sleeveColor', 'Couleur manches')),
]);

/* TEXTE */
addTab('text', 'Texte & numéro', 'Flocage dos et face avant', [
  sec('Flocage',
    textField('text.name', 'Nom', 'NOM DU JOUEUR', v => v.toUpperCase(), 14),
    textField('text.number', 'Numéro', '00', v => v.replace(/\D/g, '').slice(0, 2), 2),
    select('text.font', 'Police', FONTS.map((f, i) => [i, f[0]])),
    colorField('text.fill', 'Couleur'), colorField('text.stroke', 'Contour'),
    range('text.sw', 'Contour', 0, 6, 1, v => v + ' px'),
    toggle('text.frontNumber', 'Numéro sur la face avant')),
]);

/* ÉCUSSON */
const crestFile = el('input', { type: 'file', accept: 'image/*', hidden: 'hidden' });
crestFile.addEventListener('change', async () => {
  const f = crestFile.files[0]; crestFile.value = ''; if (!f) return;
  const imp = await Lib.importFiles([f]);  // réutilise le traitement (SVG nettoyé / image réduite)
  const it = Lib.items[Lib.items.length - 1];
  const found = Lib.items.find(i => i.name === f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()) || it;
  if (found) { S.crest.image = found.src; S.crest.show = true; changed(); } else toast('Image non utilisable');
  void imp;
});
addTab('crest', 'Écusson', 'Blason sur la poitrine', [
  sec('Affichage', toggle('crest.show', 'Afficher l\'écusson'),
    row('Position', choice('crest.pos', [['left', 'Gauche'], ['center', 'Centre'], ['right', 'Droite']])),
    range('crest.size', 'Taille', 0.6, 1.8, 0.05, v => (+v).toFixed(1) + '×')),
  sec('Créer un écusson',
    row('Forme', choice('crest.type', [['shield', 'Écu'], ['round', 'Rond'], ['diamond', 'Losange'], ['star', 'Étoile']])),
    textField('crest.letters', 'Initiales', 'FC', v => v.toUpperCase(), 3),
    colorField('crest.c1', 'Fond'), colorField('crest.c2', 'Contour / texte')),
  sec('Ou importer votre blason',
    el('div', { class: 'row' },
      el('button', { type: 'button', class: 'btn', onclick: () => crestFile.click() }, 'Importer une image'),
      el('button', { type: 'button', class: 'btn', onclick: () => { S.crest.image = null; changed(); } }, 'Retirer'), crestFile),
    el('p', { class: 'hint' }, 'SVG ou PNG (fond transparent recommandé).')),
]);

/* SPONSORS */
let spSlot = 'chest';
const SLOTS = [['chest', 'Poitrine'], ['back', 'Dos'], ['sleeveL', 'Manche G'], ['sleeveR', 'Manche D'], ['maker', 'Équipementier'], ['shorts', 'Short']];
const SLOTHINT = { chest: 'Centre de la poitrine (face avant).', back: 'Sous le numéro (dos).', sleeveL: 'Manche gauche, face et dos.', sleeveR: 'Manche droite, face et dos.', maker: 'Petit logo sur la poitrine droite.', shorts: 'Jambe du short (vue Tenue / 3D complète).' };
const sp = k => () => 'sp.' + spSlot + '.' + k;
const setSlot = v => { spSlot = v; syncs.forEach(f => f()); };

const mapBox = el('div', { class: 'map' });
const DOTS = [['chest', 1, 200, 195], ['maker', 2, 248, 114], ['sleeveL', 3, 60, 130], ['sleeveR', 4, 340, 130]];
syncs.push(() => {
  const longS = S.sleeve === 'long';
  mapBox.innerHTML = renderSVG(S, 'front', { bare: true });
  DOTS.forEach(([k, n, x, y]) => {
    if (longS && (k === 'sleeveL' || k === 'sleeveR')) y = 235, x = k === 'sleeveL' ? 66 : 334;
    const b = el('button', { type: 'button', class: 'dot' + (S.sp[k].logo !== 'none' ? ' used' : '') + (spSlot === k ? ' on' : ''), title: SLOTS.find(s => s[0] === k)[1], onclick: () => setSlot(k) }, String(n));
    b.style.left = ((x + 20) / 440 * 100) + '%'; b.style.top = (y / 440 * 100) + '%';
    mapBox.append(b);
  });
  const svg = mapBox.querySelector('svg'); if (svg) { svg.style.height = '170px'; }
  const bx = svg ? svg.getBoundingClientRect() : null; void bx;
});
const slotChips = el('div', { class: 'chipset' });
SLOTS.forEach(([v, l]) => { const b = el('button', { type: 'button', class: 'chip', onclick: () => setSlot(v) }, l); b.dataset.v = v; slotChips.append(b); });
const slotHint = el('p', { class: 'hint' });
syncs.push(() => { [...slotChips.children].forEach(b => b.classList.toggle('on', b.dataset.v === spSlot)); slotHint.textContent = SLOTHINT[spSlot]; });

// bibliothèque
let libTab = 'lib', libQuery = '';
const libTabs = el('div', { class: 'seg' });
[['lib', 'Mes logos'], ['demo', 'Démo']].forEach(([v, l]) => { const b = el('button', { type: 'button', onclick: () => { libTab = v; renderLib(); } }, l); b.dataset.v = v; libTabs.append(b); });
const libGrid = el('div', { class: 'grid c3' });
const libCount = el('span', { class: 'cnt' });
const libSearch = el('input', { type: 'search', placeholder: 'Rechercher un logo…', 'aria-label': 'Rechercher' });
libSearch.addEventListener('input', () => { libQuery = libSearch.value.trim().toLowerCase(); renderLib(); });
function assignLogo(logo, image) {
  const s = S.sp[spSlot]; s.logo = logo; if (image !== undefined) s.image = image; changed();
}
function renderLib() {
  [...libTabs.children].forEach(b => b.classList.toggle('on', b.dataset.v === libTab));
  libGrid.innerHTML = '';
  const q = libQuery;
  if (libTab === 'lib') {
    const list = Lib.items.filter(i => !q || i.name.toLowerCase().includes(q));
    libCount.textContent = Lib.items.length + ' logo' + (Lib.items.length > 1 ? 's' : '');
    if (!list.length) libGrid.append(el('div', { class: 'empty' }, Lib.items.length ? 'Aucun résultat.' : 'Aucun logo importé. Glissez des fichiers ou un dossier ci-dessus.'));
    list.slice(0, 300).forEach(it => {
      const t = el('div', { class: 'tile', role: 'button', tabindex: '0', title: it.name, onclick: () => assignLogo('custom', it.src), onkeydown: e => { if (e.key === 'Enter') assignLogo('custom', it.src); } });
      t._src = it.src;
      const img = el('img', { src: it.src, alt: it.name, loading: 'lazy' });
      t.append(el('div', { class: 'lt' }, img), el('div', { class: 'nm' }, it.name),
        el('button', { class: 'x', type: 'button', title: 'Supprimer de la bibliothèque', onclick: async e => { e.stopPropagation(); await Lib.remove(it.id); } }, '×'));
      libGrid.append(t);
    });
  } else {
    libCount.textContent = BRANDS.length + ' logos fictifs';
    BRANDS.forEach(b => {
      const t = el('button', { type: 'button', class: 'tile', onclick: () => assignLogo(b.id) }); t._brand = b.id;
      const r = brandSVG(b, { mono: false });
      const h = el('div', { class: 'lt' }); h.innerHTML = `<svg viewBox="${-r.w / 2 - 3} -16 ${r.w + 6} 32">${r.svg}</svg>`;
      t.append(h, el('div', { class: 'nm' }, b.name)); libGrid.append(t);
    });
  }
  syncLibActive();
}
function syncLibActive() {
  const s = S.sp[spSlot];
  [...libGrid.children].forEach(t => {
    if (t._src !== undefined) t.classList.toggle('on', s.logo === 'custom' && s.image === t._src);
    else if (t._brand) t.classList.toggle('on', s.logo === t._brand);
  });
}
syncs.push(syncLibActive);
Lib.onChange(() => renderLib());

const dropZone = el('div', { class: 'drop' });
const bar = el('i'), progress = el('div', { class: 'progress', style: 'display:none' }, bar);
const fileIn = el('input', { type: 'file', multiple: 'multiple', accept: '.svg,.png,.jpg,.jpeg,.webp,.gif,image/*', hidden: 'hidden' });
const dirIn = el('input', { type: 'file', multiple: 'multiple', hidden: 'hidden' });
dirIn.setAttribute('webkitdirectory', ''); dirIn.setAttribute('directory', '');
dropZone.append(el('strong', {}, 'Glissez vos logos ici'), 'Fichiers SVG, PNG, JPG, WebP — ou un dossier entier',
  el('div', { class: 'btns' },
    el('button', { type: 'button', class: 'btn sm', onclick: () => fileIn.click() }, 'Importer des fichiers'),
    el('button', { type: 'button', class: 'btn sm', onclick: () => dirIn.click() }, 'Importer un dossier')),
  progress, fileIn, dirIn);
async function doImport(files) {
  if (!files.length) return;
  libTab = 'lib'; progress.style.display = ''; bar.style.width = '0';
  const r = await Lib.importFiles(files, (d, t) => { bar.style.width = (d / t * 100) + '%'; });
  progress.style.display = 'none';
  let m = r.added + ' logo' + (r.added > 1 ? 's' : '') + ' importé' + (r.added > 1 ? 's' : '');
  const sk = r.skipped + r.ignored;
  if (sk) m += ' · ' + sk + ' ignoré' + (sk > 1 ? 's' : '');
  if (r.full) m += ' (bibliothèque pleine)';
  toast(m);
  renderLib();
}
fileIn.addEventListener('change', () => { doImport([...fileIn.files]); fileIn.value = ''; });
dirIn.addEventListener('change', () => { doImport([...dirIn.files]); dirIn.value = ''; });
['dragenter', 'dragover'].forEach(ev => { dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add('over'); }); });
['dragleave', 'drop'].forEach(ev => { dropZone.addEventListener(ev, () => dropZone.classList.remove('over')); });
dropZone.addEventListener('drop', async e => { e.preventDefault(); e.stopPropagation(); doImport(await Lib.filesFromDrop(e.dataTransfer)); });
// dépôt n'importe où dans la fenêtre → onglet Sponsors
window.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
window.addEventListener('drop', async e => {
  if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
  e.preventDefault(); showTab('sponsors'); doImport(await Lib.filesFromDrop(e.dataTransfer));
});

addTab('sponsors', 'Sponsors', 'Logos sur le maillot et le short', [
  sec('Emplacement', mapBox, slotChips, slotHint),
  sec('Logo',
    el('div', { class: 'chipset', style: 'margin-bottom:10px' },
      el('button', { type: 'button', class: 'chip', onclick: () => assignLogo('none') }, 'Aucun'),
      el('button', { type: 'button', class: 'chip', onclick: () => assignLogo('text') }, 'Texte')),
    dropZone,
    el('div', { class: 'libhead' }, libTabs, el('div', { style: 'flex:1' }), libCount),
    libSearch, el('div', { style: 'height:8px' }), libGrid,
    el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn sm danger', onclick: async () => { if (Lib.items.length && confirm('Supprimer tous les logos importés ?')) { await Lib.clear(); toast('Bibliothèque vidée'); } } }, 'Vider la bibliothèque'))),
  sec('Réglages',
    range(sp('size'), 'Taille', 0.4, 2, 0.05, v => (+v).toFixed(2) + '×'),
    cond(textField(sp('text'), 'Texte', 'Sponsor', v => v, 14), sl => sl.logo === 'text'),
    cond(colorField(sp('color'), 'Couleur'), sl => sl.logo === 'text' || sl.mono),
    cond(toggle(sp('mono'), 'Logo monochrome'), sl => BRANDS.some(b => b.id === sl.logo)),
    cond(toggle(sp('plate'), 'Pastille de fond'), sl => sl.logo !== 'text' && sl.logo !== 'none'),
    cond(colorField(sp('plateColor'), 'Couleur pastille'), sl => sl.plate && sl.logo !== 'text' && sl.logo !== 'none'),
    el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn sm', onclick: () => { S.sp[spSlot] = slot(); changed(); } }, 'Vider cet emplacement'))),
]);

/* TENUE */
addTab('kit', 'Short & chaussettes', 'Compléter la tenue', [
  sec('Short', colorField('kit.shorts', 'Couleur'), colorField('kit.shortsTrim', 'Liserés')),
  sec('Chaussettes', colorField('kit.socks', 'Couleur'), colorField('kit.socksTrim', 'Revers')),
  el('p', { class: 'hint' }, 'Visibles en vue « Tenue » (2D) ou avec « Tenue complète » en 3D.'),
]);

/* GALERIE */
const gal = el('div', { class: 'grid c3' });
const nameIn = el('input', { type: 'text', placeholder: 'Nom de la création', maxlength: 24 });
const loadGallery = () => { try { return JSON.parse(store.get('kitstudio.gallery') || '[]'); } catch (e) { return []; } };
function saveGallery(a) { if (!store.set('kitstudio.gallery', JSON.stringify(a))) { toast('Stockage plein : impossible d\'enregistrer'); return false; } return true; }
function drawGallery() {
  gal.innerHTML = ''; const items = loadGallery();
  if (!items.length) { gal.append(el('div', { class: 'empty' }, 'Aucune création enregistrée.')); return; }
  items.forEach(it => {
    const t = el('div', { class: 'tile', role: 'button', tabindex: '0', onclick: () => { S = merge(clone(DEFAULT), clone(it.s)); changed(); toast('Création chargée'); } });
    t.innerHTML = renderSVG(it.s, 'front', { bare: true }) + `<div class="nm">${esc(it.name)}</div>`;
    t.append(el('button', { class: 'x', type: 'button', title: 'Supprimer', onclick: e => { e.stopPropagation(); saveGallery(loadGallery().filter(x => x.id !== it.id)); drawGallery(); } }, '×'));
    gal.append(t);
  });
}
addTab('gallery', 'Mes créations', 'Enregistrées dans ce navigateur', [
  sec('Enregistrer', el('div', { class: 'row' }, nameIn, el('button', { type: 'button', class: 'btn primary', onclick: () => {
    const a = loadGallery(); a.unshift({ id: Date.now(), name: nameIn.value.trim() || ('Maillot ' + (a.length + 1)), s: clone(S) });
    if (saveGallery(a)) { nameIn.value = ''; drawGallery(); toast('Création enregistrée'); }
  } }, 'Enregistrer'))),
  sec('Galerie', gal),
]);

/* montage rail + panneaux */
const rail = $('#rail'), panes = $('#panes');
tabsDef.forEach((t, i) => {
  const b = el('button', { type: 'button', title: t.label, onclick: () => showTab(t.id) });
  b.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[t.id]}</svg><span>${t.label.split(' ')[0]}</span>`; b.dataset.id = t.id; rail.append(b);
  const p = el('div', { class: 'pane' }, ...t.nodes); p.dataset.id = t.id; if (i) p.hidden = true; panes.append(p);
});
function showTab(id) {
  const t = tabsDef.find(x => x.id === id);
  [...rail.children].forEach(b => b.classList.toggle('on', b.dataset.id === id));
  [...panes.children].forEach(p => p.hidden = p.dataset.id !== id);
  $('#panelTitle').textContent = t.label; $('#panelSub').textContent = t.sub;
  pop.hidden = true; store.set('kitstudio.tab', id);
}

/* ---------- scène : mode 2D/3D + barre flottante ---------- */
const fb = $('#floatbar');
const g2d = el('div', { class: 'seg' }, ...[['both', 'Face + Dos'], ['front', 'Face'], ['back', 'Dos'], ['kit', 'Tenue']].map(([v, l]) => {
  const b = el('button', { type: 'button', onclick: () => set('view', v) }, l); b.dataset.v = v; return b;
}));
syncs.push(() => [...g2d.children].forEach(b => b.classList.toggle('on', b.dataset.v === S.view)));
const g3d = el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center' },
  el('div', { class: 'seg' }, ...[['front', 'Face'], ['three', '3/4'], ['back', 'Dos'], ['side', 'Profil']].map(([v, l]) => el('button', { type: 'button', onclick: () => View3D.preset(v) }, l))),
  el('span', { class: 'sep' }));
const btnAuto = el('button', { type: 'button', class: 'btn', onclick: () => { autoRot = !autoRot; View3D.setAuto(autoRot); syncs.forEach(f => f()); } }, '⟳ Rotation');
const btnKit = el('button', { type: 'button', class: 'btn', onclick: () => set('kit3d', !S.kit3d) }, 'Tenue complète');
g3d.append(btnAuto, btnKit);
let autoRot = false;
syncs.push(() => { btnAuto.classList.toggle('on', autoRot); btnKit.classList.toggle('on', !!S.kit3d); });
fb.append(g2d, g3d);

function setMode(m) {
  if (m === '3d') {
    if (!View3D.init($('#view3d'))) { $('#noGL').hidden = false; toast('Rendu 3D indisponible sur cet appareil'); m = '2d'; }
  }
  mode = m; store.set('kitstudio.mode', m);
  $('#preview').hidden = m !== '2d'; $('#view3d').hidden = m !== '3d';
  g2d.style.display = m === '2d' ? '' : 'none'; g3d.style.display = m === '3d' ? 'flex' : 'none';
  [...$('#modeSeg').children].forEach(b => b.classList.toggle('on', b.dataset.v === m));
  $('#stageHint').textContent = m === '3d' ? 'Glissez pour faire pivoter · molette pour zoomer' : '';
  if (View3D.ready) View3D.setVisible(m === '3d');
  render();
}
[...$('#modeSeg').children].forEach(b => b.addEventListener('click', () => setMode(b.dataset.v)));

/* ---------- export ---------- */
const exp = { content: 'both', fmt: 'png', scale: 2, bg: 'transparent' };
const BGS = { transparent: null, white: '#ffffff', light: '#f1f3f7', dark: '#0e1118' };
function expSeg(key, options) {
  const w = el('div', { class: 'seg' });
  options.forEach(([v, l]) => { const b = el('button', { type: 'button', onclick: () => { exp[key] = v; if (exp.content === '3d' && exp.fmt === 'svg') exp.fmt = 'png'; syncExp(); } }, l); b.dataset.v = v; w.append(b); });
  return w;
}
const eC = expSeg('content', [['both', 'Face + dos'], ['front', 'Face'], ['back', 'Dos'], ['kit', 'Tenue'], ['3d', 'Rendu 3D']]);
const eF = expSeg('fmt', [['png', 'PNG'], ['svg', 'SVG (vectoriel)']]);
const eS = expSeg('scale', [[1, '1×'], [2, '2× HD'], [3, '3× Ultra']]);
const eB = expSeg('bg', [['transparent', 'Transparent'], ['white', 'Blanc'], ['light', 'Gris clair'], ['dark', 'Sombre']]);
$('#exportBody').append(row('Contenu', eC), row('Format', eF), row('Résolution', eS), row('Arrière-plan', eB));
function exportDims() {
  const c = exp.content, k = +exp.scale;
  if (c === '3d') return S.kit3d ? [600 * k, 1150 * k] : [800 * k, 1000 * k];
  const base = { both: [1200, 614], front: [800, 800], back: [800, 800], kit: [700, 1320] }[c];
  return base.map(x => Math.round(x * k));
}
function syncExp() {
  [[eC, 'content'], [eF, 'fmt'], [eS, 'scale'], [eB, 'bg']].forEach(([w, k]) => [...w.children].forEach(b => b.classList.toggle('on', b.dataset.v === String(exp[k]))));
  [...eF.children][1].disabled = exp.content === '3d';
  [...eF.children][1].style.opacity = exp.content === '3d' ? .35 : 1;
  const [w, h] = exportDims();
  $('#exportInfo').textContent = exp.fmt === 'svg' ? 'Vectoriel, sans perte' : `${w} × ${h} px`;
}
$('#btnExport').onclick = () => { exp.content = mode === '3d' ? '3d' : S.view; if (exp.content === '3d' && exp.fmt === 'svg') exp.fmt = 'png'; syncExp(); $('#exportDlg').showModal(); };
const fileName = ext => `maillot-${(S.text.name || 'kit').toLowerCase().replace(/\W+/g, '-')}-${exp.content}.${ext}`;
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }
const canvasBlob = c => new Promise(r => c.toBlob(r, 'image/png'));
$('#btnDoExport').onclick = async () => {
  const btn = $('#btnDoExport'); btn.disabled = true; btn.textContent = 'Préparation…';
  try {
    const bg = BGS[exp.bg]; const [w, h] = exportDims();
    if (exp.content === '3d') {
      if (!View3D.ready && !View3D.init($('#view3d'))) throw new Error('3D indisponible');
      await View3D.update(S); await new Promise(r => setTimeout(r, 160));
      const c = await View3D.snapshot(w, h);
      let out = c;
      if (bg) { out = document.createElement('canvas'); out.width = w; out.height = h; const g = out.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, w, h); g.drawImage(c, 0, 0); }
      download(await canvasBlob(out), fileName('png'));
    } else if (exp.fmt === 'svg') {
      download(new Blob([renderSVG(S, exp.content, { w, bg })], { type: 'image/svg+xml' }), fileName('svg'));
    } else {
      const svg = renderSVG(S, exp.content, { w, bg });
      const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0);
      download(await canvasBlob(c), fileName('png'));
    }
    toast('Export terminé'); $('#exportDlg').close();
  } catch (e) { console.error(e); toast('Export impossible : ' + (e.message || e)); }
  btn.disabled = false; btn.textContent = 'Télécharger';
};

/* ---------- barre du haut ---------- */
$('#btnUndo').onclick = undo; $('#btnRedo').onclick = redo;
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName) && document.activeElement.type !== 'range' && document.activeElement.type !== 'checkbox';
  if ((e.ctrlKey || e.metaKey) && !typing) {
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
  }
});
$('#btnLink').onclick = async () => {
  const c = clone(S); let dropped = false;
  if (c.crest.image) { c.crest.image = null; dropped = true; }
  Object.values(c.sp).forEach(s => { if (s.image) { s.image = null; if (s.logo === 'custom') s.logo = 'none'; dropped = true; } });
  const url = location.origin + location.pathname + '#k=' + btoa(unescape(encodeURIComponent(JSON.stringify(c))));
  try { await navigator.clipboard.writeText(url); toast(dropped ? 'Lien copié (sans les logos importés)' : 'Lien copié'); }
  catch (e) { prompt('Copiez ce lien :', url); }
  try { history.replaceState(null, '', url); } catch (e) {}
};
$('#btnReset').onclick = () => { if (confirm('Revenir au maillot par défaut ?')) { S = clone(DEFAULT); changed(); } };
$('#btnRandom').onclick = () => {
  const R = a => a[Math.floor(Math.random() * a.length)], pick = () => R(PALETTE);
  let c1 = pick(), c2 = pick(); while (c2 === c1) c2 = pick();
  let c3 = pick(); while (c3 === c1 || c3 === c2) c3 = pick();
  S.colors = { c1, c2, c3 }; S.pattern = R(PATTERNS)[0]; S.density = R([5, 7, 9, 11]);
  S.neck = R(['round', 'v', 'polo']); S.collar = c2; S.trim = c2; S.shoulder = c3;
  S.sleeveSolid = false; S.shoulderOn = Math.random() < .3;
  S.crest.c1 = c3; S.crest.c2 = c1;
  const light = ['#ffffff', '#f4d35e', '#87ceeb', '#f78fb3', '#9aa0a6', '#ff7a00'].includes(c1);
  S.text.fill = light ? '#111111' : '#ffffff'; S.text.stroke = light ? '#ffffff' : '#111111'; S.sp.chest.color = S.text.fill;
  S.kit = { shorts: c3, shortsTrim: c2, socks: c2, socksTrim: c1 };
  changed();
};

/* ---------- démarrage ---------- */
window.addEventListener('resize', () => { pop.hidden = true; });
showTab(store.get('kitstudio.tab') && tabsDef.some(t => t.id === store.get('kitstudio.tab')) ? store.get('kitstudio.tab') : 'style');
drawGallery();
renderLib();
Lib.load();
setMode(mode);
renderAll();
commit();
