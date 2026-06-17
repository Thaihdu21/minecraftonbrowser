import * as THREE from 'three';
import { World }     from './world.js';
import { Player }    from './player.js';
import { Controls }  from './controls.js';
import { Inventory } from './inventory.js';
import { UI }        from './ui.js';
import { BLOCK_TYPES, BLOCK_INFO } from './blocks.js';
import { CHUNK_SIZE } from './chunk.js';

// ── Scene Setup ────────────────────────────────────────────────────────────
const canvas   = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x87CEEB); // sky blue

const scene  = new THREE.Scene();
scene.fog    = new THREE.Fog(0x87CEEB, 80, 160);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);

// ── Lighting ───────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfffde7, 1.0);
sun.position.set(50, 100, 50);
sun.castShadow    = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far  = 300;
sun.shadow.camera.left = sun.shadow.camera.bottom = -80;
sun.shadow.camera.right = sun.shadow.camera.top   =  80;
scene.add(sun);

// ── Block Outline ──────────────────────────────────────────────────────────
const outlineGeo = new THREE.BoxGeometry(1.005, 1.005, 1.005);
const outlineMat = new THREE.MeshBasicMaterial({
  color: 0x000000,
  side:  THREE.BackSide,
  transparent: true,
  opacity: 0.6,
  depthTest: true,
});
const outlineMesh = new THREE.Mesh(outlineGeo, outlineMat);
outlineMesh.visible = false;
scene.add(outlineMesh);

// ── Core Systems ───────────────────────────────────────────────────────────
const world     = new World(scene);
const controls  = new Controls(camera, canvas);
const inventory = new Inventory();
const player    = new Player(camera, world);
const ui        = new UI(inventory);

// ── Initial World Generation ───────────────────────────────────────────────
async function initialGenerate() {
  const INIT_R = 3;
  const [pcx, pcz] = world.worldToChunk(
    Math.floor(player.position.x),
    Math.floor(player.position.z)
  );
  let total = (INIT_R*2+1) ** 2;
  let done  = 0;

  for (let dx = -INIT_R; dx <= INIT_R; dx++) {
    for (let dz = -INIT_R; dz <= INIT_R; dz++) {
      world.generateChunk(pcx + dx, pcz + dz);
      done++;
      ui.setLoading(done / total, `Generating terrain... ${Math.round(done/total*100)}%`);
      // Yield to browser every 4 chunks
      if (done % 4 === 0) await new Promise(r => setTimeout(r, 0));
    }
  }

  // Ensure player spawns on top of terrain
  const spawnH = world.getTerrainHeight(
    Math.floor(player.position.x),
    Math.floor(player.position.z)
  );
  if (player.position.y < spawnH + 2) {
    player.position.y = spawnH + 2;
  }

  ui.setLoading(1, 'Building meshes...');
  await new Promise(r => setTimeout(r, 0));

  for (const chunk of world.chunks.values()) {
    chunk.buildMesh((wx, wy, wz) => world.getBlock(wx, wy, wz));
  }

  ui.setLoading(1, 'Done!');
  await new Promise(r => setTimeout(r, 100));
  ui.hideLoading();
}

// ── Block Interaction ──────────────────────────────────────────────────────
let breakCooldown = 0;
let placeCooldown = 0;
const BREAK_DELAY = 0.25;
const PLACE_DELAY = 0.25;

function handleInteraction(dt) {
  breakCooldown -= dt;
  placeCooldown -= dt;

  const target = player.getTargetBlock();

  if (target) {
    outlineMesh.position.set(
      target.block.x + 0.5,
      target.block.y + 0.5,
      target.block.z + 0.5
    );
    outlineMesh.visible = true;
  } else {
    outlineMesh.visible = false;
  }

  // Break
  if (controls.consumeMouseLeft() && target && breakCooldown <= 0) {
    const { x, y, z } = target.block;
    world.setBlock(x, y, z, BLOCK_TYPES.AIR);
    breakCooldown = BREAK_DELAY;
  }

  // Place
  if (controls.consumeMouseRight() && target && target.previous && placeCooldown <= 0) {
    const { x, y, z } = target.previous;
    // Don't place inside player
    const px = player.position.x, py = player.position.y, pz = player.position.z;
    const insidePlayer =
      x === Math.floor(px) &&
      (y === Math.floor(py) || y === Math.floor(py + 1)) &&
      z === Math.floor(pz);
    if (!insidePlayer) {
      world.setBlock(x, y, z, inventory.getSelectedBlock());
      placeCooldown = PLACE_DELAY;
    }
  }

  // Scroll to change block
  const scroll = controls.consumeScroll();
  if (scroll !== 0) {
    inventory.scroll(scroll);
  }
}

// ── Window Resize ──────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Game Loop ──────────────────────────────────────────────────────────────
let last = performance.now();

function gameLoop(now) {
  const dt = Math.min((now - last) / 1000, 0.05); // cap at 50ms
  last = now;

  player.update(dt, controls);
  world.update(player.position.x, player.position.z);
  handleInteraction(dt);
  ui.update(dt, player, world);

  // Move sun with player for consistent lighting
  sun.position.set(player.position.x + 50, 100, player.position.z + 50);
  sun.target.position.set(player.position.x, 0, player.position.z);
  sun.target.updateMatrixWorld();

  renderer.render(scene, camera);
  requestAnimationFrame(gameLoop);
}

// ── Boot ───────────────────────────────────────────────────────────────────
initialGenerate().then(() => requestAnimationFrame(gameLoop));
