const fileInput = document.getElementById('fileInput');
const uploadCard = document.getElementById('uploadCard');
const fileDetails = document.getElementById('fileDetails');
const fileName = document.getElementById('fileName');
const canvas = document.getElementById('editorCanvas');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('canvasStage');
const emptyState = document.getElementById('emptyState');
const selectionBox = document.getElementById('selectionBox');
const previewTitle = document.getElementById('previewTitle');
const previewBadge = document.getElementById('previewBadge');
const dimensions = document.getElementById('imageDimensions');
const cropActions = document.getElementById('cropActions');
const applyCropBtn = document.getElementById('applyCropBtn');

const controls = ['rotateLeftBtn','rotateRightBtn','flipHBtn','cropBtn','brightness','contrast','grayscale','resetBtn','downloadBtn'];
let sourceImage = null;
let originalImageUrl = '';
let rotation = 0;
let flipH = false;
let cropMode = false;
let dragStart = null;
let cropRect = null;

const byId = id => document.getElementById(id);
function setEditorEnabled(enabled) {
  controls.forEach(id => byId(id).disabled = !enabled);
}
function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
function canvasDimensions() {
  const sideways = Math.abs(rotation % 180) === 90;
  return sideways
    ? { width: sourceImage.height, height: sourceImage.width }
    : { width: sourceImage.width, height: sourceImage.height };
}
function render() {
  if (!sourceImage) return;
  const size = canvasDimensions();
  canvas.width = size.width;
  canvas.height = size.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const brightness = Number(byId('brightness').value);
  const contrast = Number(byId('contrast').value);
  const grayscale = byId('grayscale').checked ? 1 : 0;
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.scale(flipH ? -1 : 1, 1);
  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale})`;
  ctx.drawImage(sourceImage, -sourceImage.width / 2, -sourceImage.height / 2);
  ctx.restore();
  dimensions.textContent = `${canvas.width} × ${canvas.height} px`;
  canvas.hidden = false;
  emptyState.hidden = true;
  stage.classList.add('is-loaded');
}
function resetAdjustments() {
  rotation = 0;
  flipH = false;
  byId('brightness').value = 100;
  byId('contrast').value = 100;
  byId('grayscale').checked = false;
  byId('brightnessValue').value = '100%';
  byId('contrastValue').value = '100%';
  byId('brightnessValue').textContent = '100%';
  byId('contrastValue').textContent = '100%';
}
async function openFile(file) {
  if (!file) return;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
    alert('Please choose a JPG, PNG, or WebP image.');
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    alert('This image is larger than 20 MB. Please choose a smaller file.');
    return;
  }
  if (originalImageUrl) URL.revokeObjectURL(originalImageUrl);
  originalImageUrl = URL.createObjectURL(file);
  try {
    sourceImage = await loadImageFromUrl(originalImageUrl);
    resetAdjustments();
    fileName.textContent = file.name;
    fileDetails.hidden = false;
    uploadCard.hidden = true;
    previewTitle.textContent = file.name;
    previewBadge.textContent = 'PHOTO LOADED';
    setEditorEnabled(true);
    stopCropMode();
    render();
  } catch {
    alert('The selected image could not be opened. Please try another file.');
  }
}
function rotateBy(degrees) {
  rotation = (rotation + degrees + 360) % 360;
  render();
}
function stopCropMode() {
  cropMode = false;
  dragStart = null;
  cropRect = null;
  selectionBox.hidden = true;
  cropActions.hidden = true;
  canvas.style.cursor = 'default';
  applyCropBtn.disabled = true;
}
function startCropMode() {
  if (!sourceImage) return;
  cropMode = true;
  cropRect = null;
  selectionBox.hidden = true;
  cropActions.hidden = false;
  canvas.style.cursor = 'crosshair';
}
function pointOnCanvas(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: Math.max(0, Math.min(canvas.width, (event.clientX - rect.left) * scaleX)),
    y: Math.max(0, Math.min(canvas.height, (event.clientY - rect.top) * scaleY)),
    cssX: event.clientX - rect.left,
    cssY: event.clientY - rect.top,
    scaleX,
    scaleY
  };
}
canvas.addEventListener('pointerdown', event => {
  if (!cropMode) return;
  const p = pointOnCanvas(event);
  dragStart = p;
  cropRect = { x: p.x, y: p.y, width: 0, height: 0 };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (!cropMode || !dragStart) return;
  const p = pointOnCanvas(event);
  const x = Math.min(dragStart.x, p.x);
  const y = Math.min(dragStart.y, p.y);
  const width = Math.abs(p.x - dragStart.x);
  const height = Math.abs(p.y - dragStart.y);
  cropRect = { x, y, width, height };
  const rect = canvas.getBoundingClientRect();
  const left = Math.min(dragStart.cssX, p.cssX);
  const top = Math.min(dragStart.cssY, p.cssY);
  selectionBox.style.left = `${canvas.offsetLeft + left}px`;
  selectionBox.style.top = `${canvas.offsetTop + top}px`;
  selectionBox.style.width = `${Math.abs(p.cssX - dragStart.cssX)}px`;
  selectionBox.style.height = `${Math.abs(p.cssY - dragStart.cssY)}px`;
  selectionBox.hidden = false;
  applyCropBtn.disabled = width < 10 || height < 10;
});
canvas.addEventListener('pointerup', () => { dragStart = null; });
async function applyCrop() {
  if (!cropRect || cropRect.width < 10 || cropRect.height < 10) return;
  const cropped = document.createElement('canvas');
  cropped.width = Math.round(cropRect.width);
  cropped.height = Math.round(cropRect.height);
  cropped.getContext('2d').drawImage(canvas, cropRect.x, cropRect.y, cropRect.width, cropRect.height, 0, 0, cropped.width, cropped.height);
  const newImage = await loadImageFromUrl(cropped.toDataURL('image/png'));
  sourceImage = newImage;
  resetAdjustments();
  stopCropMode();
  previewBadge.textContent = 'CROP APPLIED';
  render();
}

fileInput.addEventListener('change', event => openFile(event.target.files[0]));
byId('emptyUploadBtn').addEventListener('click', () => fileInput.click());
byId('changeFileBtn').addEventListener('click', () => fileInput.click());
byId('rotateLeftBtn').addEventListener('click', () => rotateBy(-90));
byId('rotateRightBtn').addEventListener('click', () => rotateBy(90));
byId('flipHBtn').addEventListener('click', () => { flipH = !flipH; render(); });
byId('cropBtn').addEventListener('click', () => cropMode ? stopCropMode() : startCropMode());
byId('cancelCropBtn').addEventListener('click', stopCropMode);
applyCropBtn.addEventListener('click', applyCrop);
byId('brightness').addEventListener('input', event => { byId('brightnessValue').textContent = `${event.target.value}%`; render(); });
byId('contrast').addEventListener('input', event => { byId('contrastValue').textContent = `${event.target.value}%`; render(); });
byId('grayscale').addEventListener('change', render);
byId('resetBtn').addEventListener('click', () => { resetAdjustments(); stopCropMode(); previewBadge.textContent = 'CHANGES RESET'; render(); });
byId('downloadBtn').addEventListener('click', () => {
  if (!sourceImage) return;
  const link = document.createElement('a');
  link.download = 'fixed-document-photo.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

setEditorEnabled(false);
