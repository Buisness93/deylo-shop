// NOCTÉA — montre 3D entierement procedurale (aucun modele a charger).
// Boite, lunette, rehaut, cadran soleille, index appliques, aiguilles a l'heure
// reelle, couronne cannelee, glace saphir bombee, bracelet, et au dos un calibre
// visible : platine a Cotes de Geneve, ponts, rubis, balancier a 4 Hz et rotor.
import * as THREE from 'three';

const TAU = Math.PI * 2;

// ---------- Finitions de la collection ----------
export const VARIANTS = {
  nocturne: {
    name: 'Nocturne', sub: 'Or rose 18 carats · cadran noir onyx',
    metal: 0xe7b08f, metalRough: 0.16, brushed: 0.32,
    dial: ['#141416', '#050506'], dialText: '#e9c9b0', lume: '#efe3cf',
    strap: { kind: 'leather', color: '#121010', stitch: '#3a302a' },
  },
  abysse: {
    name: 'Abysse', sub: 'Acier 904L · cadran bleu abyssal',
    metal: 0xd9dde2, metalRough: 0.12, brushed: 0.3,
    dial: ['#1d3f78', '#071226'], dialText: '#e8eef8', lume: '#dfeaff',
    strap: { kind: 'rubber', color: '#0c1a33', stitch: null },
  },
  verdure: {
    name: 'Verdure', sub: 'Titane grade 5 · cadran vert fumé',
    metal: 0xa9aaa6, metalRough: 0.22, brushed: 0.4,
    dial: ['#2f5a43', '#08130d'], dialText: '#ece6d6', lume: '#efe7cf',
    strap: { kind: 'leather', color: '#8a5a33', stitch: '#e9dcc4' },
  },
};

