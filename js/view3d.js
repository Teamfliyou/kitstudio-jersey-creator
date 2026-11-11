/* ================= Rendu 3D =================
   Chaque pièce (maillot, short, chaussettes) est construite à partir de sa silhouette 2D :
   deux panneaux (face / dos) "gonflés" selon la distance aux coutures, joints le long des coutures
   et laissés ouverts au col, aux poignets et à l'ourlet. Le design SVG sert de texture. */
const View3D = (() => {
  const K = 0.01;                       // 1 unité SVG = 0.01 unité 3D
  let renderer, scene, cam, ctl, root, host, ro;
  let ok = false, visible = false, raf = 0, tween = null, shadow, auto = false;
  let geomKey = '', token = 0, pending = null, timer = 0, kitOn = false;
  const mats = {}, tex = {}, meshes = {}, groups = {};
  let bumpTex, innerMat, fitted = false;

  /* ---------- silhouettes ---------- */
  function quad(p0, c, p1, n = 14) {
    const out = [];
    for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t;
      out.push([u*u*p0[0] + 2*u*t*c[0] + t*t*p1[0], u*u*p0[1] + 2*u*t*c[1] + t*t*p1[1]]); }
    return out;
  }
  // Construit [{x,y,c}] : c = le segment qui part de ce point est une couture (fermée)
  function build(list) { return list.map(([x, y, c]) => ({ x, y, c: !!c })); }

  function jerseyOutline(s, side) {
    const long = s.sleeve === 'long';
    const A = long ? { x1: 30, y1: 318, x2: 84, y2: 330, pit: 165 } : { x1: 22, y1: 162, x2: 78, y2: 190, pit: 148 };
    const L = [];
    L.push([140, 45, 1], [62, 82, 1], [A.x1, A.y1, 0], [A.x2, A.y2, 1], [100, A.pit, 1], [100, 396, 0]);
    quad([100, 396], [200, 416], [300, 396]).forEach(p => L.push([p[0], p[1], 0]));   // ourlet (le dernier point = (300,396))
    L[L.length - 1][2] = 1;                                                           // (300,396) → (300,pit) = couture
    L.push([300, A.pit, 1], [400 - A.x2, A.y2, 0], [400 - A.x1, A.y1, 1], [338, 82, 1], [260, 45, 0]);
    // col
    if (side === 'back') quad([260, 45], [200, 74], [140, 45]).slice(0, -1).forEach(p => L.push([p[0], p[1], 0]));
    else if (s.neck === 'round') quad([260, 45], [200, 125], [140, 45]).slice(0, -1).forEach(p => L.push([p[0], p[1], 0]));
    else if (s.neck === 'v') L.push([200, 120, 0]);
    else L.push([200, 98, 0]);
    return build(L);
  }
  const SHORTS = build([[108,372,0],[292,372,1],[308,528,0],[214,540,1],[200,470,1],[186,540,0],[92,528,1]]);
  const SOCK = build([[122,566,0],[182,566,1],[178,770,1],
    ...quad([178,770],[176,806],[140,812],8).map(p => [p[0],p[1],1]), [102,812,1],
    ...quad([102,812],[92,786],[114,770],8).map(p => [p[0],p[1],1])]);

  /* ---------- géométrie ---------- */
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function segDist(px, py, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx*dx + dy*dy;
    let t = l2 ? ((px - a.x)*dx + (py - a.y)*dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
    const x = a.x + t*dx, y = a.y + t*dy;
    return { d: Math.hypot(px - x, py - y), x, y };
  }
  function inside(px, py, pts) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a.y > py) !== (b.y > py) && px < (b.x - a.x) * (py - a.y) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  }

  function panelGeometry(spec, side) {
    const { pts, Z, R, rect, bulge = 0, bw = 100, taper = false, step = 3, cx = 200 } = spec;
    const n = pts.length;
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    pts.forEach(p => { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y); });
    const nx = Math.ceil((maxx - minx) / step), ny = Math.ceil((maxy - miny) / step);
    const vc = (nx + 1) * (ny + 1);
    const pos = new Float32Array(vc * 3), uv = new Float32Array(vc * 2), ins = new Uint8Array(vc);
    for (let j = 0, k = 0; j <= ny; j++) for (let i = 0; i <= nx; i++, k++) {
      const x = minx + i * step, y = miny + j * step;
      let px = x, py = y, isIn = inside(x, y, pts);
      if (!isIn) {            // on ramène le sommet sur le contour
        let best = { d: 1e9 };
        for (let q = 0; q < n; q++) { const r = segDist(x, y, pts[q], pts[(q + 1) % n]); if (r.d < best.d) best = r; }
        px = best.x; py = best.y;
      }
      ins[k] = isIn ? 1 : 0;
      let d = 1e9;            // distance aux coutures fermées
      for (let q = 0; q < n; q++) if (pts[q].c) { const r = segDist(px, py, pts[q], pts[(q + 1) % n]); if (r.d < d) d = r.d; }
      const t = Math.min(d, R) / R, h = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
      let z = Z * h + bulge * h * Math.max(0, 1 - Math.pow((px - cx) / bw, 2));
      if (taper) z *= 1 - 0.42 * smooth(92, 128, Math.abs(px - cx));
      z += h * (Math.sin(py * 0.05 + px * 0.015) * 1.5 + Math.sin(px * 0.075) * 1.0);   // plis légers
      pos[k*3] = (px - cx) * K; pos[k*3+1] = -py * K; pos[k*3+2] = side * z * K;
      let u = (px - rect[0]) / rect[2]; if (side < 0) u = 1 - u;
      uv[k*2] = u; uv[k*2+1] = 1 - (py - rect[1]) / rect[3];
    }
    const idx = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      if (!(ins[a] || ins[b] || ins[c] || ins[d])) continue;
      if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /* ---------- textures ---------- */
  const TEXSIZE = 1024;
  function makeBump() {
    const c = document.createElement('canvas'); c.width = c.height = 1024;
    const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, 1024, 1024);
    for (let y = 0; y < 1024; y += 3) for (let x = 0; x < 1024; x += 3) {
      const v = 120 + ((x / 3 + y / 3) % 2 ? 22 : 0) + Math.random() * 18;
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 2, 2);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  }
  function newTex() {
    const c = document.createElement('canvas'); c.width = c.height = TEXSIZE;
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  const svgWrap = (vb, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${TEXSIZE}" height="${TEXSIZE}" preserveAspectRatio="none">${inner}</svg>`;
  async function paint(t, svg) {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const g = t.image.getContext('2d');
    g.clearRect(0, 0, TEXSIZE, TEXSIZE); g.drawImage(img, 0, 0, TEXSIZE, TEXSIZE);
    t.needsUpdate = true;
  }

  /* ---------- scène ---------- */
  function init(el) {
    if (ok) return true;
    if (typeof THREE === 'undefined') return false;
    host = el;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch (e) { return false; }
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.domElement.className = 'gl';
    host.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    ctl = new THREE.OrbitControls(cam, renderer.domElement);
    ctl.enableDamping = true; ctl.dampingFactor = 0.08; ctl.enablePan = false;
    ctl.rotateSpeed = 0.8; ctl.autoRotateSpeed = 2.2;
    ctl.addEventListener('start', () => { tween = null; });

    scene.add(new THREE.HemisphereLight(0xffffff, 0x4b5565, 0.95));
    const key = new THREE.DirectionalLight(0xffffff, 0.75); key.position.set(3, 5, 6); scene.add(key);
    const back = new THREE.DirectionalLight(0xffffff, 0.6); back.position.set(-3, 4, -6); scene.add(back);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.25); fill.position.set(-6, 1, 2); scene.add(fill);

    root = new THREE.Group(); scene.add(root);
    bumpTex = makeBump();
    ['jf', 'jb', 'sh', 'sk'].forEach(k => {
      tex[k] = newTex();
      mats[k] = new THREE.MeshStandardMaterial({ map: tex[k], roughness: 0.88, metalness: 0, side: THREE.FrontSide, bumpMap: bumpTex, bumpScale: 0.06 });
    });
    innerMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.95, side: THREE.BackSide });
    // ombre au sol
    const sc = document.createElement('canvas'); sc.width = sc.height = 256;
    const sg = sc.getContext('2d'), gr = sg.createRadialGradient(128, 128, 10, 128, 128, 128);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle = gr; sg.fillRect(0, 0, 256, 256);
    shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; scene.add(shadow);

    ro = new ResizeObserver(resize); ro.observe(host);
    ok = true; resize();
    return true;
  }

  function size() { return { w: host.clientWidth || 600, h: host.clientHeight || 600 }; }
  function resize() {
    if (!ok) return;
    const { w, h } = size();
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
    cam.aspect = w / h; cam.updateProjectionMatrix();
    fitLimits();
  }

  function bounds() { return kitOn ? { top: 45, bottom: 815 } : { top: 40, bottom: 420 }; }
  function distFor(aspect) {
    const b = bounds(), H = (b.bottom - b.top) * K * 1.14, W = 3.9 * 1.12 * (kitOn ? 1 : 1);
    const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    return Math.max(H / 2, W / 2 / aspect) / tan;
  }
  function fitLimits() {
    const d = distFor(cam.aspect);
    ctl.minDistance = d * 0.45; ctl.maxDistance = d * 1.7;
    const dir = cam.position.clone().normalize();
    if (cam.position.length() < 0.01) { cam.position.set(0, 0.3, 1).normalize().multiplyScalar(d); }
    else cam.position.copy(dir.multiplyScalar(THREE.MathUtils.clamp(cam.position.length(), ctl.minDistance, ctl.maxDistance)));
    ctl.update();
  }

  /* ---------- construction ---------- */
  // Un panneau = face extérieure texturée + doublure intérieure unie (visible par le col / les ouvertures)
  function addPanel(parent, key, geom, mat) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geom, mat), new THREE.Mesh(geom, innerMat));
    meshes[key] = g; parent.add(g); return g;
  }
  function setPanelGeom(key, geom) {
    const g = meshes[key], old = g.children[0].geometry;
    g.children.forEach(m => { m.geometry = geom; }); old.dispose();
  }
  function buildGeometry(S) {
    const jersey = (side) => ({ pts: jerseyOutline(S, side), Z: 50, R: 62, bulge: 12, bw: 105, taper: true, rect: [0, 0, 400, 440] });
    if (!groups.jersey) {
      groups.jersey = new THREE.Group(); groups.shorts = new THREE.Group(); groups.socks = new THREE.Group();
      root.add(groups.jersey, groups.shorts, groups.socks);
      // short
      const sp = { pts: SHORTS, Z: 36, R: 52, bulge: 6, bw: 110, rect: [60, 360, 280, 190] };
      addPanel(groups.shorts, 'sf', panelGeometry(sp, 1), mats.sh);
      addPanel(groups.shorts, 'sb', panelGeometry(sp, -1), mats.sh);
      // chaussettes (la droite est la gauche en miroir)
      const kp = { pts: SOCK, Z: 24, R: 34, bulge: 0, rect: [80, 556, 120, 266], cx: 200 };
      const gl = new THREE.Group(), gr = new THREE.Group();
      addPanel(gl, 'lf', panelGeometry(kp, 1), mats.sk); addPanel(gl, 'lb', panelGeometry(kp, -1), mats.sk);
      addPanel(gr, 'rf', panelGeometry(kp, 1), mats.sk); addPanel(gr, 'rb', panelGeometry(kp, -1), mats.sk);
      gr.scale.x = -1;
      groups.socks.add(gl, gr);
    }
    innerMat.color.set(S.colors.c1).multiplyScalar(0.72);
    const key = S.sleeve + '|' + S.neck;
    if (key !== geomKey) {
      geomKey = key;
      if (!meshes.jf) {
        addPanel(groups.jersey, 'jf', panelGeometry(jersey('front'), 1), mats.jf);
        addPanel(groups.jersey, 'jb', panelGeometry(jersey('back'), -1), mats.jb);
      } else {
        setPanelGeom('jf', panelGeometry(jersey('front'), 1));
        setPanelGeom('jb', panelGeometry(jersey('back'), -1));
      }
    }
  }

  async function refresh(S, myToken) {
    buildGeometry(S);
    const kitChanged = kitOn !== !!S.kit3d || !fitted;
    kitOn = !!S.kit3d; fitted = true;
    groups.shorts.visible = groups.socks.visible = kitOn;
    if (kitChanged) cam.position.setLength(distFor(cam.aspect));
    const b = bounds();
    root.position.y = ((b.top + b.bottom) / 2) * K;
    shadow.position.y = -((b.bottom) * K) + root.position.y + 0.02;
    shadow.scale.set(4.2, 2.4, 1);
    shadow.position.y = (-b.bottom * K + root.position.y) - 0.05;
    fitLimits();
    const jobs = [
      paint(tex.jf, svgWrap('0 0 400 440', jerseySVG(S, 'front'))),
      paint(tex.jb, svgWrap('0 0 400 440', jerseySVG(S, 'back')))
    ];
    if (kitOn) {
      jobs.push(paint(tex.sh, svgWrap('60 360 280 190', shortsSVG(S))));
      jobs.push(paint(tex.sk, svgWrap('80 556 120 266', sockSVG(S))));
    }
    await Promise.all(jobs);
  }

  // Appelé à chaque changement ; regroupe les mises à jour rapprochées
  function update(S) {
    if (!ok) return Promise.resolve();
    pending = S;
    clearTimeout(timer);
    return new Promise(res => {
      timer = setTimeout(async () => {
        const my = ++token;
        try { await refresh(pending, my); } catch (e) { console.error('3D', e); }
        res();
      }, 90);
    });
  }

  /* ---------- caméra ---------- */
  const PRESETS = { front: [0, 0.06], three: [0.62, 0.1], back: [Math.PI, 0.06], side: [Math.PI / 2, 0.04] };
  function preset(name) {
    if (!ok) return;
    const [az, el] = PRESETS[name] || PRESETS.front;
    const d = Math.max(cam.position.length(), distFor(cam.aspect));
    const sph = new THREE.Spherical().setFromVector3(cam.position);
    let a0 = sph.theta, a1 = az;
    while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
    while (a1 - a0 < -Math.PI) a1 += 2 * Math.PI;
    tween = { t: 0, a0, a1, e0: Math.PI / 2 - sph.phi, e1: el, d0: sph.radius, d1: distFor(cam.aspect) };
    void d;
  }

  function loop() {
    raf = 0;
    if (!visible || !ok) return;
    if (tween) {
      tween.t = Math.min(1, tween.t + 0.045);
      const e = tween.t * tween.t * (3 - 2 * tween.t);
      const a = tween.a0 + (tween.a1 - tween.a0) * e, el = tween.e0 + (tween.e1 - tween.e0) * e, d = tween.d0 + (tween.d1 - tween.d0) * e;
      cam.position.set(d * Math.sin(a) * Math.cos(el), d * Math.sin(el), d * Math.cos(a) * Math.cos(el));
      if (tween.t >= 1) tween = null;
    }
    ctl.autoRotate = auto;
    ctl.update();
    renderer.render(scene, cam);
    raf = requestAnimationFrame(loop);
  }
  function setVisible(v) {
    visible = v;
    if (v) { resize(); if (!raf) raf = requestAnimationFrame(loop); }
  }
  function setAuto(v) { auto = v; }

  // Capture PNG (canvas) à la taille demandée, avec le point de vue courant
  async function snapshot(w, h) {
    if (!ok) throw new Error('3D indisponible');
    const old = size(), oldPR = renderer.getPixelRatio();
    const dirLen = cam.position.length(), oldAspect = cam.aspect;
    renderer.setPixelRatio(1); renderer.setSize(w, h, false);
    cam.aspect = w / h;
    const d = Math.max(distFor(cam.aspect), 0.1);
    cam.position.setLength(Math.max(d, 0.1)); cam.updateProjectionMatrix();
    renderer.render(scene, cam);
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    out.getContext('2d').drawImage(renderer.domElement, 0, 0);
    renderer.setPixelRatio(oldPR); renderer.setSize(old.w, old.h, false);
    renderer.domElement.style.width = old.w + 'px'; renderer.domElement.style.height = old.h + 'px';
    cam.aspect = oldAspect; cam.position.setLength(dirLen); cam.updateProjectionMatrix();
    return out;
  }

  return { init, update, preset, setVisible, setAuto, snapshot, resize,
    get ready() { return ok; }, get kit() { return kitOn; } };
})();
