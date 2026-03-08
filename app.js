const LEVELS_ROOT = './levels';
const CANVAS_SIZE = 1080;

const controls = [
  { key: 'headphones', label: 'Listening', folder: '02_headphones', filePrefix: 'headphones_' },
  { key: 'mouth', label: 'Pronunciation', folder: '06_mouth', filePrefix: 'mouth_' },
  { key: 'books', label: 'Vocabulary', folder: '07_books', filePrefix: 'book_' },
  { key: 'grammar', label: 'Grammar', folder: null, filePrefix: null },
  { key: 'eyes', label: 'Fluency', folder: '05_eyes', filePrefix: 'eye_' },
];

const panelCategories = [
  { key: 'listening', label: 'Listening', controlKey: 'headphones' },
  { key: 'pronunciation', label: 'Pronunciation', controlKey: 'mouth' },
  { key: 'vocabulary', label: 'Vocabulary', controlKey: 'books' },
  { key: 'grammar', label: 'Grammar', controlKey: 'grammar' },
  { key: 'fluency', label: 'Fluency', controlKey: 'eyes' },
];

const defaults = {
  headphones: 1,
  mouth: 1,
  books: 1,
  grammar: 1,
  eyes: 1,
};

const state = { ...defaults };
const previewCache = new Map();
const exportAssetMap = new Map();
let pendingExportResolver = null;
let renderVersion = 0;

const root = document.documentElement;
const previewPanel = document.querySelector('#previewPanel');
const controlsPanel = document.querySelector('#controlsPanel');
const controlsScaler = document.querySelector('#controlsScaler');
const sliderControls = document.querySelector('#sliderControls');
const exportNameInput = document.querySelector('#exportNameInput');
const canvas = document.querySelector('#previewCanvas');
const ctx = canvas.getContext('2d');
const downloadBtn = document.querySelector('#downloadBtn');
const folderInput = document.querySelector('#folderInput');

function clampLevel(value) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(10, Math.max(1, Math.round(value)));
}

function isDesktopLayout() {
  return window.innerWidth > 1024;
}

function buildControls() {
  controls.forEach((control) => {
    const card = document.createElement('section');
    card.className = 'control-card';
    card.dataset.control = control.key;

    const labelRow = document.createElement('div');
    labelRow.className = 'field-row';

    const label = document.createElement('label');
    label.className = 'field-label';
    label.htmlFor = `${control.key}Range`;
    label.textContent = control.label;

    labelRow.append(label);

    const inputRow = document.createElement('div');
    inputRow.className = 'input-row';

    const rangeWrap = document.createElement('div');
    rangeWrap.className = 'range-wrap';

    const range = document.createElement('input');
    range.className = 'range-input';
    range.id = `${control.key}Range`;
    range.type = 'range';
    range.min = '1';
    range.max = '10';
    range.step = '1';
    range.value = String(state[control.key]);

    const number = document.createElement('input');
    number.className = 'number-input';
    number.id = `${control.key}Number`;
    number.type = 'number';
    number.min = '1';
    number.max = '10';
    number.step = '1';
    number.value = String(state[control.key]);

    range.addEventListener('input', () => syncControlValue(control.key, Number(range.value)));
    range.addEventListener('pointerdown', () => setActiveControl(control.key));
    number.addEventListener('focus', () => setActiveControl(control.key));
    number.addEventListener('input', () => {
      if (number.value === '') return;
      syncControlValue(control.key, Number(number.value), false);
    });
    number.addEventListener('change', () => syncControlValue(control.key, Number(number.value)));

    rangeWrap.append(range);
    inputRow.append(rangeWrap, number);
    card.append(labelRow, inputRow);
    sliderControls.append(card);
  });

  exportNameInput.addEventListener('input', () => {
    exportNameInput.value = sanitizeFilename(exportNameInput.value);
  });

  folderInput.addEventListener('change', (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length) hydrateExportAssets(files);
    folderInput.value = '';
    if (pendingExportResolver) {
      pendingExportResolver(files.length > 0);
      pendingExportResolver = null;
    }
  });

  downloadBtn.addEventListener('click', async () => {
    downloadBtn.disabled = true;
    try {
      if (location.protocol !== 'file:') {
        await exportFromHostedCanvas();
        return;
      }

      try {
        await exportFromPreviewCanvas();
        return;
      } catch (error) {
        // Local file previews can taint canvas, so only local mode falls back to folder access.
      }

      if (!exportAssetMap.size) {
        const granted = await requestExportFolder();
        if (!granted) return;
      }
      await exportFromTrustedAssets();
    } catch (error) {
      console.error(error);
    } finally {
      downloadBtn.disabled = false;
    }
  });
}

