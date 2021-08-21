const BLOCKS_NUMBER = 120;
const BLOCK_MIN_WIDTH = 40;
const BLOCK_MAX_WIDTH = 300;
const BLOCK_MIN_HEIGHT = 40;
const BLOCK_MAX_HEIGHT = 300;
const BLOCK_BORDER_WIDTH = 1;
const MARKER_RADIUS = 4;

const SHOW_POTENTIAL = true;
const SHOW_INTERSECTIONS = true;
const SHOW_ENTRIES = true;
const SHOW_ID = false;

const section = document.getElementById('container');
const sectionBounds = section.getBoundingClientRect();
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let isMoving = false;
let prevPos = null;
let active = null;

const rects = new Array(BLOCKS_NUMBER).fill(null).map((a, i) => {
  const width = randInt(BLOCK_MIN_WIDTH, BLOCK_MAX_WIDTH);
  const height = randInt(BLOCK_MIN_HEIGHT, BLOCK_MAX_HEIGHT);
  const border = getDiag(width, height);
  return {
    id: i,
    width,
    height,
    x: randInt(border, sectionBounds.width - border),
    y: randInt(border, sectionBounds.height - border),
    rotation: randInt(0, 359),
    color: randColor(),
  };
});

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
  SHOW_POTENTIAL && rotated.forEach(item => setMarker(rect.x + item.x, rect.y + item.y));
  return rotated.map((point, i, arr) => ({
    x1: rect.x + point.x,
    y1: rect.y + point.y,
    x2: rect.x + arr[(i + 1) % arr.length].x,
    y2: rect.y + arr[(i + 1) % arr.length].y,
  }))
}

function isInside(sections, point) {
  const D1 = (sections[0].x2 - sections[0].x1) * (point.y - sections[0].y1) - (point.x - sections[0].x1) * (sections[0].y2 - sections[0].y1);
  const D2 = (sections[1].x2 - sections[1].x1) * (point.y - sections[1].y1) - (point.x - sections[1].x1) * (sections[1].y2 - sections[1].y1);
  const D3 = (sections[2].x2 - sections[2].x1) * (point.y - sections[2].y1) - (point.x - sections[2].x1) * (sections[2].y2 - sections[2].y1);
  const D4 = (sections[3].x2 - sections[3].x1) * (point.y - sections[3].y1) - (point.x - sections[3].x1) * (sections[3].y2 - sections[3].y1);
  return (D1 >= 0 && D2 >= 0 && D3 >= 0 && D4 >= 0);
}

function getIntersections(rect) {
  const intersections = [];
  const suspects = rects.filter(suspect => {
    if (suspect.id === rect.id) return false;
    const dist = getDistPoints(rect, suspect);
    const targetDiag = getDiag(rect.width, rect.height);
    const suspectDiag = getDiag(suspect.width, suspect.height);
    return targetDiag + suspectDiag >= dist * 2;
  })
  if (suspects.length === 0) return [];
  const targetSections = toSections(rect);
  targetSections.forEach((targetSection) => {
    const a1 = targetSection.x2 - targetSection.x1;
    const a2 = targetSection.y2 - targetSection.y1;
    suspects.forEach(suspect => {
      const suspectSections = toSections(suspect);
      if (SHOW_ENTRIES && isInside(targetSections, suspect)) {
        setMarker(suspect.x, suspect.y , '#0000FF');
      } else if (isInside(suspectSections, rect)) {
        setMarker(rect.x, rect.y , '#0000FF');
      }
      suspectSections.forEach((suspectSection) => {
        const b1 = suspectSection.x2 - suspectSection.x1;
        const b2 = suspectSection.y2 - suspectSection.y1;
        const div = a1 * b2 - a2 * b1;
        if (div !== 0) {
          const c1 = suspectSection.x1 - targetSection.x1;
          const c2 = suspectSection.y1 - targetSection.y1;
          const s = (c1 * b2 - c2 * b1) / div;
          const t = (a1 * c2 - a2 * c1) / div;
          if (s >= 0 && s <= 1 && t >= -1 && t <= 0) {
            const posX = targetSection.x1 + s * (targetSection.x2 - targetSection.x1);
            const posY = targetSection.y1 + s * (targetSection.y2 - targetSection.y1);
            intersections.push({ x: posX, y: posY });
          }
        }
      })
    })
  })
  return intersections;
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function enableMoving(e) {
  if (!isMoving) {
    const target = e.target;
    if (target.className === 'block') {
      active = target;
      active.style.zIndex += 1;
      prevPos = {
        x: e.clientX,
        y: e.clientY,
      };
    } else {
      clearCanvas();
    }
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
  }
  active = null;
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

window.onload = () => {
  ctx.canvas.width  = window.innerWidth;
  ctx.canvas.height = window.innerHeight;

  const divs = [];

  document.body.addEventListener('mousedown', enableMoving);
  document.body.addEventListener('mousemove', move);
  document.body.addEventListener('mouseup', disableMoving);

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
  section.append(...divs);
}