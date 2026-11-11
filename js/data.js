/* ================= Données ================= */
const FONTS = [
  ["Impact",        "Impact, 'Arial Narrow Bold', 'Haettenschweiler', sans-serif"],
  ["Arial Black",   "'Arial Black', 'Arial Bold', Gadget, sans-serif"],
  ["Segoe Black",   "'Segoe UI Black', 'Segoe UI', Arial, sans-serif"],
  ["Verdana",       "Verdana, Geneva, sans-serif"],
  ["Trebuchet",     "'Trebuchet MS', Helvetica, sans-serif"],
  ["Georgia",       "Georgia, 'Times New Roman', serif"],
  ["Courier",       "'Courier New', Courier, monospace"]
];
const PATTERNS = [
  ['solid','Uni'],['stripes-v','Rayures'],['stripes-thin','Fines'],['hoops','Cerceaux'],
  ['band-v','Bande'],['band-h','Poitrine'],['sash','Écharpe'],['half','Moitié'],
  ['quarters','Quartiers'],['chevron','Chevrons'],['checker','Damier'],['diamonds','Losanges'],['gradient','Dégradé']
];
const PALETTE = ['#ffffff','#111111','#d7263d','#0b3d91','#1e88e5','#87ceeb','#f4d35e','#c9a227',
                 '#0a8f4d','#0f5132','#ff7a00','#7b2cbf','#8d0f2c','#f78fb3','#9aa0a6','#3a1c71'];

const slot = o => Object.assign({logo:'none', text:'SPONSOR', size:1, color:'#111111', mono:false, plate:true, plateColor:'#ffffff', image:null}, o||{});
const DEFAULT = {
  neck:'round', sleeve:'short', pattern:'stripes-v', density:7,
  colors:{c1:'#ffffff', c2:'#d7263d', c3:'#111111'},
  collar:'#d7263d', trim:'#d7263d',
  shoulderOn:false, shoulder:'#111111',
  sleeveSolid:false, sleeveColor:'#d7263d',
  text:{name:'DUPONT', number:'9', font:0, fill:'#111111', stroke:'#ffffff', sw:2, frontNumber:true},
  crest:{show:true, type:'shield', pos:'left', size:1, c1:'#d7263d', c2:'#ffffff', letters:'FC', image:null},
  sp:{ chest:slot({logo:'volta'}), back:slot(), sleeveL:slot(), sleeveR:slot(), maker:slot(), shorts:slot() },
  kit:{shorts:'#111111', shortsTrim:'#d7263d', socks:'#d7263d', socksTrim:'#ffffff'},
  view:'both', kit3d:false
};
const clone = o => JSON.parse(JSON.stringify(o));
function merge(t, s){ for(const k in s){ if(s[k] && typeof s[k]==='object' && !Array.isArray(s[k])) t[k]=merge(t[k]||{}, s[k]); else t[k]=s[k]; } return t; }

// Préréglages : [nom, motif, densité, c1, c2, c3, col/liseré, encolure, texte]
const PRESET_DEFS = [
  ['Classique','stripes-v',7,'#ffffff','#d7263d','#111111','#d7263d','round','#111111'],
  ['Azur','stripes-v',9,'#87ceeb','#ffffff','#0b3d91','#0b3d91','v','#0b3d91'],
  ['Nocturne','solid',7,'#111111','#c9a227','#111111','#c9a227','polo','#c9a227'],
  ['Cerceaux','hoops',8,'#ffffff','#0a8f4d','#111111','#0a8f4d','round','#111111'],
  ['Écarlate','sash',7,'#d7263d','#ffffff','#111111','#ffffff','v','#ffffff'],
  ['Marine','half',7,'#0b3d91','#87ceeb','#ffffff','#ffffff','round','#ffffff'],
  ['Orange','chevron',7,'#ff7a00','#111111','#ffffff','#111111','polo','#111111'],
  ['Violet','checker',9,'#7b2cbf','#f4d35e','#ffffff','#f4d35e','round','#ffffff'],
  ['Sunset','gradient',7,'#f4d35e','#d7263d','#3a1c71','#3a1c71','v','#ffffff'],
  ['Bande','band-v',7,'#0f5132','#ffffff','#f4d35e','#f4d35e','polo','#ffffff'],
  ['Poitrine','band-h',7,'#1e88e5','#ffffff','#111111','#111111','round','#111111'],
  ['Losanges','diamonds',7,'#8d0f2c','#0b3d91','#f4d35e','#f4d35e','v','#f4d35e']
];
const PRESETS = PRESET_DEFS.map(([name,pattern,density,c1,c2,c3,collar,neck,fill])=>{
  const dark = c1==='#111111'||c1==='#0b3d91'||c1==='#7b2cbf'||c1==='#8d0f2c'||c1==='#0f5132';
  return {name, s: merge(clone(DEFAULT), {
    pattern, density, neck, colors:{c1,c2,c3}, collar, trim:collar,
    text:{fill, stroke: dark?'#111111':'#ffffff'},
    crest:{c1:c3===c1?c2:c3, c2:c1},
    sp:{chest:{color:fill}},
    kit:{shorts: dark?c1:c3, shortsTrim:c2, socks:c2, socksTrim:c1}
  })};
});