function requestExportFolder() {
  return new Promise((resolve) => {
    pendingExportResolver = resolve;
    folderInput.click();
  });
}

function pulseControl(key) {
  const card = document.querySelector(`.control-card[data-control="${key}"]`);
  if (!card) return;
  card.classList.remove('is-pulsing');
  void card.offsetWidth;
  card.classList.add('is-pulsing');
}

function setActiveControl(key) {
  document.querySelectorAll('.control-card').forEach((card) => {
    card.classList.toggle('is-active', card.dataset.control === key);
  });
}

function syncControlValue(key, nextValue, shouldRender = true) {
  const value = clampLevel(nextValue);
  state[key] = value;
  document.querySelector(`#${key}Range`).value = String(value);
  document.querySelector(`#${key}Number`).value = String(value);
  exportNameInput.value = buildExportNameBase();
  setActiveControl(key);
  pulseControl(key);
  if (shouldRender) render();
}

function clearDesktopVars() {
  [
    '--preview-col',
    '--controls-col',
    '--preview-panel-width',
    '--controls-panel-width',
    '--canvas-shell-size',
    '--controls-scale',
    '--controls-inner-width',
    '--panel-height',
  ].forEach((name) => root.style.removeProperty(name));
}

function fitDesktopLayout() {
  if (!isDesktopLayout()) {
    clearDesktopVars();
    return;
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const shellPaddingX = 24;
  const shellPaddingY = 24;
  const gap = 12;
  const availableWidth = Math.max(700, viewportWidth - shellPaddingX);
  const availableHeight = Math.max(360, viewportHeight - shellPaddingY);

  let controlsInnerWidth = Math.max(240, Math.min(340, Math.round(availableWidth * 0.28)));
  const controlsChrome = 20;
  const previewChrome = 20;
  const minPreviewWidth = 250;

  root.style.setProperty('--controls-inner-width', `${controlsInnerWidth}px`);
  root.style.setProperty('--controls-scale', '1');

  const naturalControlsHeight = Math.max(controlsScaler.scrollHeight, 1);
  let controlsScale = Math.min(1, (availableHeight - controlsChrome) / naturalControlsHeight);
  controlsScale = Math.max(0.58, controlsScale);

  let controlsPanelWidth = Math.ceil(controlsInnerWidth * controlsScale + controlsChrome);
  let previewAvailableWidth = availableWidth - controlsPanelWidth - gap;

  if (previewAvailableWidth < minPreviewWidth) {
    const widthScale = Math.max(0.5, (availableWidth - minPreviewWidth - gap - controlsChrome) / Math.max(controlsInnerWidth, 1));
    controlsScale = Math.min(controlsScale, widthScale);
    controlsPanelWidth = Math.ceil(controlsInnerWidth * controlsScale + controlsChrome);
    previewAvailableWidth = availableWidth - controlsPanelWidth - gap;
  }

  const canvasSize = Math.max(
    240,
    Math.min(
      previewAvailableWidth - previewChrome,
      availableHeight - previewChrome,
      CANVAS_SIZE
    )
  );

  const previewPanelWidth = Math.ceil(canvasSize + previewChrome);
  const panelHeight = Math.min(
    availableHeight,
    Math.max(canvasSize + previewChrome, Math.ceil(naturalControlsHeight * controlsScale) + controlsChrome)
  );

  root.style.setProperty('--controls-scale', String(controlsScale));
  root.style.setProperty('--controls-col', `${controlsPanelWidth}px`);
  root.style.setProperty('--controls-panel-width', `${controlsPanelWidth}px`);
  root.style.setProperty('--canvas-shell-size', `${canvasSize}px`);
  root.style.setProperty('--preview-col', `${previewPanelWidth}px`);
  root.style.setProperty('--preview-panel-width', `${previewPanelWidth}px`);
  root.style.setProperty('--panel-height', `${panelHeight}px`);
}

function buildBaseLayers() {
  return [
    { path: '01_white_bg.png' },
    { path: '03_character_shadow.png' },
    { path: `02_headphones/headphones_${state.headphones}.png` },
    { path: '04_character_bg.png' },
    { path: `06_mouth/mouth_${state.mouth}.png` },
    { path: `05_eyes/eye_${state.eyes}.png` },
    { path: `07_books/book_${state.books}.png` },
    { path: '08_level_panel.png' },
  ];
}

function buildPanelLayers() {
  const stack = [];
  panelCategories.forEach((category) => {
    const rootPath = `09_level_panel_elements/${category.key}`;
    const activeLevel = state[category.controlKey];

    for (let index = 1; index <= 10; index += 1) {
      stack.push({ path: `${rootPath}/element_frames/number_${index}.png` });
    }

    stack.push({ path: `${rootPath}/number_frames/rounded_rect_2.png` });
    stack.push({ path: `${rootPath}/number_frames/rounded_rect_1.png` });

    for (let index = 1; index <= activeLevel; index += 1) {
      stack.push({ path: `${rootPath}/numbers/plate_${index}.png` });
    }

    stack.push({ path: `${rootPath}/numbers/number_${activeLevel}_of_10.png` });
  });
  return stack;
}

function buildLayerStack() {
  return [...buildBaseLayers(), ...buildPanelLayers()];
}

async function loadPreviewImage(path) {
  const src = `${LEVELS_ROOT}/${path}`;
  if (previewCache.has(src)) return previewCache.get(src);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
  previewCache.set(src, promise);
  return promise;
}

async function render() {
  const currentVersion = ++renderVersion;
  exportNameInput.value = buildExportNameBase();
  const stack = buildLayerStack();

  try {
    const images = await Promise.all(stack.map((layer) => loadPreviewImage(layer.path)));
    if (currentVersion !== renderVersion) return;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    images.forEach((image) => ctx.drawImage(image, 0, 0, CANVAS_SIZE, CANVAS_SIZE));
  } catch (error) {
    if (currentVersion !== renderVersion) return;
    console.error(error);
  }
}

function normalizeSelectedPath(rawPath) {
  const normalized = rawPath.replace(/\\/g, '/').replace(/^\.?\//, '');
  const lower = normalized.toLowerCase();
  const marker = '/levels/';
  const markerIndex = lower.lastIndexOf(marker);
  if (markerIndex >= 0) return normalized.slice(markerIndex + marker.length);
  if (lower.startsWith('levels/')) return normalized.slice('levels/'.length);
  return normalized;
}

function hydrateExportAssets(files) {
  exportAssetMap.clear();
  files.forEach((file) => {
    const raw = file.webkitRelativePath || file.name;
    const normalized = normalizeSelectedPath(raw);
    if (normalized.toLowerCase().endsWith('.png')) exportAssetMap.set(normalized, file);
  });
}

async function exportFromHostedCanvas() {
  try {
    const blob = await canvasToBlob(canvas);
    await triggerDownload(blob);
  } catch (error) {
    await triggerDownloadFromDataUrl(canvas.toDataURL('image/png'));
  }
}

async function exportFromPreviewCanvas() {
  const blob = await canvasToBlob(canvas);
  await triggerDownload(blob);
}

async function exportFromTrustedAssets() {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = CANVAS_SIZE;
  exportCanvas.height = CANVAS_SIZE;
  const exportCtx = exportCanvas.getContext('2d');
  const stack = buildLayerStack();

  for (const layer of stack) {
    const file = exportAssetMap.get(layer.path);
    if (!file) throw new Error(`Missing file for export: ${layer.path}`);
    const image = await loadFileImage(file);
    exportCtx.drawImage(image, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  const blob = await canvasToBlob(exportCanvas);
  await triggerDownload(blob);
}

async function loadFileImage(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load ${file.name}`));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToBlob(targetCanvas) {
  return new Promise((resolve, reject) => {
    targetCanvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG export failed.')), 'image/png');
  });
}

async function triggerDownload(blob) {
  const url = URL.createObjectURL(blob);
  try {
    await triggerDownloadFromDataUrl(url, true);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function triggerDownloadFromDataUrl(url, isObjectUrl = false) {
  const link = document.createElement('a');
  link.href = url;
  link.download = buildExportName();
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();

  // iOS Safari may ignore the download attribute; opening the image is a safer fallback.
  if (!isObjectUrl && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
    window.open(url, '_blank', 'noopener');
  }
}

function sanitizeFilename(value) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').trim();
}

function buildExportNameBase() {
  const signature = [
    `L${state.headphones}`,
    `P${state.mouth}`,
    `V${state.books}`,
    `G${state.grammar}`,
    `F${state.eyes}`,
  ].join('-');
  return `levels_${signature}`;
}

function buildExportName() {
  const custom = sanitizeFilename(exportNameInput.value || buildExportNameBase());
  return `${custom || buildExportNameBase()}.png`;
}

window.addEventListener('resize', fitDesktopLayout);
window.addEventListener('orientationchange', fitDesktopLayout);
window.addEventListener('load', fitDesktopLayout);

buildControls();
render();
fitDesktopLayout();
