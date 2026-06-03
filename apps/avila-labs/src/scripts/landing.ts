import { animate } from "animejs";
import * as THREE from "three";

const palette = {
  blue: 0x1558c8,
  red: 0xdc3344,
  yellow: 0xf7c84b,
  green: 0x1eb889,
  cream: 0xfff6dc,
  dark: 0x173225,
  mountain: 0x4f7d3b,
  mountainDark: 0x294f2e,
  sky: 0x74c7dc,
};

const RAIN_DROP_COUNT = 90;
/**
 * Sky cycle speed: change SKY_LEG_MS only (ms for one sun or moon crossing).
 * Full loop = 2 × SKY_LEG_MS. Fades below are travel fractions (0–1), not ms —
 * they stay in sync at any speed.
 */
const SKY_LEG_MS = 15000;
const SKY_LOOP_MS = SKY_LEG_MS * 2;
const SKY_NIGHT_HANDOFF = 0.08;
/** Night-sky blend width (fraction of full 0→1 phase). */
const SKY_HANDOFF_PHASE = 0.08;
const BODY_PARKED_TRAVEL = -0.28;

/**
 * Must match global.css: left edge = -SKY_TRAVEL_LEFT_0 + travel × SKY_TRAVEL_SPAN.
 * travel 0 = disc entering from the left; travel 1 = disc leaving on the right.
 */
const SKY_TRAVEL_LEFT_0 = 18;
const SKY_TRAVEL_SPAN = 118;
const SKY_TRAVEL_EXIT_START = 1 - 0.018;

type SkyTrack = {
  phase: number;
};

let skyAnimations: ReturnType<typeof animate>[] = [];
const FIRST_RAIN_MIN_MS = 9000;
const FIRST_RAIN_MAX_MS = 52000;
const RAIN_FADE_MS = 2200;
const LOW_POLY_MACAW_SCALE = 0.72;
const LOW_POLY_MACAW_SCALE_LOWER = 0.56;
const LOW_POLY_MACAW_DEPTH = 1.35;
const LOW_POLY_MACAW_DEPTH_LOWER = 1.15;

const MACAW_FLIGHT_ONE = {
  leftVw: -12,
  topVh: 10,
  translateX: ["-16vw", "136vw"],
  translateY: ["0vh", "8vh", "-6vh", "4vh"],
  rotateZ: ["-8deg", "8deg", "-5deg", "7deg"],
  duration: 8200,
  ease: "inOutSine",
} as const;

const MACAW_FLIGHT_TWO = {
  leftVw: -12,
  topVh: 68,
  translateX: ["-16vw", "136vw"],
  translateY: ["4vh", "-7vh", "5vh", "-4vh"],
  rotateZ: ["7deg", "-7deg", "5deg", "-6deg"],
  duration: 10400,
  delay: 1200,
  ease: "inOutSine",
} as const;

type FlightAnimation = ReturnType<typeof animate>;
type MacawFlightLane = typeof MACAW_FLIGHT_ONE | typeof MACAW_FLIGHT_TWO;
type MacawFlightState = {
  translateX: string | number;
  translateY: string | number;
  rotateZ: string | number;
};

type MacawFlightHandle = {
  animation: FlightAnimation;
  state: MacawFlightState;
  lane: MacawFlightLane;
  sync: () => void;
  hide: () => void;
  show: () => void;
  selector?: string;
  element?: HTMLElement;
  bird?: THREE.Group;
  camera?: THREE.PerspectiveCamera;
  canvas?: HTMLCanvasElement;
  depth?: number;
};

const screenPoint = new THREE.Vector3();
const worldPoint = new THREE.Vector3();
const viewRay = new THREE.Raycaster();

let macawHandles: MacawFlightHandle[] = [];
let macawScatterAnimations: FlightAnimation[] = [];
let rainDelayTimeoutId = 0;
let rainEndTimeoutId = 0;
let rainFadeTimeoutId = 0;
let rainEndPending = false;

