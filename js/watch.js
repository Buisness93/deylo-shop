// Royal Oak (reference 15510ST) — reconstitution 3D entierement procedurale, a but
// educatif, pour la fiche produit Deylo Shop (aucun modele a charger) : boite tonneau,
// joint noir apparent, lunette octogonale satinee a chanfreins polis et 8 vis
// hexagonales, cadran Grande Tapisserie en relief, guichet de date, index et
// aiguilles luminescents, bracelet integre a maillons satines/polis, et au dos un
// calibre detaille (platine perlee, ponts Cotes de Geneve, rouages, echappement,
// balancier a 4 Hz, masse oscillante en or).
import * as THREE from 'three';

const TAU = Math.PI * 2;

// ---------- Finitions ----------
export const VARIANTS = {
  acier: {
    name: 'Acier · cadran bleu', ref: '15510ST', sub: 'Acier inoxydable · Grande Tapisserie « Bleu Nuit, Nuage 50 »',
    kind: 'metal', metal: 0xdfe3e8, trim: 0xe9ecf0,
    dial: '#1b3263', print: '#f2f4f8', date: ['#f4f4f2', '#141414'], glow: '#5c7fd6',
  },
  or: {
    name: 'Or rose', ref: '', sub: 'Or rose 18 carats · Grande Tapisserie or rose',
    kind: 'metal', metal: 0xe9b08f, trim: 0xf0bf9f,
    dial: '#c68d6d', print: '#3c2416', date: ['#f6efe8', '#2b1a10'], glow: '#e7a37c',
  },
  ceramique: {
    name: 'Céramique noire', ref: '', sub: 'Céramique noire · cadran ardoise (version d\u2019étude)',
    kind: 'ceramic', metal: 0x0d0d0e, trim: 0xd9dde2,
    dial: '#2b2d31', print: '#eef0f3', date: ['#111214', '#eef0f3'], glow: '#8c96a8',
  },
};

