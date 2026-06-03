import { animate } from "animejs";
import * as THREE from "three";

const palette = {
  blue: 0x2445ff,
  blueDeep: 0x1025c9,
  blueSoft: 0x8fa8ff,
  cream: 0xfff0cf,
  green: 0x2dd49a,
  orange: 0xff9855,
  pink: 0xff5475,
  skin: 0xffb17d,
  hair: 0x6a3b27,
  white: 0xffffff,
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function makeMaterial(color: number, roughness = 0.72) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    metalness: 0.02,
    roughness,
  });
}

function makeMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createMountain(radius: number, height: number, color: number) {
  const mountain = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, 4, 1),
    makeMaterial(color, 0.92),
  );
  mountain.castShadow = true;
  mountain.receiveShadow = true;
  return mountain;
}

function createMascot() {
  const group = new THREE.Group();
  const suit = makeMaterial(palette.blue);
  const shirt = makeMaterial(palette.white);
  const skin = makeMaterial(palette.skin);
  const hair = makeMaterial(palette.hair);
  const shoe = makeMaterial(0x11185c);

  const torso = makeMesh(new THREE.BoxGeometry(0.86, 1.08, 0.46, 1, 1, 1), suit, [0, 0.68, 0]);
  torso.rotation.z = -0.1;
  group.add(torso);

  const shirtPanel = makeMesh(new THREE.BoxGeometry(0.42, 0.92, 0.49), shirt, [0.05, 0.66, 0.01]);
  shirtPanel.rotation.z = -0.08;
  group.add(shirtPanel);

  const tie = makeMesh(new THREE.ConeGeometry(0.14, 0.52, 4), makeMaterial(palette.hair), [0.05, 0.45, 0.28]);
  tie.rotation.x = Math.PI;
  tie.rotation.z = -0.1;
  group.add(tie);

  const head = makeMesh(new THREE.BoxGeometry(0.82, 0.78, 0.72, 1, 1, 1), skin, [0, 1.55, 0.03]);
  head.rotation.y = 0.08;
  group.add(head);

  const hairCap = makeMesh(new THREE.BoxGeometry(0.9, 0.28, 0.76), hair, [-0.03, 1.9, -0.02]);
  hairCap.rotation.z = -0.12;
  group.add(hairCap);

  const beard = makeMesh(new THREE.BoxGeometry(0.54, 0.2, 0.18), hair, [0.05, 1.19, 0.39]);
  beard.rotation.z = -0.12;
  group.add(beard);

  const eyeMaterial = makeMaterial(0x1a236b);
  group.add(makeMesh(new THREE.BoxGeometry(0.09, 0.12, 0.08), eyeMaterial, [-0.18, 1.58, 0.41]));
  group.add(makeMesh(new THREE.BoxGeometry(0.09, 0.12, 0.08), eyeMaterial, [0.18, 1.58, 0.41]));

  const armGeometry = new THREE.CylinderGeometry(0.13, 0.13, 0.78, 6);
  const handGeometry = new THREE.DodecahedronGeometry(0.16, 0);
  const leftArm = makeMesh(armGeometry, suit, [-0.58, 0.72, 0.02], [0.2, 0, -0.78]);
  const rightArm = makeMesh(armGeometry, suit, [0.58, 0.72, 0.02], [-0.2, 0, 0.78]);
  leftArm.name = "leftArm";
  rightArm.name = "rightArm";
  group.add(leftArm, rightArm);
  group.add(makeMesh(handGeometry, skin, [-0.86, 0.35, 0.08]));
  group.add(makeMesh(handGeometry, skin, [0.86, 0.35, 0.08]));

  const legGeometry = new THREE.CylinderGeometry(0.15, 0.14, 0.76, 6);
  const leftLeg = makeMesh(legGeometry, suit, [-0.24, -0.02, 0], [0.08, 0, 0.36]);
  const rightLeg = makeMesh(legGeometry, suit, [0.26, -0.03, 0], [-0.08, 0, -0.36]);
  leftLeg.name = "leftLeg";
  rightLeg.name = "rightLeg";
  group.add(leftLeg, rightLeg);

  const shoeGeometry = new THREE.BoxGeometry(0.38, 0.16, 0.28);
  const leftShoe = makeMesh(shoeGeometry, shoe, [-0.41, -0.46, 0.1], [0.02, 0.1, 0.2]);
  const rightShoe = makeMesh(shoeGeometry, shoe, [0.46, -0.46, 0.1], [0.02, -0.1, -0.2]);
  leftShoe.name = "leftShoe";
  rightShoe.name = "rightShoe";
  group.add(leftShoe, rightShoe);

  group.position.set(0.78, -1.02, 1.18);
  group.rotation.y = -0.42;
  group.scale.setScalar(0.82);
  return group;
}

function createScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    canvas,
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0.4, 2.2, 7.8);
  camera.lookAt(0, 0.4, 0);

  const ambientLight = new THREE.HemisphereLight(0xffffff, 0x2840e8, 2.45);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(4.8, 7.6, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);

  const fillLight = new THREE.PointLight(0xfff0cf, 2.1, 12);
  fillLight.position.set(-3.8, 2.4, 3.6);
  scene.add(fillLight);

  const world = new THREE.Group();
  scene.add(world);

  const ground = makeMesh(
    new THREE.CircleGeometry(4.8, 6),
    makeMaterial(palette.blueSoft, 0.94),
    [0, -1.62, 0],
    [-Math.PI / 2, 0, Math.PI / 6],
    [1.45, 1, 1],
  );
  ground.receiveShadow = true;
  world.add(ground);

  const runway = makeMesh(
    new THREE.BoxGeometry(6.5, 0.04, 0.2),
    makeMaterial(palette.cream, 0.8),
    [-0.15, -1.38, 2.1],
    [0, -0.05, -0.1],
    [1, 1, 1],
  );
  world.add(runway);

  const mountains = new THREE.Group();
  [
    [-3.1, -1.62, -1.9, 1.35, 2.65, palette.blueDeep],
    [-1.75, -1.62, -2.38, 1.15, 2.2, palette.blueSoft],
    [-0.45, -1.62, -2.8, 1.75, 3.35, palette.blueDeep],
    [1.35, -1.62, -2.45, 1.42, 2.75, palette.blueSoft],
    [2.9, -1.62, -2.05, 1.08, 2.05, palette.blueDeep],
  ].forEach(([x, y, z, radius, height, color]) => {
    const mountain = createMountain(radius, height, color);
    mountain.position.set(x, y + height / 2, z);
    mountain.rotation.y = Math.PI / 4;
    mountains.add(mountain);
  });
  world.add(mountains);

  const snow = makeMaterial(palette.white, 0.86);
  mountains.children.forEach((mountain) => {
    const peak = makeMesh(new THREE.ConeGeometry(0.34, 0.42, 4), snow, [0, 0, 0]);
    peak.position.copy(mountain.position);
    peak.position.y += 0.92;
    peak.rotation.y = Math.PI / 4;
    peak.scale.setScalar(1.15);
    mountains.add(peak);
  });

  const mascot = createMascot();
  world.add(mascot);

  const gemMaterial = makeMaterial(palette.orange, 0.62);
  for (let i = 0; i < 7; i += 1) {
    const gem = makeMesh(
      new THREE.DodecahedronGeometry(0.13 + i * 0.008, 0),
      gemMaterial,
      [-2.65 + i * 0.32, -1.17 + Math.sin(i) * 0.04, 1.38 + Math.cos(i * 0.7) * 0.1],
    );
    gem.rotation.set(i * 0.4, i * 0.2, i * 0.3);
    world.add(gem);
  }

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / Math.max(clientHeight, 1);
    camera.updateProjectionMatrix();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  const clock = new THREE.Clock();
  const leftArm = mascot.getObjectByName("leftArm");
  const rightArm = mascot.getObjectByName("rightArm");
  const leftLeg = mascot.getObjectByName("leftLeg");
  const rightLeg = mascot.getObjectByName("rightLeg");
  const leftShoe = mascot.getObjectByName("leftShoe");
  const rightShoe = mascot.getObjectByName("rightShoe");

  const render = () => {
    const elapsed = clock.getElapsedTime();
    const stride = Math.sin(elapsed * 5.2);
    const bounce = Math.abs(Math.sin(elapsed * 5.2)) * 0.08;

    mascot.position.y = -1.02 + bounce;
    mascot.rotation.y = -0.42 + Math.sin(elapsed * 1.2) * 0.06;
    mountains.rotation.y = Math.sin(elapsed * 0.18) * 0.035;
    world.rotation.z = Math.sin(elapsed * 0.32) * 0.012;

    if (leftArm && rightArm && leftLeg && rightLeg && leftShoe && rightShoe) {
      leftArm.rotation.z = -0.82 + stride * 0.3;
      rightArm.rotation.z = 0.82 - stride * 0.3;
      leftLeg.rotation.z = 0.34 - stride * 0.24;
      rightLeg.rotation.z = -0.34 + stride * 0.24;
      leftShoe.rotation.z = 0.18 - stride * 0.18;
      rightShoe.rotation.z = -0.18 + stride * 0.18;
    }

    renderer.render(scene, camera);
  };

  if (prefersReducedMotion.matches) {
    render();
  } else {
    renderer.setAnimationLoop(render);
  }
}

function animateMacaws() {
  if (prefersReducedMotion.matches) {
    return;
  }

  [
    { selector: ".macaw--one", duration: 18500, delay: 0, y: ["0vh", "12vh", "-2vh", "8vh"] },
    { selector: ".macaw--two", duration: 22200, delay: 4200, y: ["6vh", "-8vh", "4vh", "-4vh"] },
    { selector: ".macaw--three", duration: 20100, delay: 8500, y: ["-4vh", "7vh", "-6vh", "3vh"] },
  ].forEach((flight) => {
    animate(flight.selector, {
      translateX: ["-22vw", "122vw"],
      translateY: flight.y,
      rotateZ: ["-5deg", "6deg", "-3deg", "4deg"],
      duration: flight.duration,
      delay: flight.delay,
      loop: true,
      ease: "inOutSine",
    });
  });

  animate(".score-card--top", {
    translateY: [-5, 5],
    duration: 2200,
    loop: true,
    alternate: true,
    ease: "inOutSine",
  });

  animate(".speech-card", {
    rotateZ: ["-1.3deg", "1deg"],
    translateY: [0, -8],
    duration: 3200,
    loop: true,
    alternate: true,
    ease: "inOutSine",
  });

  animate(".stat-card, .service-card", {
    translateY: [28, 0],
    opacity: [0, 1],
    duration: 900,
    delay: (_target, index) => index * 90,
    ease: "outExpo",
  });
}

function init() {
  const canvas = document.querySelector<HTMLCanvasElement>("#hero-canvas");
  if (canvas) {
    createScene(canvas);
  }

  animateMacaws();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