function isLowPolyMode() {
  const params = new URLSearchParams(window.location.search);
  const lowpoly = params.get("lowpoly");

  if (lowpoly !== null) {
    if (lowpoly === "" || ["1", "true", "yes"].includes(lowpoly.toLowerCase())) {
      return true;
    }
    if (["0", "false", "no"].includes(lowpoly.toLowerCase())) {
      return false;
    }
  }

  return (params.get("state") ?? "")
    .split(",")
    .some((part) => part.trim().toLowerCase() === "lowpoly");
}

function applyViewMode() {
  const lowPoly = isLowPolyMode();
  document.documentElement.classList.toggle("is-low-poly", lowPoly);

  document.querySelectorAll<HTMLCanvasElement>("#hero-canvas-back, #hero-canvas-front").forEach((canvas) => {
    canvas.toggleAttribute("aria-hidden", !lowPoly);
  });
}

function addSceneLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xfff6dc, 0x1e3b28, 2.8));

  const sun = new THREE.DirectionalLight(0xffdf9b, 3.6);
  sun.position.set(3.4, 5.4, 4.2);
  sun.castShadow = false;
  scene.add(sun);

  const fill = new THREE.PointLight(0x74c7dc, 2.2, 10);
  fill.position.set(-3.5, 1.7, 3.5);
  scene.add(fill);
}

function material(color: number, roughness = 0.72) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    metalness: 0.02,
    roughness,
  });
}

function mesh(
  geometry: THREE.BufferGeometry,
  color: number,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
) {
  const item = new THREE.Mesh(geometry, material(color));
  item.position.set(...position);
  item.rotation.set(...rotation);
  item.scale.set(...scale);
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}

function createMacaw(scale = LOW_POLY_MACAW_SCALE) {
  const bird = new THREE.Group();

  const body = mesh(new THREE.DodecahedronGeometry(0.72, 0), palette.blue, [0, 0, 0], [0.12, 0, 0], [1.25, 0.78, 0.74]);
  const chest = mesh(new THREE.DodecahedronGeometry(0.44, 0), palette.yellow, [0.04, -0.1, 0.43], [0.1, 0, 0], [0.8, 0.64, 0.35]);
  const head = mesh(new THREE.DodecahedronGeometry(0.45, 0), palette.red, [0.78, 0.2, 0.02], [0.04, 0, -0.1], [1, 0.92, 0.9]);
  const beak = mesh(new THREE.ConeGeometry(0.24, 0.58, 4), palette.yellow, [1.24, 0.2, 0.02], [0, 0, -Math.PI / 2], [1, 0.82, 0.82]);
  const tail = mesh(new THREE.ConeGeometry(0.28, 1.32, 4), palette.blue, [-1.02, -0.05, 0], [0, 0, Math.PI / 2], [0.72, 1, 0.72]);
  const leftEye = mesh(new THREE.BoxGeometry(0.07, 0.07, 0.05), palette.dark, [0.92, 0.3, 0.35]);
  const rightEye = mesh(new THREE.BoxGeometry(0.07, 0.07, 0.05), palette.dark, [0.92, 0.3, -0.35]);

  const wingGeometry = new THREE.ConeGeometry(0.42, 1.86, 4);
  const leftWing = mesh(wingGeometry, palette.red, [-0.12, 0.06, 0.54], [0.1, 0.34, -0.25], [1, 1, 0.34]);
  const rightWing = mesh(wingGeometry, palette.green, [-0.12, 0.06, -0.54], [-0.1, -0.34, 0.25], [1, 1, 0.34]);
  leftWing.name = "leftWing";
  rightWing.name = "rightWing";

  bird.add(body, chest, head, beak, tail, leftEye, rightEye, leftWing, rightWing);
  bird.rotation.set(-0.05, -0.78, -0.08);
  bird.scale.setScalar(scale);

  return bird;
}

