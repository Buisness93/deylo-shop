import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createWatch, VARIANTS } from './watch.js';

const $ = (id)=>document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1)=>Math.min(b, Math.max(a, v));
const smooth = (a, b, x)=>{ const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (t)=>t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ---------- Points de vue : coordonnees spheriques autour d'une cible ----------
// theta : azimut (0 = face au cadran, PI/2 = cote couronne, PI = fond) ; shift : decalage du cadrage
const VIEWS = [
  { name:'Ensemble', target:[0, -0.35, 0], r:15.5, theta:0.34, phi:1.34, shift:0.2 },
  { name:'Lunette', target:[0.5, 0.45, 0.3], r:9.2, theta:0.55, phi:1.08, shift:0.2 },
  { name:'Cadran', target:[0.05, 0.05, 0.16], r:10.2, theta:0.06, phi:1.5, shift:-0.22 },
  { name:'Calibre', target:[0, 0, -0.3], r:10.8, theta:Math.PI - 0.16, phi:1.45, shift:0.2 },
  { name:'Bracelet', target:[0, 1.0, -0.6], r:14.5, theta:-0.8, phi:0.88, shift:-0.16 },
  { name:'Couronne', target:[2.0, 0, -0.05], r:6.4, theta:1.25, phi:1.38, shift:0 },
];
const STORY = [0, 1, 2, 3, 4];           // chapitres du defilement
function viewToCam(v, out){
  const s = Math.sin(v.phi);
  out.pos.set(v.target[0] + v.r * s * Math.sin(v.theta), v.target[1] + v.r * Math.cos(v.phi), v.target[2] + v.r * s * Math.cos(v.theta));
  out.target.set(...v.target);
  return out;
}
function lerpView(a, b, t){
  return {
    target:a.target.map((x, i)=>x + (b.target[i] - x) * t),
    r:a.r + (b.r - a.r) * t, theta:a.theta + (b.theta - a.theta) * t, phi:a.phi + (b.phi - a.phi) * t,
    shift:(a.shift || 0) + ((b.shift || 0) - (a.shift || 0)) * t,
  };
}

// ---------- Rendu ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:false, powerPreference:'high-performance' });
let pixelRatio = Math.min(1.75, devicePixelRatio || 1);
renderer.setPixelRatio(pixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();

// Studio photo : boite sombre + softboxes. Les reflets en bandes sur les chanfreins polis
// viennent de la, comme sur une vraie photo produit.
function studioEnvironment(){
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color:0x0e0e0e, side:THREE.BackSide }));
  s.add(room);
  const box = (w, h, intensity, pos, look, tint = 0xffffff)=>{
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color:new THREE.Color(tint).multiplyScalar(intensity), side:THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); s.add(m);
  };
  box(10, 10, 0.9, [0, 13, 2], [0, 0, 0]);                       // plafond diffus
  box(2.2, 16, 3.2, [-10, 2, 3], [0, 0, 0], 0xfff4e6);           // bande gauche (chaude)
  box(1.6, 16, 2.2, [10, 1, 1], [0, 0, 0], 0xe8f0ff);            // bande droite (froide)
  box(8, 1.6, 2.6, [0, 5, 11], [0, 0, 0]);                       // face haute : filet sur la lunette
  box(12, 3, 0.8, [0, -9, 6], [0, 0, 0], 0xffeedd);              // reflet bas, doux
  box(6, 6, 1.2, [0, 3, -12], [0, 0, 0]);                        // contre-jour (fond, calibre)
  box(18, 12, 0.32, [0, 1, 14], [0, 0, 0], 0xf4efe8);            // reflecteur face : donne sa matiere au satine
  box(5, 5, 1.1, [7, 7, 9], [0, 0, 0]);                          // octobox haute droite
  box(16, 10, 0.45, [0, 1, -14], [0, 0, 0], 0xf0f2f6);           // reflecteur arriere : le fond et le calibre respirent
  box(2, 14, 1.8, [-11, 0, -6], [0, 0, 0], 0xfff2e2);            // bande de profil (bracelet)
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.02).texture;
  pm.dispose();
  return tex;
}
scene.environment = studioEnvironment();
scene.environmentIntensity = 0.9;

