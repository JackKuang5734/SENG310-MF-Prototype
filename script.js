const BASE_MAP_URL = 'https://drive.google.com/thumbnail?id=1TPt0M1FoUqwaQPDx0zrogkQfjuiyuCWo&sz=w2000';
const WALK_SPEED_PX_PER_MS = 0.22;

const PATH_LIBRARY = {
  'ECS-315': {
    title: 'ECS-315',
    subtitle: 'Advanced Programming Lab',
    location: 'South side of campus, enter through ECS, then continue to the 3rd floor lab.',
    stages: [
      {
        id: 'campus',
        label: 'Campus',
        mapUrl: BASE_MAP_URL,
        toneClass: 'campus-tone',
        imageSize: { width: 1199, height: 1274 },
        path: [
          [715, 993],
          [715, 1018],
          [696, 1034],
          [696, 1075],
          [706, 1075],
          [706, 1147],
          [661, 1181],
          [661, 1277],
          [668, 1277],
          [668, 1318],
          [679, 1318],
          [679, 1362],
          [668, 1362],
          [668, 1491],
          [680, 1508],
          [702, 1511],
          [724, 1514],
          [814, 1543],
          [814, 1553],
        ],
      },
      {
        id: 'floor1',
        label: 'Floor 1',
        mapUrl: 'https://lh3.googleusercontent.com/d/1f-kt005w5RPk6TDdHSHfK9HD1jNaR_ht',
        toneClass: 'floor-1-tone',
        imageSize: { width: 1199, height: 1274 },
        path: [
          [521, 262],
          [533, 361],
          [594, 357],
          [608, 460],
          [574, 462],
        ],
      },
      {
        id: 'floor3',
        label: 'Floor 3',
        mapUrl: 'https://lh3.googleusercontent.com/d/1uTIDI0CHiTJ88xE_b8Cdav97FAyAobDN',
        toneClass: 'floor-3-tone',
        imageSize: { width: 1199, height: 1274 },
        path: [
          [555, 505],
          [641, 488],
          [628, 356],
          [316, 395],
          [355, 712],
          [368, 708],
        ],
      },
    ],
  },
};

const menuButton = document.getElementById('menuButton');
const mapContainer = document.getElementById('mapContainer');
const mapViewport = document.getElementById('mapViewport');
const mapImage = document.getElementById('mapImage');
const mapRaster = document.getElementById('mapRaster');
const routeOverlay = document.getElementById('routeOverlay');
const routePath = document.getElementById('routePath');
const startPin = document.getElementById('startPin');
const destinationStar = document.getElementById('destinationStar');
const zoomInButton = document.getElementById('zoomInButton');
const zoomOutButton = document.getElementById('zoomOutButton');
const buildingDropdown = document.getElementById('buildingDropdown');
const buildingInput = document.getElementById('buildingInput');
const roomInput = document.getElementById('roomInput');
const searchButton = document.getElementById('searchButton');
const infoCard = document.getElementById('infoCard');
const closeInfo = document.getElementById('closeInfo');
const toggleInfo = document.getElementById('toggleInfo');
const startPathButton = document.getElementById('startPathButton');
const walkPathButton = document.getElementById('walkPathButton');
const completionModal = document.getElementById('completionModal');
const completeResetButton = document.getElementById('completeResetButton');
const stepControls = document.getElementById('stepControls');
const infoTitle = document.getElementById('infoTitle');
const infoSubtitle = document.getElementById('infoSubtitle');
const infoLocation = document.getElementById('infoLocation');
const buildingItems = Array.from(document.querySelectorAll('.dropdown-item'));
const statusTime = document.querySelector('.status-bar > span');

let hasManualSearch = false;
let pathStarted = false;
let currentKey = null;
let currentStageIndex = 0;
let mapScale = 0.72;
let translateX = 0;
let translateY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let startTranslateX = 0;
let startTranslateY = 0;
let currentImageWidth = 1199;
let currentImageHeight = 1274;
let isWalking = false;
let unavailableModal = null;
let clockTimerId = null;

let isPinching = false;
let lastTouchDistance = 0;