function flapMacawWings(bird: THREE.Group, flap: number) {
  const leftWing = bird.getObjectByName("leftWing");
  const rightWing = bird.getObjectByName("rightWing");

  if (leftWing && rightWing) {
    leftWing.rotation.z = -0.25 + flap * 0.95;
    leftWing.rotation.x = 0.1 + flap * 0.34;
    rightWing.rotation.z = 0.25 - flap * 0.95;
    rightWing.rotation.x = -0.1 - flap * 0.34;
  }
}

function createMountainRidge() {
  const ridge = new THREE.Group();
  const peakBaseY = -1.82;
  const terrainTopY = peakBaseY - 0.02;

  const terrain = mesh(
    new THREE.BoxGeometry(22, 0.55, 4.6),
    0x152a1c,
    [0, terrainTopY - 0.275, -2.45],
    [0, 0, 0],
  );
  terrain.castShadow = false;
  terrain.receiveShadow = false;
  terrain.renderOrder = 0;
  ridge.add(terrain);

  const points = [
    [-6.4, peakBaseY, -2.05, 1.28, 1.95, palette.mountainDark],
    [-5.1, peakBaseY, -2.12, 1.18, 2.25, palette.mountain],
    [-3.85, peakBaseY, -2.18, 1.32, 2.65, palette.mountainDark],
    [-2.45, peakBaseY, -2.2, 1.22, 2.85, palette.mountain],
    [-1.05, peakBaseY, -2.15, 1.38, 3.05, palette.mountainDark],
    [0.45, peakBaseY, -2.12, 1.42, 3.15, palette.mountain],
    [1.95, peakBaseY, -2.08, 1.34, 2.95, palette.mountainDark],
    [3.35, peakBaseY, -2.05, 1.2, 2.55, palette.mountain],
    [4.75, peakBaseY, -2.0, 1.1, 2.2, palette.mountainDark],
    [6.15, peakBaseY, -1.95, 1.02, 1.9, palette.mountain],
    [7.2, peakBaseY, -1.9, 0.92, 1.65, palette.mountainDark],
  ] as const;

  points.forEach(([x, y, z, radius, height, color]) => {
    const peak = mesh(
      new THREE.ConeGeometry(radius, height, 4, 1),
      color,
      [x, y + height / 2, z],
      [0, Math.PI / 4, 0],
    );
    peak.castShadow = false;
    peak.receiveShadow = false;
    peak.renderOrder = 1;
    ridge.add(peak);
  });

  return ridge;
}

function disableShadows(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });
}

function parseCssUnit(value: string | number, unit: string) {
  if (typeof value === "number") {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed.endsWith(unit)) {
    return Number.parseFloat(trimmed);
  }

  return Number.parseFloat(trimmed);
}

function screenPointToWorld(
  camera: THREE.PerspectiveCamera,
  screenX: number,
  screenY: number,
  width: number,
  height: number,
  depth = LOW_POLY_MACAW_DEPTH,
) {
  screenPoint.set((screenX / width) * 2 - 1, -(screenY / height) * 2 + 1, 0.5);
  screenPoint.unproject(camera);
  viewRay.set(
    camera.position,
    screenPoint.sub(camera.position).normalize(),
  );
  const distance = (depth - camera.position.z) / viewRay.ray.direction.z;
  return worldPoint.copy(camera.position).addScaledVector(viewRay.ray.direction, distance);
}

function applyMacawFlightState(
  bird: THREE.Group,
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
  state: MacawFlightState,
  lane: MacawFlightLane,
  depth = LOW_POLY_MACAW_DEPTH,
) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const xVw = lane.leftVw + parseCssUnit(state.translateX, "vw");
  const yVh = lane.topVh + parseCssUnit(state.translateY, "vh");
  const screenX = (xVw / 100) * width;
  const screenY = (yVh / 100) * height;
  const world = screenPointToWorld(camera, screenX, screenY, width, height, depth);

  bird.position.copy(world);
  bird.rotation.z = (parseCssUnit(state.rotateZ, "deg") * Math.PI) / 180 - 0.08;
  bird.rotation.y = -0.78;
  bird.rotation.x = -0.05;
}

