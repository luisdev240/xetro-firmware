document.documentElement.classList.add('js');

const captures = {
  'menu-navigateur': { title: 'MENU PRINCIPAL', description: 'Des icônes personnalisées. L’essentiel à un cran de molette.', alt: 'Menu principal du firmware, avec Navigateur sélectionné.' },
  navigateur: { title: 'NAVIGATEUR PC', description: 'Les pages sur le T-Embed. Le moteur web sur ton PC.', alt: 'Écran Navigateur PC avec les commandes de navigation à la molette.' },
  'ia-chat': { title: 'IA CHAT', description: 'OK pour parler. La molette pour retrouver le fil.', alt: 'IA Chat : OK pour parler et rotation pour défiler dans le chat.' },
  dualboot: { title: 'DUAL BOOT', description: 'Bruce ou Xetro. Les deux restent à portée de main.', alt: 'Menu Dual Boot du firmware proposant de démarrer Bruce.' },
  parametres: { title: 'PARAMÈTRES / 1.4.3', description: 'L’interface, les protocoles, les détails. À ta façon.', alt: 'Paramètres du firmware 1.4.3 avec Interface, Protocols et Misc.' },
};

const tabs = [...document.querySelectorAll('[data-gallery]')];
const galleryImage = document.querySelector('#gallery-image');
const dialog = document.querySelector('#capture-dialog');
let currentCapture = 'menu-navigateur';

function selectCapture(key, focus = false) {
  if (!captures[key]) return;
  currentCapture = key;
  tabs.forEach(tab => {
    const selected = tab.dataset.gallery === key;
    tab.classList.toggle('selected', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  });
  galleryImage.src = `assets/${key}.png`;
  galleryImage.alt = captures[key].alt;
  document.querySelector('#capture-label').textContent = captures[key].title;
  document.querySelector('#capture-description').textContent = captures[key].description;
  document.querySelector('#gallery-panel').setAttribute('aria-labelledby', `tab-${key}`);
  document.querySelector('#capture-button').setAttribute('aria-label', `Agrandir : ${captures[key].title}`);
  if (dialog.open) updateDialog();
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectCapture(tab.dataset.gallery));
  tab.addEventListener('keydown', event => {
    let next = index;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    selectCapture(tabs[next].dataset.gallery, true);
  });
});

document.querySelectorAll('[data-select-gallery]').forEach(link => {
  link.addEventListener('click', () => selectCapture(link.dataset.selectGallery));
});

function updateDialog() {
  const image = document.querySelector('#dialog-image');
  image.src = `assets/${currentCapture}.png`;
  image.alt = captures[currentCapture].alt;
  document.querySelector('#dialog-caption').textContent = captures[currentCapture].title;
}

function enlargeCapture() {
  updateDialog();
  dialog.showModal();
}
document.querySelector('#enlarge-capture').addEventListener('click', enlargeCapture);
document.querySelector('#capture-button').addEventListener('click', enlargeCapture);
document.querySelector('#close-capture').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('keydown', event => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  const keys = Object.keys(captures);
  const next = (keys.indexOf(currentCapture) + (event.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length;
  selectCapture(keys[next]);
});

const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function setMenu(open) {
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  navigation.classList.toggle('open', open);
}
menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', event => { if (event.key === 'Escape') setMenu(false); });

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: .08 });
document.querySelectorAll('.reveal').forEach(section => observer.observe(section));

const stage = document.querySelector('#device-stage');
const modelButtons = document.querySelectorAll('[data-model-screen]');
modelButtons.forEach(button => {
  button.addEventListener('click', () => {
    modelButtons.forEach(item => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    const key = button.dataset.modelScreen;
    document.querySelector('.fallback-screen img').src = `assets/${key}.png`;
    stage.dataset.screen = key;
    window.dispatchEvent(new CustomEvent('xetro:screen', { detail: key }));
  });
});

// Keep a usable, draggable visual when WebGL is unavailable.
let fallbackDrag = null;
stage.addEventListener('pointerdown', event => {
  if (stage.classList.contains('ready')) return;
  fallbackDrag = { x: event.clientX, y: event.clientY };
  stage.setPointerCapture(event.pointerId);
});
stage.addEventListener('pointermove', event => {
  if (!fallbackDrag) return;
  const x = Math.max(-30, Math.min(30, (event.clientX - fallbackDrag.x) / 5));
  const y = Math.max(-20, Math.min(20, (event.clientY - fallbackDrag.y) / 5));
  document.querySelector('.fallback-shell').style.transform = `perspective(900px) rotateX(${-y}deg) rotateY(${-18 + x}deg) rotateZ(-12deg)`;
});
stage.addEventListener('pointerup', () => { fallbackDrag = null; });
stage.addEventListener('pointercancel', () => { fallbackDrag = null; });
document.querySelector('#reset-view').addEventListener('click', () => {
  document.querySelector('.fallback-shell').style.transform = '';
  window.dispatchEvent(new Event('xetro:reset'));
});

// Warm up the real screenshots when the page is idle.
const warmImages = () => Object.keys(captures).forEach(key => { const image = new Image(); image.src = `assets/${key}.png`; });
if ('requestIdleCallback' in window) requestIdleCallback(warmImages);
else setTimeout(warmImages, 1200);

// Model controls change only the illustration, never the downloadable firmware.
const explodeButton = document.querySelector('#explode-view');
explodeButton.addEventListener('click', () => {
  const expanded = explodeButton.getAttribute('aria-pressed') !== 'true';
  explodeButton.setAttribute('aria-pressed', String(expanded));
  stage.dataset.explodeRequested = String(expanded);
  window.dispatchEvent(new CustomEvent('xetro:explode', { detail: expanded }));
});
document.querySelectorAll('[data-finish]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-finish]').forEach(item =>
      item.setAttribute('aria-pressed', String(item === button)));
    const carbon = button.dataset.finish === 'carbon';
    stage.dataset.modelFinish = button.dataset.finish;
    document.querySelector('.fallback-shell').style.background = carbon ? '#252d22' : '';
    window.dispatchEvent(new CustomEvent('xetro:finish', { detail: button.dataset.finish }));
  });
});
window.addEventListener('xetro:model-unavailable', () => {
  explodeButton.disabled = true;
  explodeButton.title = 'La vue éclatée nécessite WebGL.';
});

const readingProgress = document.querySelector('.reading-progress');
let scrollPending = false;
function updateReadingProgress() {
  const distance = document.documentElement.scrollHeight - innerHeight;
  readingProgress.style.transform = `scaleX(${distance > 0 ? scrollY / distance : 0})`;
  scrollPending = false;
}
window.addEventListener('scroll', () => {
  if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateReadingProgress); }
}, { passive: true });
window.addEventListener('resize', updateReadingProgress);
updateReadingProgress();

const sectionNavigation = new IntersectionObserver(entries => {
  const active = entries.find(entry => entry.isIntersecting);
  if (!active) return;
  navigation.querySelectorAll('a').forEach(link => {
    if (link.hash === `#${active.target.id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}, { rootMargin: '-20% 0px -60% 0px' });
document.querySelectorAll('#firmware, #experience, #installation, #questions').forEach(section => sectionNavigation.observe(section));
