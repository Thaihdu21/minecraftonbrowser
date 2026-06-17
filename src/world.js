import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL } from './chunk.js';
import { BLOCK_TYPES } from './blocks.js';
import { PerlinNoise } from './noise.js';

const RENDER_DISTANCE = 6;  // chunks
const TREE_CHANCE     = 0.015;

export class World {
  constructor(scene) {
    this.scene   = scene;
    this.chunks  = new Map();   // key: "cx,cz"
    this.noise   = new PerlinNoise(12345);
    this.noise2  = new PerlinNoise(54321);
    this.modifications = new Map(); // persistent block edits

    this._loadModifications();
  }

  chunkKey(cx, cz) { return `${cx},${cz}`; }

  getChunk(cx, cz) {
    return this.chunks.get(this.chunkKey(cx, cz)) || null;
  }

  // World → chunk coords
  worldToChunk(wx, wz) {
    return [Math.floor(wx / CHUNK_SIZE), Math.floor(wz / CHUNK_SIZE)];
  }

  // World → local block coords
  worldToLocal(wx, wy, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return [cx, cz, lx, Math.floor(wy), lz];
  }

  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BLOCK_TYPES.AIR;
    const [cx, cz] = this.worldToChunk(wx, wz);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return BLOCK_TYPES.AIR;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.getBlock(lx, wy, lz);
  }

  setBlock(wx, wy, wz, type) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const [cx, cz] = this.worldToChunk(wx, wz);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    chunk.setBlock(lx, wy, lz, type);
    chunk.dirty = true;

    // Save modification
    const key = `${wx},${wy},${wz}`;
    this.modifications.set(key, type);
    this._saveModifications();

    // Rebuild neighbor chunks if block on boundary
    const neighbors = [];
    if (lx === 0)             neighbors.push([cx-1, cz]);
    if (lx === CHUNK_SIZE-1)  neighbors.push([cx+1, cz]);
    if (lz === 0)             neighbors.push([cx, cz-1]);
    if (lz === CHUNK_SIZE-1)  neighbors.push([cx, cz+1]);
    for (const [ncx, ncz] of neighbors) {
      const nc = this.getChunk(ncx, ncz);
      if (nc) nc.dirty = true;
    }
  }

  // Terrain height at world position
  getTerrainHeight(wx, wz) {
    const scale  = 0.008;
    const scale2 = 0.03;

    const base    = this.noise.octave(wx * scale,  wz * scale,  4, 0.5, 2.0);
    const detail  = this.noise.octave(wx * scale2, wz * scale2, 2, 0.5, 2.0);

    // Map [-1,1] → height
    const height = Math.floor(SEA_LEVEL + base * 14 + detail * 6);
    return Math.max(2, Math.min(CHUNK_HEIGHT - 5, height));
  }

  generateChunk(cx, cz) {
    const chunk = new Chunk(cx, cz, this.scene);

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const h  = this.getTerrainHeight(wx, wz);

        for (let y = 0; y <= h; y++) {
          let type = BLOCK_TYPES.STONE;
          if (y === h)     type = BLOCK_TYPES.GRASS;
          else if (y >= h-3) type = BLOCK_TYPES.DIRT;
          chunk.setBlock(lx, y, lz, type);
        }

        // Trees
        if (h > SEA_LEVEL + 1) {
          const treeRng = Math.abs(
            Math.sin((wx * 127.1 + wz * 311.7) * 0.001 + this.noise.seed * 1000)
          );
          if (treeRng < TREE_CHANCE) {
            this._placeTree(chunk, cx, cz, lx, h + 1, lz);
          }
        }
      }
    }

    chunk.generated = true;
    this.chunks.set(this.chunkKey(cx, cz), chunk);

    // Apply saved modifications
    this._applyModifications(chunk, cx, cz);

    return chunk;
  }

  _placeTree(chunk, cx, cz, lx, startY, lz) {
    const trunkH = 4 + Math.floor(Math.random() * 3);

    // Trunk
    for (let y = 0; y < trunkH; y++) {
      const wy = startY + y;
      if (wy < CHUNK_HEIGHT) chunk.setBlock(lx, wy, lz, BLOCK_TYPES.WOOD);
    }

    // Leaves
    const leafY = startY + trunkH - 1;
    for (let dy = 0; dy <= 2; dy++) {
      const radius = dy === 0 ? 2 : 1;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.abs(dx) === radius && Math.abs(dz) === radius) continue; // round corners
          const nlx = lx + dx, nly = leafY + dy, nlz = lz + dz;
          if (nlx >= 0 && nlx < CHUNK_SIZE && nlz >= 0 && nlz < CHUNK_SIZE && nly < CHUNK_HEIGHT) {
            if (chunk.getBlock(nlx, nly, nlz) === BLOCK_TYPES.AIR) {
              chunk.setBlock(nlx, nly, nlz, BLOCK_TYPES.LEAVES);
            }
          }
        }
      }
    }
    // Top leaf
    if (startY + trunkH < CHUNK_HEIGHT) chunk.setBlock(lx, startY + trunkH, lz, BLOCK_TYPES.LEAVES);
  }

  update(playerX, playerZ) {
    const [pcx, pcz] = this.worldToChunk(Math.floor(playerX), Math.floor(playerZ));

    // Load chunks in range
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        if (dx*dx + dz*dz > RENDER_DISTANCE*RENDER_DISTANCE) continue;
        const cx = pcx + dx, cz = pcz + dz;
        if (!this.getChunk(cx, cz)) {
          this.generateChunk(cx, cz);
        }
      }
    }

    // Rebuild dirty chunks
    for (const chunk of this.chunks.values()) {
      if (chunk.dirty && chunk.generated) {
        chunk.buildMesh((wx, wy, wz) => this.getBlock(wx, wy, wz));
      }
    }

    // Unload distant chunks
    for (const [key, chunk] of this.chunks.entries()) {
      const ddx = chunk.chunkX - pcx;
      const ddz = chunk.chunkZ - pcz;
      if (ddx*ddx + ddz*ddz > (RENDER_DISTANCE+2)*(RENDER_DISTANCE+2)) {
        chunk.dispose();
        this.chunks.delete(key);
      }
    }
  }

  // --- Persistence ---
  _saveModifications() {
    try {
      const obj = {};
      for (const [k, v] of this.modifications.entries()) obj[k] = v;
      localStorage.setItem('mc_mods', JSON.stringify(obj));
    } catch (e) { /* quota exceeded – ignore */ }
  }

  _loadModifications() {
    try {
      const raw = localStorage.getItem('mc_mods');
      if (!raw) return;
      const obj = JSON.parse(raw);
      for (const [k, v] of Object.entries(obj)) this.modifications.set(k, v);
    } catch (e) { /* corrupted – ignore */ }
  }

  _applyModifications(chunk, cx, cz) {
    const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;
    for (const [key, type] of this.modifications.entries()) {
      const [wx, wy, wz] = key.split(',').map(Number);
      const lx = wx - x0, lz = wz - z0;
      if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
        chunk.setBlock(lx, wy, lz, type);
      }
    }
  }
}