function startMacawFlight(
  bird: THREE.Group,
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
  lane: MacawFlightLane,
  depth = LOW_POLY_MACAW_DEPTH,
): MacawFlightHandle {
  const state: MacawFlightState = {
    translateX: lane.translateX[0],
    translateY: lane.translateY[0],
    rotateZ: lane.rotateZ[0],
  };
  const delay = "delay" in lane ? lane.delay : 0;
  const syncBirdToFlight = () => applyMacawFlightState(bird, camera, canvas, state, lane, depth);

  bird.visible = delay <= 0;
  if (delay <= 0) {
    syncBirdToFlight();
  }

  const animation = animate(state, {
    translateX: lane.translateX,
    translateY: lane.translateY,
    rotateZ: lane.rotateZ,
    duration: lane.duration,
    delay,
    loop: true,
    ease: lane.ease,
    onBegin: () => {
      bird.visible = true;
      syncBirdToFlight();
    },
    onRender: syncBirdToFlight,
  });

  return {
    animation,
    state,
    lane,
    depth,
    sync: syncBirdToFlight,
    hide: () => {
      bird.visible = false;
    },
    show: () => {
      bird.visible = true;
      syncBirdToFlight();
    },
    bird,
    camera,
    canvas,
  };
}

function createLowPolyScenes(backCanvas: HTMLCanvasElement, frontCanvas: HTMLCanvasElement) {
  const backRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: backCanvas });
  const frontRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: frontCanvas });
  const pixelRatio = Math.min(window.devicePixelRatio, 2);

  backRenderer.setPixelRatio(pixelRatio);
  frontRenderer.setPixelRatio(pixelRatio);
  backRenderer.shadowMap.enabled = false;
  frontRenderer.shadowMap.enabled = false;

  const backScene = new THREE.Scene();
  const frontScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 0.7, 7);
  camera.lookAt(0, 0.1, 0);

  addSceneLights(backScene);
  addSceneLights(frontScene);

  const ridge = createMountainRidge();
  ridge.position.set(0, -0.12, 0);
  ridge.scale.set(1.12, 1, 1);
  backScene.add(ridge);

  const birdUpper = createMacaw();
  const birdLower = createMacaw(LOW_POLY_MACAW_SCALE_LOWER);
  disableShadows(birdUpper);
  disableShadows(birdLower);
  frontScene.add(birdUpper, birdLower);

  const macawFlightHandles = [
    startMacawFlight(birdUpper, camera, frontCanvas, MACAW_FLIGHT_ONE),
    startMacawFlight(birdLower, camera, frontCanvas, MACAW_FLIGHT_TWO, LOW_POLY_MACAW_DEPTH_LOWER),
  ];

  const resize = () => {
    const width = frontCanvas.clientWidth;
    const height = frontCanvas.clientHeight;
    backRenderer.setSize(width, height, false);
    frontRenderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(frontCanvas);
  resize();

  const macaws = [birdUpper, birdLower];
  const startedAt = performance.now();

  const render = () => {
    const elapsed = (performance.now() - startedAt) / 1000;
    const flap = Math.sin(elapsed * 7.2);

    ridge.rotation.y = Math.sin(elapsed * 0.18) * 0.025;
    macaws.forEach((bird) => flapMacawWings(bird, flap));

    backRenderer.render(backScene, camera);
    frontRenderer.render(frontScene, camera);
  };

  backRenderer.setAnimationLoop(render);

  return { macawFlightHandles };
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function createRainLayer() {
  const layer = document.querySelector<HTMLElement>(".rain-layer");
  if (!layer || layer.children.length > 0) {
    return;
  }

  const drops = Array.from({ length: RAIN_DROP_COUNT }, () => {
    const drop = document.createElement("span");
    drop.className = "raindrop";
    drop.style.left = `${randomBetween(-8, 108).toFixed(2)}vw`;
    drop.style.animationDuration = `${randomBetween(620, 1180).toFixed(0)}ms`;
    drop.style.animationDelay = `${randomBetween(-1800, 0).toFixed(0)}ms`;
    drop.style.opacity = randomBetween(0.32, 0.86).toFixed(2);
    return drop;
  });

  layer.append(...drops);
}

function create2DMacawFlight(selector: string, lane: MacawFlightLane): MacawFlightHandle | null {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) {
    return null;
  }

  const state: MacawFlightState = {
    translateX: lane.translateX[0],
    translateY: lane.translateY[0],
    rotateZ: lane.rotateZ[0],
  };
  const delay = "delay" in lane ? lane.delay : 0;
  const sync = () => {
    element.style.transform = `translate3d(${state.translateX}, ${state.translateY}, 0) rotate(${state.rotateZ})`;
  };

  element.style.visibility = delay > 0 ? "hidden" : "visible";
  element.style.opacity = "1";
  if (delay <= 0) {
    sync();
  }

  const animation = animate(state, {
    translateX: lane.translateX,
    translateY: lane.translateY,
    rotateZ: lane.rotateZ,
    duration: lane.duration,
    delay,
    loop: true,
    ease: lane.ease,
    onBegin: () => {
      element.style.visibility = "visible";
      sync();
    },
    onRender: sync,
  });

  return {
    animation,
    state,
    lane,
    sync,
    selector,
    element,
    hide: () => {
      element.style.visibility = "hidden";
    },
    show: () => {
      element.style.visibility = "visible";
      element.style.opacity = "1";
      sync();
    },
  };
}

