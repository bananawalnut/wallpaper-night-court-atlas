import init, { ParallaxWorld } from "./pkg/night_court_proto.js?v=1.0.0";
import { zenithWallpaper } from "./zenith-wallpaper.js";

const SCENES = {
  loggia: {
    name: "Starward Loggia",
    index: "01 / 02",
    description: "A high concealed observatory where distant places can be drawn into symbolic alignment.",
    hotspot: { x: 0.58, y: 0.77 },
    river: { start: [0.50, 1.02], control: [0.61, 0.82], end: [0.57, 0.63] },
    travelVector: { x: -0.032, y: -0.09 },
    arrival: { x: -0.012, y: -0.026, zoom: 0.095 },
    parallax: { x: 1.0, y: 0.86 },
    skyMax: 0.59,
    starfall: { start: [0.14, 0.16], end: [0.62, 0.35], offset: 0 },
    lightBounds: { x: [0.20, 0.86], y: [0.69, 0.88] },
    lightSeed: 0x10571a,
  },
  riverfront: {
    name: "Sidra Riverfront",
    index: "02 / 02",
    description: "At river level, the city becomes intimate and the House of Wind returns to its true distance.",
    hotspot: { x: 0.69, y: 0.23 },
    river: { start: [0.72, 1.03], control: [0.57, 0.79], end: [0.44, 0.63] },
    travelVector: { x: 0.04, y: 0.07 },
    arrival: { x: 0.018, y: -0.018, zoom: 0.105 },
    parallax: { x: 0.9, y: 0.72 },
    skyMax: 0.55,
    starfall: { start: [0.80, 0.13], end: [0.42, 0.31], offset: 4.7 },
    lightBounds: { x: [0.12, 0.91], y: [0.55, 0.84] },
    lightSeed: 0x51d2a9,
  },
};

const atlas = document.querySelector("#atlas");
const opening = document.querySelector("#opening");
const travelCanvas = document.querySelector("#atmosphere");
const travelContext = travelCanvas.getContext("2d");
const transition = document.querySelector("#transition");
const placeName = document.querySelector("#place-name");
const placeIndex = document.querySelector("#place-index");
const placeDescription = document.querySelector("#place-description");
const motionToggle = document.querySelector("#motion-toggle");
const routeNodes = [...document.querySelectorAll(".route-node")];
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

const sceneElements = new Map(
  [...document.querySelectorAll(".scene")].map((element) => {
    const id = element.dataset.scene;
    const hotspot = element.querySelector(".hotspot");
    const skyCanvas = element.querySelector(".fx-sky");
    const worldCanvas = element.querySelector(".fx-world");
    hotspot.style.left = `${SCENES[id].hotspot.x * 100}%`;
    hotspot.style.top = `${SCENES[id].hotspot.y * 100}%`;
    return [id, {
      element,
      hotspot,
      layers: [...element.querySelectorAll(".art-layer, .depth-fx")],
      canvases: [skyCanvas, worldCanvas],
      skyCanvas,
      skyContext: skyCanvas.getContext("2d"),
      worldCanvas,
      worldContext: worldCanvas.getContext("2d"),
      loaded: id === "loggia",
      loadPromise: null,
      onboarding: { minimumElapsed: false, interacted: false, timer: null },
      lights: createLights(SCENES[id]),
    }];
  }),
);

let motion;
let previousTime = performance.now();
let activeScene = "loggia";
let activeLayers = sceneElements.get(activeScene).layers;
let travelState = null;
let arrivalStart = null;
let still = motionPreference.matches;
let visible = true;
let disposed = false;
let animationFrame = 0;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967295;
  };
}

function createLights(scene) {
  const random = seededRandom(scene.lightSeed);
  return Array.from({ length: 30 }, (_, index) => ({
    x: scene.lightBounds.x[0] + random() * (scene.lightBounds.x[1] - scene.lightBounds.x[0]),
    y: scene.lightBounds.y[0] + random() * (scene.lightBounds.y[1] - scene.lightBounds.y[0]),
    phase: random() * Math.PI * 2,
    warm: index % 6 !== 0,
    size: 0.7 + random() * 0.9,
  }));
}