// fond peint : halo chaud au centre, coins profonds (teinte selon la finition)
function backdrop(glow, night){
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = night ? '#020304' : '#070605'; g.fillRect(0, 0, 1024, 1024);
  const rg = g.createRadialGradient(560, 470, 0, 560, 470, 620);
  const col = new THREE.Color(glow); if(night) col.lerp(new THREE.Color(0x0a2a2a), 0.7);
  rg.addColorStop(0, 'rgba(' + [col.r, col.g, col.b].map(v=>Math.round(v * 255)).join(',') + ',' + (night ? 0.10 : 0.16) + ')');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 1024, 1024);
  // grain fin pour eviter le banding
  const id = g.getImageData(0, 0, 1024, 1024), d = id.data;
  for(let i = 0; i < d.length; i += 4){ const n = (Math.random() - 0.5) * 5; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// lumieres : cle (ombres portees des aiguilles sur le cadran), contre-jour, et une lune pour le mode nuit
const key = new THREE.DirectionalLight(0xfff3e2, 1.6); key.position.set(-3.5, 6, 9);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left:-4.5, right:4.5, top:4.5, bottom:-4.5, near:1, far:30 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.015; key.shadow.radius = 4;
scene.add(key);
const rim = new THREE.DirectionalLight(0xcfe0ff, 1.4); rim.position.set(6, -1, -7); scene.add(rim);
const moon = new THREE.DirectionalLight(0x6f8cff, 0); moon.position.set(2, 5, 6); scene.add(moon);

const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 120);
const cam = { pos:new THREE.Vector3(), target:new THREE.Vector3() };

const W = createWatch();
scene.add(W.root);

