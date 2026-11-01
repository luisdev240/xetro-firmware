import * as THREE from 'three';
import { OrbitControls } from './assets/vendor/OrbitControls.js';
import { RoomEnvironment } from './assets/vendor/RoomEnvironment.js';

const stage = document.querySelector('#device-stage');
const canvas = document.querySelector('#device-canvas');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function roundedShape(width, height, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2, y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function extruded(width, height, radius, depth, material, z = 0) {
  const geometry = new THREE.ExtrudeGeometry(roundedShape(width, height, radius), {
    depth, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: .045, bevelThickness: .045, curveSegments: 24,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = z;
  return mesh;
}

function cylinder(radius, depth, material, x, y, z, segments = 64) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, segments), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

async function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xdcebc4, 0x15200d, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 4);
  key.position.set(-4, 7, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb3fa65, 3.2);
  rim.position.set(5, -2, -1);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xc5d7e4, 2);
  fill.position.set(3, 2, 6);
  scene.add(fill);

  const device = new THREE.Group();
  device.rotation.set(-.11, -.27, -.16);
  scene.add(device);

  const shellMaterial = new THREE.MeshPhysicalMaterial({ color: 0x57604f, metalness: .32, roughness: .24,
    transparent: true, opacity: .9, transmission: .12, thickness: .5, clearcoat: 1, clearcoatRoughness: .17 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b1009, metalness: .45, roughness: .34 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x151b10, metalness: .12, roughness: .61 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x7f8972, metalness: .92, roughness: .26 });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xc0c9a9, transparent: true, opacity: .32 });
  const rear = extruded(7.45, 3.03, 1.27, .5, dark, -.35);
  device.add(rear);
  const shell = extruded(7.5, 3.06, 1.29, .67, shellMaterial, -.26);
  device.add(shell);
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(shell.geometry, 35), edgeMaterial);
  outline.position.copy(shell.position);
  device.add(outline);

  // Circuit traces beneath the translucent front, built as native geometry.
  const traceMaterial = new THREE.MeshStandardMaterial({ color: 0x536f38, metalness: .75, roughness: .37 });
  for (let i = 0; i < 9; i++) {
    const trace = new THREE.Mesh(new THREE.BoxGeometry(.016, .18 + i * .036, .012), traceMaterial);
    trace.position.set(-2.6 + i * .5, -1.16, .46);
    device.add(trace);
    const pin = new THREE.Mesh(new THREE.BoxGeometry(.12, .045, .018), metal);
    pin.position.set(-2.6 + i * .5, -1.3, .49);
    device.add(pin);
  }

  const bezel = extruded(4.08, 2.26, .12, .08, dark, .43);
  bezel.position.x = -1.02;
  device.add(bezel);
  const screenEdge = new THREE.LineSegments(new THREE.EdgesGeometry(bezel.geometry, 30),
    new THREE.LineBasicMaterial({ color: 0x8b977c, transparent: true, opacity: .65 }));
  screenEdge.position.copy(bezel.position);
  device.add(screenEdge);
  const loader = new THREE.TextureLoader();
  const textures = new Map();
  async function screenTexture(key) {
    if (!textures.has(key)) {
      const texture = await loader.loadAsync(`assets/${key}.png`);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      textures.set(key, texture);
    }
    return textures.get(key);
  }
  const screenMaterial = new THREE.MeshBasicMaterial({ map: await screenTexture('menu-navigateur'), color: 0xcfe4b6, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.87, 1.935), screenMaterial);
  screen.position.set(-1.02, .01, .565);
  device.add(screen);

  const dialX = 2.28;
  device.add(cylinder(1.12, .17, metal, dialX, 0, .5));
  device.add(cylinder(1.065, .2, dark, dialX, 0, .66));
  device.add(cylinder(.97, .24, rubber, dialX, 0, .79));
  const ringMaterial = new THREE.MeshStandardMaterial({ color: 0x626f52, roughness: .3, metalness: .8 });
  for (const [radius, z] of [[1.025, .8], [.9, .93], [.49, .96], [.27, 1.005]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .023, 10, 80), ringMaterial);
    ring.position.set(dialX, 0, z);
    device.add(ring);
  }
  const ridgeGeometry = new THREE.BoxGeometry(.028, .105, .03);
  for (let i = 0; i < 48; i++) {
    const angle = i / 48 * Math.PI * 2;
    const ridge = new THREE.Mesh(ridgeGeometry, dark);
    ridge.position.set(dialX + Math.cos(angle) * .82, Math.sin(angle) * .82, .928);
    ridge.rotation.z = angle - Math.PI / 2;
    device.add(ridge);
  }
  device.add(cylinder(.46, .04, dark, dialX, 0, .94));
  device.add(cylinder(.24, .08, metal, dialX, 0, 1));
  device.add(cylinder(.13, .014, rubber, dialX, 0, 1.05));
  const capMark = new THREE.Mesh(new THREE.BoxGeometry(.04, .12, .015), metal);
  capMark.position.set(dialX, .66, .95);
  device.add(capMark);

  const ledGeometry = new THREE.SphereGeometry(.045, 12, 12);
  const ledMaterial = new THREE.MeshStandardMaterial({ color: 0xc7fa63, emissive: 0xa7e644, emissiveIntensity: 1.6, roughness: .2 });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + .2;
    const led = new THREE.Mesh(ledGeometry, ledMaterial);
    led.position.set(dialX + Math.cos(a) * 1.107, Math.sin(a) * 1.107, .65);
    device.add(led);
  }
  for (const [x, y] of [[-3.26, .73], [-3.26, -.73], [1.18, 1.13], [1.18, -1.13]]) {
    device.add(cylinder(.075, .025, metal, x, y, .5, 20));
    const slit = new THREE.Mesh(new THREE.BoxGeometry(.09, .017, .008), dark);
    slit.position.set(x, y, .52);
    slit.rotation.z = .4;
    device.add(slit);
  }
  const usb = new THREE.Mesh(new THREE.BoxGeometry(.48, .13, .25), dark);
  usb.position.set(-.3, -1.5, .07);
  device.add(usb);

  const controls = new OrbitControls(camera, canvas);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = .075;
  controls.rotateSpeed = .65;
  controls.minPolarAngle = .65;
  controls.maxPolarAngle = 2.3;
  controls.minAzimuthAngle = -1.15;
  controls.maxAzimuthAngle = 1.15;
  controls.target.set(0, 0, 0);
  let dragging = false;
  controls.addEventListener('start', () => { dragging = true; });
  controls.addEventListener('end', () => { dragging = false; });

  function resize() {
    const width = stage.clientWidth, height = stage.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const fov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // Leave room for the protruding encoder and perspective at rotated angles.
    const distance = Math.max(7.8 / (2 * fov * camera.aspect), 4 / (2 * fov)) * 1.25;
    camera.position.set(0, .45, distance);
    camera.updateProjectionMatrix();
    controls.update();
    controls.saveState();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  window.addEventListener('xetro:screen', async event => {
    const key = event.detail;
    const texture = await screenTexture(key);
    if (stage.dataset.screen !== key) return;
    screenMaterial.map = texture;
    screenMaterial.needsUpdate = true;
  });
  window.addEventListener('xetro:reset', () => { controls.reset(); });
  let visible = true;
  let flasherOpen = false;
  window.addEventListener('xetro:flasher', event => { flasherOpen = event.detail; });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }).observe(stage);
  const started = performance.now();
  let first = true;
  function render(now) {
    requestAnimationFrame(render);
    if (!visible || document.hidden || flasherOpen) return;
    if (!reducedMotion.matches && !dragging) {
      const t = (now - started) / 1000;
      device.position.y = Math.sin(t * .75) * .055;
      device.rotation.y = -.27 + Math.sin(t * .3) * .025;
    }
    controls.update();
    renderer.render(scene, camera);
    if (first) {
      first = false;
      stage.classList.add('ready');
      stage.dataset.model = 'ready';
    }
  }
  requestAnimationFrame(render);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    stage.classList.remove('ready');
    stage.dataset.model = 'fallback';
  });
}

start().catch(error => {
  stage.dataset.model = 'fallback';
  document.querySelector('.model-status').textContent = 'APERÇU INTERACTIF';
  console.warn('Le modèle WebGL est indisponible : aperçu de secours affiché.', error);
});
