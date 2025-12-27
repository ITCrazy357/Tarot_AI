// Hand-Tracked Tarot Picker
// - Open palm moves cursor (index tip)
// - Move to left/right edge -> pan deck (and holds when you stop)
// - Pinch (index + thumb) -> pick/reveal (3 picks max)

const stage = document.getElementById("stage");
const deckRail = document.getElementById("deckRail");
const pickedStack = document.getElementById("pickedStack");
const pickedCountEl = document.getElementById("pickedCount");
const pickedPill = document.getElementById("pickedPill");
const footerMsg = document.getElementById("footerMsg");

const cursor = document.getElementById("cursor");
const cursorLabel = document.getElementById("cursorLabel");

// Summary (after 3 picks)
const summary = document.getElementById("summary");
const summaryCards = document.getElementById("summaryCards");
const summaryCloseBtn = document.getElementById("summaryCloseBtn");
const summaryAgainBtn = document.getElementById("summaryAgainBtn");

const reveal = document.getElementById("reveal");
const revealCard = document.getElementById("revealCard");
const revealTitle = document.getElementById("revealTitle");
const revealSub = document.getElementById("revealSub");
const revealIndex = document.getElementById("revealIndex");
const revealArt = document.getElementById("revealArt");

const startOverlay = document.getElementById("start");
const startBtn = document.getElementById("startBtn");
const demoBtn = document.getElementById("demoBtn");

const mirrorBtn = document.getElementById("mirrorBtn");
const camBtn = document.getElementById("camBtn");
const camPreview = document.getElementById("camPreview");
const video = document.getElementById("video");
const videoPreview = document.getElementById("videoPreview");

const starsCanvas = document.getElementById("stars");
const starsCtx = starsCanvas.getContext("2d", { alpha: true });

/** ---------------------------
 *  Data
 *  (You can replace these later)
 --------------------------- */
const TAROT = [
  {
    id: 0,
    title: "GOOD LUCK",
    sub: "😀😀😀😀😀",
    glyph: "Mai trúng tủ là ngon lun",
    index: "XVII",
  },
  {
    id: 1,
    title: "GOOD LUCK",
    sub: "🍀🍀🍀🍀🍀",
    glyph: "Chúc em thi tốt nhe",
    index: "XVIII",
  },
  {
    id: 2,
    title: "GOOD LUCK",
    sub: "😌",
    glyph: "Chúc em qua kiếp này",
    index: "XIX",
  },
  {
    id: 3,
    title: "GOOD LUCK",
    sub: "😀",
    glyph: "Trộm vía trên 6đ",
    index: "XVI",
  },
  {
    id: 4,
    title: "GOOD LUCK",
    sub: "✨✨✨✨✨",
    glyph: "Chúc em may mắn ",
    index: "XXI",
  },
  {
    id: 5,
    title: "GOOD LUCK",
    sub: "🌟🌟🌟🌟🌟",
    glyph: "Ông trời độ em",
    index: "0",
  },
  {
    id: 6,
    title: "GOOD LUCK",
    sub: "🔥🔥🔥🔥🔥",
    glyph: "Mai làm hết bài là ngon lun",
    index: "I",
  },
  {
    id: 7,
    title: "GOOD LUCK",
    sub: "💫💫💫💫💫",
    glyph: "Không rớt môn là ngon lun",
    index: "XI",
  },
  {
    id: 8,
    title: "GOOD LUCK",
    sub: "🍀🍀🍀🍀🍀",
    glyph: "Trộm vía nhớ bài tới lúc thi ",
    index: "XIV",
  },
  {
    id: 9,
    title: "GOOD LUCK",
    sub: "😁",
    glyph: "Trên 7đ là ngon lun",
    index: "III",
  },
];

// Shuffle deck order every page load (Fisher–Yates)
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// DECK is the visual order; TAROT remains the master data (lookup by id)
let DECK = shuffleArray([...TAROT]);

let cardEls = [];
let chosen = new Set();
let picked = []; // array of ids

/** ---------------------------
 *  Cursor + Gesture state
 --------------------------- */
let mirror = true;
let hasHand = false;

let pointerTarget = {
  x: window.innerWidth * 0.5,
  y: window.innerHeight * 0.45,
};
let pointer = { x: pointerTarget.x, y: pointerTarget.y };

let pinch = {
  isPinching: false,
  wasPinching: false,
  // hysteresis thresholds in normalized screen space
  start: 0.06,
  end: 0.06,
  strength: 0,
};

let hoveredId = null;
let isRevealing = false;
let summaryOpen = false;