function getContainerCenter() {
  const rect = mapContainer.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function setMapScaleAroundPoint(nextScale, clientX, clientY) {
  const clampedScale = clampScale(nextScale);
  if (clampedScale === mapScale) return;

  const center = getContainerCenter();
  const pointX = clientX - center.x;
  const pointY = clientY - center.y;
  const mapCoordX = (pointX - translateX) / mapScale;
  const mapCoordY = (pointY - translateY) / mapScale;

  translateX = pointX - mapCoordX * clampedScale;
  translateY = pointY - mapCoordY * clampedScale;
  mapScale = clampedScale;
  applyMapTransform();
}

function getTouchDistance(touchA, touchB) {
  return Math.hypot(touchB.clientX - touchA.clientX, touchB.clientY - touchA.clientY);
}

function getTouchMidpoint(touchA, touchB) {
  return {
    x: (touchA.clientX + touchB.clientX) / 2,
    y: (touchA.clientY + touchB.clientY) / 2,
  };
}

function ensureUnavailableModal() {
  if (unavailableModal) return unavailableModal;

  unavailableModal = document.createElement('div');
  unavailableModal.className = 'completion-modal';
  unavailableModal.id = 'unavailableModal';
  unavailableModal.innerHTML = `
    <div class="completion-card">
      <h3>Path not developed</h3>
      <p id="unavailableMessage"></p>
      <button class="primary-btn" id="closeUnavailableButton" type="button">Close</button>
    </div>
  `;

  const phone = document.querySelector('.phone');
  phone.appendChild(unavailableModal);

  unavailableModal.querySelector('#closeUnavailableButton').addEventListener('click', () => {
    unavailableModal.classList.remove('visible');
  });

  return unavailableModal;
}

function showUnavailablePathPopup(routeKey) {
  const modal = ensureUnavailableModal();
  const availablePaths = Object.keys(PATH_LIBRARY).sort().join(', ');
  const message = modal.querySelector('#unavailableMessage');
  message.textContent = `${routeKey || 'This path'} has not been developed yet. Existing paths: ${availablePaths}.`;
  modal.classList.add('visible');
}

function updateClock() {
  if (!statusTime) return;
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  hours = hours % 12 || 12;
  statusTime.textContent = `${hours}:${minutes}`;
}

function startClock() {
  updateClock();
  if (clockTimerId) {
    clearInterval(clockTimerId);
  }
  clockTimerId = setInterval(updateClock, 1000);
}

function getRouteKey() {
  const building = buildingInput.value.trim().toUpperCase();
  const room = roomInput.value.trim();
  return `${building}-${room}`;
}

function toPath(points) {
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
}

function positionElement(el, point) {
  el.style.left = `${point[0]}px`;
  el.style.top = `${point[1]}px`;
}

function openDropdown() {
  buildingDropdown.classList.add('open');
}

function closeDropdown() {
  buildingDropdown.classList.remove('open');
}

function applyMapTransform() {
  mapViewport.style.transform = `translate(${translateX}px, ${translateY}px) scale(${mapScale})`;
}

function setViewportSize(width, height) {
  currentImageWidth = width;
  currentImageHeight = height;
  mapViewport.style.width = `${width}px`;
  mapViewport.style.height = `${height}px`;
  mapViewport.style.marginLeft = `${-width / 2}px`;
  mapViewport.style.marginTop = `${-height / 2}px`;
  mapRaster.style.width = `${width}px`;
  mapRaster.style.height = `${height}px`;
}

function applyImageNaturalSize() {
  const width = mapRaster.naturalWidth || currentImageWidth;
  const height = mapRaster.naturalHeight || currentImageHeight;
  setViewportSize(width, height);
  routeOverlay.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const routeData = currentKey ? PATH_LIBRARY[currentKey] : null;
  if (routeData && pathStarted) {
    const stage = routeData.stages[currentStageIndex];
    if (stage) {
      stage.imageSize = { width, height };
      routePath.setAttribute('d', toPath(stage.path));
      positionElement(startPin, stage.path[0]);
      positionElement(destinationStar, stage.path[stage.path.length - 1]);
    }
  }
  applyMapTransform();
}

function clampScale(value) {
  return Math.min(2.6, Math.max(0.45, value));
}

function zoomMap(delta, clientX = null, clientY = null) {
  const nextScale = clampScale(mapScale + delta);
  if (clientX !== null && clientY !== null) {
    setMapScaleAroundPoint(nextScale, clientX, clientY);
    return;
  }
  mapScale = nextScale;
  applyMapTransform();
}

function updateSearchButtonState() {
  const isReady = buildingInput.value.trim().length > 0 && roomInput.value.trim().length > 0;
  searchButton.classList.toggle('ready', isReady);
  searchButton.style.fontSize = '1.55rem';
  searchButton.style.fontWeight = '700';
  searchButton.style.transition = 'color 160ms ease, transform 160ms ease, text-shadow 160ms ease';
  searchButton.style.cursor = isReady ? 'pointer' : 'default';
  searchButton.style.color = isReady ? '#2f6bff' : '#7a7485';
  searchButton.style.textShadow = isReady ? '0 0 10px rgba(47, 107, 255, 0.32)' : 'none';
  searchButton.style.transform = isReady ? 'scale(1.08)' : 'scale(1)';
}

function filterBuildingDropdown() {
  const query = buildingInput.value.trim().toLowerCase();
  let visibleCount = 0;

  buildingItems.forEach((item) => {
    const code = item.dataset.building.toLowerCase();
    const label = item.textContent.toLowerCase();
    const matches = query === '' || code.includes(query) || label.includes(query);
    item.style.display = matches ? '' : 'none';
    if (matches) visibleCount += 1;
  });

  if (visibleCount === 0) {
    buildingItems.forEach((item) => {
      item.style.display = '';
    });
  }
}

function clearVisualState() {
  routePath.style.display = 'none';
  startPin.style.display = 'none';
  destinationStar.style.display = 'none';
  stepControls.classList.remove('visible');
  infoCard.classList.remove('visible', 'collapsed', 'path-active', 'expanded');
  completionModal.classList.remove('visible');
  ensureUnavailableModal().classList.remove('visible');
  pathStarted = false;
  isWalking = false;
  walkPathButton.disabled = true;
  walkPathButton.hidden = true;
  startPathButton.hidden = false;
  stepControls.innerHTML = '';
}

function resetPrototype() {
  clearVisualState();
  currentKey = null;
  currentStageIndex = 0;
  hasManualSearch = false;
  buildingInput.value = '';
  roomInput.value = '';
  translateX = 0;
  translateY = 0;
  mapScale = 0.72;
  mapImage.className = 'map-image campus-tone';
  mapRaster.removeAttribute('srcset');
  mapRaster.src = `${BASE_MAP_URL}&reset=${Date.now()}`;
  setViewportSize(1199, 1274);
  routeOverlay.setAttribute('viewBox', '0 0 1199 1274');
  updateSearchButtonState();
  filterBuildingDropdown();
  applyMapTransform();
}

function setStage(stage, stageIndex) {
  currentStageIndex = stageIndex;
  setViewportSize(stage.imageSize.width, stage.imageSize.height);
  mapImage.className = `map-image ${stage.toneClass}`;
  mapRaster.src = stage.mapUrl;
  routeOverlay.setAttribute('viewBox', `0 0 ${stage.imageSize.width} ${stage.imageSize.height}`);
  routePath.setAttribute('d', toPath(stage.path));
  routePath.style.display = 'block';
  positionElement(startPin, stage.path[0]);
  positionElement(destinationStar, stage.path[stage.path.length - 1]);
  startPin.style.display = 'block';
  destinationStar.style.display = 'block';
  walkPathButton.disabled = false;

  Array.from(stepControls.querySelectorAll('.step-btn')).forEach((button, index) => {
    button.classList.toggle('active', index === stageIndex);
  });
}

function renderStepButtons(routeData) {
  stepControls.innerHTML = '';
  routeData.stages.forEach((stage, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `step-btn ${index === currentStageIndex ? 'active' : ''}`;
    button.textContent = stage.label;
    button.addEventListener('click', () => setStage(stage, index));
    stepControls.appendChild(button);
  });
  stepControls.classList.add('visible');
}

function renderSearchState() {
  const routeKey = getRouteKey();
  const routeData = PATH_LIBRARY[routeKey];
  clearVisualState();

  if (!hasManualSearch) return;

  if (!routeData) {
    showUnavailablePathPopup(routeKey);
    return;
  }

  currentKey = routeKey;
  infoTitle.textContent = routeData.title;
  infoSubtitle.textContent = routeData.subtitle;
  infoLocation.textContent = routeData.location;
  infoCard.classList.add('visible');
  infoCard.classList.remove('collapsed', 'path-active', 'expanded');
  walkPathButton.hidden = true;
  walkPathButton.disabled = true;
  startPathButton.hidden = false;
}

function startPath() {
  const routeData = PATH_LIBRARY[currentKey];
  if (!routeData) return;
  pathStarted = true;
  renderStepButtons(routeData);
  setStage(routeData.stages[0], 0);
  startPathButton.hidden = true;
  walkPathButton.hidden = false;
  walkPathButton.disabled = false;
  infoCard.classList.add('path-active', 'collapsed');
  infoCard.classList.remove('expanded');
  closeDropdown();
}

function getPathLength(points) {
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    totalLength += Math.hypot(x2 - x1, y2 - y1);
  }
  return totalLength;
}

