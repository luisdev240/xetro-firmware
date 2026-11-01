import md5 from './assets/vendor/md5.mjs';

const FILES = new Map([
  ['bootloader.bin', 0], ['partition-table.bin', 0x8000],
  ['xetro-dualboot-ia.bin', 0x10000], ['bruce-dualboot.bin', 0x600000],
  ['ota_data_initial.bin', 0xbf0000],
]);
const PROTECTED = [[0x9000, 0x10000], [0xc12000, 0x1000000]];

export function validateRelease(release) {
  if (release.schema !== 1 || release.chip !== 'ESP32-S3' || release.flashSize !== '16MB' ||
      release.layout !== 'momentum-bruce-db1' || release.eraseAll !== false ||
      release.groq?.embeddedKey !== false || release.files?.length !== 5) {
    throw new Error('Ce pack ne correspond pas au profil Dualboot + IA. Installation annulée.');
  }
  const seen = new Set();
  const ranges = [];
  for (const file of release.files) {
    if (!FILES.has(file.path) || seen.has(file.path) || FILES.get(file.path) !== file.offset ||
        !Number.isSafeInteger(file.size) || file.size < 1 || !/^[a-f0-9]{64}$/.test(file.sha256)) {
      throw new Error('Le manifeste des fichiers est invalide.');
    }
    seen.add(file.path);
    const start = file.offset, end = start + Math.ceil(file.size / 4096) * 4096;
    if (end > 0x1000000 || PROTECTED.some(([a, b]) => start < b && end > a)) {
      throw new Error('Le pack empiète sur une zone de configuration.');
    }
    if ((start === 0 && end > 0x8000) || (start === 0x8000 && end > 0x9000) ||
        (start === 0x10000 && end > 0x600000) || (start === 0x600000 && end > 0xbf0000) ||
        (start === 0xbf0000 && file.size !== 8192)) throw new Error('Une image dépasse sa partition.');
    ranges.push([start, end]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  if (ranges.some((range, i) => i && range[0] < ranges[i - 1][1])) throw new Error('Les fichiers se chevauchent.');
  return release;
}

export async function fetchFirmware(release, fetcher = fetch) {
  validateRelease(release);
  return Promise.all(release.files.map(async file => {
    const response = await fetcher(`./firmware/${file.path}`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Téléchargement impossible : ${file.path}.`);
    const data = new Uint8Array(await response.arrayBuffer());
    if (data.byteLength !== file.size) throw new Error(`Fichier incomplet : ${file.path}.`);
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))]
      .map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== file.sha256) throw new Error(`Vérification échouée : ${file.path}.`);
    return { address: file.offset, data };
  }));
}

export async function writeRelease(loader, release, fileArray, onProgress) {
  validateRelease(release);
  if (loader.chip?.CHIP_NAME !== 'ESP32-S3') throw new Error('Appareil incompatible : ESP32-S3 requis.');
  if (await loader.detectFlashSize() !== '16MB') throw new Error('Appareil incompatible : mémoire de 16 Mo requise.');
  if (fileArray.length !== 5 || fileArray.some((file, i) =>
    file.address !== release.files[i].offset || file.data.byteLength !== release.files[i].size)) {
    throw new Error('Les fichiers préparés ne correspondent pas au pack.');
  }
  await loader.writeFlash({ fileArray, flashMode: 'dio', flashFreq: '80m', flashSize: '16MB',
    eraseAll: false, compress: true, calculateMD5Hash: image => md5(image), reportProgress: onProgress });
}

export class Flasher {
  constructor({ serial = navigator.serial, loadTools = () => import('./assets/vendor/esptool.js'),
                fetcher = (...args) => fetch(...args) } = {}) {
    this.serial = serial;
    this.loadTools = loadTools;
    this.fetcher = fetcher;
    this.loader = this.transport = this.release = null;
    this.busy = false;
    this.installed = false;
    this.dialog = document.querySelector('#flasher-dialog');
    this.connectButton = document.querySelector('#flash-connect');
    this.installButton = document.querySelector('#flash-install');
    this.confirm = document.querySelector('#flash-board-confirm');
    this.closeButton = document.querySelector('#close-flasher');
    this.status = document.querySelector('#flash-status');
    this.progress = document.querySelector('#flash-progress');
    this.progressText = document.querySelector('#flash-progress-text');
    this.log = document.querySelector('#flash-log-output');
    this.sdButton = document.querySelector('#flash-download-sd');
    this.sdNote = document.querySelector('#flash-sd-note');
    document.querySelectorAll('[data-open-flasher]').forEach(button => button.addEventListener('click', () => this.open()));
    this.confirm.addEventListener('change', () => this.updateButtons());
    this.connectButton.addEventListener('click', () => this.connect());
    this.installButton.addEventListener('click', () => this.install());
    this.closeButton.addEventListener('click', () => this.close());
    this.sdButton.addEventListener('click', () => this.downloadSd());
    this.dialog.addEventListener('cancel', event => {
      event.preventDefault();
      if (!this.busy) this.close();
    });
    window.addEventListener('beforeunload', event => {
      if (this.busy) { event.preventDefault(); event.returnValue = ''; }
    });
    this.supported = Boolean(window.isSecureContext && this.serial?.requestPort);
    document.querySelector('#flash-browser-note').hidden = this.supported;
    this.updateButtons();
  }

  updateButtons() {
    this.connectButton.disabled = !this.supported || !this.confirm.checked || this.busy || this.installed || Boolean(this.loader) || !this.release;
    this.installButton.disabled = !this.loader || !this.confirm.checked || this.busy || this.installed;
    this.closeButton.disabled = this.busy;
    this.confirm.disabled = this.busy || this.installed;
  }

  setStep(step) {
    document.querySelectorAll('[data-flash-step]').forEach(item => {
      const number = Number(item.dataset.flashStep);
      item.classList.toggle('completed', number < step);
      if (number === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
  }

  message(text, error = false) {
    this.status.textContent = text;
    this.status.classList.toggle('flash-error', error);
  }

  async open() {
    this.dialog.showModal();
    window.dispatchEvent(new CustomEvent('xetro:flasher', { detail: true }));
    if (this.release) return;
    try {
      const response = await this.fetcher('./firmware/release.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('Le pack est indisponible. Réessaie plus tard.');
      this.release = validateRelease(await response.json());
      this.message(this.supported ? 'Prêt. Confirme le modèle, puis connecte ton T-Embed.' : 'Flash USB indisponible dans ce navigateur.');
      this.configureSd();
    } catch (error) {
      this.message(error.message, true);
    }
    this.updateButtons();
  }

  async disconnect() {
    const transport = this.transport;
    this.loader = this.transport = null;
    if (transport) await transport.disconnect();
  }

  async connect() {
    if (this.connectButton.disabled) return;
    this.busy = true;
    this.updateButtons();
    this.message('Choisis le port USB du T-Embed…');
    try {
      // The browser chooser is called directly from the user's click.
      const port = await this.serial.requestPort({ filters: [{ usbVendorId: 0x303a, usbProductId: 0x1001 }] });
      const { ESPLoader, Transport } = await this.loadTools();
      this.transport = new Transport(port, false);
      const log = text => { this.log.textContent = (this.log.textContent + text + '\n').slice(-16000); };
      const loader = new ESPLoader({ transport: this.transport, baudrate: 460800,
        debugLogging: false, terminal: { clean: () => { this.log.textContent = ''; }, write: log, writeLine: log } });
      this.message('Connexion au T-Embed…');
      await loader.main();
      if (loader.chip?.CHIP_NAME !== 'ESP32-S3') throw new Error('Ce pack nécessite un ESP32-S3. Aucun fichier n’a été écrit.');
      if (await loader.detectFlashSize() !== '16MB') throw new Error('Ce pack nécessite 16 Mo de mémoire. Aucun fichier n’a été écrit.');
      this.loader = loader;
      this.setStep(2);
      this.message('T-Embed connecté · ESP32-S3 · 16 Mo. Tu peux lancer l’installation.');
    } catch (error) {
      try { await this.disconnect(); } catch (cleanupError) { this.log.textContent += `\nDéconnexion : ${cleanupError.message}`; }
      const message = error.name === 'NotFoundError' ? 'Connexion annulée. Tu peux réessayer.' :
        error.name === 'SecurityError' ? 'Ouvre ce site directement dans Chrome ou Edge pour autoriser l’accès USB.' :
        `${error.message} Ferme les logiciels série ; si nécessaire, passe le T-Embed en mode téléchargement.`;
      this.message(message, error.name !== 'NotFoundError');
    } finally {
      this.busy = false;
      this.updateButtons();
    }
  }

  async install() {
    if (this.installButton.disabled) return;
    this.busy = true;
    this.updateButtons();
    this.message('Téléchargement et vérification des cinq fichiers…');
    try {
      const files = await fetchFirmware(this.release, this.fetcher);
      this.message('Installation en cours. Garde le câble branché et cette page ouverte.');
      await writeRelease(this.loader, this.release, files, (index, written, total) => {
        const percentage = Math.min(99, Math.floor((index + written / Math.max(1, total)) / files.length * 100));
        this.progress.value = percentage;
        this.progressText.textContent = `${percentage} %`;
      });
      // Reached only after the loader verifies each image against device MD5.
      this.installed = true;
      this.progress.value = 100;
      this.progressText.textContent = '100 %';
      let reset = true;
      try { await this.loader.after('hard_reset'); } catch (error) {
        reset = false;
        this.log.textContent += `\nRedémarrage manuel nécessaire : ${error.message}`;
      }
      this.message(reset ? 'Firmware écrit et vérifié. Le redémarrage a été demandé.' :
        'Firmware écrit et vérifié. Appuie sur RST pour redémarrer ton T-Embed.');
      this.setStep(3);
      document.querySelector('#flash-sd-step').hidden = false;
      document.querySelector('#flash-setup').hidden = true;
      this.configureSd();
    } catch (error) {
      this.message(`Installation interrompue : ${error.message} Reconnecte le T-Embed avant de réessayer.`, true);
    } finally {
      try { await this.disconnect(); } catch (error) { this.log.textContent += `\nDéconnexion : ${error.message}`; }
      this.busy = false;
      this.updateButtons();
    }
  }

  configureSd() {
    const sd = this.release?.sdcard;
    const available = sd?.available === true && sd.path === 'sdcard.zip' && /^[a-f0-9]{64}$/.test(sd.sha256 || '');
    this.sdButton.disabled = !available;
    document.querySelector('#flash-sd-availability').textContent = available ?
      'Ressources SD : le pack sera proposé à la dernière étape.' :
      'Ressources SD : le pack est indisponible pour cette version.';
    this.sdButton.firstChild.textContent = available ? 'Télécharger sdcard.zip ' : 'sdcard.zip — indisponible ';
    this.sdNote.textContent = available ?
      `Pack SD · ${(sd.size / 1000000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo · intégrité vérifiée avant téléchargement. Copie les dossiers à la racine de la carte, puis insère-la dans ton T-Embed.` :
      'Le téléchargement sera activé lorsqu’un pack vérifié sera disponible.';
  }

  async downloadSd() {
    if (this.sdButton.disabled) return;
    this.sdButton.disabled = true;
    this.sdButton.firstChild.textContent = 'Vérification du pack… ';
    this.message('Téléchargement et vérification du pack SD…');
    try {
      const response = await this.fetcher('./firmware/sdcard.zip');
      if (!response.ok) throw new Error('Le téléchargement de la carte SD est indisponible.');
      const data = await response.arrayBuffer();
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(b => b.toString(16).padStart(2, '0')).join('');
      if (hash !== this.release.sdcard.sha256) throw new Error('Le ZIP reçu ne correspond pas au pack prévu.');
      const url = URL.createObjectURL(new Blob([data], { type: 'application/zip' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'sdcard.zip'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      this.message('Pack SD vérifié. Téléchargement lancé.');
    } catch (error) { this.message(error.message, true); }
    finally { this.configureSd(); }
  }

  async close() {
    if (this.busy) return;
    this.busy = true;
    this.updateButtons();
    try {
      if (this.loader && !this.installed) {
        try { await this.loader.after('hard_reset'); }
        catch (error) { this.log.textContent += `\nAppuie sur RST pour quitter le mode téléchargement : ${error.message}`; }
      }
      await this.disconnect();
    } catch (error) { this.log.textContent += `\nDéconnexion : ${error.message}`; }
    finally {
      this.busy = false;
      this.dialog.close();
      window.dispatchEvent(new CustomEvent('xetro:flasher', { detail: false }));
      this.updateButtons();
    }
  }
}

export const flasher = document.querySelector('#flasher-dialog') ? new Flasher() : null;
