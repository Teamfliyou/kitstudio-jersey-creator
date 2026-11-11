/* ================= Rendu SVG ================= */
let uid = 0;
const esc = s => String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function patternSVG(s){
  const {c1,c2,c3} = s.colors; const n = s.density;
  const odd = n%2 ? n : n+1;
  let defs='', body='';
  switch(s.pattern){
    case 'stripes-v': { const k=(odd-1)/2, w=400/odd;
      for(let i=0;i<odd;i++) if(Math.abs(i-k)%2===0) body+=`<rect x="${i*w}" y="0" width="${w+.5}" height="440" fill="${c2}"/>`; break; }
    case 'stripes-thin': { const w=400/odd;
      for(let i=0;i<odd;i++) body+=`<rect x="${(i+.5)*w - w*.14}" y="0" width="${w*.28}" height="440" fill="${c2}"/>`; break; }
    case 'hoops': { const h=400/n;
      for(let i=0;i<n;i++) if(i%2===1) body+=`<rect x="0" y="${40+i*h}" width="400" height="${h+.5}" fill="${c2}"/>`; break; }
    case 'band-v':
      body=`<rect x="140" y="0" width="120" height="440" fill="${c3}"/><rect x="150" y="0" width="100" height="440" fill="${c2}"/>`; break;
    case 'band-h':
      body=`<rect x="0" y="140" width="400" height="90" fill="${c3}"/><rect x="0" y="150" width="400" height="70" fill="${c2}"/>`; break;
    case 'sash':
      body=`<g transform="rotate(-32 200 230)"><rect x="-120" y="183" width="640" height="94" fill="${c3}"/><rect x="-120" y="193" width="640" height="74" fill="${c2}"/></g>`; break;
    case 'half':
      body=`<rect x="200" y="0" width="200" height="440" fill="${c2}"/><rect x="196" y="0" width="8" height="440" fill="${c3}"/>`; break;
    case 'quarters':
      body=`<rect x="0" y="0" width="200" height="225" fill="${c2}"/><rect x="200" y="225" width="200" height="215" fill="${c2}"/>`; break;
    case 'chevron': { const step=Math.max(40,620/n), h=step/2;
      for(let y=40;y<460;y+=step) body+=`<path d="M0 ${y} L200 ${y+55} L400 ${y} L400 ${y+h} L200 ${y+h+55} L0 ${y+h} Z" fill="${c2}"/>`; break; }
    case 'checker': { const q=400/n;
      for(let r=0;r*q<400;r++) for(let c=0;c<n;c++) if((r+c)%2) body+=`<rect x="${c*q}" y="${40+r*q}" width="${q+.3}" height="${q+.3}" fill="${c2}"/>`; break; }
    case 'diamonds': { const w=700/n, h=w*1.4;
      for(let r=-1;r*h/2<460;r++) for(let c=-1;c*w<420;c++){
        const cx=c*w+(r%2?w/2:0), cy=40+r*h/2;
        body+=`<polygon points="${cx},${cy-h*.4} ${cx+w*.4},${cy} ${cx},${cy+h*.4} ${cx-w*.4},${cy}" fill="${c2}"/>`;
      } break; }
    case 'gradient':
      defs=`<linearGradient id="GRAD" x1="0" y1="0" x2="0" y2="1"><stop offset=".15" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;
      body=`<rect width="400" height="440" fill="url(#GRAD)"/>`; break;
  }
  return {defs, body};
}


/* ===== Sponsors (marques fictives) ===== */
const BRANDS = [
  {id:'volta',name:'VOLTA',a:'#ff7a00',b:'#111111',icon:'<path d="M4 -14 L-10 3 L-2 3 L-5 14 L10 -5 L2 -5 Z" fill="currentColor"/>'},
  {id:'novabank',name:'NOVABANK',a:'#0b3d91',b:'#0b3d91',icon:'<circle r="10" fill="none" stroke="currentColor" stroke-width="5"/><circle r="3" fill="currentColor"/>'},
  {id:'aeroline',name:'AEROLINE',a:'#1e88e5',b:'#111111',icon:'<path d="M-14 8 Q0 -14 14 -10 Q2 -2 -2 8 Z" fill="currentColor"/>'},
  {id:'fresh',name:'fresh',lc:1,a:'#0a8f4d',b:'#0a8f4d',icon:'<path d="M-12 10 Q-12 -12 12 -12 Q12 10 -12 10 Z" fill="currentColor"/>'},
  {id:'titan',name:'TITAN',a:'#111111',b:'#111111',icon:'<polygon points="14,0 7,12 -7,12 -14,0 -7,-12 7,-12" fill="currentColor"/>'},
  {id:'zenith',name:'ZENITH',a:'#d7263d',b:'#111111',icon:'<path d="M0 -14 L14 12 L-14 12 Z" fill="currentColor"/>'},
  {id:'pulse',name:'PULSE',a:'#d7263d',b:'#d7263d',icon:'<path d="M-14 0 L-6 0 L-3 -10 L2 10 L5 0 L14 0" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>'},
  {id:'orbit',name:'ORBIT',a:'#7b2cbf',b:'#3a1c71',icon:'<circle r="9" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="9" cy="-9" r="4" fill="currentColor"/>'},
  {id:'kick',name:'KICK',a:'#ff7a00',b:'#111111',icon:'<path d="M-14 12 L-6 -12 L-2 -12 L-10 12Z M-5 12 L3 -12 L7 -12 L-1 12Z M4 12 L12 -12 L16 -12 L8 12Z" fill="currentColor"/>'},
  {id:'motorx',name:'MOTORX',a:'#d7263d',b:'#111111',icon:'<path d="M-12 -12 L0 0 L-12 12 M0 -12 L12 0 L0 12" fill="none" stroke="currentColor" stroke-width="5"/>'}
];
function brandSVG(b, sl){
  const A = sl.mono ? sl.color : b.a, B = sl.mono ? sl.color : b.b;
  const tw = b.name.length*(b.lc?9.5:11.5), w = 36+tw;
  return {w, svg:`<g transform="translate(${-w/2} 0)"><g transform="translate(16 0)" color="${A}">${b.icon}</g>
    <text x="36" y="6.5" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="${b.lc?19:17}" fill="${B}" textLength="${tw}" lengthAdjust="spacingAndGlyphs">${b.name}</text></g>`};
}
function sponsorSVG(sl, x, y, maxW){
  if(!sl || sl.logo==='none') return '';
  if(sl.logo==='text'){
    if(!sl.text) return '';
    const fs=26*sl.size;
    return `<g transform="translate(${x} ${y})">${textSVG(sl.text.toUpperCase(),0,fs*.35,fs,"'Arial Black', Arial, sans-serif",sl.color,'none',0,maxW)}</g>`;
  }
  let inner, w;
  if(sl.logo==='custom'){
    if(!sl.image) return '';
    w=120; inner=`<image href="${sl.image}" x="-60" y="-20" width="120" height="40" preserveAspectRatio="xMidYMid meet"/>`;
  }else{
    const b=BRANDS.find(b=>b.id===sl.logo); if(!b) return '';
    ({w,svg:inner}=brandSVG(b,sl));
  }
  const pad = sl.plate ? 12 : 0;
  const k = Math.min(sl.size, maxW/(w+pad));
  const plate = sl.plate ? `<rect x="${-w/2-6}" y="-15" width="${w+12}" height="30" rx="7" fill="${sl.plateColor}" stroke="#000" stroke-opacity=".18"/>` : '';
  return `<g transform="translate(${x} ${y}) scale(${k.toFixed(3)})">${plate}${inner}</g>`;
}

function crestSVG(c){
  if(!c.show) return '';
  const x = c.pos==='left'?152 : c.pos==='right'?248 : 200;
  let g='';
  if(c.image) g=`<image href="${c.image}" x="-24" y="-24" width="48" height="48" preserveAspectRatio="xMidYMid meet"/>`;
  else{
    let shape;
    if(c.type==='shield') shape=`<path d="M-18 -20 L18 -20 L18 4 Q18 20 0 28 Q-18 20 -18 4 Z" fill="${c.c1}" stroke="${c.c2}" stroke-width="2.5" stroke-linejoin="round"/>`;
    else if(c.type==='round') shape=`<circle r="21" fill="${c.c1}" stroke="${c.c2}" stroke-width="2.5"/>`;
    else if(c.type==='diamond') shape=`<path d="M0 -25 L22 0 L0 25 L-22 0 Z" fill="${c.c1}" stroke="${c.c2}" stroke-width="2.5" stroke-linejoin="round"/>`;
    else { // étoile
      let pts=''; for(let i=0;i<10;i++){const r=i%2?10:24,a=-Math.PI/2+i*Math.PI/5;pts+=`${(r*Math.cos(a)).toFixed(1)},${(r*Math.sin(a)).toFixed(1)} `;}
      shape=`<polygon points="${pts}" fill="${c.c1}" stroke="${c.c2}" stroke-width="2" stroke-linejoin="round"/>`;
    }
    const ty = c.type==='shield'? 5 : 5;
    g = shape + (c.letters?`<text y="${ty}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${c.letters.length>2?11:14}" fill="${c.c2}">${esc(c.letters)}</text>`:'');
  }
  return `<g transform="translate(${x} 118) scale(${c.size})">${g}</g>`;
}

function textSVG(str,x,y,size,fam,fill,stroke,sw,maxW){
  if(!str) return '';
  const est = str.length*size*0.62;
  const fit = est>maxW ? ` textLength="${maxW}" lengthAdjust="spacingAndGlyphs"` : '';
  return `<text x="${x}" y="${y}" text-anchor="middle" font-family="${fam}" font-weight="700" font-size="${size}" fill="${fill}" stroke="${sw>0?stroke:'none'}" stroke-width="${sw*2}" paint-order="stroke" stroke-linejoin="round"${fit}>${esc(str)}</text>`;
}

function jerseySVG(s, side, bare){
  const id = 'j'+(++uid);
  const long = s.sleeve==='long';
  const A = long ? {x1:30,y1:318,x2:84,y2:330,pit:165,seam:350} : {x1:22,y1:162,x2:78,y2:190,pit:148,seam:215};
  const front = side==='front';
  let neckD;
  if(!front) neckD='Q200 74 140 45';
  else if(s.neck==='round') neckD='Q200 125 140 45';
  else if(s.neck==='v') neckD='L200 120 L140 45';
  else neckD='L200 98 L140 45';
  const d = `M140 45 L62 82 L${A.x1} ${A.y1} L${A.x2} ${A.y2} L100 ${A.pit} L100 396 Q200 416 300 396 L300 ${A.pit} L${400-A.x2} ${A.y2} L${400-A.x1} ${A.y1} L338 82 L260 45 ${neckD} Z`;
  const neckLine = `M260 45 ${neckD.replace(/ L140 45$/,' L140 45')}`;
  const {c1} = s.colors;
  const pat = patternSVG(s);
  const defs = pat.defs.replace('GRAD','G'+id);
  const bodyPat = pat.body.replace('url(#GRAD)',`url(#G${id})`);

  const sleeveL = `0,0 138,0 138,47 100,${A.pit} 100,${A.seam} 0,${A.seam}`;
  const sleeveR = `400,0 262,0 262,47 300,${A.pit} 300,${A.seam} 400,${A.seam}`;

  let o = `<defs>${defs}
    <clipPath id="c${id}"><path d="${d}"/></clipPath>
    <linearGradient id="h${id}" x1="0" x2="1">
      <stop offset="0" stop-color="#000" stop-opacity=".30"/><stop offset=".2" stop-color="#000" stop-opacity=".02"/>
      <stop offset=".45" stop-color="#fff" stop-opacity=".10"/><stop offset=".8" stop-color="#000" stop-opacity=".03"/>
      <stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>
    <linearGradient id="v${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset=".6" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>`;
  o += `<g clip-path="url(#c${id})">`;
  o += `<rect width="400" height="440" fill="${c1}"/>${bodyPat}`;
  if(s.sleeveSolid) o += `<polygon points="${sleeveL}" fill="${s.sleeveColor}"/><polygon points="${sleeveR}" fill="${s.sleeveColor}"/>`;
  // épaulettes
  if(s.shoulderOn) o += `<path d="M140 45 L62 82 M260 45 L338 82" stroke="${s.shoulder}" stroke-width="16" fill="none"/>`;
  // poignets
  o += `<path d="M${A.x1} ${A.y1} L${A.x2} ${A.y2} M${400-A.x1} ${A.y1} L${400-A.x2} ${A.y2}" stroke="${s.trim}" stroke-width="${long?26:22}" fill="none"/>`;
  // col
  if(s.neck!=='polo' || !front) o += `<path d="${neckLine}" stroke="${s.collar}" stroke-width="20" fill="none" stroke-linejoin="miter"/>`;
  else o += `<path d="${neckLine}" stroke="${s.collar}" stroke-width="12" fill="none"/>`;
  // ombrages
  o += `<rect width="400" height="440" fill="url(#h${id})"/><rect width="400" height="440" fill="url(#v${id})"/>`;
  o += `<path d="M138 48 L100 ${A.pit} M262 48 L300 ${A.pit}" stroke="#000" stroke-opacity=".22" stroke-width="1.6" fill="none"/>`;
  o += `<path d="M128 170 Q140 290 124 392 M272 170 Q260 290 276 392" stroke="#000" stroke-opacity=".07" stroke-width="7" fill="none"/>`;
  o += `<path d="M168 215 Q200 232 232 215" stroke="#fff" stroke-opacity=".06" stroke-width="10" fill="none"/>`;
  o += `</g>`;
  o += `<path d="${d}" fill="none" stroke="#000" stroke-opacity=".38" stroke-width="1.6" stroke-linejoin="round"/>`;
  // polo : rabats
  if(front && s.neck==='polo'){
    o += `<g stroke="#000" stroke-opacity=".35" stroke-width="1.2" stroke-linejoin="round">
      <path d="M128 38 L200 100 L184 124 L112 62 Z" fill="${s.collar}"/>
      <path d="M272 38 L200 100 L216 124 L288 62 Z" fill="${s.collar}"/></g>
      <rect x="195" y="98" width="10" height="56" rx="2" fill="${c1}" stroke="#000" stroke-opacity=".25"/>
      <circle cx="200" cy="112" r="2.4" fill="#000" fill-opacity=".45"/><circle cx="200" cy="136" r="2.4" fill="#000" fill-opacity=".45"/>`;
  }
  if(!bare){
    const t = s.text, fam = FONTS[t.font][1];
    if(front){
      o += crestSVG(s.crest);
      o += sponsorSVG(s.sp.chest,200,195,170) + sponsorSVG(s.sp.maker,248,114,44);
      if(t.frontNumber && t.number) o += textSVG(t.number,200,362,48,fam,t.fill,t.stroke,t.sw*.6,80);
    }else{
      o += textSVG((t.name||'').toUpperCase(),200,112,Math.min(36,176/Math.max(1,(t.name||'').length*.6)),fam,t.fill,t.stroke,t.sw*.7,176);
      o += textSVG(t.number||'',200,290,160,fam,t.fill,t.stroke,t.sw*1.5,180);
      o += sponsorSVG(s.sp.back,200,345,150);
    }
    const sx = long?66:60, sy = long?235:130;
    o += sponsorSVG(s.sp.sleeveL,sx,sy,40) + sponsorSVG(s.sp.sleeveR,400-sx,sy,40);
  }
  return o;
}

function shortsSVG(s){
  const id='s'+(++uid);
  const k=s.kit;
  return `<defs><clipPath id="${id}"><path d="M108 372 L292 372 L308 528 L214 540 L200 470 L186 540 L92 528 Z"/></clipPath></defs>
  <g clip-path="url(#${id})"><rect x="80" y="360" width="240" height="200" fill="${k.shorts}"/>
    <path d="M108 372 L92 528 M292 372 L308 528" stroke="${k.shortsTrim}" stroke-width="22" fill="none"/>
    <path d="M92 528 L186 540 M308 528 L214 540" stroke="${k.shortsTrim}" stroke-width="10" fill="none"/>
    <rect x="80" y="360" width="240" height="200" fill="#000" opacity=".07"/>
    <path d="M200 395 L200 470" stroke="#000" stroke-opacity=".3" stroke-width="2"/></g>
  <path d="M108 372 L292 372 L308 528 L214 540 L200 470 L186 540 L92 528 Z" fill="none" stroke="#000" stroke-opacity=".38" stroke-width="1.6" stroke-linejoin="round"/>`+sponsorSVG(s.sp.shorts,146,452,56);
}
function sockSVG(s){
  const k=s.kit; const id='k'+(++uid);
  const sock = `<path d="M122 566 L182 566 L178 770 Q176 806 140 812 L102 812 Q92 786 114 770 Z"/>`;
  return `<defs><clipPath id="${id}">${sock}</clipPath></defs>
  <g clip-path="url(#${id})"><rect x="90" y="560" width="100" height="260" fill="${k.socks}"/>
    <rect x="90" y="566" width="100" height="26" fill="${k.socksTrim}"/><rect x="90" y="592" width="100" height="6" fill="${k.socksTrim}" opacity=".7"/>
    <rect x="90" y="560" width="100" height="260" fill="#000" opacity=".06"/></g>
  <g fill="none" stroke="#000" stroke-opacity=".38" stroke-width="1.6" stroke-linejoin="round">${sock.replace('/>',' />')}</g>`;
}

function renderSVG(s, view, opt={}){
  let vb, inner='';
  if(view==='front'||view==='back'){ vb=[-20,0,440,440]; inner=jerseySVG(s,view,opt.bare); }
  else if(view==='both'){ vb=[-20,0,860,440]; inner=`<g>${jerseySVG(s,'front',opt.bare)}</g><g transform="translate(420 0)">${jerseySVG(s,'back',opt.bare)}</g>`; }
  else { vb=[-20,0,440,830];
    inner=shortsSVG(s)+`<g transform="translate(0 0)">${sockSVG(s)}</g><g transform="translate(400 0) scale(-1 1)">${sockSVG(s)}</g>`+jerseySVG(s,'front',opt.bare); }
  const bg = opt.bg ? `<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="${opt.bg}"/>` : '';
  const size = opt.w ? ` width="${opt.w}" height="${Math.round(opt.w*vb[3]/vb[2])}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}"${size}>${bg}${inner}</svg>`;
}