function animatePointSequence(points) {
  return new Promise((resolve) => {
    if (!points || points.length < 2) {
      resolve();
      return;
    }

    const segments = [];
    let totalLength = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[i + 1];
      const length = Math.hypot(x2 - x1, y2 - y1);
      segments.push({ x1, y1, x2, y2, length });
      totalLength += length;
    }

    const duration = Math.max(800, totalLength / WALK_SPEED_PX_PER_MS);
    const startTime = performance.now();
    startPin.style.display = 'block';
    destinationStar.style.display = 'block';
    positionElement(startPin, points[0]);
    positionElement(destinationStar, points[points.length - 1]);

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      let targetDistance = totalLength * progress;
      let active = segments[segments.length - 1];

      for (const segment of segments) {
        if (targetDistance <= segment.length) {
          active = segment;
          break;
        }
        targetDistance -= segment.length;
      }

      const segmentProgress = active.length === 0 ? 1 : targetDistance / active.length;
      const x = active.x1 + (active.x2 - active.x1) * segmentProgress;
      const y = active.y1 + (active.y2 - active.y1) * segmentProgress;
      positionElement(startPin, [x, y]);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        positionElement(startPin, points[points.length - 1]);
        resolve();
      }
    }

    requestAnimationFrame(step);
  });
}

