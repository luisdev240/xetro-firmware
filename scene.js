import * as THREE from 'three';
import { OrbitControls } from './assets/vendor/OrbitControls.js';
import { RoomEnvironment } from './assets/vendor/RoomEnvironment.js';

const stage = document.querySelector('#device-stage');
const canvas = document.querySelector('#device-canvas');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function roundedShape(width, height, radius, cx = 0, cy = 0) {
  const shape = new THREE.Shape();
  const x = cx - width / 2, y = cy - height / 2;
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

function extruded(width, height, radius, depth, material, z = 0, holes = []) {
  const shape = roundedShape(width, height, radius);
  shape.holes.push(...holes);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .025, bevelThickness: .025, curveSegments: 24,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = z;
  return mesh;
}

function label(text, width, height, color = '#b8b4ad') {
  const image = document.createElement('canvas');
  image.width = 1024;
  image.height = 128;
  const context = image.getContext('2d');
  context.fillStyle = color;
  context.font = '500 72px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 512, 66);
  const texture = new THREE.CanvasTexture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}

function cylinder(radius, depth, material, x, y, z, segments = 64) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, segments), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

async function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xe8ecf2, 0x17110c, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 3.4);
  key.position.set(-4, 7, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff7c28, 3.0);
  rim.position.set(5, -2, -1);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xcdd9ef, 1.6);
  fill.position.set(3, 2, 6);
  scene.add(fill);

  const device = new THREE.Group();
  device.rotation.set(-.25, -.3, -.12);
  scene.add(device);

  // Enclosure, encoder and keys are tessellated from LILYGO's published STEP files.
  // The source coordinates preserve the 98 x 39 x 31 mm proportions.
  const assemblyRoot = new THREE.Group();
  assemblyRoot.position.z = .756;
  device.add(assemblyRoot);
  const rearAssembly = new THREE.Group();
  const boardAssembly = new THREE.Group();
  const frontAssembly = new THREE.Group();
  const displayAssembly = new THREE.Group();
  const dialAssembly = new THREE.Group();
  assemblyRoot.add(rearAssembly, boardAssembly, frontAssembly, displayAssembly, dialAssembly);
  const shellMaterial = new THREE.MeshPhysicalMaterial({ color: 0xb8c0c8, metalness: .05,
    roughness: .13, transparent: true, opacity: .24, depthWrite: false,
    clearcoat: .8, clearcoatRoughness: .13, envMapIntensity: .6 });
  const rotorMaterial = shellMaterial.clone();
  rotorMaterial.opacity = .36;
  rotorMaterial.roughness = .21;
  const dark = new THREE.MeshStandardMaterial({ color: 0x101214, metalness: .08, roughness: .68 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x08090a, metalness: 0, roughness: .92 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb1b7be, metalness: .9, roughness: .26 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xb18b49, metalness: .8, roughness: .32 });
  const pcbMaterial = new THREE.MeshStandardMaterial({ color: 0x080b0e, metalness: .05, roughness: .75, envMapIntensity: .5 });
  const box = (w, h, d, material, x, y, z, parent) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const dialX = 29.5 * 7.5 / 98;
  const rotor = new THREE.Group();
  rotor.position.x = dialX;
  dialAssembly.add(rotor);
  const assets = await Promise.all([
    fetch('assets/tembed/geometry.json').then(response => {
      if (!response.ok) throw new Error('Enclosure manifest unavailable');
      return response.json();
    }),
    fetch('assets/tembed/geometry.bin').then(response => {
      if (!response.ok) throw new Error('Enclosure geometry unavailable');
      return response.arrayBuffer();
    }),
  ]);
  const [manifest, buffer] = assets;
  const partMaterials = { body: shellMaterial, front: shellMaterial, rear: shellMaterial,
    'back-pad': rubber, magnet: metal, rotor: rotorMaterial,
    'rotor-button': metal, 'rotor-base': rotorMaterial, 'side-key': shellMaterial, pcb: pcbMaterial };
  const partParents = { body: boardAssembly, front: frontAssembly, rear: rearAssembly,
    'back-pad': rearAssembly, magnet: boardAssembly, rotor, 'rotor-button': rotor,
    'rotor-base': dialAssembly, 'side-key': boardAssembly, pcb: boardAssembly };
  for (const part of manifest.parts) {
    // The Plus photos show a revised three-piece pad with two round openings.
    // Retain the CAD housing, and reproduce that visible pad below.
    if (part.kind === 'back-pad') continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buffer, part.position, part.vertices * 3), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(buffer, part.normal, part.vertices * 3), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer, part.index, part.indices), 1));
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, partMaterials[part.kind]);
    mesh.name = part.name;
    if (partParents[part.kind] === rotor) mesh.position.x = -dialX;
    partParents[part.kind].add(mesh);
  }
  const padMaterial = rubber.clone();
  padMaterial.side = THREE.DoubleSide;
  const padLeft = new THREE.Shape();
  padLeft.moveTo(-1.43, -1.335);
  padLeft.lineTo(-2.185, -1.335);
  padLeft.absarc(-2.185, 0, 1.335, -Math.PI / 2, Math.PI / 2, true);
  padLeft.lineTo(-1.43, 1.335);
  padLeft.closePath();
  const padRight = new THREE.Shape();
  padRight.moveTo(1.43, 1.335);
  padRight.lineTo(2.185, 1.335);
  padRight.absarc(2.185, 0, 1.335, Math.PI / 2, -Math.PI / 2, true);
  padRight.lineTo(1.43, -1.335);
  padRight.closePath();
  for (const [shape, x] of [[padLeft, -1.83], [padRight, 1.83]]) {
    const hole = new THREE.Path();
    hole.absarc(x, 0, .235, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const pad = new THREE.Mesh(new THREE.ShapeGeometry(shape, 48), padMaterial);
    pad.position.z = -1.955;
    rearAssembly.add(pad);
    rearAssembly.add(cylinder(.232, .012, metal, x, 0, -1.951, 48));
  }
  const centerPad = new THREE.Mesh(new THREE.ShapeGeometry(roundedShape(2.5, 2.67, .025)), padMaterial);
  centerPad.position.z = -1.955;
  rearAssembly.add(centerPad);

  // Small electronic details supplement the manufacturer's mechanical model.
  // They are illustrative; exterior dimensions and cut-outs come from the CAD.
  const battery = extruded(3.6, 1.9, .12, .38, metal, -1.39);
  battery.position.x = -.6;
  boardAssembly.add(battery);
  box(.26, 1.89, .39, gold, -2.2, 0, -1.18, boardAssembly);
  box(1.72, 1.7, .055, dark, -.08, 0, -1.51, boardAssembly);
  for (let i = 0; i < 9; i++) {
    box(.055, .12, .012, gold, -.78 + i * .16, -.75, -1.551, boardAssembly);
    box(.055, .12, .012, gold, -.78 + i * .16, .75, -1.551, boardAssembly);
  }
  const rfLabel = label('nRF24L01', 1.15, .12, '#b8bdc1');
  rfLabel.position.set(-.08, 0, -1.548);
  rfLabel.rotation.y = Math.PI;
  boardAssembly.add(rfLabel);
  const antennaWire = new THREE.CatmullRomCurve3([
    new THREE.Vector3(.65, .5, -1.55), new THREE.Vector3(1.1, .68, -1.53),
    new THREE.Vector3(1.4, .35, -1.5), new THREE.Vector3(2.2, .12, -1.4),
  ]);
  boardAssembly.add(new THREE.Mesh(new THREE.TubeGeometry(antennaWire, 24, .018, 6, false), rubber));
  const copper = new THREE.MeshStandardMaterial({ color: 0x9c542f, metalness: .65, roughness: .4 });
  for (const z of [-.5, -.76, -1.02]) {
    const points = Array.from({ length: 33 }, (_, i) => {
      const angle = Math.PI / 2 + i / 32 * Math.PI;
      return new THREE.Vector3(-2.25 + Math.cos(angle) * 1.42, Math.sin(angle) * 1.42, z);
    });
    const path = new THREE.CatmullRomCurve3(points);
    boardAssembly.add(new THREE.Mesh(new THREE.TubeGeometry(path, 40, .009, 5, false), copper));
  }

  const port = new THREE.Group();
  port.position.set(.61, -1.475, -.765);
  port.rotation.x = Math.PI / 2;
  port.add(extruded(.7, .25, .10, .025, metal));
  const portVoid = extruded(.58, .16, .065, .006, rubber, .05);
  port.add(portVoid);
  box(.39, .026, .006, dark, 0, 0, .085, port);
  boardAssembly.add(port);
  const screenX = (-11.575 + 1.5) * 7.5 / 98;
  const screenBed = new THREE.Mesh(new THREE.PlaneGeometry(3.36, 1.82), dark);
  screenBed.position.set(screenX, 0, .172);
  displayAssembly.add(screenBed);
  const loader = new THREE.TextureLoader();
  const textures = new Map();
  async function screenTexture(key) {
    if (!textures.has(key)) {
      textures.set(key, loader.loadAsync(`assets/${key}.png`).then(texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        return texture;
      }));
    }
    return textures.get(key);
  }
  const screenMaterial = new THREE.MeshBasicMaterial({ map: await screenTexture('menu-navigateur'), color: 0xf4f5ed, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.265, 1.734), screenMaterial);
  screen.position.set(screenX, 0, .181);
  displayAssembly.add(screen);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.77),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .035,
      metalness: 0, roughness: .12, clearcoat: 1, depthWrite: false }));
  glass.position.set(screenX, 0, .19);
  displayAssembly.add(glass);

  const dialPCB = cylinder(1.015, .012, dark, dialX, 0, .018, 64);
  dialAssembly.add(dialPCB);
  rotor.add(cylinder(.18, .006, dark, 0, 0, .433, 48));
  const spokeMaterial = new THREE.LineBasicMaterial({ color: 0xbfc7cf, transparent: true, opacity: .85 });
  for (let spoke = 0; spoke < 3; spoke++) {
    const points = Array.from({ length: 13 }, (_, i) => {
      const angle = THREE.MathUtils.degToRad(52 + i / 12 * 76);
      return new THREE.Vector3(Math.cos(angle) * .78, Math.sin(angle) * .78, .434);
    });
    points.push(new THREE.Vector3(-.18, .34, .434), new THREE.Vector3(.18, .34, .434));
    const marking = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), spokeMaterial);
    marking.rotation.z = spoke * Math.PI * 2 / 3;
    rotor.add(marking);
  }
  box(.06, .235, .006, metal, 0, 0, .44, rotor);
  box(.235, .06, .006, metal, 0, 0, .44, rotor);
  box(.03, .2, .006, dark, 0, 0, .447, rotor);
  box(.2, .03, .006, dark, 0, 0, .447, rotor);
  const ledMaterial = new THREE.MeshStandardMaterial({ color: 0xff9447, emissive: 0xff6416, emissiveIntensity: 1.8, roughness: .3 });
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2;
    const led = box(.085, .065, .026, ledMaterial, dialX + Math.cos(angle) * 1.035, Math.sin(angle) * 1.035, .072, dialAssembly);
    led.rotation.z = angle;
  }
  // The two screw heads between LCD and encoder, visible on the real front.
  for (const y of [-1.08, 1.08]) {
    frontAssembly.add(cylinder(.058, .026, metal, .94, y, .115, 20));
    box(.065, .012, .008, rubber, .94, y, .133, frontAssembly);
  }
  const hardwareBrand = label('LILYGO', .86, .115, '#c5cbd0');
  hardwareBrand.rotation.z = Math.PI / 2;
  hardwareBrand.position.set(-3.23, 0, .115);
  frontAssembly.add(hardwareBrand);
  const mic = cylinder(.052, .014, rubber, .94, -.82, .13, 16);
  frontAssembly.add(mic);

  const controls = new OrbitControls(camera, canvas);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = .1;
  controls.rotateSpeed = .6;
  controls.minPolarAngle = .35;
  controls.maxPolarAngle = Math.PI - .35;
  controls.target.set(0, 0, 0);
  const layers = [
    [rearAssembly, new THREE.Vector3(-.22, -.12, -.9)],
    [boardAssembly, new THREE.Vector3(0, 0, 0)],
    [frontAssembly, new THREE.Vector3(.05, .08, .48)],
    [displayAssembly, new THREE.Vector3(-.3, .28, 1)],
    [dialAssembly, new THREE.Vector3(.42, .08, 1.45)],
  ];
  let exploded = stage.dataset.explodeRequested === 'true';
  let separation = 0;
  let backView = false;
  let turn = -.3;
  let dialTurn = 0;
  let dialTarget = 0;
  const backButton = document.querySelector('#rear-view');
  function setBackView(value) {
    backView = value;
    backButton.setAttribute('aria-pressed', String(value));
    backButton.textContent = value ? 'Voir la face' : 'Voir le dos';
    controls.reset();
  }
  backButton.addEventListener('click', () => setBackView(!backView));
  window.addEventListener('xetro:explode', event => { exploded = event.detail; });
  function setFinish(finish) {
    const black = finish === 'carbon';
    shellMaterial.color.setHex(black ? 0x111418 : 0xb8c0c8);
    shellMaterial.transparent = !black;
    shellMaterial.opacity = black ? 1 : .24;
    shellMaterial.depthWrite = black;
    shellMaterial.roughness = black ? .62 : .13;
    shellMaterial.clearcoat = black ? .2 : 1;
    shellMaterial.envMapIntensity = black ? .45 : .6;
    shellMaterial.needsUpdate = true;
    rotorMaterial.color.setHex(black ? 0x25282d : 0xb8c0c8);
    rotorMaterial.transparent = !black;
    rotorMaterial.opacity = black ? 1 : .36;
    rotorMaterial.depthWrite = black;
    rotorMaterial.roughness = black ? .5 : .21;
    rotorMaterial.needsUpdate = true;
  }
  window.addEventListener('xetro:finish', event => setFinish(event.detail));
  setFinish(stage.dataset.modelFinish);
  let dragging = false;
  controls.addEventListener('start', () => { dragging = true; });
  controls.addEventListener('end', () => { dragging = false; });
  canvas.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') { setBackView(false); return; }
    const offset = camera.position.clone().sub(controls.target);
    const orbit = new THREE.Spherical().setFromVector3(offset);
    if (event.key === 'ArrowLeft') orbit.theta -= .16;
    if (event.key === 'ArrowRight') orbit.theta += .16;
    if (event.key === 'ArrowUp') orbit.phi -= .12;
    if (event.key === 'ArrowDown') orbit.phi += .12;
    orbit.phi = THREE.MathUtils.clamp(orbit.phi, controls.minPolarAngle, controls.maxPolarAngle);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(orbit));
    controls.update();
  });

  function resize() {
    const width = stage.clientWidth, height = stage.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const fov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // Leave room for the protruding encoder and perspective at rotated angles.
    const distance = Math.max(7.8 / (2 * fov * camera.aspect), 4 / (2 * fov)) * 1.25;
    // Resizing preserves the angle selected by the visitor.
    const direction = camera.position.lengthSq() ? camera.position.clone().normalize() : new THREE.Vector3(0, .025, 1).normalize();
    camera.position.copy(direction.multiplyScalar(distance));
    camera.updateProjectionMatrix();
    controls.update();
    controls.saveState();
    controls.position0.set(0, .025, 1).normalize().multiplyScalar(distance);
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  window.addEventListener('xetro:screen', async event => {
    const key = event.detail;
    dialTarget -= Math.PI / 8;
    const texture = await screenTexture(key);
    if (stage.dataset.screen !== key) return;
    screenMaterial.map = texture;
    screenMaterial.needsUpdate = true;
  });
  if (stage.dataset.screen && stage.dataset.screen !== 'menu-navigateur') {
    window.dispatchEvent(new CustomEvent('xetro:screen', { detail: stage.dataset.screen }));
  }
  window.addEventListener('xetro:reset', () => { setBackView(false); });
  let visible = true;
  let flasherOpen = false;
  let contextLost = false;
  window.addEventListener('xetro:flasher', event => { flasherOpen = event.detail; });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }).observe(stage);
  const started = performance.now();
  let first = true;
  let previousFrame = 0;
  function render(now) {
    requestAnimationFrame(render);
    if (!visible || document.hidden || flasherOpen || contextLost) return;
    if (!dragging && !first && now - previousFrame < 1000 / 30) return;
    const delta = Math.min((now - previousFrame) / 1000, .1);
    previousFrame = now;
    separation = reducedMotion.matches ? Number(exploded) :
      THREE.MathUtils.damp(separation, Number(exploded), 7, delta);
    for (const [assembly, offset] of layers) assembly.position.copy(offset).multiplyScalar(separation);
    const targetTurn = -.3 + (backView ? Math.PI : 0);
    turn = reducedMotion.matches ? targetTurn : THREE.MathUtils.damp(turn, targetTurn, 7, delta);
    dialTurn = reducedMotion.matches ? dialTarget : THREE.MathUtils.damp(dialTurn, dialTarget, 10, delta);
    rotor.rotation.z = dialTurn;
    device.rotation.y = turn - separation * .4;
    device.rotation.x = -.25 - separation * .16;
    stage.dataset.exploded = separation > .95 ? 'true' : separation < .05 ? 'false' : 'transition';
    if (!reducedMotion.matches && !dragging) {
      const t = (now - started) / 1000;
      device.position.y = Math.sin(t * .75) * .055;
      device.rotation.y += Math.sin(t * .3) * .018;
    }
    controls.update();
    renderer.render(scene, camera);
    if (first) {
      first = false;
      stage.classList.add('ready');
      stage.dataset.model = 'ready';
      window.dispatchEvent(new Event('xetro:model-ready'));
    }
  }
  requestAnimationFrame(render);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost = true;
    stage.classList.remove('ready');
    stage.dataset.model = 'fallback';
    window.dispatchEvent(new Event('xetro:model-unavailable'));
  });
  canvas.addEventListener('webglcontextrestored', () => { contextLost = false; first = true; });
}

start().catch(error => {
  stage.dataset.model = 'fallback';
  document.querySelector('.model-status').textContent = 'APERÇU INTERACTIF';
  window.dispatchEvent(new Event('xetro:model-unavailable'));
  console.warn('Le modèle WebGL est indisponible : aperçu de secours affiché.', error);
});
