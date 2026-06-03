import { animate } from "animejs";
import * as THREE from "three";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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

function createMacaw() {
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
  bird.position.set(0, 0.72, 1.7);
  bird.rotation.set(-0.06, -0.55, -0.08);
  bird.scale.setScalar(1.25);

  return bird;
}

function createMountainRidge() {
  const ridge = new THREE.Group();
  const points = [
    [-3.8, -1.7, -1.8, 1.25, 2.1, palette.mountainDark],
    [-2.4, -1.7, -2.0, 1.12, 2.5, palette.mountain],
    [-0.9, -1.72, -2.2, 1.42, 3.05, palette.mountainDark],
    [0.7, -1.7, -2.1, 1.35, 2.75, palette.mountain],
    [2.25, -1.72, -1.95, 1.18, 2.35, palette.mountainDark],
    [3.55, -1.7, -1.82, 0.96, 1.95, palette.mountain],
  ] as const;

  points.forEach(([x, y, z, radius, height, color]) => {
    const peak = mesh(
      new THREE.ConeGeometry(radius, height, 4, 1),
      color,
      [x, y + height / 2, z],
      [0, Math.PI / 4, 0],
    );
    ridge.add(peak);
  });

  return ridge;
}

function createScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 0.7, 7);
  camera.lookAt(0, 0.1, 0);

  scene.add(new THREE.HemisphereLight(0xfff6dc, 0x294f2e, 2.8));

  const sun = new THREE.DirectionalLight(0xffdf9b, 3.6);
  sun.position.set(3.4, 5.4, 4.2);
  sun.castShadow = true;
  scene.add(sun);

  const fill = new THREE.PointLight(0x74c7dc, 2.2, 10);
  fill.position.set(-3.5, 1.7, 3.5);
  scene.add(fill);

  const ridge = createMountainRidge();
  ridge.position.y = -0.18;
  scene.add(ridge);

  const bird = createMacaw();
  scene.add(bird);

  const resize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  const leftWing = bird.getObjectByName("leftWing");
  const rightWing = bird.getObjectByName("rightWing");
  const startedAt = performance.now();

  const render = () => {
    const elapsed = (performance.now() - startedAt) / 1000;
    const flap = Math.sin(elapsed * 7.2);
    const drift = Math.sin(elapsed * 0.72);

    bird.position.y = 0.72 + Math.sin(elapsed * 1.8) * 0.12;
    bird.rotation.z = -0.08 + drift * 0.05;
    bird.rotation.y = -0.55 + Math.sin(elapsed * 0.9) * 0.08;
    ridge.rotation.y = Math.sin(elapsed * 0.18) * 0.025;

    if (leftWing && rightWing) {
      leftWing.rotation.z = -0.25 + flap * 0.58;
      leftWing.rotation.x = 0.1 + flap * 0.2;
      rightWing.rotation.z = 0.25 - flap * 0.58;
      rightWing.rotation.x = -0.1 - flap * 0.2;
    }

    renderer.render(scene, camera);
  };

  if (prefersReducedMotion.matches) {
    render();
  } else {
    renderer.setAnimationLoop(render);
  }
}

function animateDetails() {
  if (prefersReducedMotion.matches) {
    return;
  }

  animate(".message-card", {
    translateY: [18, 0],
    opacity: [0, 1],
    duration: 1100,
    ease: "outExpo",
  });

  [
    { selector: ".tiny-macaw--one", duration: 18000, delay: 1000, y: ["0vh", "5vh", "-4vh", "3vh"] },
    { selector: ".tiny-macaw--two", duration: 22000, delay: 6200, y: ["4vh", "-5vh", "3vh", "-3vh"] },
  ].forEach((flight) => {
    animate(flight.selector, {
      translateX: ["-20vw", "120vw"],
      translateY: flight.y,
      rotateZ: ["-5deg", "4deg", "-2deg", "5deg"],
      duration: flight.duration,
      delay: flight.delay,
      loop: true,
      ease: "inOutSine",
    });
  });
}

function init() {
  const canvas = document.querySelector<HTMLCanvasElement>("#hero-canvas");
  if (canvas) {
    createScene(canvas);
  }

  animateDetails();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