// ---------- Textures dessinees au canvas ----------
function canvasTex(w, h, draw, srgb = true){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if(srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Cadran soleille : degrade + rayons brosses + impressions
function dialTexture(v){
  return canvasTex(2048, 2048, (g, W)=>{
    const c = W / 2;
    const rg = g.createRadialGradient(c, c, 0, c, c, c);
    rg.addColorStop(0, v.dial[0]); rg.addColorStop(1, v.dial[1]);
    g.fillStyle = rg; g.fillRect(0, 0, W, W);
    // brossage soleil : milliers de rayons tres fins
    for(let i = 0; i < 2400; i++){
      const a = (i / 2400) * TAU, l = Math.random() * 0.06 + 0.02;
      g.strokeStyle = (i % 2 ? 'rgba(255,255,255,' : 'rgba(0,0,0,') + l + ')';
      g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(c + Math.cos(a) * 30, c + Math.sin(a) * 30); g.lineTo(c + Math.cos(a) * c, c + Math.sin(a) * c); g.stroke();
    }
    // chemin de fer des minutes
    g.strokeStyle = v.dialText; g.fillStyle = v.dialText;
    for(let i = 0; i < 60; i++){
      const a = (i / 60) * TAU - Math.PI / 2, big = i % 5 === 0;
      const r1 = c * 0.955, r2 = c * (big ? 0.905 : 0.93);
      g.lineWidth = big ? 6 : 3; g.globalAlpha = big ? 0.9 : 0.6;
      g.beginPath(); g.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); g.lineTo(c + Math.cos(a) * r2, c + Math.sin(a) * r2); g.stroke();
    }
    g.globalAlpha = 1;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '500 92px "Cormorant Garamond", Georgia, serif';
    g.letterSpacing = '18px';
    g.fillText('NOCTÉA', c + 9, c - c * 0.36);
    g.font = '400 30px "Jost", Arial, sans-serif'; g.letterSpacing = '12px'; g.globalAlpha = 0.8;
    g.fillText('MANUFACTURE', c + 6, c - c * 0.27);
    g.fillText('AUTOMATIQUE', c + 6, c + c * 0.34);
    g.font = 'italic 400 46px "Cormorant Garamond", Georgia, serif'; g.letterSpacing = '4px'; g.globalAlpha = 0.9;
    g.fillText('Calibre N.01', c, c + c * 0.43);
    g.globalAlpha = 1;
  });
}

// Platine du calibre : Cotes de Geneve + perlage
function plateTexture(){
  return canvasTex(1024, 1024, (g, W)=>{
    g.fillStyle = '#c9ccd0'; g.fillRect(0, 0, W, W);
    // perlage : cercles concentriques qui se chevauchent
    for(let y = 0; y < W + 40; y += 34){
      for(let x = (y / 34) % 2 ? 17 : 0; x < W + 40; x += 34){
        const rg = g.createRadialGradient(x, y, 0, x, y, 24);
        rg.addColorStop(0, '#e9ebee'); rg.addColorStop(0.55, '#b9bcc1'); rg.addColorStop(1, 'rgba(200,203,207,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(x, y, 24, 0, TAU); g.fill();
      }
    }
  });
}
function stripesTexture(base){
  return canvasTex(1024, 1024, (g, W)=>{
    g.fillStyle = base; g.fillRect(0, 0, W, W);
    // Cotes de Geneve : bandes en diagonale avec reflet doux
    g.save(); g.translate(W / 2, W / 2); g.rotate(-0.5); g.translate(-W, -W);
    for(let x = 0; x < W * 2; x += 64){
      const lg = g.createLinearGradient(x, 0, x + 64, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.45, 'rgba(255,255,255,.35)'); lg.addColorStop(0.55, 'rgba(255,255,255,.08)'); lg.addColorStop(1, 'rgba(0,0,0,.18)');
      g.fillStyle = lg; g.fillRect(x, 0, 64, W * 2);
    }
    g.restore();
  });
}
// Rotor : Cotes de Geneve + signature gravee
function rotorTexture(){
  const t = stripesTexture('#c89a62');
  const g = t.image.getContext('2d');
  g.fillStyle = 'rgba(60,35,15,.55)'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '500 70px "Cormorant Garamond", Georgia, serif'; g.letterSpacing = '14px';
  g.fillText('NOCTÉA', 512, 300);
  g.font = '400 26px "Jost", Arial, sans-serif'; g.letterSpacing = '8px';
  g.fillText('31 RUBIS · 72 H', 512, 370);
  t.needsUpdate = true;
  return t;
}
// Cuir : grain + surpiqures le long des bords
function strapTexture(s){
  return canvasTex(512, 2048, (g, W, H)=>{
    g.fillStyle = s.color; g.fillRect(0, 0, W, H);
    if(s.kind === 'leather'){
      for(let i = 0; i < 26000; i++){
        g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.12)';
        const r = Math.random() * 2.2 + 0.4; g.beginPath(); g.arc(Math.random() * W, Math.random() * H, r, 0, TAU); g.fill();
      }
      if(s.stitch){
        g.strokeStyle = s.stitch; g.lineWidth = 5; g.setLineDash([20, 14]);
        [44, W - 44].forEach(x=>{ g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); });
      }
    } else {
      // caoutchouc : nervures horizontales
      for(let y = 0; y < H; y += 26){ g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(70, y, W - 140, 9); }
    }
  });
}
function strapBump(kind){
  return canvasTex(256, 1024, (g, W, H)=>{
    g.fillStyle = '#808080'; g.fillRect(0, 0, W, H);
    if(kind === 'leather'){
      for(let i = 0; i < 9000; i++){ g.fillStyle = Math.random() < 0.5 ? '#9a9a9a' : '#5c5c5c'; g.beginPath(); g.arc(Math.random() * W, Math.random() * H, Math.random() * 2.4 + 0.5, 0, TAU); g.fill(); }
    } else {
      for(let y = 0; y < H; y += 13){ g.fillStyle = '#a0a0a0'; g.fillRect(35, y, W - 70, 5); }
    }
  }, false);
}
// Rehaut : graduation imprimee sur l'anneau incline autour du cadran
function flangeTexture(color){
  return canvasTex(4096, 128, (g, W, H)=>{
    g.fillStyle = '#0c0c0d'; g.fillRect(0, 0, W, H);
    g.fillStyle = color;
    for(let i = 0; i < 240; i++){
      const x = (i / 240) * W, big = i % 20 === 0, mid = i % 4 === 0;
      g.globalAlpha = big ? 1 : mid ? 0.75 : 0.4;
      g.fillRect(x - (big ? 3 : 1.5), big ? 20 : mid ? 52 : 74, big ? 6 : 3, H);
    }
  });
}