async function walkPath() {
  if (isWalking || !pathStarted || !currentKey) return;
  const routeData = PATH_LIBRARY[currentKey];
  const currentStage = routeData?.stages[currentStageIndex];
  if (!currentStage) return;

  isWalking = true;
  walkPathButton.disabled = true;
  Array.from(stepControls.querySelectorAll('.step-btn')).forEach((button) => {
    button.disabled = true;
  });

  await animatePointSequence(currentStage.path);

  const nextStageIndex = currentStageIndex + 1;
  if (nextStageIndex < routeData.stages.length) {
    setStage(routeData.stages[nextStageIndex], nextStageIndex);
  } else {
    completionModal.classList.add('visible');
    walkPathButton.disabled = true;
  }

  Array.from(stepControls.querySelectorAll('.step-btn')).forEach((button) => {
    button.disabled = false;
  });
  isWalking = false;
}

menuButton.addEventListener('click', () => {
  buildingDropdown.classList.toggle('open');
  filterBuildingDropdown();
});

buildingInput.addEventListener('focus', () => {
  filterBuildingDropdown();
  openDropdown();
});

buildingInput.addEventListener('input', () => {
  updateSearchButtonState();
  filterBuildingDropdown();
  openDropdown();
});

roomInput.addEventListener('input', () => {
  updateSearchButtonState();
});

buildingItems.forEach((item) => {
  item.addEventListener('click', () => {
    buildingInput.value = item.dataset.building;
    updateSearchButtonState();
    filterBuildingDropdown();
    closeDropdown();
  });
});

searchButton.addEventListener('click', () => {
  if (!buildingInput.value.trim() || !roomInput.value.trim()) return;
  hasManualSearch = true;
  renderSearchState();
});

roomInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    hasManualSearch = true;
    renderSearchState();
  }
});

buildingInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    hasManualSearch = true;
    renderSearchState();
  }
});

zoomInButton.addEventListener('click', () => {
  const center = getContainerCenter();
  zoomMap(0.2, center.x, center.y);
});
zoomOutButton.addEventListener('click', () => {
  const center = getContainerCenter();
  zoomMap(-0.2, center.x, center.y);
});

mapContainer.addEventListener('wheel', (event) => {
  event.preventDefault();
  const delta = event.deltaY < 0 ? 0.12 : -0.12;
  zoomMap(delta, event.clientX, event.clientY);
}, { passive: false });

mapContainer.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch' || isPinching) return;
  isDragging = true;
  dragStartX = event.clientX;
  dragStartY = event.clientY;
  startTranslateX = translateX;
  startTranslateY = translateY;
  mapContainer.setPointerCapture(event.pointerId);
});