/** ---------------------------
 *  Deck scroll + layout
 --------------------------- */
let scrollOffset = 0;
let scrollMin = 0;
let scrollMax = 0;

let metrics = { cardW: 120, gap: 90 };
function updateMetrics() {
  metrics.cardW = getCSSPx("--cardW");
  metrics.gap = getCSSPx("--gap");
}
updateMetrics();

function computeScrollBounds() {
  const gap = metrics.gap;
  const visible = TAROT.filter((c) => !chosen.has(c.id));
  const n = visible.length;
  const total = Math.max(0, (n - 1) * gap);
  scrollMin = 0;
  scrollMax = total;

  // keep in range
  scrollOffset = clamp(scrollOffset, scrollMin, scrollMax);

  // start centered (only once)
  if (!computeScrollBounds._didInit) {
    const centerIndex = Math.floor((n - 1) / 2);
    scrollOffset = clamp(centerIndex * gap, scrollMin, scrollMax);
    computeScrollBounds._didInit = true;
  }
}
computeScrollBounds._didInit = false;

function getCSSPx(varName) {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  if (v.endsWith("px")) return parseFloat(v);
  // handle calc() etc by creating temp element
  const tmp = document.createElement("div");
  tmp.style.position = "absolute";
  tmp.style.left = "-9999px";
  tmp.style.width = `var(${varName})`;
  document.body.appendChild(tmp);
  const px = tmp.getBoundingClientRect().width;
  tmp.remove();
  return px;
}

/** ---------------------------
 *  Build deck
 --------------------------- */