const starRandom = seededRandom(0x57a4fa11);
const stars = Array.from({ length: 44 }, (_, index) => ({
  x: 0.035 + starRandom() * 0.93,
  y: 0.035 + starRandom() * 0.51,
  radius: 0.45 + (index % 5) * 0.18,
  phase: index * 0.73,
  drift: 0.000022 + (index % 7) * 0.000007,
}));

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value) {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function resizeCanvas(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.floor(canvas.clientWidth * ratio);
  const height = Math.floor(canvas.clientHeight * ratio);
  if (canvas.width === width && canvas.height === height) return;
  canvas.width = width;
  canvas.height = height;
}

function resize() {
  resizeCanvas(travelCanvas);
  sceneElements.forEach((runtime) => runtime.canvases.forEach(resizeCanvas));
}

function traceRiver(context, canvas, scene) {
  context.beginPath();
  context.moveTo(scene.river.start[0] * canvas.width, scene.river.start[1] * canvas.height);
  context.quadraticCurveTo(
    scene.river.control[0] * canvas.width,
    scene.river.control[1] * canvas.height,
    scene.river.end[0] * canvas.width,
    scene.river.end[1] * canvas.height,
  );
}

function drawSkyPlane(context, canvas, scene, time) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.globalCompositeOperation = "screen";

  for (const star of stars) {
    if (star.y > scene.skyMax) continue;
    const alpha = 0.07 + Math.sin(time * star.drift + star.phase) * 0.055;
    context.fillStyle = `rgba(203, 212, 255, ${Math.max(0.018, alpha)})`;
    context.beginPath();
    context.arc(star.x * canvas.width, star.y * canvas.height, star.radius * Math.max(1, canvas.width / 1800), 0, Math.PI * 2);
    context.fill();
  }

  const veilY = canvas.height * (scene.skyMax * 0.72);
  const veil = context.createLinearGradient(0, veilY, canvas.width, veilY + canvas.height * 0.08);
  veil.addColorStop(0, "rgba(106, 92, 174, 0)");
  veil.addColorStop(0.48, "rgba(139, 124, 207, .055)");
  veil.addColorStop(1, "rgba(106, 92, 174, 0)");
  context.strokeStyle = veil;
  context.lineWidth = Math.max(8, canvas.height * 0.025);
  context.beginPath();
  context.moveTo(-canvas.width * 0.05, veilY + Math.sin(time * 0.00008) * 7);
  context.bezierCurveTo(
    canvas.width * 0.24,
    veilY - canvas.height * 0.07,
    canvas.width * 0.72,
    veilY + canvas.height * 0.09,
    canvas.width * 1.05,
    veilY - canvas.height * 0.025,
  );
  context.stroke();

  const cycle = ((time / 1000) + scene.starfall.offset) % 14;
  if (cycle < 2.2) {
    const progress = smoothstep(cycle / 2.2);
    const start = scene.starfall.start;
    const end = scene.starfall.end;
    const x = (start[0] + (end[0] - start[0]) * progress) * canvas.width;
    const y = (start[1] + (end[1] - start[1]) * progress) * canvas.height;
    const dx = (end[0] - start[0]) * canvas.width * 0.16;
    const dy = (end[1] - start[1]) * canvas.height * 0.16;
    const gradient = context.createLinearGradient(x - dx, y - dy, x, y);
    gradient.addColorStop(0, "rgba(195, 203, 255, 0)");
    gradient.addColorStop(1, "rgba(229, 233, 255, .36)");
    context.strokeStyle = gradient;
    context.lineWidth = Math.max(1, canvas.width / 1900);
    context.beginPath();
    context.moveTo(x - dx, y - dy);
    context.lineTo(x, y);
    context.stroke();
  }
  context.restore();
}

function drawRiverShimmer(context, canvas, scene, time) {
  context.save();
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";
  for (let pass = 0; pass < 4; pass += 1) {
    context.setLineDash([28 + pass * 15, 94 + pass * 23]);
    context.lineDashOffset = -(time * (0.016 + pass * 0.0035) + pass * 47);
    context.strokeStyle = `rgba(${190 + pass * 8}, ${201 + pass * 7}, 255, ${0.10 - pass * 0.014})`;
    context.lineWidth = Math.max(1, canvas.width / (1600 - pass * 170));
    traceRiver(context, canvas, scene);
    context.stroke();
  }
  context.restore();
}