function start2DMacawFlights() {
  return [
    create2DMacawFlight(".tiny-macaw--one", MACAW_FLIGHT_ONE),
    create2DMacawFlight(".tiny-macaw--two", MACAW_FLIGHT_TWO),
  ].filter((handle): handle is MacawFlightHandle => handle !== null);
}

function macawLaneDelay(lane: MacawFlightLane) {
  return "delay" in lane ? lane.delay : 0;
}

function macawFlightCanHandoff(handle: MacawFlightHandle) {
  const flight = handle.animation;
  const delay = macawLaneDelay(handle.lane);

  if (flight.cancelled) {
    return false;
  }

  if (delay > 0 && flight.currentTime <= 0) {
    return false;
  }

  return flight.iterationCurrentTime >= 60;
}

function syncMacawFlightPosition(handle: MacawFlightHandle) {
  const flight = handle.animation;
  const delay = macawLaneDelay(handle.lane);

  if (flight.cancelled) {
    handle.sync();
    return;
  }

  if (delay > 0 && flight.currentTime <= 0) {
    handle.state.translateX = handle.lane.translateX[0];
    handle.state.translateY = handle.lane.translateY[0];
    handle.state.rotateZ = handle.lane.rotateZ[0];
    handle.sync();
    return;
  }

  flight.seek(Math.max(flight.iterationCurrentTime, 0), 1, 1);
  handle.sync();
}

