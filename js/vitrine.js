// Deylo Shop — vitrine 3D multi-montres : charge des modeles glTF (Sketchfab, CC),
// les recentre et les met a l'echelle automatiquement, studio photo et examen libre.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const $ = (id)=>document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s)=>String(s).replace(/[&<>"]/g, c=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

// ---------- Rendu ----------
const canvas = $('vtGl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const PR_MOVE = Math.min(1.25, devicePixelRatio || 1), PR_STILL = Math.min(2, Math.max(1.5, devicePixelRatio || 1));
let pixelRatio = PR_STILL;

const scene = new THREE.Scene();
// fond transparent : le decor de studio est peint en CSS derriere le canevas

// studio photo : softboxes qui dessinent les reflets sur le metal poli
function studioEnvironment(){
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color:0x111111, side:THREE.BackSide })));
  const box = (w, h, k, pos, tint = 0xffffff)=>{
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color:new THREE.Color(tint).multiplyScalar(k), side:THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m);
  };
  box(10, 10, 1.1, [0, 13, 2]);
  box(2.2, 16, 3.4, [-10, 2, 3], 0xfff4e6);
  box(1.6, 16, 2.4, [10, 1, 1], 0xe8f0ff);
  box(8, 1.6, 2.8, [0, 5, 11]);
  box(18, 12, 0.55, [0, 1, 14], 0xf4efe8);
  box(16, 10, 0.5, [0, 1, -14], 0xf0f2f6);
  box(5, 5, 1.2, [7, 7, 9]);
  box(12, 3, 0.8, [0, -9, 6], 0xffeedd);
  const pm = new THREE.PMREMGenerator(renderer);
  const t = pm.fromScene(s, 0.02).texture; pm.dispose();
  return t;
}
scene.environment = studioEnvironment();
const key = new THREE.DirectionalLight(0xfff3e2, 1.4); key.position.set(-3.5, 6, 9); scene.add(key);
const rim = new THREE.DirectionalLight(0xcfe0ff, 1.0); rim.position.set(6, -1, -7); scene.add(rim);

const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 200);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 2.5; controls.maxDistance = 30;
controls.autoRotate = !reduced; controls.autoRotateSpeed = 0.6;

const holder = new THREE.Group(); scene.add(holder);
// outil de reglage : ?debug dans l'URL permet de tester une orientation depuis la console
if(/[?&]debug/.test(location.search)) window.__vt = { controls, rot:(x, y, z)=>{ const r = holder.children[0]?.children[0]; if(r){ r.rotation.set(...[x, y, z].map(THREE.MathUtils.degToRad)); dirty = true; } } };