function drawCityFlicker(context, canvas, runtime, time) {
  const pulse = time * 0.001;
  for (const light of runtime.lights) {
    const alpha = Math.max(0, Math.sin(pulse * 0.61 + light.phase)) ** 6 * 0.21;
    if (alpha < 0.012) continue;
    context.fillStyle = light.warm
      ? `rgba(244, 200, 132, ${alpha})`
      : `rgba(190, 207, 255, ${alpha * 0.68})`;
    context.beginPath();
    context.arc(
      light.x * canvas.width,
      light.y * canvas.height,
      light.size * Math.max(0.7, canvas.width / 2200),
      0,
      Math.PI * 2,
    );
    context.fill();
  }
}

function drawWorldPlane(runtime, scene, time) {
  const { worldContext: context, worldCanvas: canvas } = runtime;
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawRiverShimmer(context, canvas, scene, time);
  drawCityFlicker(context, canvas, runtime, time);
}

function drawTravelCurrent(progress) {
  travelContext.clearRect(0, 0, travelCanvas.width, travelCanvas.height);
  if (!travelState) return;
  travelContext.save();
  travelContext.globalCompositeOperation = "screen";
  travelContext.globalAlpha = Math.sin(progress * Math.PI) * 0.62;
  travelContext.strokeStyle = "rgba(221, 228, 255, .86)";
  travelContext.lineWidth = Math.max(1.5, travelCanvas.width / 1000);
  travelContext.shadowColor = "rgba(151, 170, 255, .85)";
  travelContext.shadowBlur = 22;
  traceRiver(travelContext, travelCanvas, SCENES[travelState.from]);
  travelContext.stroke();
  travelContext.restore();
}

function drawAtmosphere(time) {
  const runtime = sceneElements.get(activeScene);
  runtime.skyContext.clearRect(0, 0, runtime.skyCanvas.width, runtime.skyCanvas.height);
  runtime.worldContext.clearRect(0, 0, runtime.worldCanvas.width, runtime.worldCanvas.height);
  travelContext.clearRect(0, 0, travelCanvas.width, travelCanvas.height);
  if (still) return;

  const scene = SCENES[activeScene];
  drawSkyPlane(runtime.skyContext, runtime.skyCanvas, scene, time);
  drawWorldPlane(runtime, scene, time);
  if (travelState) drawTravelCurrent(travelState.progress);
}

function arrivalPhase(now) {
  if (still || arrivalStart === null) return { raw: 1, eased: 1 };
  const raw = Math.min(1, (now - arrivalStart) / 4200);
  if (raw >= 1) arrivalStart = null;
  return { raw, eased: smoothstep(raw) };
}

function travelTransform(now) {
  if (!travelState) return { active: false, x: 0, y: 0, zoom: 0, local: 0 };
  const duration = still ? 140 : 1350;
  const progress = Math.min(1, (now - travelState.start) / duration);
  travelState.progress = progress;

  if (!travelState.switched && progress >= 0.5) switchScene(travelState.to);
  if (progress >= 1) {
    transition.classList.remove("active");
    travelState = null;
    arrivalStart = still ? null : now;
    beginOnboarding(activeScene);
    return { active: false, x: 0, y: 0, zoom: 0, local: 0 };
  }

  const isDeparture = !travelState.switched;
  const local = isDeparture ? smoothstep(progress * 2) : 1 - smoothstep((progress - 0.5) * 2);
  const vector = SCENES[isDeparture ? travelState.from : travelState.to].travelVector;
  const sign = isDeparture ? 1 : -1;
  return {
    active: true,
    x: vector.x * window.innerWidth * local * sign,
    y: vector.y * window.innerHeight * local * sign,
    zoom: local * (isDeparture ? 0.085 : 0.06),
    local,
  };
}