function buildErraticScatterPath(state: MacawFlightState) {
  const x = parseCssUnit(state.translateX, "vw");
  const y = parseCssUnit(state.translateY, "vh");
  const rot = parseCssUnit(state.rotateZ, "deg");
  const translateX = [`${x.toFixed(1)}vw`];
  const translateY = [`${y.toFixed(1)}vh`];
  const rotateZ = [`${rot.toFixed(1)}deg`];

  let px = x;
  for (let index = 0; index < 3; index += 1) {
    px += randomBetween(6, 11);
    translateX.push(`${px.toFixed(1)}vw`);
    translateY.push(`${(y + randomBetween(-5, 5) * (index + 1) * 0.55).toFixed(1)}vh`);
    rotateZ.push(`${(rot + randomBetween(-9, 9) * (index + 1) * 0.45).toFixed(1)}deg`);
  }

  const jolts = 4 + Math.floor(Math.random() * 3);
  for (let index = 0; index < jolts; index += 1) {
    if (Math.random() < 0.28) {
      px -= randomBetween(4, 12);
    }
    px += randomBetween(10, 24);
    translateX.push(`${px.toFixed(1)}vw`);
    translateY.push(`${(y + randomBetween(-18, 18)).toFixed(1)}vh`);
    rotateZ.push(`${(rot + randomBetween(-42, 42)).toFixed(1)}deg`);
  }

  translateX.push("158vw");
  translateY.push(`${(y + randomBetween(-24, 24)).toFixed(1)}vh`);
  rotateZ.push(`${(rot + randomBetween(-48, 48)).toFixed(1)}deg`);

  return { translateX, translateY, rotateZ };
}

function restartMacawFlight(handle: MacawFlightHandle) {
  handle.animation.cancel();

  if (handle.bird && handle.camera && handle.canvas) {
    return startMacawFlight(handle.bird, handle.camera, handle.canvas, handle.lane, handle.depth);
  }

  if (handle.selector) {
    const restarted = create2DMacawFlight(handle.selector, handle.lane);
    if (restarted) {
      return restarted;
    }
  }

  return handle;
}

function startMacawScatter(handle: MacawFlightHandle, staggerMs = 0) {
  syncMacawFlightPosition(handle);
  const flight = handle.animation;
  const handoff = macawFlightCanHandoff(handle);
  const path = buildErraticScatterPath(handle.state);

  if (!handoff && !flight.cancelled) {
    flight.cancel();
  }

  const scatter = animate(handle.state, {
    translateX: path.translateX,
    translateY: path.translateY,
    rotateZ: path.rotateZ,
    duration: randomBetween(2200, 3400),
    delay: staggerMs,
    ease: "inOutSine",
    ...(handoff ? { composition: "replace" as const } : {}),
    onBegin: () => {
      handle.show();
    },
    onRender: handle.sync,
    onComplete: () => {
      handle.hide();
      if (rainEndPending) {
        requestRainEnd();
      }
    },
  });

  if (!handoff) {
    scatter.play();
  }

  handle.animation = scatter;
  return scatter;
}

function beginMacawRainScatter() {
  macawScatterAnimations.forEach((animation) => animation.cancel());
  macawScatterAnimations = [];

  macawHandles.forEach((handle, index) => {
    handle.show();
    macawScatterAnimations.push(startMacawScatter(handle, index === 0 ? 0 : 90));
  });
}

function resetMacawFlightsAfterRain() {
  macawScatterAnimations.forEach((animation) => animation.cancel());
  macawScatterAnimations = [];
  macawHandles = macawHandles.map((handle) => restartMacawFlight(handle));
}

function isMacawVisible(handle: MacawFlightHandle) {
  if (handle.bird) {
    return handle.bird.visible;
  }

  if (handle.element) {
    return handle.element.style.visibility !== "hidden";
  }

  return false;
}

function anyMacawVisible() {
  return macawHandles.some(isMacawVisible);
}

function cancelRainFade() {
  if (rainFadeTimeoutId) {
    window.clearTimeout(rainFadeTimeoutId);
    rainFadeTimeoutId = 0;
  }

  document.body.classList.remove("is-rain-ending");
}

function startRain() {
  cancelRainFade();
  rainEndPending = false;
  document.body.classList.add("is-raining");
  beginMacawRainScatter();
}

function finishRain() {
  rainEndPending = false;
  cancelRainFade();
  document.body.classList.add("is-rain-ending");

  rainFadeTimeoutId = window.setTimeout(() => {
    rainFadeTimeoutId = 0;
    document.body.classList.remove("is-raining", "is-rain-ending");
    resetMacawFlightsAfterRain();

    if (!document.body.classList.contains("is-snapshot")) {
      scheduleRain();
    }
  }, RAIN_FADE_MS);
}

