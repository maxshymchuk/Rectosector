let BLOCKS_NUMBER = 250;
let BLOCK_MIN_WIDTH = 40;
let BLOCK_MAX_WIDTH = 300;
let BLOCK_MIN_HEIGHT = 40;
let BLOCK_MAX_HEIGHT = 300;
let BLOCK_BORDER_WIDTH = 1;
let MARKER_RADIUS = 4;
let SHOW_POTENTIAL = true;
let SHOW_INTERSECTIONS = true;
let SHOW_ENTRIES = true;
let SHOW_ID = false;

function withInit(func) {
  return new Proxy(func, { 
    apply: (target, _, args) => { 
      const result = target(...args); 
      init(); 
      return result;
    }
  });
}

function withHelp(object) {
  return new Proxy(object, { 
    get: (target, prop) => { 
      if (prop === 'help') {
        console.log('Help: window.RECTOSECTOR.help')
        console.log('Available commands:')
        Object.keys(target).forEach(key => console.log(`\t${target[key].help}`));
        console.log('Example: window.RECTOSECTOR.setNumber(100)')
      } else {
        return target[prop].func;
      }
    }
  });
}

function between(value, min, max) {
  if (isNaN(value)) return null;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

const RECTOSECTOR = {
  setNumber: {
    help: 'setNumber(number = [0 - 50_000]) - number of rectangles on the screen',
    func: withInit(value => BLOCKS_NUMBER = between(value, 0, 50_000) ?? BLOCKS_NUMBER)
  },
  setMinWidth: {
    help: `setMinWidth(number = [0 - ${BLOCK_MAX_WIDTH}]) - min size of one of dimension of a rectangle`,
    func: withInit(value => BLOCK_MIN_WIDTH = between(value, 0, BLOCK_MAX_WIDTH) ?? BLOCK_MIN_WIDTH),
  },
  setMaxWidth: {
    help: `setMaxWidth(number = [${BLOCK_MIN_WIDTH} - 1000]) - max size of one of dimension of a rectangle`,
    func: withInit(value => BLOCK_MAX_WIDTH = between(value, BLOCK_MIN_WIDTH, 1000) ?? BLOCK_MAX_WIDTH),
  },
  setMinHeight: {
    help: `setMinHeight(number = [0 - ${BLOCK_MAX_HEIGHT}]) - min size of one of dimension of a rectangle`,
    func: withInit(value => BLOCK_MIN_HEIGHT = between(value, 0, BLOCK_MAX_HEIGHT) ?? BLOCK_MIN_HEIGHT),
  },
  setMaxHeight: {
    help: `setMaxHeight(number = [${BLOCK_MIN_HEIGHT} - 1000]) - max size of one of dimension of a rectangle`,
    func: withInit(value => BLOCK_MAX_HEIGHT = between(value, BLOCK_MIN_HEIGHT, 1000) ?? BLOCK_MAX_HEIGHT),
  },
  setBorderWidth: {
    help: 'setBorderWidth(number = [0 - 10]) - width of a border of rectangles',
    func: withInit(value => BLOCK_BORDER_WIDTH = between(value, 0, 10) ?? BLOCK_BORDER_WIDTH),
  },
  setMarkerRadius: {
    help: 'setMarkerRadius(number = [0 - 10]) - radius of markers (dots) of intersections and other events',
    func: withInit(value => MARKER_RADIUS = between(value, 0, 10) ?? MARKER_RADIUS),
  },
  setShowPotentials: {
    help: 'setShowPotentials(boolean) - show red markers that shows nodes of potentially intersected rectangles',
    func: withInit(value => SHOW_POTENTIAL = !!value),
  },
  setShowIntersections: {
    help: 'setShowIntersections(boolean) - show green markers that shows nodes of intersected lines',
    func: withInit(value => SHOW_INTERSECTIONS = !!value),
  },
  setShowEntries: {
    help: 'setShowEntries(boolean) - show blue markers that shows centers of intersected rectangles',
    func: withInit(value => SHOW_ENTRIES = !!value),
  },
  setShowIds: {
    help: 'setShowIds(boolean) - show id (number) of a rectangle',
    func: withInit(value => SHOW_ID = !!value)
  }
}

window.RECTOSECTOR = withHelp(RECTOSECTOR);

const section = document.getElementById('container');
const sectionBounds = section.getBoundingClientRect();
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let isMoving = false;
let prevPos = null;
let active = null;
let rects = [];

function setMarker(x, y, color = '#FF0000') {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, MARKER_RADIUS, 0, 2 * Math.PI);
  ctx.fill();
}