mapContainer.addEventListener('pointermove', (event) => {
  if (!isDragging || event.pointerType === 'touch') return;
  translateX = startTranslateX + (event.clientX - dragStartX);
  translateY = startTranslateY + (event.clientY - dragStartY);
  applyMapTransform();
});

mapContainer.addEventListener('pointerup', () => {
  isDragging = false;
});

mapContainer.addEventListener('pointercancel', () => {
  isDragging = false;
});

mapContainer.addEventListener('touchstart', (event) => {
  if (event.touches.length === 2) {
    isPinching = true;
    isDragging = false;
    lastTouchDistance = getTouchDistance(event.touches[0], event.touches[1]);
    return;
  }

  if (event.touches.length === 1) {
    isPinching = false;
    isDragging = true;
    dragStartX = event.touches[0].clientX;
    dragStartY = event.touches[0].clientY;
    startTranslateX = translateX;
    startTranslateY = translateY;
  }
}, { passive: true });

mapContainer.addEventListener('touchmove', (event) => {
  if (event.touches.length === 2) {
    event.preventDefault();
    const newDistance = getTouchDistance(event.touches[0], event.touches[1]);
    if (lastTouchDistance > 0) {
      const midpoint = getTouchMidpoint(event.touches[0], event.touches[1]);
      const nextScale = mapScale * (newDistance / lastTouchDistance);
      setMapScaleAroundPoint(nextScale, midpoint.x, midpoint.y);
    }
    lastTouchDistance = newDistance;
    isPinching = true;
    isDragging = false;
    return;
  }

  if (event.touches.length === 1 && !isPinching) {
    event.preventDefault();
    translateX = startTranslateX + (event.touches[0].clientX - dragStartX);
    translateY = startTranslateY + (event.touches[0].clientY - dragStartY);
    applyMapTransform();
  }
}, { passive: false });

mapContainer.addEventListener('touchend', (event) => {
  if (event.touches.length < 2) {
    lastTouchDistance = 0;
    isPinching = false;
  }

  if (event.touches.length === 1) {
    isDragging = true;
    dragStartX = event.touches[0].clientX;
    dragStartY = event.touches[0].clientY;
    startTranslateX = translateX;
    startTranslateY = translateY;
  } else {
    isDragging = false;
  }
});

mapContainer.addEventListener('touchcancel', () => {
  isDragging = false;
  isPinching = false;
  lastTouchDistance = 0;
});

closeInfo.addEventListener('click', () => {
  infoCard.classList.remove('visible');
});

toggleInfo.addEventListener('click', () => {
  if (!infoCard.classList.contains('visible')) return;
  if (infoCard.classList.contains('path-active')) {
    infoCard.classList.toggle('expanded');
  } else {
    infoCard.classList.toggle('collapsed');
  }
});

startPathButton.addEventListener('click', startPath);
walkPathButton.addEventListener('click', walkPath);
completeResetButton.addEventListener('click', resetPrototype);

mapRaster.addEventListener('load', () => {
  applyImageNaturalSize();
});

document.addEventListener('click', (event) => {
  const clickedInsideDropdown = buildingDropdown.contains(event.target);
  const clickedSearch = event.target.closest('.search-box');
  if (!clickedInsideDropdown && !clickedSearch) {
    closeDropdown();
  }
});

buildingInput.value = '';
roomInput.value = '';
translateX = 0;
translateY = 0;
applyMapTransform();
updateSearchButtonState();
filterBuildingDropdown();
startClock();
if (mapRaster.complete) {
  applyImageNaturalSize();
}
clearVisualState();

console.assert(document.getElementById('infoLocation') !== null, 'infoLocation element must exist');
console.assert(document.getElementById('toggleInfo') !== null, 'toggleInfo button must exist');
console.assert(statusTime !== null, 'status bar time element must exist');
console.assert(Array.isArray(PATH_LIBRARY['ECS-315'].stages), 'ECS-315 stages must be an array');
console.assert(PATH_LIBRARY['ECS-315'].stages.length === 3, 'ECS-315 should have 3 stages');
console.assert(getPathLength(PATH_LIBRARY['ECS-315'].stages[0].path) > getPathLength(PATH_LIBRARY['ECS-315'].stages[1].path), 'Campus path should currently be longer than floor 1 path for timing validation.');