// ---------- Outils canvas ----------
function canvasTex(w, h, draw, srgb = true){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if(srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const shade = (hex, k)=>{ const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };

// Grande Tapisserie : pyramides tronquees en grille (carte de normales + couleur)
const TAP_CELLS = 34;
function tapisserieMaps(color){
  const S = 2048, n = TAP_CELLS, c = S / n, g = c * 0.13, b = c * 0.2;
  const normal = canvasTex(S, S, (x)=>{
    x.fillStyle = 'rgb(128,128,255)'; x.fillRect(0, 0, S, S);
    for(let i = 0; i < n; i++) for(let j = 0; j < n; j++){
      const x0 = i * c + g / 2, y0 = j * c + g / 2, x1 = x0 + c - g, y1 = y0 + c - g;
      const poly = (pts, col)=>{ x.fillStyle = col; x.beginPath(); x.moveTo(pts[0], pts[1]); for(let k = 2; k < pts.length; k += 2) x.lineTo(pts[k], pts[k + 1]); x.closePath(); x.fill(); };
      poly([x0, y0, x1, y0, x1 - b, y0 + b, x0 + b, y0 + b], 'rgb(128,214,222)'); // face haute (vers +y)
      poly([x0, y1, x1, y1, x1 - b, y1 - b, x0 + b, y1 - b], 'rgb(128,42,222)');  // face basse
      poly([x0, y0, x0 + b, y0 + b, x0 + b, y1 - b, x0, y1], 'rgb(42,128,222)');  // face gauche
      poly([x1, y0, x1 - b, y0 + b, x1 - b, y1 - b, x1, y1], 'rgb(214,128,222)'); // face droite
    }
  }, false);
  const map = canvasTex(S, S, (x)=>{
    x.fillStyle = shade(color, 0.55); x.fillRect(0, 0, S, S);
    for(let i = 0; i < n; i++) for(let j = 0; j < n; j++){
      const x0 = i * c + g / 2, y0 = j * c + g / 2, w = c - g;
      x.fillStyle = shade(color, 0.92 + Math.random() * 0.08); x.fillRect(x0, y0, w, w);
      x.fillStyle = shade(color, 1.08); x.fillRect(x0 + b, y0 + b, w - 2 * b, w - 2 * b);
    }
    // degrade radial tres doux : plus clair au centre comme un vrai cadran
    const rg = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    rg.addColorStop(0, 'rgba(255,255,255,.07)'); rg.addColorStop(1, 'rgba(0,0,0,.28)');
    x.fillStyle = rg; x.fillRect(0, 0, S, S);
  });
  return { normal, map };
}

// Impressions du cadran (calque transparent) : logo, mentions, minuterie
function printTexture(v){
  return canvasTex(2048, 2048, (g, W)=>{
    const c = W / 2;
    g.fillStyle = v.print; g.strokeStyle = v.print; g.textAlign = 'center'; g.textBaseline = 'middle';
    for(let i = 0; i < 60; i++){
      const a = (i / 60) * TAU - Math.PI / 2, big = i % 5 === 0;
      const r1 = c * 0.985, r2 = c * (big ? 0.94 : 0.958);
      g.lineWidth = big ? 7 : 3.5; g.globalAlpha = big ? 1 : 0.8;
      g.beginPath(); g.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); g.lineTo(c + Math.cos(a) * r2, c + Math.sin(a) * r2); g.stroke();
    }
    g.globalAlpha = 1;
    // signature sous le logo AP applique (le logo lui-meme est en relief, voir addLogo)
    g.font = '500 50px "Jost", Arial, sans-serif'; g.letterSpacing = '10px';
    g.fillText('AUDEMARS PIGUET', c + 5, c - c * 0.4);
    g.font = '500 30px "Jost", Arial, sans-serif'; g.letterSpacing = '10px'; g.globalAlpha = 0.92;
    g.fillText('AUTOMATIC', c + 5, c + c * 0.4);
    g.font = '400 20px "Jost", Arial, sans-serif'; g.letterSpacing = '6px'; g.globalAlpha = 0.8;
    g.fillText('SWISS MADE', c + 3, c + c * 0.905);
  });
}
function flangeTexture(color, base){
  return canvasTex(4096, 128, (g, W, H)=>{
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    g.fillStyle = color;
    for(let i = 0; i < 300; i++){
      const x = (i / 300) * W, big = i % 25 === 0, mid = i % 5 === 0;
      g.globalAlpha = big ? 1 : mid ? 0.85 : 0.5;
      g.fillRect(x - (big ? 3 : 1.5), big ? 18 : mid ? 46 : 70, big ? 6 : 3, H);
    }
  });
}
function dateTexture(v){
  const d = new Date().getDate();
  return canvasTex(256, 192, (g, W, H)=>{
    g.fillStyle = v.date[0]; g.fillRect(0, 0, W, H);
    g.fillStyle = v.date[1]; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 150px "Jost", Arial, sans-serif';
    g.fillText(String(d), W / 2, H / 2 + 8);
  });
}
// Platine perlee
function perlageTexture(){
  return canvasTex(1024, 1024, (g, W)=>{
    g.fillStyle = '#c4c7cb'; g.fillRect(0, 0, W, W);
    for(let y = 0; y < W + 30; y += 26) for(let x = (y / 26) % 2 ? 13 : 0; x < W + 30; x += 26){
      const rg = g.createRadialGradient(x - 4, y - 4, 0, x, y, 19);
      rg.addColorStop(0, '#f1f2f4'); rg.addColorStop(0.5, '#bdc0c5'); rg.addColorStop(0.85, '#a9adb2'); rg.addColorStop(1, 'rgba(180,183,188,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, 19, 0, TAU); g.fill();
    }
  });
}
// Cotes de Geneve (+ texte grave optionnel)
function cotesTexture(base, text){
  return canvasTex(1024, 1024, (g, W)=>{
    g.fillStyle = base; g.fillRect(0, 0, W, W);
    g.save(); g.translate(W / 2, W / 2); g.rotate(-0.45); g.translate(-W, -W);
    for(let x = 0; x < W * 2; x += 56){
      const lg = g.createLinearGradient(x, 0, x + 56, 0);
      lg.addColorStop(0, 'rgba(0,0,0,.2)'); lg.addColorStop(0.4, 'rgba(255,255,255,.4)'); lg.addColorStop(0.55, 'rgba(255,255,255,.1)'); lg.addColorStop(1, 'rgba(0,0,0,.22)');
      g.fillStyle = lg; g.fillRect(x, 0, 56, W * 2);
    }
    g.restore();
    if(text){
      g.fillStyle = 'rgba(30,20,10,.6)'; g.textAlign = 'center'; g.textBaseline = 'middle';
      text.forEach(([s, y, f])=>{ g.font = f; g.letterSpacing = '10px'; g.fillText(s, W / 2, y); });
    }
  });
}
// Fond de boite : gravure circulaire
function casebackTexture(){
  return canvasTex(2048, 2048, (g, W)=>{
    const c = W / 2;
    g.fillStyle = '#d6d9dd'; g.fillRect(0, 0, W, W);
    // satinage circulaire
    for(let r = c * 0.6; r < c; r += 2){ g.strokeStyle = 'rgba(' + (Math.random() < 0.5 ? '255,255,255' : '0,0,0') + ',' + (Math.random() * 0.08) + ')'; g.lineWidth = 1.5; g.beginPath(); g.arc(c, c, r, 0, TAU); g.stroke(); }
    g.fillStyle = 'rgba(40,42,46,.75)'; g.font = '500 44px "Jost", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const txt = 'AUDEMARS PIGUET  ·  ROYAL OAK  ·  STAINLESS STEEL  ·  WATER RESISTANT 50 M  ·  N° 0427  ·  ';
    const rr = c * 0.73, chars = [...txt];
    chars.forEach((ch, i)=>{
      const a = -Math.PI / 2 + (i / chars.length) * TAU;
      g.save(); g.translate(c + Math.cos(a) * rr, c + Math.sin(a) * rr); g.rotate(a + Math.PI / 2); g.fillText(ch, 0, 0); g.restore();
    });
  });
}

// Grain de satinage : micro-rayures paralleles (carte de rugosite, sens du brossage)
function brushTexture(vertical){
  const t = canvasTex(1024, 1024, (g, W)=>{
    g.fillStyle = 'rgb(150,150,150)'; g.fillRect(0, 0, W, W);
    for(let i = 0; i < 2600; i++){
      const y = Math.random() * W, v = 110 + Math.random() * 90, len = 80 + Math.random() * 600, x = Math.random() * W;
      g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      g.fillRect(x, y, len, Math.random() < 0.85 ? 1 : 2);
    }
  }, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.6, 0.6);
  if(vertical){ t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; }
  return t;
}

// ---------- Geometries ----------
function extrude(shape, depth, bevel, segs = 3, curve = 24){
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled:!!bevel, bevelThickness:bevel || 0, bevelSize:bevel || 0, bevelSegments:segs, curveSegments:curve });
}
function lathe(profile, seg = 200){
  const g = new THREE.LatheGeometry(profile.map(([r, z])=>new THREE.Vector2(r, z)), seg);
  g.rotateX(Math.PI / 2);
  return g;
}
function roundedPoly(n, R, cr, rot = 0, path = new THREE.Shape()){
  const v = [];
  for(let i = 0; i < n; i++){ const a = rot + (i / n) * TAU; v.push(new THREE.Vector2(Math.cos(a) * R, Math.sin(a) * R)); }
  for(let i = 0; i < n; i++){
    const p = v[(i + n - 1) % n], c = v[i], q = v[(i + 1) % n];
    const s = c.clone().add(p.clone().sub(c).normalize().multiplyScalar(cr));
    const e = c.clone().add(q.clone().sub(c).normalize().multiplyScalar(cr));
    if(i === 0) path.moveTo(s.x, s.y); else path.lineTo(s.x, s.y);
    path.quadraticCurveTo(c.x, c.y, e.x, e.y);
  }
  path.closePath();
  return path;
}
function roundedRect(w, h, r, path = new THREE.Shape()){
  const x = -w / 2, y = -h / 2;
  path.moveTo(x + r, y); path.lineTo(x + w - r, y); path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r); path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h); path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r); path.quadraticCurveTo(x, y, x + r, y);
  return path;
}
function circlePath(r){ const p = new THREE.Path(); p.absarc(0, 0, r, 0, TAU, true); return p; }
// roue dentee (rouage / echappement) avec bras evides
function wheelShape(r, teeth, spokes, hub){
  const s = new THREE.Shape();
  for(let i = 0; i <= teeth * 2; i++){
    const a = (i / (teeth * 2)) * TAU, rr = i % 2 ? r : r * 0.9;
    i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(rr, 0);
  }
  for(let k = 0; k < spokes; k++){
    const a0 = (k / spokes) * TAU + 0.18, a1 = ((k + 1) / spokes) * TAU - 0.18, h = new THREE.Path();
    h.moveTo(Math.cos(a0) * hub * 1.6, Math.sin(a0) * hub * 1.6); h.absarc(0, 0, r * 0.72, a0, a1, false); h.closePath();
    s.holes.push(h);
  }
  return s;
}