function resize(){
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if(!w || !h) return;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', ()=>{ resize(); dirty = true; });

// ---------- Chargement ----------
const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/');
const ktx2 = new KTX2Loader().setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/basis/').detectSupport(renderer);
const loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
const cache = {};
let catalog = [], current = null, dirty = true, loadToken = 0;

async function exists(url){
  try { const r = await fetch(url, { method:'HEAD', cache:'no-store' }); return r.ok; } catch(e){ return false; }
}

function state(html, progress){
  const el = $('vtState');
  if(!html){ el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = html + (progress != null ? '<div class="bar"><i style="width:' + Math.round(progress * 100) + '%"></i></div>' : '');
}

// recentre le modele et le ramene a une taille commune (la plus grande dimension = 4 unites)
function normalize(root){
  const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const k = 4 / Math.max(size.x, size.y, size.z || 1);
  root.position.sub(center.multiplyScalar(k)); root.scale.setScalar(k);
  root.traverse(o=>{
    if(o.isMesh){
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(m=>{ if(m && 'envMapIntensity' in m) m.envMapIntensity = 1.1; if(m && m.map) m.map.anisotropy = 8; });
    }
  });
  return size.multiplyScalar(k);
}

// cadrage : on recule la camera jusqu'a voir toute la montre
let fitDist = 10;
const VIEWS = { front:[0.0, 0.08], three:[0.62, 0.22], side:[Math.PI / 2, 0.06], back:[Math.PI, 0.08] };
function goView(name, instant){
  const [theta, lift] = VIEWS[name];
  const target = new THREE.Vector3(0, 0, 0);
  const pos = new THREE.Vector3(Math.sin(theta) * fitDist, lift * fitDist, Math.cos(theta) * fitDist);
  if(instant){ camera.position.copy(pos); controls.target.copy(target); controls.update(); dirty = true; return; }
  tween = { from:camera.position.clone(), to:pos, t:0 };
  document.querySelectorAll('#vtViews button').forEach(b=>b.classList.toggle('on', b.dataset.view === name));
}
let tween = null;

async function show(w){
  current = w;
  const token = ++loadToken;
  document.querySelectorAll('.vt-card').forEach(c=>c.classList.toggle('on', c.dataset.id === w.id));
  $('vtBrand').textContent = w.brand;
  $('vtModel').textContent = w.model;
  $('vtSub').textContent = w.sub;
  const i = catalog.indexOf(w);
  $('vtCount').innerHTML = '<b>' + String(i + 1).padStart(2, '0') + '</b> / ' + String(catalog.length).padStart(2, '0');
  const head = document.querySelector('.vt-head');
  head.classList.remove('in'); void head.offsetWidth; head.classList.add('in');
  $('vtCredit').innerHTML = 'Modèle 3D : ' + (w.authorUrl ? '<a href="' + esc(w.authorUrl) + '" target="_blank" rel="noopener">' + esc(w.author) + '</a>' : esc(w.author)) + ' · <a href="' + esc(w.source) + '" target="_blank" rel="noopener">Sketchfab</a> · <a href="' + esc(w.licenseUrl) + '" target="_blank" rel="noopener">' + esc(w.license) + '</a>';
  holder.clear(); dirty = true;
  document.querySelector('.vt-stage').classList.toggle('empty', !w.available);
  if(!w.available){
    state('<span class="vt-soon">Bientôt en vitrine</span><p>Son modèle 3D arrive prochainement. En attendant, <span style="white-space:nowrap">parlons-en.</span></p><a class="btn btn-line btn-sm" href="index.html#rendez-vous">Nous contacter</a>');
    return;
  }
  try {
    let root = cache[w.id];
    if(!root){
      state('<b>Chargement…</b><p>' + esc(w.brand + ' ' + w.model) + '</p>', 0);
      const gltf = await loader.loadAsync(w.path, (e)=>{ if(token === loadToken && e.total) state('<b>Chargement…</b><p>' + esc(w.brand + ' ' + w.model) + '</p>', e.loaded / e.total); });
      root = new THREE.Group(); root.add(gltf.scene);
      // chaque modele a son orientation d'origine : on tourne le cadran vers la vue « Face »
      if(w.rotation) gltf.scene.rotation.set(...w.rotation.map(THREE.MathUtils.degToRad));
      const size = normalize(gltf.scene);
      root.userData.size = size;
      cache[w.id] = root;
    }
    if(token !== loadToken) return;
    holder.add(root);
    const s = root.userData.size;
    fitDist = Math.max(s.x / camera.aspect, s.y) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.4 + s.z * 0.5;
    controls.maxDistance = fitDist * 2.5; controls.minDistance = fitDist * 0.25;
    goView('front', true);
    document.querySelectorAll('#vtViews button').forEach(b=>b.classList.toggle('on', b.dataset.view === 'front'));
    state(null);
  } catch(e){
    if(token !== loadToken) return;
    state('<b>Chargement interrompu</b><p>Ce modèle n’a pas pu s’afficher. Réessayez ou choisissez une autre pièce.</p>');
  }
}

// ---------- Interface ----------
function renderCards(){
  $('vtCards').innerHTML = catalog.map((w, i)=>
    '<button type="button" class="vt-card' + (w.available ? '' : ' soon') + '" data-id="' + esc(w.id) + '"><span class="n">' + String(i + 1).padStart(2, '0') + '</span><span class="b">' + esc(w.brand) + '</span><span class="m">' + esc(w.model) + '</span><span class="s">' + esc(w.sub) + '</span>' +
    (w.available ? '' : '<span class="lic"><em>Bientôt en vitrine</em></span>') + '</button>'
  ).join('');
  document.querySelectorAll('.vt-card').forEach(c=>c.addEventListener('click', ()=>show(catalog.find(w=>w.id === c.dataset.id))));
}
document.querySelectorAll('#vtViews button').forEach(b=>b.addEventListener('click', ()=>{ controls.autoRotate = false; $('vtSpin').checked = false; goView(b.dataset.view); }));
$('vtSpin').addEventListener('change', (e)=>{ controls.autoRotate = e.target.checked && !reduced; dirty = true; });
canvas.addEventListener('pointerdown', ()=>{ tween = null; });
controls.addEventListener('change', ()=>{ dirty = true; });

// ---------- Boucle : rendu a la demande, haute definition a l'arret ----------
const clock = new THREE.Clock();
let stillSince = 0;
function frame(){
  requestAnimationFrame(frame);
  if(document.hidden) return;
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  if(tween){
    tween.t = Math.min(1, tween.t + dt / 1.2);
    const k = tween.t < 0.5 ? 4 * tween.t ** 3 : 1 - Math.pow(-2 * tween.t + 2, 3) / 2;
    camera.position.lerpVectors(tween.from, tween.to, k);
    if(tween.t >= 1) tween = null;
    dirty = true;
  }
  controls.update();
  if(dirty) stillSince = t;
  const want = (t - stillSince) > 0.25 ? PR_STILL : PR_MOVE;
  if(want !== pixelRatio){ pixelRatio = want; resize(); dirty = true; }
  if(!dirty) return;
  dirty = false;
  renderer.render(scene, camera);
}

(async function start(){
  resize();
  try { catalog = (await (await fetch('models/catalog.json', { cache:'no-store' })).json()).watches; } catch(e){ catalog = []; }
  await Promise.all(catalog.map(async w=>{ w.available = await exists(w.path); }));
  // les pieces deja en 3D d'abord, celles a venir ensuite
  catalog = [...catalog.filter(w=>w.available), ...catalog.filter(w=>!w.available)];
  renderCards();
  const first = catalog.find(w=>w.available) || catalog[0];
  if(first) show(first);
  frame();
})();