function applyLayerTransforms(now) {
  const scene = SCENES[activeScene];
  const arrival = arrivalPhase(now);
  const pointerBlend = still ? 0 : smoothstep((arrival.raw - 0.30) / 0.70);
  const travel = travelTransform(now);

  for (const layer of activeLayers) {
    const depth = Number(layer.dataset.depth);
    const depthRatio = clamp01(depth / 1.45);
    const lag = depthRatio * 0.14;
    const layerArrival = smoothstep((arrival.raw - lag) / Math.max(0.01, 1 - lag));
    const depthMotion = 0.24 + depthRatio * 0.76;
    const pointerX = motion.offset_x(depth) * pointerBlend * scene.parallax.x;
    const pointerY = motion.offset_y(depth) * pointerBlend * scene.parallax.y;
    const arrivalX = (1 - layerArrival) * scene.arrival.x * window.innerWidth * depthMotion;
    const arrivalY = (1 - layerArrival) * scene.arrival.y * window.innerHeight * depthMotion;
    const x = pointerX + arrivalX + travel.x * depthMotion;
    const y = pointerY + arrivalY + travel.y * depthMotion;
    const scale = 1.065
      + (1 - layerArrival) * scene.arrival.zoom * (0.32 + depthRatio * 0.68)
      + travel.zoom * depthMotion;
    const isPlate = layer.classList.contains("plate");
    const opacity = isPlate || !travel.active ? 1 : 1 - travel.local * (0.025 + depthRatio * 0.075);

    layer.style.setProperty("--layer-opacity", opacity.toFixed(3));
    layer.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(5)})`;
  }
}

function frame(now) {
  if (disposed) return;
  if (!visible) {
    previousTime = now;
    animationFrame = requestAnimationFrame(frame);
    return;
  }
  resize();
  const dt = (now - previousTime) / 1000;
  previousTime = now;
  motion.step(dt);
  applyLayerTransforms(now);
  atlas.style.setProperty("--glow", motion.glow());
  drawAtmosphere(now);
  animationFrame = requestAnimationFrame(frame);
}

function switchScene(target) {
  const previous = sceneElements.get(activeScene).element;
  previous.classList.remove("active", "onboarding");
  const next = sceneElements.get(target).element;
  next.classList.add("active");
  activeScene = target;
  activeLayers = sceneElements.get(target).layers;
  if (travelState) travelState.switched = true;

  const details = SCENES[target];
  placeName.textContent = details.name;
  placeIndex.textContent = details.index;
  placeDescription.textContent = details.description;
  routeNodes.forEach((node) => node.classList.toggle("active", node.dataset.target === target));
}

async function loadSceneAssets(id) {
  const runtime = sceneElements.get(id);
  if (runtime.loaded) return;
  if (!runtime.loadPromise) {
    runtime.loadPromise = (async () => {
      const sources = [...runtime.element.querySelectorAll("source[data-srcset]")];
      const images = [...runtime.element.querySelectorAll("img[data-src]")];
      sources.forEach((source) => {
        source.srcset = source.dataset.srcset;
        source.removeAttribute("data-srcset");
      });
      images.forEach((image) => {
        image.src = image.dataset.src;
        image.removeAttribute("data-src");
      });
      await Promise.all(images.map((image) => image.decode?.().catch(() => undefined)));
      runtime.loaded = true;
      runtime.loadPromise = null;
    })();
  }
  await runtime.loadPromise;
}

function storageKey(id) {
  return `night-court-atlas:discovered:${id}`;
}

function wasDiscovered(id) {
  try {
    return sessionStorage.getItem(storageKey(id)) === "true";
  } catch {
    return false;
  }
}

function markDiscovered(id) {
  const runtime = sceneElements.get(id);
  runtime.onboarding.interacted = true;
  if (!runtime.onboarding.minimumElapsed) return;
  runtime.element.classList.remove("onboarding");
  try {
    sessionStorage.setItem(storageKey(id), "true");
  } catch {
    // The visual state still works when session storage is unavailable.
  }
}

function beginOnboarding(id) {
  const runtime = sceneElements.get(id);
  window.clearTimeout(runtime.onboarding.timer);
  if (wasDiscovered(id)) {
    runtime.element.classList.remove("onboarding");
    return;
  }
  runtime.onboarding.minimumElapsed = false;
  runtime.onboarding.interacted = false;
  runtime.element.classList.add("onboarding");
  runtime.onboarding.timer = window.setTimeout(() => {
    runtime.onboarding.minimumElapsed = true;
    if (runtime.onboarding.interacted) markDiscovered(id);
  }, 5000);
}

async function travel(target) {
  if (travelState || target === activeScene) return;
  await loadSceneAssets(target);
  markDiscovered(activeScene);
  travelState = {
    from: activeScene,
    to: target,
    start: performance.now(),
    progress: 0,
    switched: false,
  };
  transition.classList.add("active");
}

function scheduleRiverfrontLoad() {
  const load = () => loadSceneAssets("riverfront");
  if ("requestIdleCallback" in window) window.requestIdleCallback(load, { timeout: 1800 });
  else window.setTimeout(load, 900);
}

async function boot() {
  await init({ module_or_path: new URL("./pkg/night_court_proto_bg.wasm?v=1.0.0", import.meta.url) });
  motion = new ParallaxWorld();
  motionToggle.setAttribute("aria-pressed", String(still));
  motionToggle.textContent = still ? "Awaken" : "Stillness";
  animationFrame = requestAnimationFrame(frame);
}

function enterIllustratedWorld() {
  opening.classList.add("dismissed");
  arrivalStart = still ? null : performance.now();
  beginOnboarding(activeScene);
  scheduleRiverfrontLoad();
}

function setStillness(next) {
  still = Boolean(next);
  arrivalStart = null;
  motionToggle.setAttribute("aria-pressed", String(still));
  motionToggle.textContent = still ? "Awaken" : "Stillness";
  if (still) activeLayers.forEach((layer) => {
    layer.style.setProperty("--layer-opacity", "1");
    layer.style.transform = "scale(1.065)";
  });
}

window.addEventListener("pointermove", (event) => {
  if (!motion) return;
  motion.point_to(event.clientX / window.innerWidth * 2 - 1, event.clientY / window.innerHeight * 2 - 1);
});

sceneElements.forEach((runtime, id) => {
  runtime.hotspot.addEventListener("pointerenter", () => markDiscovered(id));
  runtime.hotspot.addEventListener("focus", () => markDiscovered(id));
});

document.querySelectorAll("[data-target]").forEach((button) => {
  button.addEventListener("click", () => travel(button.dataset.target));
  button.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    travel(button.dataset.target);
  });
});

document.querySelector("#begin").addEventListener("click", () => {
  enterIllustratedWorld();
});

motionToggle.addEventListener("click", () => {
  setStillness(!still);
});

motionPreference.addEventListener?.("change", (event) => {
  setStillness(event.matches);
});

const wallpaperHost = {
  apiVersion: "1.0",
  applyPreferences(preferences = {}) {
    setStillness(Boolean(preferences.reducedMotion || preferences.stillness));
  },
  performAction(action) {
    if (action === "show-loggia") travel("loggia");
    if (action === "show-sidra") travel("riverfront");
    if (action === "replay-arrival") enterIllustratedWorld();
    if (action === "toggle-stillness") setStillness(!still);
  },
  setVisible(isVisible) {
    visible = Boolean(isVisible);
  },
  dispose() {
    disposed = true;
    cancelAnimationFrame(animationFrame);
  },
};

globalThis.wallpaperHost = wallpaperHost;
zenithWallpaper.addEventListener("preferences-change", ({ detail }) => wallpaperHost.applyPreferences(detail));
zenithWallpaper.addEventListener("action", ({ detail }) => wallpaperHost.performAction(detail.id));
zenithWallpaper.addEventListener("visibility-change", ({ detail }) => wallpaperHost.setVisible(detail.visible));
boot().then(() => {
  document.dispatchEvent(new Event("wallpaper-host-ready"));
  zenithWallpaper.ready({
    apiVersion: wallpaperHost.apiVersion,
    capabilities: ["wasm", "canvas2d"],
  });
  if (document.documentElement.dataset.wallpaper === "true") enterIllustratedWorld();
}).catch((error) => {
  console.error(error);
  window.webkit?.messageHandlers?.zenithRuntime?.postMessage({ type: "fatal-error", message: String(error) });
});