// ---------- Montre ----------
export function createWatch(){
  const root = new THREE.Group();
  const watch = new THREE.Group(); root.add(watch);
  const M = {};

  // Metal : satine (brossage anisotrope) pour les grandes faces, poli miroir pour les chanfreins
  M.satin = new THREE.MeshPhysicalMaterial({ metalness:1, roughness:0.3, anisotropy:0.85, anisotropyRotation:0, roughnessMap:brushTexture(false) });
  M.satinV = new THREE.MeshPhysicalMaterial({ metalness:1, roughness:0.3, anisotropy:0.85, anisotropyRotation:Math.PI / 2, roughnessMap:brushTexture(true) });
  M.polish = new THREE.MeshPhysicalMaterial({ metalness:1, roughness:0.06, clearcoat:0.4, clearcoatRoughness:0.04 });
  M.flank = new THREE.MeshPhysicalMaterial({ metalness:1, roughness:0.34, anisotropy:0.7, anisotropyRotation:0, roughnessMap:brushTexture(false) });
  M.trim = new THREE.MeshPhysicalMaterial({ metalness:1, roughness:0.08 });             // vis, index, aiguilles (or gris/rose)
  M.gasket = new THREE.MeshStandardMaterial({ color:0x0a0a0b, roughness:0.55, metalness:0 });
  M.dial = new THREE.MeshPhysicalMaterial({ metalness:0.35, roughness:0.36, clearcoat:0.5, clearcoatRoughness:0.15, normalScale:new THREE.Vector2(0.9, 0.9) });
  M.print = new THREE.MeshStandardMaterial({ transparent:true, roughness:0.5, metalness:0, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2 });
  M.flange = new THREE.MeshStandardMaterial({ roughness:0.45, metalness:0.3, side:THREE.DoubleSide });
  M.lume = new THREE.MeshStandardMaterial({ color:0xeef3ea, roughness:0.55, emissive:0x6fffd2, emissiveIntensity:0 });
  M.date = new THREE.MeshStandardMaterial({ roughness:0.5 });
  M.crystal = new THREE.MeshPhysicalMaterial({ transmission:1, roughness:0, ior:1.77, thickness:0.05, metalness:0, clearcoat:1, specularIntensity:0.75, specularColor:new THREE.Color(0xb9d0ff), envMapIntensity:1.4 });
  M.inner = new THREE.MeshStandardMaterial({ color:0x08080a, roughness:0.85, side:THREE.BackSide });
  M.plate = new THREE.MeshStandardMaterial({ map:perlageTexture(), metalness:0.85, roughness:0.36 });
  M.bridge = new THREE.MeshStandardMaterial({ map:cotesTexture('#c9ccd1', [['CALIBRE 4302', 600, '500 44px "Jost", Arial, sans-serif'], ['32 JEWELS · SWISS MADE', 660, '400 28px "Jost", Arial, sans-serif']]), metalness:0.9, roughness:0.28 });
  M.bridgeSide = new THREE.MeshStandardMaterial({ color:0xd7dadf, metalness:1, roughness:0.12 });
  M.rotor = new THREE.MeshStandardMaterial({ map:cotesTexture('#d0a066', [['AUDEMARS PIGUET', 300, '500 46px "Jost", Arial, sans-serif'], ['22K GOLD', 362, '400 26px "Jost", Arial, sans-serif']]), metalness:1, roughness:0.22 });
  M.gold = new THREE.MeshStandardMaterial({ color:0xdcae68, metalness:1, roughness:0.18 });
  M.ruby = new THREE.MeshPhysicalMaterial({ color:0xc0122f, roughness:0.04, metalness:0, clearcoat:1, transmission:0.35, thickness:0.04, ior:1.76 });
  M.blued = new THREE.MeshStandardMaterial({ color:0x1b3a9a, metalness:1, roughness:0.2 });
  M.slot = new THREE.MeshStandardMaterial({ color:0x111111, roughness:0.8 });
  M.caseback = new THREE.MeshStandardMaterial({ map:casebackTexture(), metalness:1, roughness:0.32, side:THREE.DoubleSide });

  const shadowy = (m)=>{ m.castShadow = true; m.receiveShadow = true; return m; };
  const add = (geo, mat, parent = watch)=>{ const m = shadowy(new THREE.Mesh(geo, mat)); parent.add(m); return m; };

  // --- Boite tonneau : faces satinees, flancs et chanfreins polis
  { const s = new THREE.Shape();
    const outline = (k, sh = new THREE.Shape())=>{
      const X = 1.97 * k, Y = 2.08 * k, F = 1.18 * k;
      sh.moveTo(-F, Y); sh.lineTo(F, Y);
      sh.bezierCurveTo(F + 0.48 * k, Y, X, 1.3 * k, X, 0); sh.bezierCurveTo(X, -1.3 * k, F + 0.48 * k, -Y, F, -Y);
      sh.lineTo(-F, -Y); sh.bezierCurveTo(-F - 0.48 * k, -Y, -X, -1.3 * k, -X, 0); sh.bezierCurveTo(-X, 1.3 * k, -F - 0.48 * k, Y, -F, Y);
      sh.holes.push(circlePath(1.5));
      return sh;
    };
    // corps : flancs satines verticaux, fond plat
    const body = extrude(outline(1), 0.568, 0, 1, 64); body.translate(0, 0, -0.42);
    add(body, [M.satinV, M.flank]);
    // arete superieure : chanfrein poli a 45 degres, dessus satine
    const top = extrude(outline(0.975), 0.002, 0.05, 1, 64); top.translate(0, 0, 0.148);
    add(top, [M.satinV, M.polish]);
  }
  add(new THREE.CylinderGeometry(1.5, 1.5, 0.6, 96, 1, true).rotateX(Math.PI / 2).translate(0, 0, -0.1), M.inner);
  // --- Joint noir apparent entre boite et lunette
  { const s = roundedPoly(8, 2.06, 0.4, Math.PI / 8); s.holes.push(circlePath(1.5));
    const g = extrude(s, 0.045, 0, 1, 64); g.translate(0, 0, 0.2); add(g, M.gasket); }
  // --- Lunette octogonale (plats a 12/3/6/9 h) : dessus satine, chanfreins polis
  { const s = roundedPoly(8, 1.97, 0.36, Math.PI / 8); s.holes.push(circlePath(1.47));
    const g = extrude(s, 0.1, 0.038, 5, 96); g.translate(0, 0, 0.283);
    add(g, [M.satin, M.polish]); }
  // --- 8 vis hexagonales en or gris, toutes alignees dans le meme sens (detail d'origine)
  const screwGeo = new THREE.CylinderGeometry(0.078, 0.078, 0.03, 6).rotateX(Math.PI / 2);
  for(let k = 0; k < 8; k++){
    const a = Math.PI / 8 + k * Math.PI / 4;
    const m = add(screwGeo, M.trim); m.position.set(Math.cos(a) * 1.72, Math.sin(a) * 1.72, 0.428);
  }
  // --- Rehaut (minuterie inclinee)
  add(lathe([[1.47, 0.42], [1.37, 0.17]], 300), M.flange);
  // --- Cadran Grande Tapisserie + impressions
  const dial = add(new THREE.CircleGeometry(1.39, 160), M.dial); dial.position.z = 0.16;
  const print = new THREE.Mesh(new THREE.CircleGeometry(1.39, 160), M.print); print.position.z = 0.1615; watch.add(print);
  // --- Guichet de date a 3 h (cadre poli + disque)
  { const frame = roundedRect(0.36, 0.28, 0.05); frame.holes.push(roundedRect(0.27, 0.19, 0.03, new THREE.Path()));
    const m = add(extrude(frame, 0.02, 0.01, 3), M.trim); m.position.set(1.0, 0, 0.162);
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.19), M.date); d.position.set(1.0, 0, 0.1625); watch.add(d); }
  // --- Index appliques facettes + luminescence (double a midi, rien a 3 h : la date)
  { const g = extrude(roundedRect(0.075, 0.3, 0.02), 0.03, 0.014, 3);
    const lg = new THREE.BoxGeometry(0.032, 0.22, 0.012);
    for(let i = 0; i < 12; i++){
      if(i === 3) continue;
      const a = (i / 12) * TAU;
      (i === 0 ? [-0.06, 0.06] : [0]).forEach(off=>{
        const piv = new THREE.Group(); piv.rotation.z = -a; watch.add(piv);
        const m = add(g, M.trim, piv); m.position.set(off, 1.08, 0.165);
        const l = new THREE.Mesh(lg, M.lume); l.position.set(off, 1.08, 0.216); piv.add(l);
      });
    }
  }
  // --- Aiguilles baton facettees a luminescence + trotteuse a contrepoids
  const hands = {};
  const handShape = (len, w, tail)=>{ const s = new THREE.Shape(); s.moveTo(-w, -tail); s.lineTo(w, -tail); s.lineTo(w, len - w * 1.6); s.lineTo(0, len); s.lineTo(-w, len - w * 1.6); s.closePath(); return s; };
  const mkHand = (len, w, tail, z, lumeLen)=>{
    const piv = new THREE.Group(); piv.position.z = z; watch.add(piv);
    piv.add(shadowy(new THREE.Mesh(extrude(handShape(len, w, tail), 0.012, 0.009, 3), M.trim)));
    const l = new THREE.Mesh(extrude(handShape(lumeLen, w * 0.48, 0), 0.006, 0), M.lume); l.position.set(0, len - lumeLen - w * 0.6, 0.02); piv.add(l);
    return piv;
  };
  hands.h = mkHand(0.8, 0.068, 0.16, 0.215, 0.52);
  hands.m = mkHand(1.24, 0.052, 0.2, 0.248, 0.88);
  hands.s = new THREE.Group(); hands.s.position.z = 0.282; watch.add(hands.s);
  { const s = new THREE.Shape(); s.moveTo(-0.009, -0.34); s.lineTo(0.009, -0.34); s.lineTo(0.005, 1.3); s.lineTo(-0.005, 1.3); s.closePath();
    hands.s.add(shadowy(new THREE.Mesh(extrude(s, 0.006, 0.002, 2), M.trim)));
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.008), M.lume); tip.position.set(0, 1.12, 0.008); hands.s.add(tip);
    const cw = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 32).rotateX(Math.PI / 2), M.trim)); cw.position.set(0, -0.25, 0.004); hands.s.add(cw); }
  add(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 32).rotateX(Math.PI / 2).translate(0, 0, 0.24), M.trim);
  // --- Glace saphir (legerement bombee)
  { const g = new THREE.CircleGeometry(1.48, 128), p = g.attributes.position;
    for(let i = 0; i < p.count; i++){ const r = Math.hypot(p.getX(i), p.getY(i)) / 1.48; p.setZ(i, 0.405 + 0.018 * (1 - r * r)); }
    g.computeVertexNormals(); watch.add(new THREE.Mesh(g, M.crystal)); }
  // --- Couronne vissee cannelee + tube
  { const g = new THREE.CylinderGeometry(0.24, 0.24, 0.24, 120, 1), p = g.attributes.position;
    for(let i = 0; i < p.count; i++){ const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z); if(r > 0.18){ const k = 0.24 + 0.014 * Math.cos(a * 36); p.setX(i, Math.cos(a) * k); p.setZ(i, Math.sin(a) * k); } }
    g.computeVertexNormals(); g.rotateZ(Math.PI / 2);
    const crown = add(g, M.polish); crown.position.set(2.33, 0, -0.08);
    const tube = add(new THREE.CylinderGeometry(0.13, 0.13, 0.16, 40).rotateZ(Math.PI / 2), M.polish); tube.position.set(2.16, 0, -0.08);
    const capTex = canvasTex(256, 256, (g, W)=>{ g.fillStyle = '#d4d7db'; g.fillRect(0, 0, W, W); g.fillStyle = 'rgba(30,30,34,.85)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 120px Arial, sans-serif'; g.fillText('AP', W / 2, W / 2 + 6); });
    M.crownCap = new THREE.MeshStandardMaterial({ map:capTex, metalness:1, roughness:0.25 });
    const cap = add(new THREE.CircleGeometry(0.18, 48), M.crownCap); cap.rotation.y = Math.PI / 2; cap.rotation.z = Math.PI / 2; cap.position.set(2.452, 0, -0.08); }

  // --- Fond : 8 vis a fente, couronne gravee, glace saphir
  { const ring = shadowy(new THREE.Mesh(new THREE.RingGeometry(1.27, 2.02, 160, 1).rotateY(Math.PI), M.caseback)); ring.position.z = -0.425; watch.add(ring);
    const sg = new THREE.CylinderGeometry(0.075, 0.075, 0.02, 32).rotateX(Math.PI / 2), slot = new THREE.BoxGeometry(0.11, 0.02, 0.012);
    for(let k = 0; k < 8; k++){
      const a = Math.PI / 8 + k * Math.PI / 4, m = add(sg, M.trim); m.position.set(Math.cos(a) * 1.72, Math.sin(a) * 1.72, -0.432);
      const s = new THREE.Mesh(slot, M.slot); s.position.set(m.position.x, m.position.y, -0.443); s.rotation.z = a * 1.7; watch.add(s);
    }
    const sap = new THREE.Mesh(new THREE.CircleGeometry(1.28, 128).rotateY(Math.PI), M.crystal); sap.position.z = -0.43; watch.add(sap); }

  // --- Calibre (vu par le fond)
  const mv = new THREE.Group(); watch.add(mv);
  const back = (geo, mat, z, x = 0, y = 0)=>{ const m = shadowy(new THREE.Mesh(geo, mat)); m.rotation.y = Math.PI; m.position.set(x, y, z); mv.add(m); return m; };
  back(new THREE.CircleGeometry(1.45, 128), M.plate, -0.16);
  // rouages dores (sous les ponts), qui tournent lentement
  const wheels = [];
  [[0.32, 0.0, 0.3, 48, 5, 0.06, 0.25], [-0.25, -0.55, 0.24, 40, 5, 0.05, -0.6], [0.55, -0.62, 0.2, 36, 4, 0.045, 1.4]].forEach(([x, y, r, t, sp, hub, spd])=>{
    const piv = new THREE.Group(); piv.position.set(x, y, -0.19); mv.add(piv);
    const m = shadowy(new THREE.Mesh(extrude(wheelShape(r, t, sp, hub), 0.012, 0.004, 1, 12), M.gold)); m.rotation.y = Math.PI; piv.add(m);
    wheels.push({ piv, spd });
  });
  // ponts aux Cotes de Geneve (faces decorees, flancs polis)
  const bridge = (pts, z, depth = 0.045)=>{ const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(([x, y])=>s.lineTo(x, y)); s.closePath();
    return back(extrude(s, depth, 0.012, 3, 12), [M.bridge, M.bridgeSide], z); };
  bridge([[-1.38, 0.2], [-0.15, 0.32], [0.18, -0.15], [-0.05, -1.36], [-0.75, -1.2], [-1.32, -0.55]], -0.205);
  bridge([[0.1, 0.1], [1.25, 0.28], [1.4, -0.35], [0.85, -1.0], [0.25, -0.78]], -0.205);
  // chatons en or + rubis, vis bleuies a fente
  const jewel = (x, y, z = -0.268)=>{ back(new THREE.TorusGeometry(0.055, 0.016, 10, 32), M.gold, z, x, y); back(new THREE.SphereGeometry(0.036, 20, 12), M.ruby, z + 0.006, x, y); };
  [[0.9, -0.3], [0.38, -0.85], [-0.78, -0.25], [-1.0, -0.6], [0.15, 0.0], [1.1, 0.05], [-0.5, -0.95]].forEach(([x, y])=>jewel(x, y));
  { const sh = new THREE.CylinderGeometry(0.055, 0.055, 0.025, 28).rotateX(Math.PI / 2), sl = new THREE.BoxGeometry(0.08, 0.016, 0.01);
    [[1.22, -0.12], [0.62, -0.95], [-1.22, -0.4], [-0.25, -1.2], [-0.55, 0.18], [1.05, -0.62]].forEach(([x, y], i)=>{
      back(sh, M.blued, -0.268, x, y); const s = back(sl, M.slot, -0.282, x, y); s.rotation.z = i * 0.7; }); }
  // echappement : roue d'ancre bleuie qui avance par a-coups
  const esc = new THREE.Group(); esc.position.set(-0.62, 0.52, -0.21); mv.add(esc);
  { const m = shadowy(new THREE.Mesh(extrude(wheelShape(0.13, 15, 3, 0.03), 0.008, 0.002, 1, 8), M.blued)); m.rotation.y = Math.PI; esc.add(m); }
  // balancier a vis + spiral bleui + coq
  const bal = new THREE.Group(); bal.position.set(0.55, 0.6, -0.27); mv.add(bal);
  bal.add(shadowy(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.028, 14, 80), M.gold)));
  for(let k = 0; k < 2; k++){ const sp = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.6, 0.016), M.gold); sp.rotation.z = k * Math.PI / 2; bal.add(sp); }
  for(let k = 0; k < 12; k++){ const a = k * TAU / 12, sc = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 10), M.gold); sc.position.set(Math.cos(a) * 0.33, Math.sin(a) * 0.33, 0); sc.rotation.z = a + Math.PI / 2; bal.add(sc); }
  { const pts = []; for(let i = 0; i <= 600; i++){ const a = i / 600 * TAU * 11, r = 0.035 + i / 600 * 0.2; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, -0.015)); }
    bal.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color:0x2a4fb8 }))); }
  bridge([[0.98, 0.98], [0.9, 0.62], [0.42, 0.32], [0.2, 0.48], [0.52, 0.86]], -0.3, 0.035);
  jewel(0.55, 0.6, -0.348);
  // masse oscillante en or 22 ct : secteur grave + serge plus epaisse
  const rotorPiv = new THREE.Group(); rotorPiv.position.z = -0.36; mv.add(rotorPiv);
  { const rs = new THREE.Shape(); rs.absarc(0, 0, 1.24, 0.05, Math.PI - 0.05, false); rs.absarc(0, 0, 0.26, Math.PI - 0.05, 0.05, true); rs.closePath();
    const g = extrude(rs, 0.028, 0.008, 2, 64); const p = g.attributes.position, uv = g.attributes.uv;
    for(let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.6 + 0.5, p.getY(i) / 2.6 + 0.5);
    const m = shadowy(new THREE.Mesh(g, M.rotor)); m.rotation.y = Math.PI; rotorPiv.add(m);
    const rim = new THREE.Shape(); rim.absarc(0, 0, 1.24, 0.05, Math.PI - 0.05, false); rim.absarc(0, 0, 1.08, Math.PI - 0.05, 0.05, true); rim.closePath();
    const rm = shadowy(new THREE.Mesh(extrude(rim, 0.05, 0.01, 2, 64), M.gold)); rm.rotation.y = Math.PI; rm.position.z = 0.02; rotorPiv.add(rm);
    const hub = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.05, 48).rotateX(Math.PI / 2), M.gold)); hub.position.z = -0.01; rotorPiv.add(hub);
    for(let k = 0; k < 3; k++){ const a = k * TAU / 3, s = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 20).rotateX(Math.PI / 2), M.blued); s.position.set(Math.cos(a) * 0.17, Math.sin(a) * 0.17, -0.04); rotorPiv.add(s); } }

  // --- Bracelet integre : rangs de maillons lateraux satines + maillon central poli decale
  const bracelet = new THREE.Group(); watch.add(bracelet);
  { const s = new THREE.Shape(); s.moveTo(-1.2, -0.13); s.lineTo(1.2, -0.13); s.lineTo(1.15, 0.13); s.lineTo(-1.15, 0.13); s.closePath();
    const g = extrude(s, 0.26, 0.035, 4, 4); g.translate(0, 0, -0.13);
    [1, -1].forEach(dir=>{ const m = add(g, [M.satinV, M.polish], bracelet); m.position.set(0, dir * 2.2, -0.1); if(dir < 0) m.rotation.z = Math.PI; }); }
  { const R = 3.2, a0 = Math.asin(2.38 / 3.2), da = 0.1375, rows = 10, zc = -0.11 - R * Math.cos(a0);
    const frame = (a, dir)=>{
      const P = new THREE.Vector3(0, dir * R * Math.sin(a), zc + R * Math.cos(a));
      const T = new THREE.Vector3(0, dir * Math.cos(a), -Math.sin(a)).normalize();
      const N = new THREE.Vector3(0, dir * Math.sin(a), Math.cos(a)).normalize();
      return { P, m:new THREE.Matrix4().makeBasis(new THREE.Vector3(dir, 0, 0), T, N) };
    };
    const centerGeo = extrude(roundedRect(0.44, 0.24, 0.05), 0.15, 0.03, 4); centerGeo.translate(0, 0, -0.075);
    const sideCache = {};
    [1, -1].forEach(dir=>{
      for(let i = 0; i < rows; i++){
        const f = i / (rows - 1), w = 2.44 - 0.62 * f, th = 0.2 - 0.04 * f;
        const ws = (w - 0.56) / 2, key = ws.toFixed(3) + th.toFixed(3);
        if(!sideCache[key]){
          const s = new THREE.Shape(); s.moveTo(-ws / 2, -0.19); s.lineTo(ws / 2, -0.19); s.lineTo(ws / 2 - 0.015, 0.19); s.lineTo(-ws / 2 + 0.015, 0.19); s.closePath();
          const g = extrude(s, th, 0.03, 4, 4); g.translate(0, 0, -th / 2); sideCache[key] = g;
        }
        const { P, m } = frame(a0 + i * da, dir);
        [-1, 1].forEach(side=>{
          const link = shadowy(new THREE.Mesh(sideCache[key], [M.satinV, M.polish]));
          link.applyMatrix4(new THREE.Matrix4().makeTranslation(side * (0.28 + ws / 2), 0, 0).premultiply(m));
          link.position.add(P); bracelet.add(link);
        });
      }
      for(let i = -1; i < rows - 1; i++){
        const { P, m } = frame(a0 + (i + 0.5) * da, dir);
        const c = shadowy(new THREE.Mesh(centerGeo, M.polish)); c.applyMatrix4(m); c.position.add(P); bracelet.add(c);
      }
    });
  }

  // ---------- Finition ----------
  const cache = {};
  let current = 'acier';
  function setVariant(key){
    current = key;
    const v = VARIANTS[key];
    if(!cache[key]) cache[key] = { tap:tapisserieMaps(v.dial), print:printTexture(v), flange:flangeTexture(v.print, shade(v.dial, 0.75)), date:dateTexture(v) };
    const t = cache[key];
    const metal = new THREE.Color(v.metal);
    [M.satin, M.satinV, M.polish, M.flank].forEach(m=>{
      m.color.copy(metal);
      if(v.kind === 'ceramic'){ m.metalness = 0; m.clearcoat = 1; m.clearcoatRoughness = m === M.polish ? 0.03 : 0.25; m.roughness = m === M.polish ? 0.08 : 0.42; m.anisotropy = m === M.polish ? 0 : 0.5; }
      else { m.metalness = 1; m.clearcoat = m === M.polish ? 0.4 : 0; m.clearcoatRoughness = 0.04; m.roughness = m === M.polish ? 0.06 : 0.36; m.anisotropy = m === M.polish ? 0 : 0.6; }
      m.needsUpdate = true;
    });
    M.trim.color.set(v.trim);
    M.dial.map = t.tap.map; M.dial.normalMap = t.tap.normal; M.dial.color.set(0xffffff); M.dial.needsUpdate = true;
    M.print.map = t.print; M.print.needsUpdate = true;
    t.flange.wrapS = THREE.RepeatWrapping; M.flange.map = t.flange; M.flange.needsUpdate = true;
    M.date.map = t.date; M.date.needsUpdate = true;
  }
  setVariant('acier');

  // ---------- Mouvement et heure reelle ----------
  let rotorSpin = 0, rotorVel = 0, escAng = 0;
  function update(dt, t){
    const now = new Date();
    const ms = now.getMilliseconds(), s = now.getSeconds() + Math.floor(ms / 125) * 0.125;
    const m = now.getMinutes() + s / 60, h = (now.getHours() % 12) + m / 60;
    hands.s.rotation.z = -(s / 60) * TAU;
    hands.m.rotation.z = -(m / 60) * TAU;
    hands.h.rotation.z = -(h / 12) * TAU;
    bal.rotation.z = Math.sin(t * TAU * 4) * 2.3;
    // roue d'echappement : un pas a chaque alternance (8 par seconde)
    const target = -Math.floor(t * 8) * TAU / 15; escAng += (target - escAng) * Math.min(1, dt * 40); esc.rotation.z = escAng;
    wheels.forEach(w=>{ w.piv.rotation.z += w.spd * dt * 0.15; });
    rotorVel += (Math.sin(t * 0.6) * 0.5 - rotorVel) * Math.min(1, dt * 0.7);
    rotorSpin += rotorVel * dt; rotorPiv.rotation.z = rotorSpin;
  }
  function kickRotor(v){ rotorVel += v; }
  function setNight(k){ M.lume.emissiveIntensity = k * 3.2; }

  // Points d'interet (repere de la montre) avec leur normale pour savoir s'ils font face
  const hotspots = [
    { id:'screws', pos:new THREE.Vector3(Math.cos(Math.PI / 8) * 1.72, Math.sin(Math.PI / 8) * 1.72, 0.45), normal:new THREE.Vector3(0, 0, 1) },
    { id:'gasket', pos:new THREE.Vector3(-1.86, -0.6, 0.22), normal:new THREE.Vector3(-1, -0.3, 0.6) },
    { id:'tapisserie', pos:new THREE.Vector3(-0.55, -0.62, 0.17), normal:new THREE.Vector3(0, 0, 1) },
    { id:'logo', pos:new THREE.Vector3(0.16, 0.66, 0.19), normal:new THREE.Vector3(0, 0, 1) },
    { id:'date', pos:new THREE.Vector3(1.0, 0, 0.19), normal:new THREE.Vector3(0, 0, 1) },
    { id:'crown', pos:new THREE.Vector3(2.46, 0, -0.08), normal:new THREE.Vector3(1, 0, 0) },
    { id:'bracelet', pos:new THREE.Vector3(0, 2.5, 0.02), normal:new THREE.Vector3(0, 0.35, 1) },
    { id:'balance', pos:new THREE.Vector3(0.55, 0.6, -0.45), normal:new THREE.Vector3(0, 0, -1) },
    { id:'rotor', pos:new THREE.Vector3(-0.5, -0.75, -0.45), normal:new THREE.Vector3(0, 0, -1) },
  ];

  // Logo « AP » applique en or gris sous l'index de midi, extrude et facette
  function addLogo(font, TextGeometry){
    const g = new TextGeometry('AP', { font, size:0.15, depth:0.016, curveSegments:6, bevelEnabled:true, bevelThickness:0.006, bevelSize:0.005, bevelSegments:2 });
    g.computeBoundingBox(); const b = g.boundingBox; g.translate(-(b.max.x + b.min.x) / 2, -(b.max.y + b.min.y) / 2, 0);
    const m = add(g, M.trim); m.position.set(0, 0.66, 0.165);
  }

  return { root, watch, setVariant, update, kickRotor, setNight, hotspots, addLogo };
}