function requestRainEnd() {
  if (!document.body.classList.contains("is-raining")) {
    return;
  }

  if (anyMacawVisible()) {
    rainEndPending = true;
    return;
  }

  finishRain();
}

function setRaining(isRaining: boolean) {
  if (isRaining) {
    startRain();
    return;
  }

  requestRainEnd();
}

function cancelScheduledRain() {
  if (rainDelayTimeoutId) {
    window.clearTimeout(rainDelayTimeoutId);
    rainDelayTimeoutId = 0;
  }

  if (rainEndTimeoutId) {
    window.clearTimeout(rainEndTimeoutId);
    rainEndTimeoutId = 0;
  }
}

function scheduleRain(initial = false) {
  cancelScheduledRain();

  const delay = initial
    ? randomBetween(FIRST_RAIN_MIN_MS, FIRST_RAIN_MAX_MS)
    : randomBetween(18000, 56000);

  rainDelayTimeoutId = window.setTimeout(() => {
    rainDelayTimeoutId = 0;
    const duration = randomBetween(9000, 17000);
    setRaining(true);

    rainEndTimeoutId = window.setTimeout(() => {
      rainEndTimeoutId = 0;
      requestRainEnd();
    }, duration);
  }, delay);
}

function toggleRainOnDoubleClick() {
  cancelScheduledRain();
  const raining = document.body.classList.contains("is-raining");

  if (!raining) {
    startRain();
    return;
  }

  requestRainEnd();
}

