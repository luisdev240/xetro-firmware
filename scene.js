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

function instanceRing(count, geometry, material, radius, x, z) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const transform = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const angle = i / count * Math.PI * 2;
    transform.position.set(x + Math.cos(angle) * radius, Math.sin(angle) * radius, z);
    transform.rotation.z = angle;
    transform.updateMatrix();
    mesh.setMatrixAt(i, transform.matrix);
  }
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
  device.rotation.set(-.17, -.3, -.12);
  scene.add(device);

  // Five real assemblies: the enclosure no longer intersects a solid front slab.
  const rearAssembly = new THREE.Group();
  const boardAssembly = new THREE.Group();
  const frontAssembly = new THREE.Group();
  const displayAssembly = new THREE.Group();
  const dialAssembly = new THREE.Group();
  device.add(rearAssembly, boardAssembly, frontAssembly, displayAssembly, dialAssembly);
  const shellMaterial = new THREE.MeshPhysicalMaterial({ color: 0x4c4e50, metalness: .38,
    roughness: .34, clearcoat: .65, clearcoatRoughness: .28 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111317, metalness: .35, roughness: .4 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x090a0b, metalness: .03, roughness: .8 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9ba0a6, metalness: .95, roughness: .24 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xff7a1c, metalness: .65, roughness: .28 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xbe8d48, metalness: .85, roughness: .3 });
  const pcbMaterial = new THREE.MeshStandardMaterial({ color: 0x14201d, metalness: .22, roughness: .65 });
  const box = (w, h, d, material, x, y, z, parent) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const outline = (mesh, parent, color = 0x80858b, opacity = .2) => {
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 40),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
    lines.position.copy(mesh.position);
    parent.add(lines);
  };
  const screw = (x, y, z, parent, back = false) => {
    const head = cylinder(.064, .018, metal, x, y, z, 20);
    parent.add(head);
    const slot = box(.072, .012, .006, rubber, x, y, z + (back ? -.014 : .014), parent);
    slot.rotation.z = .5;
    const cross = slot.clone();
    cross.rotation.z += Math.PI / 2;
    parent.add(cross);
  };
  const rear = extruded(7.43, 3, 1.16, .24, shellMaterial, -.59);
  rearAssembly.add(rear);
  outline(rear, rearAssembly);
  const seam = extruded(7.46, 3.025, 1.17, .065, rubber, -.33);
  rearAssembly.add(seam);

  // A recessed back, speaker perforations and a small printed identity plate.
  const backInset = extruded(5.65, 2.17, .25, .035, dark, -.64);
  rearAssembly.add(backInset);
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 8; col++) {
      rearAssembly.add(cylinder(.035, .006, rubber, -2.48 + col * .15, -.3 + row * .15, -.67, 10));
    }
  }
  const backBrand = label('X E T R O', 2.4, .32, '#ff8a2a');
  backBrand.rotation.y = Math.PI;
  backBrand.position.set(.55, .35, -.682);
  rearAssembly.add(backBrand);
  const backText = label('F I R M W A R E', 2.15, .19);
  backText.rotation.y = Math.PI;
  backText.position.set(.55, -.04, -.682);
  rearAssembly.add(backText);
  const backCode = label('DUALBOOT / IA / WEB', 2.35, .13, '#727a82');
  backCode.rotation.y = Math.PI;
  backCode.position.set(.55, -.48, -.682);
  rearAssembly.add(backCode);
  for (const [x, y] of [[-3.03, .79], [-3.03, -.79], [3.03, .79], [3.03, -.79]]) {
    screw(x, y, -.635, rearAssembly, true);
    const foot = extruded(.3, .14, .055, .025, rubber, -.655);
    foot.position.set(x * .87, y * 1.36, -.655);
    rearAssembly.add(foot);
  }

  const board = extruded(6.94, 2.53, .8, .08, pcbMaterial, -.18);
  boardAssembly.add(board);
  const chip = box(1.32, 1.04, .14, dark, -.9, 0, -.02, boardAssembly);
  outline(chip, boardAssembly, 0x767b80, .35);
  const chipLabel = label('ESP32-S3', .95, .14, '#b5bcc2');
  chipLabel.position.set(-.9, .02, .056);
  boardAssembly.add(chipLabel);
  box(.6, .48, .12, dark, .4, .55, -.03, boardAssembly);
  box(.7, .45, .12, metal, -2.22, .54, -.03, boardAssembly);
  for (let i = 0; i < 12; i++) {
    for (const side of [-1, 1]) {
      box(.035, .13, .025, metal, -1.45 + i * .1, side * .58, -.03, boardAssembly);
      box(.025, .18 + (i % 4) * .07, .008, gold, -2.35 + i * .35, -1, -.09, boardAssembly);
    }
  }
  for (let i = 0; i < 10; i++) {
    box(.13, .08, .06, i % 2 ? dark : metal, -2.75 + i * .3, .98, -.05, boardAssembly);
    boardAssembly.add(cylinder(.052, .018, gold, -2.6 + i * .5, -1.08, -.08, 12));
  }
  for (const [x, y] of [[-3.1, .8], [-3.1, -.8], [1.05, 1.12], [1.05, -1.12]]) {
    boardAssembly.add(cylinder(.085, .37, gold, x, y, -.03, 16));
  }
  const ribbon = box(1.08, .42, .018, accent, -1.1, -.83, .05, boardAssembly);
  ribbon.rotation.x = -.3;
  for (let i = 0; i < 9; i++) box(.014, .35, .01, gold, -1.5 + i * .1, -.82, .078, boardAssembly);

  const dialX = 2.28;
  const displayCutout = new THREE.Path(roundedShape(4.18, 2.27, .14, -1.04).getPoints(36));
  const dialCutout = new THREE.Path();
  dialCutout.absarc(dialX, 0, 1.06, 0, Math.PI * 2, true);
  const shell = extruded(7.5, 3.06, 1.18, .42, shellMaterial, -.22, [displayCutout, dialCutout]);
  frontAssembly.add(shell);
  outline(shell, frontAssembly);
  // The orange seam is a narrow contour, not an opaque second housing.
  const trim = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
    roundedShape(7.45, 3.01, 1.16).getPoints(100).map(p => new THREE.Vector3(p.x, p.y, -.235))),
    new THREE.LineBasicMaterial({ color: 0xf67b28, transparent: true, opacity: .65 }));
  frontAssembly.add(trim);
  for (const [x, y] of [[-3.17, .73], [-3.17, -.73], [1.13, 1.18], [1.13, -1.18]]) screw(x, y, .226, frontAssembly);
  const frontBrand = label('XETRO', .63, .105, '#ff8a2a');
  frontBrand.position.set(-2.52, -1.31, .23);
  frontAssembly.add(frontBrand);
  const frontMark = label('CC1101 +', .72, .095, '#b7bbbf');
  frontMark.position.set(-.02, -1.31, .23);
  frontAssembly.add(frontMark);

  // Side-facing connectors stay with the PCB when the enclosure is exploded.
  const port = new THREE.Group();
  port.position.set(-.55, -1.505, -.05);
  port.rotation.x = Math.PI / 2;
  port.add(extruded(.6, .21, .095, .045, metal));
  const portVoid = extruded(.51, .135, .065, .012, rubber, .05);
  port.add(portVoid);
  box(.35, .028, .01, dark, 0, 0, .075, port);
  for (let i = 0; i < 7; i++) box(.018, .016, .006, gold, -.135 + i * .045, 0, .083, port);
  boardAssembly.add(port);
  const sd = new THREE.Group();
  sd.position.set(.63, -1.5, -.07);
  sd.rotation.x = Math.PI / 2;
  sd.add(extruded(.7, .085, .035, .035, rubber));
  boardAssembly.add(sd);
  const sideButton = extruded(.43, .12, .055, .09, accent);
  sideButton.rotation.x = -Math.PI / 2;
  sideButton.position.set(-.3, 1.51, -.06);
  frontAssembly.add(sideButton);

  const bezel = extruded(4.16, 2.25, .13, .12, rubber, .23);
  bezel.position.x = -1.04;
  displayAssembly.add(bezel);
  const innerRim = extruded(4.02, 2.1, .075, .035, metal, .36);
  innerRim.position.x = -1.04;
  displayAssembly.add(innerRim);
  const screenBed = extruded(3.96, 2.04, .06, .025, dark, .402);
  screenBed.position.x = -1.04;
  displayAssembly.add(screenBed);
  const loader = new THREE.TextureLoader();
  const textures = new Map();
  async function screenTexture(key) {
    if (!textures.has(key)) {
      // Cache the in-flight load too; repeated fast clicks share a single texture.
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
  const screenMaterial = new THREE.MeshBasicMaterial({ map: await screenTexture('menu-navigateur'), color: 0xf2e9dc, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.84, 1.92), screenMaterial);
  screen.position.set(-1.04, 0, .485);
  displayAssembly.add(screen);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.91, 1.99),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .045,
      metalness: .1, roughness: .15, clearcoat: 1, depthWrite: false }));
  glass.position.set(-1.04, 0, .493);
  displayAssembly.add(glass);

  // Instanced knurling gives the encoder a real machined edge at two draw calls.
  dialAssembly.add(cylinder(1.08, .13, dark, dialX, 0, .28));
  const ledMaterial = new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xff6500, emissiveIntensity: 1.4, roughness: .28 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.025, .025, 10, 96), ledMaterial);
  ring.position.set(dialX, 0, .38);
  dialAssembly.add(ring);
  const rotor = new THREE.Group();
  rotor.position.x = dialX;
  dialAssembly.add(rotor);
  rotor.add(cylinder(.96, .26, dark, 0, 0, .53));
  rotor.add(instanceRing(64, new THREE.BoxGeometry(.05, .028, .21), metal, .945, 0, .53));
  rotor.add(cylinder(.91, .065, shellMaterial, 0, 0, .695));
  rotor.add(cylinder(.84, .012, dark, 0, 0, .735));
  const dialFace = new THREE.Mesh(new THREE.RingGeometry(.37, .79, 96),
    new THREE.MeshStandardMaterial({ color: 0x33373b, metalness: .8, roughness: .38 }));
  dialFace.position.z = .745;
  rotor.add(dialFace);
  for (const [radius, z] of [[.9, .735], [.8, .747], [.37, .755]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .012, 8, 96), metal);
    ring.position.z = z;
    rotor.add(ring);
  }
  rotor.add(instanceRing(32, new THREE.BoxGeometry(.055, .013, .008), metal, .7, 0, .757));
  rotor.add(cylinder(.325, .07, rubber, 0, 0, .778));
  rotor.add(cylinder(.275, .025, accent, 0, 0, .825));
  const okLabel = label('OK', .23, .09, '#0c0c0c');
  okLabel.position.set(0, 0, .844);
  rotor.add(okLabel);
  const pointer = box(.035, .12, .012, accent, 0, .61, .765, rotor);
  pointer.rotation.z = -.05;
  dialAssembly.add(instanceRing(12, new THREE.SphereGeometry(.025, 8, 8), ledMaterial, 1.04, dialX, .39));

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
    shellMaterial.color.setHex(finish === 'carbon' ? 0x08090b : 0x4c4e50);
    shellMaterial.roughness = finish === 'carbon' ? .64 : .34;
    shellMaterial.metalness = finish === 'carbon' ? .08 : .38;
    shellMaterial.envMapIntensity = finish === 'carbon' ? .45 : 1;
    shellMaterial.clearcoat = finish === 'carbon' ? .25 : .65;
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
    device.rotation.x = -.17 - separation * .16;
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