function toSections(rect) {
  const rad = toRadian(rect.rotation);
  const rotated = [
    rotateByAxes({ x: -rect.width / 2, y: -rect.height / 2 }, rad),
    rotateByAxes({ x: rect.width / 2, y: -rect.height / 2 }, rad),
    rotateByAxes({ x: rect.width / 2, y: rect.height / 2 }, rad),
    rotateByAxes({ x: -rect.width / 2, y: rect.height / 2 }, rad),
  ]
  return rotated.map((point, i, arr) => ({
    x1: rect.x + point.x,
    y1: rect.y + point.y,
    x2: rect.x + arr[(i + 1) % arr.length].x,
    y2: rect.y + arr[(i + 1) % arr.length].y,
  }))
}

function isInside(sections, point) {
  for (let i = 0; i < sections.length; i++) {
    const D =
      (sections[i].x2 - sections[i].x1) * (point.y - sections[i].y1) -
      (point.x - sections[i].x1) * (sections[i].y2 - sections[i].y1);
    if (D < 0) return false;
  }
  return true;
}

function getIntersections(activeElement) {
  const intersections = [];
  const suspects = rects.filter(suspect => {
    if (suspect.id === activeElement.id) return false;
    const dist = getDistPoints(activeElement, suspect);
    const targetDiag = getDiag(activeElement.width, activeElement.height);
    const suspectDiag = getDiag(suspect.width, suspect.height);
    return targetDiag + suspectDiag >= dist * 2;
  })
  if (suspects.length === 0) return [];
  const activeElementSections = toSections(activeElement);
  for (let i = 0; i < activeElementSections.length; i++) {
    const a1 = activeElementSections[i].x2 - activeElementSections[i].x1;
    const a2 = activeElementSections[i].y2 - activeElementSections[i].y1;
    for (let j = 0; j < suspects.length; j++) {
      const suspectSections = toSections(suspects[j]);
      if (SHOW_POTENTIAL) suspectSections.forEach(point => setMarker(point.x1, point.y1));
      for (let k = 0; k < suspectSections.length; k++) {
        const b1 = suspectSections[k].x2 - suspectSections[k].x1;
        const b2 = suspectSections[k].y2 - suspectSections[k].y1;
        const div = a1 * b2 - a2 * b1;
        if (div === 0) continue;
        const c1 = suspectSections[k].x1 - activeElementSections[i].x1;
        const c2 = suspectSections[k].y1 - activeElementSections[i].y1;
        const s = (c1 * b2 - c2 * b1) / div;
        const t = (a1 * c2 - a2 * c1) / div;
        if (s >= 0 && s <= 1 && t >= -1 && t <= 0) {
          intersections.push({ 
            x: activeElementSections[i].x1 + s * (activeElementSections[i].x2 - activeElementSections[i].x1), 
            y: activeElementSections[i].y1 + s * (activeElementSections[i].y2 - activeElementSections[i].y1),
          });
        }
      }
      if (!SHOW_ENTRIES) continue;
      if (isInside(activeElementSections, suspects[j])) {
        setMarker(suspects[j].x, suspects[j].y , '#0000FF');
      } else if (isInside(suspectSections, activeElement)) {
        setMarker(activeElement.x, activeElement.y , '#0000FF');
      }
    }
  }
  return intersections;
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function enableMoving(e) {
  if (isMoving) return;
  if (e.target.className === 'block') {
    active = e.target;
    active.style.zIndex += 1;
    prevPos = {
      x: e.clientX,
      y: e.clientY,
    };
    const rect = rects[active.dataset.dataId];
    if (SHOW_INTERSECTIONS) {
      const intersections = getIntersections(rect);
      intersections.forEach(point => setMarker(point.x, point.y, '#00FF00'));
    }
  } else {
    clearCanvas();
  }
}

function move(e) {
  if (active && prevPos) {
    const rect = rects[active.dataset.dataId];
    const shiftX = e.clientX - prevPos.x;
    const shiftY = e.clientY - prevPos.y;
    active.style.left = `${rect.x - rect.width / 2 + shiftX}px`;
    active.style.top = `${rect.y - rect.height / 2 + shiftY}px`;
    const shifted = {
      ...rect,
      x: rect.x + shiftX,
      y: rect.y + shiftY
    }
    clearCanvas();
    if (SHOW_INTERSECTIONS) {
      const intersections = getIntersections(shifted);
      intersections.forEach(point => setMarker(point.x, point.y, '#00FF00'));
    }
  }
}

function disableMoving(e) {
  if (active) {
    const rect = rects[active.dataset.dataId];
    const shiftX = e.clientX - prevPos.x;
    const shiftY = e.clientY - prevPos.y;
    rect.x += shiftX;
    rect.y += shiftY;
    active.style.zIndex -= 1;
    active = null;
  }
  prevPos = null;
}

function onEnter(e) {
  e.target.style.backgroundColor = e.target.style.borderColor;
}

function onLeave(e) {
  e.target.style.backgroundColor = 'unset';
}

function toRadian(degrees) {
  return (Math.PI * -degrees) / 180;
}

function rotateByAxes(v, rad) {
  return {
    x: v.x * Math.cos(rad) + v.y * Math.sin(rad),
    y: v.y * Math.cos(rad) - v.x * Math.sin(rad),
  };
}

function getDiag(w, h) {
  return Math.sqrt(w ** 2 + h ** 2) / 2;
}

function getDistPoints(pos1, pos2) {
  const w = pos2.x - pos1.x;
  const h = pos2.y - pos1.y;
  return getDiag(w, h);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randColor() {
  return `rgb(${randInt(50, 220)}, ${randInt(50, 220)}, ${randInt(50, 220)})`;
}

function reset() {
  isMoving = false;
  prevPos = null;
  active = null;
  rects = [];
}

function init() {
  
  ctx.canvas.width  = window.innerWidth;
  ctx.canvas.height = window.innerHeight;

  clearCanvas();
  reset();

  const divs = [];

  document.body.addEventListener('mousedown', enableMoving);
  document.body.addEventListener('mousemove', move);
  document.body.addEventListener('mouseup', disableMoving);

  for (let i = 0; i < BLOCKS_NUMBER; i++) {
    const width = randInt(BLOCK_MIN_WIDTH, BLOCK_MAX_WIDTH);
    const height = randInt(BLOCK_MIN_HEIGHT, BLOCK_MAX_HEIGHT);
    const border = getDiag(width, height);
    rects.push({
      id: i,
      width,
      height,
      x: randInt(border, sectionBounds.width - border),
      y: randInt(border, sectionBounds.height - border),
      rotation: randInt(0, 359),
      color: randColor(),
    });
  }

  for (let i = 0; i < rects.length; i++) {
    const div = document.createElement('div');
    if (SHOW_ID) {
      const span = document.createElement('span');
      span.innerText = rects[i].id;
      span.style.color = rects[i].color;
      span.style.transform = `rotate(${-rects[i].rotation}deg)`;
      div.append(span);
    }
    div.dataset.dataId = rects[i].id;
    div.setAttribute('class', 'block')
    div.style.width = `${rects[i].width}px`;
    div.style.height = `${rects[i].height}px`;
    div.style.left = `${rects[i].x - rects[i].width / 2}px`;
    div.style.top = `${rects[i].y - rects[i].height / 2}px`;
    div.style.borderColor = rects[i].color;
    div.style.borderWidth = `${BLOCK_BORDER_WIDTH}px`;
    div.style.transform = `rotate(${rects[i].rotation}deg)`;
    div.addEventListener('mouseenter', onEnter);
    div.addEventListener('mouseleave', onLeave);
    divs.push(div);
  }
  section.replaceChildren(...divs);
}

window.onload = init;
window.RECTOSECTOR.help;