// ---------- Geometries ----------
function lathe(profile, seg = 160){
  const g = new THREE.LatheGeometry(profile.map(([r, z])=>new THREE.Vector2(r, z)), seg);
  g.rotateX(Math.PI / 2); // l'axe de revolution devient z (le cadran regarde +z)
  return g;
}
function handShape(len, w, tail){
  const s = new THREE.Shape();
  s.moveTo(0, -tail); s.lineTo(w * 0.55, -tail * 0.6); s.lineTo(w, len * 0.18); s.lineTo(0, len); s.lineTo(-w, len * 0.18); s.lineTo(-w * 0.55, -tail * 0.6); s.closePath();
  return s;
}
function extrude(shape, depth, bevel){
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled:!!bevel, bevelThickness:bevel || 0, bevelSize:bevel || 0, bevelSegments:3, curveSegments:24 });
}

const STRAP_END = 1.98;
// Bracelet : section en rectangle aux bords arrondis, balayee le long d'un arc (le poignet)
function strapGeometry(dir, w0, w1, t){
  const R = 3.05, zc = -2.21, N = 90;
  const a0 = Math.asin(2.2 / R), a1 = STRAP_END;
  const r = t / 2, CAP = 8;
  // contour de la section : demi-cercle droit puis demi-cercle gauche (x = largeur, n = epaisseur)
  const ring = [];
  for(let k = 0; k <= CAP; k++){ const a = -Math.PI / 2 + (k / CAP) * Math.PI; ring.push({ side:1, c:Math.cos(a), s:Math.sin(a) }); }
  for(let k = 0; k <= CAP; k++){ const a = Math.PI / 2 + (k / CAP) * Math.PI; ring.push({ side:-1, c:Math.cos(a), s:Math.sin(a) }); }
  const M = ring.length, pos = [], uv = [], idx = [];
  for(let i = 0; i <= N; i++){
    const f = i / N, a = a0 + (a1 - a0) * f;
    let w = (w0 + (w1 - w0) * Math.pow(f, 1.3)) / 2;
    if(i > N - 8) w *= Math.max(0.45, 1 - (i - (N - 8)) / 10); // bout arrondi
    const cy = dir * R * Math.sin(a), cz = zc + R * Math.cos(a);
    const ny = dir * Math.sin(a), nz = Math.cos(a); // normale sortante du poignet
    ring.forEach(p=>{
      const x = p.side * Math.max(0, w - r) + p.c * r;
      const n = p.s * r;
      pos.push(x, cy + ny * n, cz + nz * n);
      uv.push(0.5 + x / w0, f * 2.2);
    });
  }
  for(let i = 0; i < N; i++) for(let j = 0; j < M; j++){
    const a = i * M + j, b = i * M + (j + 1) % M, c = (i + 1) * M + j, d = (i + 1) * M + (j + 1) % M;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ---------- Montre ----------
export function createWatch(){
  const root = new THREE.Group();
  const watch = new THREE.Group(); root.add(watch);
  const mats = {};

  mats.polished = new THREE.MeshPhysicalMaterial({ metalness:1, roughness:0.15, clearcoat:0.3, clearcoatRoughness:0.08, side:THREE.DoubleSide });
  mats.brushed = new THREE.MeshPhysicalMaterial({ metalness:1, roughness:0.32, side:THREE.DoubleSide });
  mats.dial = new THREE.MeshPhysicalMaterial({ metalness:0.55, roughness:0.32, clearcoat:0.6, clearcoatRoughness:0.12 });
  mats.flange = new THREE.MeshStandardMaterial({ metalness:0.2, roughness:0.5, side:THREE.DoubleSide });
  mats.lume = new THREE.MeshStandardMaterial({ roughness:0.6, emissive:0x000000 });
  mats.crystal = new THREE.MeshPhysicalMaterial({ transmission:1, roughness:0, ior:1.77, thickness:0.08, metalness:0, clearcoat:1, specularIntensity:1, envMapIntensity:1.4 });
  mats.strap = new THREE.MeshPhysicalMaterial({ roughness:0.62, sheen:0.6, sheenRoughness:0.7, sheenColor:new THREE.Color(0x553322), side:THREE.DoubleSide });
  mats.inner = new THREE.MeshStandardMaterial({ color:0x0a0a0b, roughness:0.8, side:THREE.BackSide });
  mats.plate = new THREE.MeshStandardMaterial({ map:plateTexture(), metalness:0.85, roughness:0.38 });
  mats.bridge = new THREE.MeshStandardMaterial({ map:stripesTexture('#c7cacf'), metalness:0.9, roughness:0.3 });
  mats.rotor = new THREE.MeshStandardMaterial({ map:rotorTexture(), metalness:1, roughness:0.25 });
  mats.ruby = new THREE.MeshPhysicalMaterial({ color:0xb0102a, roughness:0.05, metalness:0, clearcoat:1, transmission:0.4, thickness:0.05 });
  mats.blued = new THREE.MeshStandardMaterial({ color:0x1d3a8f, metalness:1, roughness:0.22 });
  mats.goldMove = new THREE.MeshStandardMaterial({ color:0xd9a95e, metalness:1, roughness:0.2 });

  const add = (geo, mat, parent = watch)=>{ const m = new THREE.Mesh(geo, mat); parent.add(m); return m; };

  // Boite (carrure) : profil tourne, flancs galbes
  add(lathe([[1.62,-0.27],[1.9,-0.27],[1.99,-0.22],[2.04,-0.12],[2.06,0.0],[2.04,0.12],[1.99,0.19],[1.9,0.22],[1.62,0.22]]), mats.brushed);
  add(new THREE.CylinderGeometry(1.62, 1.62, 0.5, 96, 1, true).rotateX(Math.PI / 2).translate(0, 0, -0.03), mats.inner);
  // Lunette polie
  add(lathe([[1.6,0.22],[1.97,0.22],[1.985,0.27],[1.93,0.345],[1.8,0.375],[1.66,0.37],[1.6,0.35]]), mats.polished);
  // Rehaut incline (graduation)
  add(lathe([[1.6,0.345],[1.47,0.19]], 240), mats.flange);
  // Cadran
  const dial = add(new THREE.CircleGeometry(1.5, 128), mats.dial); dial.position.z = 0.185;
  // Index appliques (or/acier poli), double a midi
  const idxGeo = new THREE.BoxGeometry(0.055, 0.22, 0.045);
  for(let i = 0; i < 12; i++){
    const a = (i / 12) * TAU;
    const parts = i === 0 ? [-0.05, 0.05] : [0];
    parts.forEach(off=>{
      const m = add(idxGeo, mats.polished);
      const r = 1.2;
      m.position.set(Math.sin(a) * r + Math.cos(a) * off, Math.cos(a) * r - Math.sin(a) * off, 0.21);
      m.rotation.z = -a;
      const l = add(new THREE.BoxGeometry(0.03, 0.13, 0.01), mats.lume, m); l.position.z = 0.026;
    });
  }
  // Aiguilles (dauphine facettees) + trotteuse a contrepoids
  const hands = {};
  const mkHand = (len, w, tail, z, mat)=>{
    const piv = new THREE.Group(); piv.position.z = z; watch.add(piv);
    const geo = extrude(handShape(len, w, tail), 0.012, 0.008);
    const m = new THREE.Mesh(geo, mat); piv.add(m);
    return piv;
  };
  hands.h = mkHand(0.82, 0.075, 0.16, 0.225, mats.polished);
  hands.m = mkHand(1.3, 0.06, 0.2, 0.255, mats.polished);
  { const l = new THREE.Mesh(extrude(handShape(0.5, 0.03, 0), 0.004), mats.lume); l.position.set(0, 0.22, 0.02); hands.h.add(l);
    const l2 = new THREE.Mesh(extrude(handShape(0.85, 0.024, 0), 0.004), mats.lume); l2.position.set(0, 0.3, 0.02); hands.m.add(l2); }
  hands.s = new THREE.Group(); hands.s.position.z = 0.285; watch.add(hands.s);
  { const s = new THREE.Shape(); s.moveTo(-0.011, -0.36); s.lineTo(0.011, -0.36); s.lineTo(0.006, 1.42); s.lineTo(-0.006, 1.42); s.closePath();
    hands.s.add(new THREE.Mesh(extrude(s, 0.006), mats.secHand = new THREE.MeshStandardMaterial({ color:0xd8b27c, metalness:1, roughness:0.25 })));
    const cw = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 32).rotateX(Math.PI / 2), mats.secHand); cw.position.set(0, -0.26, 0.004); hands.s.add(cw); }
  add(new THREE.CylinderGeometry(0.06, 0.07, 0.11, 32).rotateX(Math.PI / 2).translate(0, 0, 0.25), mats.polished);
  // Glace saphir bombee
  { const g = new THREE.CircleGeometry(1.63, 96), p = g.attributes.position;
    for(let i = 0; i < p.count; i++){ const r = Math.hypot(p.getX(i), p.getY(i)) / 1.63; p.setZ(i, 0.375 + 0.05 * (1 - r * r)); }
    g.computeVertexNormals();
    add(g, mats.crystal); }

  // Cornes : profil extrude et oriente (profil dans le plan y/z, epaisseur en x)
  { const s = new THREE.Shape();
    s.moveTo(1.4, -0.24); s.lineTo(2.18, -0.24); s.quadraticCurveTo(2.38, -0.23, 2.38, -0.1); s.quadraticCurveTo(2.36, 0.03, 2.18, 0.07); s.quadraticCurveTo(1.85, 0.17, 1.4, 0.215); s.closePath();
    const g = extrude(s, 0.34, 0.04);
    g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
    [0.8, -1.14].forEach((x)=>{
      const top = add(g, mats.brushed); top.position.x = x;
      const bot = add(g, mats.brushed); bot.rotation.z = Math.PI; bot.position.x = -x;
    });
  }
  // Couronne cannelee + protege-couronne
  { const g = new THREE.CylinderGeometry(0.23, 0.23, 0.26, 96, 1), p = g.attributes.position;
    for(let i = 0; i < p.count; i++){ const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z); if(r > 0.17){ const k = 0.23 + 0.014 * Math.cos(a * 30); p.setX(i, Math.cos(a) * k); p.setZ(i, Math.sin(a) * k); } }
    g.computeVertexNormals(); g.rotateZ(Math.PI / 2);
    const crown = add(g, mats.polished); crown.position.set(2.24, 0, -0.02);
    const tube = add(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 32).rotateZ(Math.PI / 2), mats.polished); tube.position.set(2.05, 0, -0.02);
    const cap = add(new THREE.CircleGeometry(0.17, 48).rotateY(Math.PI / 2), mats.polished); cap.position.set(2.372, 0, -0.02);
    mats.crown = crown;
  }

  // Fond : anneau visse + glace saphir + calibre visible
  add(lathe([[1.44,-0.3],[1.7,-0.3],[1.88,-0.285],[1.95,-0.25],[1.62,-0.25]]), mats.polished);
  { const g = new THREE.CircleGeometry(1.45, 96); g.rotateY(Math.PI); g.translate(0, 0, -0.298); add(g, mats.crystal); }
  const movement = new THREE.Group(); watch.add(movement);
  { const plate = new THREE.Mesh(new THREE.CircleGeometry(1.55, 96).rotateY(Math.PI), mats.plate); plate.position.z = -0.06; movement.add(plate);
    // ponts : grandes formes extrudees aux Cotes de Geneve
    const bridge = (pts, z)=>{ const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(([x, y])=>s.lineTo(x, y)); s.closePath();
      const m = new THREE.Mesh(extrude(s, 0.05, 0.012), mats.bridge); m.rotation.y = Math.PI; m.position.z = z; movement.add(m); return m; };
    bridge([[-1.45,0.1],[-0.2,0.25],[0.25,-0.2],[0.1,-1.3],[-0.7,-1.25],[-1.4,-0.6]], -0.075);
    bridge([[0.15,0.15],[1.2,0.25],[1.45,-0.35],[0.9,-0.9],[0.35,-0.75]], -0.075);
    // rubis et vis bleuies
    const ruby = new THREE.SphereGeometry(0.045, 20, 12), screw = new THREE.CylinderGeometry(0.06, 0.06, 0.03, 24).rotateX(Math.PI / 2);
    [[-0.9,-0.3],[-0.4,-0.85],[0.75,-0.25],[0.95,-0.6],[-0.15,0.0],[-1.1,0.0]].forEach(([x, y])=>{ const r = new THREE.Mesh(ruby, mats.ruby); r.position.set(-x, y, -0.135); movement.add(r); });
    [[-1.25,-0.45],[-0.25,-1.1],[1.2,-0.1],[0.6,-0.8],[-0.5,0.12]].forEach(([x, y])=>{ const s = new THREE.Mesh(screw, mats.blued); s.position.set(-x, y, -0.14); movement.add(s); });
    // balancier (4 Hz) avec spiral
    const bal = new THREE.Group(); bal.position.set(0.62, 0.62, -0.15); movement.add(bal);
    bal.add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 12, 64), mats.goldMove));
    for(let k = 0; k < 3; k++){ const sp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.6, 0.02), mats.goldMove); sp.rotation.z = k * TAU / 6; bal.add(sp); }
    for(let k = 0; k < 8; k++){ const a = k * TAU / 8, sc = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), mats.goldMove); sc.position.set(Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0); bal.add(sc); }
    const spiralPts = []; for(let i = 0; i <= 400; i++){ const a = i / 400 * TAU * 9, r = 0.04 + i / 400 * 0.2; spiralPts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, -0.02)); }
    bal.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(spiralPts), new THREE.LineBasicMaterial({ color:0x9aa3b5 })));
    const cock = bridge([[-0.95,0.95],[-0.55,0.5],[-0.3,0.62],[-0.55,1.15]], -0.2);
    movement.userData.balance = bal; movement.userData.cock = cock;
    // rotor : secteur annulaire en or grave, sur roulement central
    const rs = new THREE.Shape(); rs.absarc(0, 0, 1.42, 0, Math.PI, false); rs.absarc(0, 0, 0.32, Math.PI, 0, true);
    const rotorPiv = new THREE.Group(); rotorPiv.position.z = -0.235; movement.add(rotorPiv);
    const rotor = new THREE.Mesh(extrude(rs, 0.035, 0.01), mats.rotor); rotor.rotation.y = Math.PI;
    // UV planaires pour la texture gravee
    { const p = rotor.geometry.attributes.position, uv = rotor.geometry.attributes.uv; for(let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.9 + 0.5, p.getY(i) / 2.9 + 0.5); }
    rotorPiv.add(rotor);
    rotorPiv.add(new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.05, 48).rotateX(Math.PI / 2), mats.goldMove));
    movement.userData.rotor = rotorPiv;
  }

  // Bracelet (deux brins)
  const straps = new THREE.Group(); watch.add(straps);
  const strapTop = new THREE.Mesh(strapGeometry(1, 1.5, 1.2, 0.16), mats.strap);
  const strapBot = new THREE.Mesh(strapGeometry(-1, 1.5, 1.2, 0.16), mats.strap);
  straps.add(strapTop, strapBot);
  { const R = 3.05, zc = -2.21, a = STRAP_END + 0.02, dir = -1;
    const P = new THREE.Vector3(0, dir * R * Math.sin(a), zc + R * Math.cos(a));
    const T = new THREE.Vector3(0, dir * Math.cos(a), -Math.sin(a)).normalize();
    const N = new THREE.Vector3(0, dir * Math.sin(a), Math.cos(a)).normalize();
    const X = new THREE.Vector3().crossVectors(T, N).normalize();
    const basis = new THREE.Matrix4().makeBasis(X, T, N);
    const rr = (w, h, r)=>{ const p = new THREE.Path(), x = -w / 2, y = -h / 2;
      p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r); p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r); p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y); return p; };
    const frame = new THREE.Shape(rr(1.72, 0.72, 0.3).getPoints(24)); frame.holes.push(new THREE.Path(rr(1.46, 0.46, 0.18).getPoints(24)));
    const buckle = new THREE.Mesh(extrude(frame, 0.07, 0.025), mats.polished);
    buckle.geometry.translate(0, 0.3, -0.06); buckle.geometry.applyMatrix4(basis); buckle.position.copy(P); straps.add(buckle);
    const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.05), mats.polished);
    tongue.geometry.translate(0, 0.27, 0.06); tongue.geometry.applyMatrix4(basis); tongue.position.copy(P); straps.add(tongue);
    // passant de cuir juste avant la boucle
    const keeper = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.16, 0.26), mats.strap);
    const a2 = STRAP_END - 0.22, P2 = new THREE.Vector3(0, dir * R * Math.sin(a2), zc + R * Math.cos(a2));
    const T2 = new THREE.Vector3(0, dir * Math.cos(a2), -Math.sin(a2)).normalize(), N2 = new THREE.Vector3(0, dir * Math.sin(a2), Math.cos(a2)).normalize();
    keeper.geometry.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(T2, N2).normalize(), T2, N2)); keeper.position.copy(P2); straps.add(keeper);
  }

  // ---------- Finition ----------
  const dialTexCache = {};
  function setVariant(key){
    const v = VARIANTS[key];
    const metal = new THREE.Color(v.metal);
    mats.polished.color.copy(metal); mats.polished.roughness = v.metalRough;
    mats.brushed.color.copy(metal); mats.brushed.roughness = v.brushed;
    if(!dialTexCache[key]) dialTexCache[key] = { dial:dialTexture(v), flange:flangeTexture(v.dialText), strap:strapTexture(v.strap), bump:strapBump(v.strap.kind) };
    const t = dialTexCache[key];
    t.flange.wrapS = THREE.RepeatWrapping;
    mats.dial.map = t.dial; mats.dial.color.set(0xffffff); mats.dial.needsUpdate = true;
    mats.flange.map = t.flange; mats.flange.needsUpdate = true;
    mats.lume.color.set(v.lume);
    mats.strap.map = t.strap; mats.strap.bumpMap = t.bump; mats.strap.bumpScale = v.strap.kind === 'leather' ? 1.2 : 2.5;
    mats.strap.roughness = v.strap.kind === 'leather' ? 0.62 : 0.42;
    mats.strap.sheen = v.strap.kind === 'leather' ? 0.6 : 0;
    mats.strap.needsUpdate = true;
    mats.secHand.color.set(key === 'abysse' ? 0xe9ecef : key === 'verdure' ? 0xe0d5bd : 0xe7b08f);
  }
  setVariant('nocturne');

  // ---------- Heure reelle + mecanique ----------
  let rotorSpin = 0, rotorVel = 0;
  function update(dt, t){
    const now = new Date();
    // trotteuse en balayage a 8 battements par seconde, comme un calibre a 28 800 alt/h
    const ms = now.getMilliseconds(), s = now.getSeconds() + Math.floor(ms / 125) * 0.125;
    const m = now.getMinutes() + s / 60, h = (now.getHours() % 12) + m / 60;
    hands.s.rotation.z = -(s / 60) * TAU;
    hands.m.rotation.z = -(m / 60) * TAU;
    hands.h.rotation.z = -(h / 12) * TAU;
    movement.userData.balance.rotation.z = Math.sin(t * TAU * 4) * 2.2;
    rotorVel += (Math.sin(t * 0.7) * 0.6 - rotorVel) * Math.min(1, dt * 0.8);
    rotorSpin += rotorVel * dt;
    movement.userData.rotor.rotation.z = rotorSpin;
  }
  function kickRotor(v){ rotorVel += v; }

  // points d'interet pour les annotations
  const hotspots = [
    { id:'crown', pos:new THREE.Vector3(2.38, 0, -0.02), normal:new THREE.Vector3(1, 0, 0) },
    { id:'bezel', pos:new THREE.Vector3(-1.38, 1.38, 0.34), normal:new THREE.Vector3(-0.3, 0.3, 1) },
    { id:'dial', pos:new THREE.Vector3(0, 0.62, 0.2), normal:new THREE.Vector3(0, 0, 1) },
    { id:'hands', pos:new THREE.Vector3(0.62, -0.5, 0.27), normal:new THREE.Vector3(0, 0, 1) },
    { id:'balance', pos:new THREE.Vector3(0.62, 0.62, -0.3), normal:new THREE.Vector3(0, 0, -1) },
    { id:'rotor', pos:new THREE.Vector3(-0.6, -0.7, -0.3), normal:new THREE.Vector3(0, 0, -1) },
  ];

  return { root, watch, setVariant, update, kickRotor, hotspots };
}