function createCardEl(card) {
  const el = document.createElement("div");
  el.className = "tarot-card";
  el.dataset.id = String(card.id);

  el.innerHTML = `
    <div class="card-inner">
      <div class="card-face card-back">
        <div class="back-ornament">
          <div class="back-center"></div>
        </div>
      </div>
      <div class="card-face card-front">
        <div class="front-frame">
          <div class="front-top">
            <div class="front-title">${escapeHTML(card.title)}</div>
            <div class="front-sub">${escapeHTML(card.sub)}</div>
          </div>
          <div class="front-art">
            <div class="glyph">${escapeHTML(card.glyph)}</div>
            <div class="art-text">Placeholder</div>
          </div>
          <div class="front-bottom">
            <div class="front-index">${escapeHTML(card.index)}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  return el;
}

function buildDeck() {
  deckRail.innerHTML = "";
  cardEls = [];

  DECK.forEach((c) => {
    const el = createCardEl(c);
    deckRail.appendChild(el);
    cardEls.push(el);
  });

  computeScrollBounds();
  layoutDeck();
}

buildDeck();

/** ---------------------------
 *  Layout / Hover
 --------------------------- */
function layoutDeck() {
  const railRect = deckRail.getBoundingClientRect();
  const cardW = metrics.cardW;
  const gap = metrics.gap;

  // Coordinates are relative to the deck rail
  const centerX = railRect.width * 0.54; // slightly right like the video
  const baseY = railRect.height * 0.38;

  let visibleIndex = 0;

  for (const el of cardEls) {
    const id = Number(el.dataset.id);
    if (chosen.has(id)) {
      el.classList.add("chosen");
      continue;
    } else {
      el.classList.remove("chosen");
    }

    const x = centerX + (visibleIndex * gap - scrollOffset);

    // curve factor based on distance from center of viewport
    const t = (x - railRect.width * 0.5) / (railRect.width * 0.48);
    const curve = Math.min(1.8, Math.abs(t));
    const y = baseY + curve * curve * (railRect.height * 0.22);

    const rotZ = t * 14;
    const rotX = -18; // tilt toward viewer
    const depth = 20 - curve * 12;

    const isHovered = hoveredId === id;
    const hoverBoost = isHovered ? 58 : 0;

    el.style.left = `${x - cardW / 2}px`;
    el.style.top = `${y - (cardW * 1.55) / 2}px`;

    // stacking order
    const z = 1000 - Math.round(curve * 200) + (isHovered ? 300 : 0);

    const scale = isHovered ? 1.18 : 1.0;

    el.style.zIndex = String(z);
    el.style.transform = `translateZ(${
      depth + hoverBoost
    }px) rotateX(${rotX}deg) rotateZ(${rotZ}deg) scale(${scale})`;

    visibleIndex++;
  }
}

function updateHover() {
  if (!cursor.classList.contains("show") || isRevealing) {
    setHovered(null);
    return;
  }

  // Find closest card by distance to its rect center
  const cx = pointer.x;
  const cy = pointer.y;

  let best = { id: null, dist: Infinity };
  for (const el of cardEls) {
    const id = Number(el.dataset.id);
    if (chosen.has(id)) continue;

    const r = el.getBoundingClientRect();
    const inside =
      cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
    if (inside) {
      best = { id, dist: 0 };
      break;
    }
    // distance to rect center
    const mx = (r.left + r.right) / 2;
    const my = (r.top + r.bottom) / 2;
    const d = Math.hypot(cx - mx, cy - my);
    if (d < best.dist) best = { id, dist: d };
  }

  // Only hover when reasonably close
  const maxDist = Math.max(90, Math.min(160, window.innerWidth * 0.22));
  if (best.id !== null && best.dist <= maxDist) setHovered(best.id);
  else setHovered(null);
}

function setHovered(id) {
  if (hoveredId === id) return;
  hoveredId = id;

  for (const el of cardEls) {
    const cid = Number(el.dataset.id);
    if (cid === hoveredId) el.classList.add("hovered");
    else el.classList.remove("hovered");
  }
}

/** ---------------------------
 *  Selection / Reveal
 --------------------------- */
function canPickMore() {
  return picked.length < 3;
}

async function pickCard(id) {
  if (isRevealing) return;
  if (!canPickMore()) return;
  if (chosen.has(id)) return;

  isRevealing = true;
  footerMsg.textContent = "Revealing…";
  setHovered(null);

  const card = TAROT.find((c) => c.id === id);
  if (!card) return;

  // Reveal overlay content
  revealTitle.textContent = card.title;
  revealSub.textContent = card.sub;
  revealIndex.textContent = card.index;
  // update glyph
  const glyphEl = revealArt.querySelector(".glyph");
  if (glyphEl) glyphEl.textContent = card.glyph;

  reveal.classList.add("show");
  reveal.classList.remove("moving");
  revealCard.classList.remove("is-flipped");

  // short delay, then flip
  await wait(140);
  revealCard.classList.add("is-flipped");

  // wait a bit to "read"
  await wait(3000);

  // animate to stack + finalize
  reveal.classList.add("moving");
  await wait(620);

  reveal.classList.remove("show");
  reveal.classList.remove("moving");

  chosen.add(id);
  picked.push(id);
  updatePickedUI();

  addPickedCard(card);

  computeScrollBounds();
  layoutDeck();

  // done
  isRevealing = false;

  const done = !canPickMore();
  footerMsg.textContent = done
    ? "Done! 3 cards selected."
    : "Move to pick more…";
  if (done) {
    await wait(240);
    showSummary();
  }
}

function addPickedCard(card) {
  const mini = document.createElement("div");
  mini.className = "tarot-card small is-flipped";
  mini.innerHTML = `
    <div class="card-inner">
      <div class="card-face card-back">
        <div class="back-ornament">
          <div class="back-center"></div>
        </div>
      </div>
      <div class="card-face card-front">
        <div class="front-frame">
          <div class="front-top">
            <div class="front-title">${escapeHTML(card.title)}</div>
            <div class="front-sub">${escapeHTML(card.sub)}</div>
          </div>
          <div class="front-art">
            <div class="glyph">${escapeHTML(card.glyph)}</div>
            <div class="art-text">Selected</div>
          </div>
          <div class="front-bottom">
            <div class="front-index">${escapeHTML(card.index)}</div>
          </div>
        </div>
      </div>
    </div>
  `;
  pickedStack.appendChild(mini);

  // tiny entrance animation
  mini.animate(
    [
      { transform: "translateX(-10px) scale(.96)", opacity: 0.0 },
      { transform: "translateX(0) scale(1)", opacity: 1 },
    ],
    { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" }
  );
}

function updatePickedUI() {
  pickedCountEl.textContent = String(picked.length);
  if (picked.length >= 3) {
    pickedPill.style.background = "rgba(247,231,178,.12)";
    pickedPill.style.borderColor = "rgba(247,231,178,.22)";
  }
}

/** ---------------------------
 *  Edge panning
 --------------------------- */
function updateScroll(dt) {
  if (!hasHand || pinch.isPinching || isRevealing) return;

  const edgeZone =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--edgeZone")
    ) || 0.14;
  const w = window.innerWidth;

  const leftEdge = w * edgeZone;
  const rightEdge = w * (1 - edgeZone);

  let v = 0;
  if (pointer.x < leftEdge) {
    const f = 1 - clamp(pointer.x / leftEdge, 0, 1);
    v = -1 * (220 + 520 * f) * f;
  } else if (pointer.x > rightEdge) {
    const f = clamp((pointer.x - rightEdge) / (w - rightEdge), 0, 1);
    v = (220 + 520 * f) * f;
  }

  if (v !== 0) {
    scrollOffset = clamp(scrollOffset + v * dt, scrollMin, scrollMax);
  }
}

/** ---------------------------
 *  MediaPipe Hands
 --------------------------- */
let hands = null;
let camera = null;
let usingDemo = false;

async function startHands() {
  usingDemo = false;

  // request camera
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();

  // optional preview mirror
  videoPreview.srcObject = stream;
  await videoPreview.play();

  hands = new Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.65,
    minTrackingConfidence: 0.6,
  });

  hands.onResults(onHandsResults);

  camera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 640,
    height: 480,
  });

  camera.start();

  footerMsg.textContent = "Tracking… move your hand";
  startOverlay.classList.add("hidden");
}

function stopHands() {
  if (camera && camera.stop) camera.stop();
  camera = null;

  if (video.srcObject) {
    for (const t of video.srcObject.getTracks()) t.stop();
    video.srcObject = null;
  }
  if (videoPreview.srcObject) {
    videoPreview.srcObject = null;
  }
}

function onHandsResults(results) {
  const rect = stage.getBoundingClientRect();

  if (results.multiHandLandmarks && results.multiHandLandmarks.length) {
    hasHand = true;
    cursor.classList.add("show");

    const lm = results.multiHandLandmarks[0];
    const indexTip = lm[8];
    const thumbTip = lm[4];

    const xNorm = mirror ? 1 - indexTip.x : indexTip.x;
    const yNorm = indexTip.y;

    pointerTarget.x = rect.left + xNorm * rect.width;
    pointerTarget.y = rect.top + yNorm * rect.height;

    // Pinch distance in normalized landmark space
    const dx = indexTip.x - thumbTip.x;
    const dy = indexTip.y - thumbTip.y;
    const dist = Math.hypot(dx, dy);

    // Hysteresis
    if (!pinch.isPinching && dist < pinch.start) {
      pinch.isPinching = true;
    } else if (pinch.isPinching && dist > pinch.end) {
      pinch.isPinching = false;
    }

    pinch.strength = clamp(
      (pinch.end - dist) / (pinch.end - pinch.start),
      0,
      1
    );
  } else {
    hasHand = false;
    cursor.classList.remove("show");
    pinch.isPinching = false;
    pinch.strength = 0;
  }
}

/** ---------------------------
 *  Demo (mouse fallback)
 --------------------------- */
function startDemo() {
  usingDemo = true;
  hasHand = true;
  cursor.classList.add("show");
  footerMsg.textContent = "Demo mode: move mouse, click to pick.";
  startOverlay.classList.add("hidden");

  window.addEventListener("mousemove", (e) => {
    pointerTarget.x = e.clientX;
    pointerTarget.y = e.clientY;
  });

  window.addEventListener("mousedown", () => {
    // simulate pinch begin
    pinch.wasPinching = false;
    pinch.isPinching = true;
  });

  window.addEventListener("mouseup", () => {
    pinch.isPinching = false;
  });
}

/** ---------------------------
 *  Main loop
 --------------------------- */
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // smooth pointer
  pointer.x = lerp(pointer.x, pointerTarget.x, 0.35);
  pointer.y = lerp(pointer.y, pointerTarget.y, 0.35);

  // cursor (cursor is inside #stage, so position relative to stage)
  const stageRectNow = stage.getBoundingClientRect();
  cursor.style.left = `${pointer.x - stageRectNow.left}px`;
  cursor.style.top = `${pointer.y - stageRectNow.top}px`;

  // pinch class + label
  cursor.classList.toggle("pinching", pinch.isPinching);
  cursorLabel.textContent = pinch.isPinching ? "PINCH" : "OPEN";

  // edge pan
  updateScroll(dt);

  // layout + hover
  layoutDeck();
  updateHover();

  // pinch begin => pick
  if (!pinch.wasPinching && pinch.isPinching) {
    if (hoveredId !== null && canPickMore()) {
      pickCard(hoveredId);
    }
  }
  pinch.wasPinching = pinch.isPinching;

  // stars background
  updateStars(now);

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/** ---------------------------
 *  Stars background (lightweight)
 --------------------------- */
let stars = [];
let starInit = false;
function initStars() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  starsCanvas.width = Math.floor(window.innerWidth * dpr);
  starsCanvas.height = Math.floor(window.innerHeight * dpr);
  starsCanvas.style.width = window.innerWidth + "px";
  starsCanvas.style.height = window.innerHeight + "px";
  starsCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const count = Math.floor((window.innerWidth * window.innerHeight) / 16000);
  stars = new Array(clamp(count, 80, 220)).fill(0).map(() => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: Math.random() * 1.6 + 0.2,
    tw: Math.random() * 0.9 + 0.2,
    sp: (Math.random() * 0.6 + 0.2) * (Math.random() < 0.15 ? 2.0 : 1.0),
  }));
  starInit = true;
}

function updateStars(now) {
  if (!starInit) initStars();
  const t = now * 0.001;

  starsCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  // subtle nebula
  const g = starsCtx.createRadialGradient(
    window.innerWidth * 0.72,
    window.innerHeight * 0.18,
    40,
    window.innerWidth * 0.72,
    window.innerHeight * 0.18,
    Math.max(window.innerWidth, window.innerHeight) * 0.55
  );
  g.addColorStop(0, "rgba(120,90,255,0.12)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  starsCtx.fillStyle = g;
  starsCtx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const g2 = starsCtx.createRadialGradient(
    window.innerWidth * 0.18,
    window.innerHeight * 0.28,
    30,
    window.innerWidth * 0.18,
    window.innerHeight * 0.28,
    Math.max(window.innerWidth, window.innerHeight) * 0.45
  );
  g2.addColorStop(0, "rgba(202,168,95,0.08)");
  g2.addColorStop(1, "rgba(0,0,0,0)");
  starsCtx.fillStyle = g2;
  starsCtx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  // stars
  for (const s of stars) {
    const tw = 0.55 + 0.45 * Math.sin(t * (0.6 + s.sp) + s.tw * 10);
    const alpha = 0.18 + tw * 0.55;

    // tiny parallax based on scrollOffset and cursor
    const px = (scrollOffset - (scrollMin + scrollMax) / 2) * 0.002;
    const py = (pointer.y - window.innerHeight / 2) * 0.0007;

    const x = s.x + px * 40;
    const y = s.y + py * 40;

    starsCtx.beginPath();
    starsCtx.arc(x, y, s.r, 0, Math.PI * 2);
    starsCtx.fillStyle = `rgba(255,255,255,${alpha})`;
    starsCtx.fill();
  }
}

/** ---------------------------
 *  UI controls
 --------------------------- */
if (summaryCloseBtn) {
  summaryCloseBtn.addEventListener("click", () => hideSummary());
}
if (summaryAgainBtn) {
  summaryAgainBtn.addEventListener("click", () =>
    resetSession({ reshuffle: true })
  );
}

mirrorBtn.addEventListener("click", () => {
  mirror = !mirror;
  mirrorBtn.style.background = mirror
    ? "rgba(255,255,255,.08)"
    : "rgba(255,255,255,.05)";
  footerMsg.textContent = mirror ? "Mirror: ON" : "Mirror: OFF";
});

camBtn.addEventListener("click", () => {
  camPreview.classList.toggle("show");
});

startBtn.addEventListener("click", async () => {
  footerMsg.textContent = "Requesting camera…";
  try {
    await startHands();
  } catch (err) {
    console.error(err);
    footerMsg.textContent = "Camera blocked. Try https/localhost.";
    alert(
      "Camera permission failed. Run with https or http://localhost (VSCode Live Server)."
    );
  }
});

demoBtn.addEventListener("click", () => startDemo());

window.addEventListener("resize", () => {
  initStars();
  updateMetrics();
  computeScrollBounds();
});

/** ---------------------------
 *  Helpers
 --------------------------- */
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showSummary() {
  if (!summary || !summaryCards) return;
  summaryCards.innerHTML = "";

  const cards = picked
    .map((id) => TAROT.find((c) => c.id === id))
    .filter(Boolean);

  for (const card of cards) {
    const el = createCardEl(card);
    el.classList.add("summary-card", "is-flipped");
    summaryCards.appendChild(el);
  }

  summaryOpen = true;
  summary.classList.add("show");
  summary.setAttribute("aria-hidden", "false");
}

function hideSummary() {
  if (!summary) return;
  summaryOpen = false;
  summary.classList.remove("show");
  summary.setAttribute("aria-hidden", "true");
}

function resetSession({ reshuffle = false } = {}) {
  hideSummary();

  chosen = new Set();
  picked = [];
  hoveredId = null;
  isRevealing = false;

  pickedStack.innerHTML = "";
  updatePickedUI();
  footerMsg.textContent = "Move to pick more…";

  if (reshuffle) {
    DECK = shuffleArray([...TAROT]);
  }

  computeScrollBounds._didInit = false;
  scrollOffset = 0;
  buildDeck();
}
