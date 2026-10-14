import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createWatch, VARIANTS } from './watch.js';

const $ = (id)=>document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1)=>Math.min(b, Math.max(a, v));
const smooth = (a, b, x)=>{ const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (t)=>t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ---------- Points de vue : coordonnees spheriques autour d'une cible ----------
// theta : azimut autour de l'axe vertical (0 = face au cadran, PI/2 = cote couronne, PI = fond)
// shift : decalage horizontal du cadrage (fraction d'ecran) pour laisser la place au texte
const VIEWS = [
  { name:'Ensemble', target:[0, -0.3, 0], r:14.5, theta:0.34, phi:1.36, shift:0.2 },
  { name:'Cadran', target:[0, 0.05, 0.2], r:10.2, theta:0.12, phi:1.46, shift:-0.2 },
  { name:'Couronne', target:[1.7, 0, 0], r:7.4, theta:1.22, phi:1.36, shift:0.2 },
  { name:'Calibre', target:[0, 0, -0.25], r:11.5, theta:Math.PI - 0.16, phi:1.45, shift:-0.2 },
  { name:'Profil', target:[0, -0.7, 0], r:15, theta:Math.PI * 1.5 + 0.22, phi:1.22, shift:0.12 },
];
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
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
scene.environmentIntensity = 0.85;
const key = new THREE.DirectionalLight(0xfff1dd, 2.4); key.position.set(-4, 6, 7); scene.add(key);
const rim = new THREE.DirectionalLight(0xc8d8ff, 1.2); rim.position.set(5, -2, -6); scene.add(rim);
scene.add(new THREE.AmbientLight(0xffffff, 0.15));

const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
const cam = { pos:new THREE.Vector3(), target:new THREE.Vector3() };

const W = createWatch();
scene.add(W.root);

const controls = new OrbitControls(camera, canvas);
controls.enabled = false;
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 3.2; controls.maxDistance = 20;
controls.rotateSpeed = 0.7;

function resize(){
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if(!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // sur ecran etroit on recule pour garder la montre entiere
  camera.fov = w / h < 0.8 ? 42 : 30;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
// decale le cadre de rendu : la montre glisse a gauche ou a droite sans changer l'angle de vue
let shiftNow = 0;
function applyShift(target, dt){
  shiftNow += (target - shiftNow) * (dt ? Math.min(1, dt * 4) : 1);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if(!w || !h) return;
  const narrow = w / h < 0.8;
  camera.setViewOffset(w, h, narrow ? 0 : -shiftNow * w, narrow ? h * 0.17 : 0, w, h);
}

// ---------- Etat ----------
let variant = 'nocturne';
let atelier = false, tween = null, spin = false;
let scrollSeg = 0, segSmooth = 0; // 0..4 selon le defilement
let pointer = { x:0, y:0, sx:0, sy:0 };
const stage = $('stage');

function stageProgress(){
  const r = stage.getBoundingClientRect();
  const span = stage.offsetHeight - innerHeight;
  return clamp(-r.top / Math.max(1, span));
}

// ---------- Finitions ----------
function buildFinishUI(){
  const sw = (k, v)=>'<button type="button" role="radio" data-v="' + k + '" aria-label="' + v.name + ' — ' + v.sub + '" style="--m:#' + new THREE.Color(v.metal).getHexString() + ';--d:' + v.dial[0] + '"><i></i><span>' + v.name + '</span></button>';
  $('finishPick').innerHTML = Object.entries(VARIANTS).map(([k, v])=>sw(k, v)).join('');
  $('atFinishes').innerHTML = Object.entries(VARIANTS).map(([k, v])=>'<button type="button" data-v="' + k + '"><i style="--m:#' + new THREE.Color(v.metal).getHexString() + ';--d:' + v.dial[0] + '"></i><span><b>' + v.name + '</b><small>' + v.sub + '</small></span></button>').join('');
  $('rdvModel').innerHTML = Object.values(VARIANTS).map(v=>'<option>Calibre N.01 ' + v.name + '</option>').join('');
  document.querySelectorAll('[data-v]').forEach(b=>b.addEventListener('click', ()=>setVariant(b.dataset.v)));
}
function setVariant(k){
  variant = k;
  W.setVariant(k);
  document.querySelectorAll('[data-v]').forEach(b=>{ const on = b.dataset.v === k; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  $('atTitle').textContent = VARIANTS[k].name;
  document.documentElement.style.setProperty('--glow', '#' + new THREE.Color(VARIANTS[k].metal).getHexString());
  W.kickRotor(4);
}

// ---------- Atelier ----------
function enterAtelier(view){
  atelier = true;
  document.body.classList.add('in-atelier');
  $('atelier').hidden = false;
  controls.target.copy(cam.target);
  controls.enabled = true;
  goView(view ?? Math.round(scrollSeg));
}
function exitAtelier(){
  atelier = false; tween = null;
  document.body.classList.remove('in-atelier');
  $('atelier').hidden = true;
  controls.enabled = false;
}
function currentSpherical(){
  const off = camera.position.clone().sub(controls.target);
  const r = off.length();
  return { target:controls.target.toArray(), r, theta:Math.atan2(off.x, off.z), phi:Math.acos(clamp(off.y / r, -1, 1)) };
}
function goView(i){
  const from = currentSpherical(), to = { ...VIEWS[i] };
  // prendre le chemin le plus court autour de la montre
  let d = to.theta - from.theta; d = Math.atan2(Math.sin(d), Math.cos(d));
  to.theta = from.theta + d;
  tween = { from, to, t:0, dur:reduced ? 0.01 : 1.4 };
  document.querySelectorAll('#atViews button').forEach(b=>b.classList.toggle('on', +b.dataset.view === i));
  if(i === 3) W.kickRotor(6);
}

// ---------- Annotations ----------
const NOTES = {
  crown:['Couronne vissée', '30 cannelures, étanche à 100 m.'],
  bezel:['Lunette polie', 'Polie miroir à la main, 0,8 mm de chanfrein.'],
  dial:['Cadran soleillé', 'Brossé en rayons, laqué en sept couches.'],
  hands:['Aiguilles dauphine', 'Facettées, Super-LumiNova, à l\'heure exacte.'],
  balance:['Balancier', '4 Hz, spiral Breguet, visible en mouvement.'],
  rotor:['Rotor or 22 ct', 'Gravé, Côtes de Genève, remonte à chaque geste.'],
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
  const show = atelier && $('tglNotes').checked;
  $('hotspots').classList.toggle('show', show);
  if(!show) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  W.hotspots.forEach((hs, i)=>{
    tmpV.copy(hs.pos).applyMatrix4(W.watch.matrixWorld);
    tmpN.copy(hs.normal).transformDirection(W.watch.matrixWorld);
    tmpD.copy(camera.position).sub(tmpV).normalize();
    const facing = tmpN.dot(tmpD) > 0.2;
    tmpV.project(camera);
    const el = hsEls[i];
    el.style.transform = 'translate(' + ((tmpV.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-tmpV.y * 0.5 + 0.5) * h).toFixed(1) + 'px)';
    el.classList.toggle('hidden', !facing || tmpV.z > 1);
  });
}

// ---------- Chapitres (defilement) ----------
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
  railItems.forEach((li, k)=>li.classList.toggle('on', Math.round(scrollSeg) === k));
  $('scrollCue').style.opacity = String(1 - smooth(0.05, 0.3, scrollSeg));
}
railItems.forEach(li=>li.addEventListener('click', ()=>{
  const k = +li.dataset.go, span = stage.offsetHeight - innerHeight;
  scrollTo({ top:stage.offsetTop + span * (k / 4), behavior:reduced ? 'auto' : 'smooth' });
}));

// ---------- Boucle ----------
const clock = new THREE.Clock();
let visible = true;
new IntersectionObserver(([e])=>{ visible = e.isIntersecting; }).observe(stage);
const camOut = { pos:new THREE.Vector3(), target:new THREE.Vector3() };

function frame(){
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  if(!visible && !atelier) return;

  scrollSeg = stageProgress() * 4;
  if(!atelier){
    // lissage sur la position de defilement (et pas sur la position 3D) : la camera reste
    // sur son orbite et ne coupe jamais a travers la montre, meme sur un saut de chapitre
    segSmooth += (scrollSeg - segSmooth) * (1 - Math.pow(0.0004, dt));
    // tenir chaque chapitre, puis basculer vers le suivant dans la seconde moitie du segment
    const i = Math.min(3, Math.floor(segSmooth)), f = segSmooth - i;
    const v = lerpView(VIEWS[i], VIEWS[i + 1], ease(smooth(0.42, 1, f)));
    viewToCam(v, camOut);
    applyShift(v.shift, 0);
    cam.pos.copy(camOut.pos); cam.target.copy(camOut.target);
    camera.position.copy(cam.pos); camera.lookAt(cam.target);
    // ouverture : la montre respire et suit legerement la souris
    const heroW = 1 - smooth(0.1, 0.6, scrollSeg);
    pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 3);
    pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 3);
    W.root.rotation.y = heroW * (reduced ? 0 : Math.sin(t * 0.35) * 0.16 + pointer.sx * 0.22);
    W.root.rotation.x = heroW * pointer.sy * 0.12;
    updateChapters();
  } else {
    W.root.rotation.y *= 0.92; W.root.rotation.x *= 0.92;
    applyShift(0, dt);
    if(tween){
      tween.t += dt / tween.dur;
      const k = ease(clamp(tween.t));
      viewToCam(lerpView(tween.from, tween.to, k), camOut);
      camera.position.copy(camOut.pos); controls.target.copy(camOut.target);
      if(tween.t >= 1) tween = null;
    } else if(spin){
      const s = currentSpherical(); s.theta += dt * 0.25;
      viewToCam(s, camOut); camera.position.copy(camOut.pos);
    }
    controls.update();
    cam.pos.copy(camera.position); cam.target.copy(controls.target);
  }
  if(scrollSeg > 2.6 && scrollSeg < 3.4 && !atelier) W.kickRotor(dt * 1.5);
  W.update(dt, t);
  renderer.render(scene, camera);
  placeHotspots();
}

// ---------- Vignettes de la collection (rendues avec la vraie montre) ----------
function renderThumbs(){
  const grid = $('collGrid');
  const saved = variant;
  camera.clearViewOffset();
  viewToCam({ target:[0, -0.45, 0], r:13.2, theta:0.42, phi:1.34 }, camOut);
  camera.position.copy(camOut.pos); camera.lookAt(camOut.target);
  // rendu a taille fixe (portrait) pour des vignettes legeres, puis on restaure
  renderer.setPixelRatio(1); renderer.setSize(720, 820, false);
  camera.aspect = 720 / 820; camera.fov = 30; camera.updateProjectionMatrix();
  const cards = Object.entries(VARIANTS).map(([k, v])=>{
    W.setVariant(k); W.update(0, 0);
    renderer.render(scene, camera);
    const img = canvas.toDataURL('image/png');
    return '<article class="coll-card" data-pick="' + k + '" style="--m:#' + new THREE.Color(v.metal).getHexString() + '">' +
      '<div class="cc-img"><img src="' + img + '" alt="NOCTÉA ' + v.name + ', ' + v.sub + '"></div>' +
      '<div class="cc-body"><p class="cc-ref">Réf. N01-' + k.slice(0, 3).toUpperCase() + '</p><h3>' + v.name + '</h3><p class="cc-sub">' + v.sub + '</p>' +
      '<div class="cc-foot"><span>Prix sur demande</span><button class="btn btn-line btn-sm" type="button">Examiner</button></div></div></article>';
  });
  grid.innerHTML = cards.join('');
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); resize();
  W.setVariant(saved);
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

// heure locale affichee a cote des aiguilles
const fmtTime = new Intl.DateTimeFormat('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
setInterval(()=>{ $('liveTime').textContent = fmtTime.format(new Date()); }, 250);

// chiffres du calibre qui defilent a l'apparition
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

// apparition douce des sections
const io = new IntersectionObserver((es)=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold:0.15 });
document.querySelectorAll('.sec-head,.coll-grid,.figures,.specs,.craft-card,.rdv-form').forEach(el=>io.observe(el));

// barre de navigation qui se densifie apres l'ouverture
addEventListener('scroll', ()=>$('nav').classList.toggle('solid', scrollY > innerHeight * 0.5), { passive:true });

// formulaire de demonstration : rien n'est envoye
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
  bar.style.width = '35%';
  // les textes du cadran et du rotor sont dessines au canvas : il faut les polices avant
  try { await Promise.all(['500 92px "Cormorant Garamond"', 'italic 400 46px "Cormorant Garamond"', '400 30px "Jost"'].map(f=>document.fonts.load(f))); } catch(e){}
  bar.style.width = '70%';
  buildFinishUI();
  setVariant('nocturne');
  resize();
  renderThumbs();
  segSmooth = stageProgress() * 4;
  bar.style.width = '100%';
  frame();
  setTimeout(()=>$('loader').classList.add('done'), reduced ? 0 : 500);
})();