// post-traitement : MSAA 4x + halo sur les hautes lumieres + sortie ACES/sRGB
const rt = new THREE.WebGLRenderTarget(4, 4, { type:THREE.HalfFloatType, samples:4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.16, 0.4, 1.4);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const controls = new OrbitControls(camera, canvas);
controls.enabled = false;
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 3.2; controls.maxDistance = 22;
controls.rotateSpeed = 0.7;

function resize(){
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if(!w || !h) return;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 40 : 30;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
let shiftNow = 0;
function applyShift(target){
  shiftNow = target;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if(!w || !h) return;
  const narrow = w / h < 0.8;
  camera.setViewOffset(w, h, narrow ? 0 : -shiftNow * w, narrow ? h * 0.17 : 0, w, h);
}

// ---------- Etat ----------
let variant = 'acier';
let atelier = false, tween = null, spin = false, night = 0, nightTarget = 0;
let scrollSeg = 0, segSmooth = 0;
const pointer = { x:0, y:0, sx:0, sy:0 };
const stage = $('stage');
const bgCache = {};
function setBackdrop(){
  const k = variant + (nightTarget ? 'n' : '');
  if(!bgCache[k]) bgCache[k] = backdrop(VARIANTS[variant].glow, !!nightTarget);
  scene.background = bgCache[k];
}

function stageProgress(){
  const r = stage.getBoundingClientRect();
  return clamp(-r.top / Math.max(1, stage.offsetHeight - innerHeight));
}

// ---------- Finitions ----------
const hex = (n)=>'#' + new THREE.Color(n).getHexString();
function buildFinishUI(){
  $('finishPick').innerHTML = Object.entries(VARIANTS).map(([k, v])=>'<button type="button" role="radio" data-v="' + k + '" aria-label="' + v.name + ' — ' + v.sub + '" style="--m:' + hex(v.metal === 0x0d0d0e ? 0x2a2b2e : v.metal) + ';--d:' + v.dial + '"><i></i><span>' + v.name + '</span></button>').join('');
  $('atFinishes').innerHTML = Object.entries(VARIANTS).map(([k, v])=>'<button type="button" data-v="' + k + '"><i style="--m:' + hex(v.metal === 0x0d0d0e ? 0x2a2b2e : v.metal) + ';--d:' + v.dial + '"></i><span><b>' + v.name + '</b><small>' + v.sub + '</small></span></button>').join('');
  $('rdvModel').innerHTML = Object.values(VARIANTS).map(v=>'<option>Octogone ' + v.name + '</option>').join('');
  document.querySelectorAll('[data-v]').forEach(b=>b.addEventListener('click', ()=>setVariant(b.dataset.v)));
}
function setVariant(k){
  variant = k;
  W.setVariant(k);
  document.querySelectorAll('[data-v]').forEach(b=>{ const on = b.dataset.v === k; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  $('atTitle').textContent = 'Octogone ' + VARIANTS[k].name;
  document.documentElement.style.setProperty('--glow', VARIANTS[k].glow);
  setBackdrop();
  W.kickRotor(4);
}

// ---------- Atelier ----------
function enterAtelier(view){
  atelier = true;
  document.body.classList.add('in-atelier');
  $('atelier').hidden = false;
  controls.target.copy(cam.target);
  controls.enabled = true;
  goView(view ?? STORY[Math.round(scrollSeg)]);
}
function exitAtelier(){
  atelier = false; tween = null;
  document.body.classList.remove('in-atelier');
  $('atelier').hidden = true;
  controls.enabled = false;
  setNight(false);
}
function currentSpherical(){
  const off = camera.position.clone().sub(controls.target);
  const r = off.length();
  return { target:controls.target.toArray(), r, theta:Math.atan2(off.x, off.z), phi:Math.acos(clamp(off.y / r, -1, 1)), shift:0 };
}
function goView(i){
  const from = currentSpherical(), to = { ...VIEWS[i], shift:0 };
  let d = to.theta - from.theta; d = Math.atan2(Math.sin(d), Math.cos(d));
  to.theta = from.theta + d;
  tween = { from, to, t:0, dur:reduced ? 0.01 : 1.5 };
  document.querySelectorAll('#atViews button').forEach(b=>b.classList.toggle('on', +b.dataset.view === i));
  if(i === 3) W.kickRotor(6);
}
function setNight(on){
  nightTarget = on ? 1 : 0;
  $('tglNight').checked = on;
  document.body.classList.toggle('night', on);
  setBackdrop();
}

// ---------- Annotations ----------
const NOTES = {
  screws:['Huit vis hexagonales', 'Or gris, toutes alignées dans le même sens.'],
  gasket:['Joint apparent', 'Le liseré noir entre lunette et boîte.'],
  tapisserie:['Grande Tapisserie', 'Guilloché au pantographe, 1 156 pyramides.'],
  date:['Guichet de date', 'Cadre poli, date du jour.'],
  crown:['Couronne vissée', '36 cannelures, fond octogonal.'],
  bracelet:['Bracelet intégré', 'Maillons satinés, chanfreins polis main.'],
  balance:['Balancier à vis', '4 Hz, spiral bleui, sous vos yeux.'],
  rotor:['Masse en or 22 ct', 'Gravée, Côtes de Genève.'],
};
const hsEls = W.hotspots.map(h=>{
  const el = document.createElement('button');
  el.type = 'button'; el.className = 'hs';
  el.innerHTML = '<i></i><span><b>' + NOTES[h.id][0] + '</b><small>' + NOTES[h.id][1] + '</small></span>';
  el.addEventListener('click', ()=>el.classList.toggle('open'));
  $('hotspots').appendChild(el);
  return el;
});
const tmpV = new THREE.Vector3(), tmpN = new THREE.Vector3(), tmpD = new THREE.Vector3();
function placeHotspots(){
  const show = atelier && $('tglNotes').checked && !tween;
  $('hotspots').classList.toggle('show', show);
  if(!show) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  W.hotspots.forEach((hs, i)=>{
    tmpV.copy(hs.pos).applyMatrix4(W.watch.matrixWorld);
    tmpN.copy(hs.normal).normalize().transformDirection(W.watch.matrixWorld);
    tmpD.copy(camera.position).sub(tmpV).normalize();
    const facing = tmpN.dot(tmpD) > 0.25;
    tmpV.project(camera);
    const el = hsEls[i];
    el.style.transform = 'translate(' + ((tmpV.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-tmpV.y * 0.5 + 0.5) * h).toFixed(1) + 'px)';
    el.classList.toggle('hidden', !facing || tmpV.z > 1);
  });
}

// ---------- Chapitres ----------
const chapters = [...document.querySelectorAll('.chapter')];
const railItems = [...document.querySelectorAll('#rail li')];
function updateChapters(){
  chapters.forEach((c, k)=>{
    const d = Math.abs(segSmooth - k);
    const o = 1 - smooth(0.22, 0.42, d);
    c.style.opacity = o.toFixed(3);
    c.style.transform = 'translateY(' + ((segSmooth - k) * -40).toFixed(1) + 'px)';
    c.style.pointerEvents = o > 0.6 ? 'auto' : 'none';
  });
  railItems.forEach((li, k)=>li.classList.toggle('on', Math.round(segSmooth) === k));
  $('scrollCue').style.opacity = String(1 - smooth(0.05, 0.3, segSmooth));
}
railItems.forEach(li=>li.addEventListener('click', ()=>{
  const k = +li.dataset.go, span = stage.offsetHeight - innerHeight;
  scrollTo({ top:stage.offsetTop + span * (k / (STORY.length - 1)), behavior:reduced ? 'auto' : 'smooth' });
}));

// ---------- Qualite adaptative : on degrade proprement si la machine peine ----------
let perfT = 0, perfN = 0, perfLevel = 0;
function adapt(dt){
  perfT += dt; perfN++;
  if(perfT < 2.5) return;
  const avg = perfT / perfN; perfT = 0; perfN = 0;
  if(avg > 0.03 && perfLevel === 0 && pixelRatio > 1){ perfLevel = 1; pixelRatio = 1; resize(); }
  else if(avg > 0.034 && perfLevel <= 1){ perfLevel = 2; bloom.enabled = false; key.shadow.mapSize.set(1024, 1024); key.shadow.map?.dispose(); key.shadow.map = null; }
}

// ---------- Boucle ----------
const clock = new THREE.Clock();
let visible = true;
new IntersectionObserver(([e])=>{ visible = e.isIntersecting; }).observe(stage);
const camOut = { pos:new THREE.Vector3(), target:new THREE.Vector3() };

function frame(){
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  if((!visible && !atelier) || document.hidden) return;

  scrollSeg = stageProgress() * (STORY.length - 1);
  if(!atelier){
    // lissage sur la position de defilement : la camera reste sur son orbite
    segSmooth += (scrollSeg - segSmooth) * (1 - Math.pow(0.0004, dt));
    const i = Math.min(STORY.length - 2, Math.floor(segSmooth)), f = segSmooth - i;
    const v = lerpView(VIEWS[STORY[i]], VIEWS[STORY[i + 1]], ease(smooth(0.42, 1, f)));
    viewToCam(v, camOut); applyShift(v.shift);
    cam.pos.copy(camOut.pos); cam.target.copy(camOut.target);
    camera.position.copy(cam.pos); camera.lookAt(cam.target);
    const heroW = 1 - smooth(0.1, 0.6, segSmooth);
    pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 3);
    pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 3);
    W.root.rotation.y = heroW * (reduced ? 0 : Math.sin(t * 0.35) * 0.16 + pointer.sx * 0.22);
    W.root.rotation.x = heroW * pointer.sy * 0.12;
    updateChapters();
  } else {
    W.root.rotation.y *= 0.92; W.root.rotation.x *= 0.92;
    applyShift(0);
    if(tween){
      tween.t += dt / tween.dur;
      viewToCam(lerpView(tween.from, tween.to, ease(clamp(tween.t))), camOut);
      camera.position.copy(camOut.pos); controls.target.copy(camOut.target);
      if(tween.t >= 1) tween = null;
    } else if(spin){
      const s = currentSpherical(); s.theta += dt * 0.25;
      viewToCam(s, camOut); camera.position.copy(camOut.pos);
    }
    controls.update();
    cam.pos.copy(camera.position); cam.target.copy(controls.target);
  }
  // mode nuit : la lumiere tombe, la luminescence s'allume
  night += (nightTarget - night) * Math.min(1, dt * 2.5);
  scene.environmentIntensity = 0.9 * (1 - night * 0.94);
  key.intensity = 1.6 * (1 - night * 0.97); rim.intensity = 1.4 * (1 - night * 0.9); moon.intensity = night * 0.5;
  bloom.strength = 0.16 + night * 0.9; bloom.threshold = 1.4 - night * 1.2;
  W.setNight(night);

  if(scrollSeg > 2.6 && scrollSeg < 3.4 && !atelier) W.kickRotor(dt * 1.5);
  W.update(dt, t);
  composer.render(dt);
  placeHotspots();
  adapt(dt);
}

// ---------- Vignettes de la collection (rendues avec la vraie montre) ----------
function renderThumbs(){
  const grid = $('collGrid');
  camera.clearViewOffset();
  viewToCam({ target:[0, -0.5, 0], r:14.8, theta:0.42, phi:1.32 }, camOut);
  camera.position.copy(camOut.pos); camera.lookAt(camOut.target);
  renderer.setPixelRatio(1); composer.setPixelRatio(1); renderer.setSize(720, 840, false); composer.setSize(720, 840);
  camera.aspect = 720 / 840; camera.fov = 30; camera.updateProjectionMatrix();
  const cards = Object.entries(VARIANTS).map(([k, v])=>{
    variant = k; W.setVariant(k); setBackdrop(); W.update(0, 0);
    composer.render(0);
    const img = canvas.toDataURL('image/jpeg', 0.9);
    return '<article class="coll-card" data-pick="' + k + '" style="--m:' + v.glow + '">' +
      '<div class="cc-img"><img src="' + img + '" alt="NOCTÉA Octogone ' + v.name + ', ' + v.sub + '"></div>' +
      '<div class="cc-body"><p class="cc-ref">Réf. 15.41-' + k.slice(0, 2).toUpperCase() + '</p><h3>' + v.name + '</h3><p class="cc-sub">' + v.sub + '</p>' +
      '<div class="cc-foot"><span>Prix sur demande</span><button class="btn btn-line btn-sm" type="button">Examiner</button></div></div></article>';
  });
  grid.innerHTML = cards.join('');
  resize();
  grid.querySelectorAll('[data-pick]').forEach(c=>c.addEventListener('click', ()=>{
    setVariant(c.dataset.pick);
    scrollTo({ top:stage.offsetTop, behavior:'auto' });
    setTimeout(()=>enterAtelier(0), 60);
  }));
}

// ---------- Interactions ----------
addEventListener('pointermove', (e)=>{ pointer.x = (e.clientX / innerWidth) * 2 - 1; pointer.y = (e.clientY / innerHeight) * 2 - 1; }, { passive:true });
canvas.addEventListener('pointerdown', ()=>{ if(atelier){ tween = null; W.kickRotor(3); } });
$('btnAtelier').addEventListener('click', ()=>enterAtelier(0));
$('btnAtelier2').addEventListener('click', ()=>enterAtelier(4));
$('btnClose').addEventListener('click', exitAtelier);
addEventListener('keydown', (e)=>{ if(e.key === 'Escape' && atelier) exitAtelier(); });
document.querySelectorAll('#atViews button').forEach(b=>b.addEventListener('click', ()=>goView(+b.dataset.view)));
$('tglSpin').addEventListener('change', (e)=>{ spin = e.target.checked; });
$('tglNight').addEventListener('change', (e)=>setNight(e.target.checked));

const fmtTime = new Intl.DateTimeFormat('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
setInterval(()=>{ $('liveTime').textContent = fmtTime.format(new Date()); }, 250);

document.querySelectorAll('[data-count]').forEach(el=>{
  const ob = new IntersectionObserver((es)=>{
    if(!es[0].isIntersecting) return;
    ob.disconnect();
    const to = +el.dataset.count, t0 = performance.now(), sep = el.dataset.sep;
    const step = (now)=>{ const k = ease(clamp((now - t0) / 1600)); const n = Math.round(to * k); el.textContent = sep ? n.toLocaleString('fr-FR') : n; if(k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, { threshold:0.6 });
  ob.observe(el);
});

const io = new IntersectionObserver((es)=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold:0.15 });
document.querySelectorAll('.sec-head,.coll-grid,.figures,.specs,.craft-card,.rdv-form').forEach(el=>io.observe(el));
addEventListener('scroll', ()=>$('nav').classList.toggle('solid', scrollY > innerHeight * 0.5), { passive:true });

$('rdvForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const f = e.target, msg = $('rdvMsg');
  if(!f.nom.value.trim() || !f.email.validity.valid){ msg.textContent = 'Merci d\'indiquer votre nom et une adresse e-mail valide.'; msg.className = 'rdv-msg err'; return; }
  msg.textContent = 'Merci ' + f.nom.value.trim().split(' ')[0] + '. Ceci est une maison fictive : votre demande n\'a été envoyée nulle part.';
  msg.className = 'rdv-msg ok';
  f.reset();
});

// ---------- Demarrage ----------
(async function start(){
  const bar = $('loaderBar');
  bar.style.width = '30%';
  try { await Promise.all(['600 112px "Cormorant Garamond"', '500 78px "Cormorant Garamond"', '500 34px "Jost"', '600 150px "Jost"'].map(f=>document.fonts.load(f))); } catch(e){}
  bar.style.width = '60%';
  await new Promise(r=>setTimeout(r, 30));
  buildFinishUI();
  renderThumbs();
  bar.style.width = '90%';
  setVariant('acier');
  resize();
  segSmooth = stageProgress() * (STORY.length - 1);
  bar.style.width = '100%';
  frame();
  setTimeout(()=>$('loader').classList.add('done'), reduced ? 0 : 600);
})();