function setupRainDoubleClick() {
  const scene = document.querySelector<HTMLElement>(".coming-soon");
  if (!scene) {
    return;
  }

  scene.addEventListener("dblclick", (event) => {
    event.preventDefault();
    toggleRainOnDoubleClick();
  });
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothRange(value: number, start: number, end: number) {
  const t = clamp01((value - start) / (end - start));
  return t * t * (3 - 2 * t);
}

/** 0 at phase 0 and 1 (loop seam); largest at mid-cycle. */
function phaseDistanceToLoopEdge(p: number) {
  return Math.min(p, 1 - p);
}

function handoffSpan() {
  return SKY_NIGHT_HANDOFF;
}

function nearRightEdge(travel: number) {
  return smoothRange(travel, 1 - handoffSpan(), 1);
}

function bodyOpacity(travel: number) {
  if (travel >= SKY_TRAVEL_EXIT_START) {
    return 1 - smoothRange(travel, SKY_TRAVEL_EXIT_START, 1);
  }

  return 1;
}

function computeSkyState(phase: number) {
  const p = clamp01(phase);
  const sky = SKY_HANDOFF_PHASE / 2;
  const moonLeg = p >= 0.5;

  const sunT = moonLeg ? 0 : p * 2;
  const moonT = moonLeg ? (p - 0.5) * 2 : 0;

  const sunOpacity = moonLeg ? 0 : bodyOpacity(sunT);
  const moonOpacity = moonLeg ? bodyOpacity(moonT) : 0;

  const nightBlend = smoothRange(p, 0.5 - sky, 0.5 + sky);
  const hazeW = sky * 1.35;
  const dusk =
    smoothRange(p, 0.5 - hazeW, 0.5) * (1 - smoothRange(p, 0.5, 0.5 + hazeW));

  const loopEdge = phaseDistanceToLoopEdge(p);
  const dawnWide = sky * 2.6;
  const dawn = 1 - smoothRange(loopEdge, 0, dawnWide);
  const dawnSkyLinger = 1 - smoothRange(loopEdge, 0, dawnWide * 1.75);

  const sunset = clamp01(Math.max(nearRightEdge(sunT) * sunOpacity, dusk * 0.92));
  const sunrise = clamp01(
    Math.max(nearRightEdge(moonT) * moonOpacity * 0.9, dawn * 0.72),
  );
  const skyT = clamp01(
    Math.max(nightBlend * 0.94, sunset * 0.55, sunrise * 0.38, dawnSkyLinger * 0.62),
  );

  const sunDawnReveal = moonLeg
    ? 0
    : clamp01(smoothRange(p, 0, dawnWide * 1.1) * 0.88 + 0.12);
  const moonSetFade = moonLeg ? 1 - smoothRange(p, 1 - dawnWide * 0.85, 1) : 1;

  const sunriseTravel =
    moonOpacity > 0.02 ? moonT : sunOpacity > 0.02 ? sunT : BODY_PARKED_TRAVEL;

  return {
    skyT,
    sunset,
    sunrise,
    sunriseTravel,
    sunTravel: sunOpacity > 0.02 ? sunT : BODY_PARKED_TRAVEL,
    moonTravel: moonOpacity > 0.02 ? moonT : BODY_PARKED_TRAVEL,
    sunOpacity: sunOpacity * sunDawnReveal,
    moonOpacity: moonOpacity * moonSetFade,
  };
}

function applySkyState(state: ReturnType<typeof computeSkyState>) {
  const root = document.documentElement;

  root.style.setProperty("--sky-t", state.skyT.toFixed(4));
  root.style.setProperty("--sunset", state.sunset.toFixed(4));
  root.style.setProperty("--sunrise", state.sunrise.toFixed(4));
  root.style.setProperty("--sunrise-travel", state.sunriseTravel.toFixed(4));
  root.style.setProperty("--sun-travel", state.sunTravel.toFixed(4));
  root.style.setProperty("--moon-travel", state.moonTravel.toFixed(4));
  root.style.setProperty("--sun-opacity", state.sunOpacity.toFixed(4));
  root.style.setProperty("--moon-opacity", state.moonOpacity.toFixed(4));
}

function syncSkyFromPhase(phase: number) {
  applySkyState(computeSkyState(phase));
}

function startDayNightCycle() {
  const track: SkyTrack = { phase: 0 };

  skyAnimations.forEach((animation) => animation.pause());
  syncSkyFromPhase(track.phase);

  skyAnimations = [
    animate(track, {
      phase: [0, 1],
      duration: SKY_LOOP_MS,
      ease: "linear",
      loop: true,
      onRender: () => syncSkyFromPhase(track.phase),
    }),
  ];
}

function stopDayNightCycle() {
  skyAnimations.forEach((animation) => animation.pause());
  skyAnimations = [];
}

function applyForcedState() {
  const params = new URLSearchParams(window.location.search);
  const state = params.get("state");

  if (!state) {
    return false;
  }

  document.body.classList.add("is-snapshot");
  stopDayNightCycle();

  if (state.includes("night")) {
    syncSkyFromPhase(0.72);
  }

  if (state.includes("rain")) {
    setRaining(true);
  }

  return true;
}

function initLowPolyScene() {
  const backCanvas = document.querySelector<HTMLCanvasElement>("#hero-canvas-back");
  const frontCanvas = document.querySelector<HTMLCanvasElement>("#hero-canvas-front");

  if (backCanvas && frontCanvas) {
    try {
      const scene = createLowPolyScenes(backCanvas, frontCanvas);
      macawHandles = scene.macawFlightHandles;
    } catch (error) {
      console.warn("WebGL low-poly scene could not start.", error);
    }
  }

  const forcedState = applyForcedState();
  createRainLayer();

  if (!forcedState) {
    startDayNightCycle();
    scheduleRain(true);
  }
}

function init2DScene() {
  macawHandles = start2DMacawFlights();
  const forcedState = applyForcedState();
  createRainLayer();

  if (!forcedState) {
    startDayNightCycle();
    scheduleRain(true);
  }
}

function init() {
  applyViewMode();
  setupRainDoubleClick();

  if (isLowPolyMode()) {
    initLowPolyScene();
    return;
  }

  init2DScene();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
