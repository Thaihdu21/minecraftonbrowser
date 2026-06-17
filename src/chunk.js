import * as THREE from 'three';
import { BLOCK_TYPES, BLOCK_INFO, FACES } from './blocks.js';

export const CHUNK_SIZE   = 16;
export const CHUNK_HEIGHT = 64;
export const SEA_LEVEL    = 32;

export class Chunk {
  constructor(chunkX, chunkZ, scene) {
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.scene  = scene;

    // Flat array: [x][y][z] = x + CHUNK_SIZE*(y + CHUNK_HEIGHT*z)
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    this.meshes = [];  // THREE.Mesh per block type
    this.dirty  = true;
    this.generated = false;
    this.mesh = null;
  }

  blockIdx(x, y, z) {
    return x + CHUNK_SIZE * (y + CHUNK_HEIGHT * z);
  }

  getBlock(x, y, z) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return BLOCK_TYPES.AIR;
    }
    return this.blocks[this.blockIdx(x, y, z)];
  }

  setBlock(x, y, z, type) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) return;
    this.blocks[this.blockIdx(x, y, z)] = type;
    this.dirty = true;
  }

  // Build geometry from visible faces (greedy-ish per block type)
  buildMesh(getNeighborBlock) {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }

    // Collect geometry per block type
    const typeGeoms = {};

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const blockType = this.getBlock(x, y, z);
          if (blockType === BLOCK_TYPES.AIR) continue;

          const info = BLOCK_INFO[blockType];
          if (!info || !info.solid) continue;

          const wx = this.chunkX * CHUNK_SIZE + x;
          const wz = this.chunkZ * CHUNK_SIZE + z;

          for (const face of FACES) {
            const [dx, dy, dz] = face.dir;
            const nx = x + dx, ny = y + dy, nz = z + dz;

            // Check neighbor (inside chunk or across boundary)
            let neighborSolid = false;
            if (nx >= 0 && nx < CHUNK_SIZE && ny >= 0 && ny < CHUNK_HEIGHT && nz >= 0 && nz < CHUNK_SIZE) {
              const nb = this.getBlock(nx, ny, nz);
              neighborSolid = BLOCK_INFO[nb]?.solid ?? false;
            } else {
              // Ask world for cross-chunk block
              const wnx = wx + dx, wny = y + dy, wnz = wz + dz;
              const nb = getNeighborBlock(wnx, wny, wnz);
              neighborSolid = BLOCK_INFO[nb]?.solid ?? false;
            }

            if (neighborSolid) continue; // Face hidden, skip

            // Get color for this face type
            const color = info.colors[face.faceType] ?? info.colors.side;

            const key = `${blockType}_${face.faceType}`;
            if (!typeGeoms[key]) {
              typeGeoms[key] = {
                positions: [],
                normals:   [],
                indices:   [],
                color:     color,
                vertCount: 0,
              };
            }
            const geom = typeGeoms[key];

            const base = geom.vertCount;
            for (const corner of face.corners) {
              geom.positions.push(wx + corner[0], y + corner[1], wz + corner[2]);
              geom.normals.push(dx, dy, dz);
            }
            geom.indices.push(
              base, base+1, base+2,
              base+2, base+1, base+3
            );
            geom.vertCount += 4;
          }
        }
      }
    }

    // Build merged mesh with vertex colors per sub-mesh
    const geometries = [];
    const materials  = [];

    for (const data of Object.values(typeGeoms)) {
      if (data.positions.length === 0) continue;

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
      geo.setAttribute('normal',   new THREE.Float32BufferAttribute(data.normals,   3));
      geo.setIndex(data.indices);
      geo.computeBoundingSphere();

      geometries.push(geo);

      const mat = new THREE.MeshLambertMaterial({
        color: data.color,
        side: THREE.FrontSide,
      });
      materials.push(mat);
    }

    if (geometries.length === 0) return;

    // Merge all geometries into one mesh with material groups
    const mergedGeo = new THREE.BufferGeometry();
    let totalVerts = 0;
    let totalIdx   = 0;
    const allPos   = [];
    const allNorm  = [];
    const allIdx   = [];
    const groups   = [];

    for (let i = 0; i < geometries.length; i++) {
      const g = geometries[i];
      const pos  = g.getAttribute('position').array;
      const norm = g.getAttribute('normal').array;
      const idx  = g.getIndex().array;
      const idxStart = allIdx.length;

      for (let j = 0; j < idx.length; j++) allIdx.push(idx[j] + totalVerts);
      for (let j = 0; j < pos.length; j++)  allPos.push(pos[j]);
      for (let j = 0; j < norm.length; j++) allNorm.push(norm[j]);

      groups.push({ start: idxStart, count: idx.length, materialIndex: i });
      totalVerts += pos.length / 3;
      totalIdx   += idx.length;

      g.dispose();
    }

    mergedGeo.setAttribute('position', new THREE.Float32BufferAttribute(allPos,  3));
    mergedGeo.setAttribute('normal',   new THREE.Float32BufferAttribute(allNorm, 3));
    mergedGeo.setIndex(allIdx);
    for (const g of groups) mergedGeo.addGroup(g.start, g.count, g.materialIndex);
    mergedGeo.computeBoundingSphere();

    this.mesh = new THREE.Mesh(mergedGeo, materials);
    this.mesh.castShadow    = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = true;
    this.scene.add(this.mesh);
    this.dirty = false;
  }

  dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach(m => m.dispose());
      } else {
        this.mesh.material.dispose();
      }
      this.mesh = null;
    }
  }
}
