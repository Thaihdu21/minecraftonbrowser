import * as THREE from 'three';
import { BLOCK_TYPES, BLOCK_INFO } from './blocks.js';
import { CHUNK_HEIGHT } from './chunk.js';

const GRAVITY       = -28;
const JUMP_VELOCITY =  10;
const WALK_SPEED    =   5;
const SPRINT_SPEED  =   9;
const PLAYER_HEIGHT =  1.8;
const PLAYER_RADIUS =  0.3;
const REACH         =   5;

export class Player {
  constructor(camera, world) {
    this.camera   = camera;
    this.world    = world;

    this.position = new THREE.Vector3(8, 50, 8);
    this.velocity = new THREE.Vector3();
    this.onGround = false;

    // Load saved position
    this._loadPosition();
  }

  update(dt, controls) {
    if (!controls.enabled) return;

    const speed = controls.keys.shift ? SPRINT_SPEED : WALK_SPEED;

    // Horizontal movement relative to camera yaw
    const dir = new THREE.Vector3();
    if (controls.keys.w) dir.z -= 1;
    if (controls.keys.s) dir.z += 1;
    if (controls.keys.a) dir.x -= 1;
    if (controls.keys.d) dir.x += 1;
    dir.normalize();

    // Rotate movement by yaw only
    const yaw = controls.yaw;
    const moveX = dir.x * Math.cos(yaw) + dir.z * Math.sin(yaw);
    const moveZ = dir.x * (-Math.sin(yaw)) + dir.z * Math.cos(yaw);

    this.velocity.x = moveX * speed;
    this.velocity.z = moveZ * speed;

    // Jump
    if (controls.keys.space && this.onGround) {
      this.velocity.y = JUMP_VELOCITY;
      this.onGround = false;
    }

    // Gravity
    this.velocity.y += GRAVITY * dt;

    // Move & collide
    this._moveAndCollide(dt);

    // Update camera
    this.camera.position.set(
      this.position.x,
      this.position.y + PLAYER_HEIGHT * 0.85,
      this.position.z
    );

    // Autosave position every 5 seconds
    this._posTimer = (this._posTimer || 0) + dt;
    if (this._posTimer > 5) {
      this._savePosition();
      this._posTimer = 0;
    }
  }

  _moveAndCollide(dt) {
    // Step X
    this.position.x += this.velocity.x * dt;
    this._resolveCollisions('x');

    // Step Z
    this.position.z += this.velocity.z * dt;
    this._resolveCollisions('z');

    // Step Y
    this.position.y += this.velocity.y * dt;
    this._resolveCollisions('y');
  }

  _resolveCollisions(axis) {
    const px = this.position.x;
    const py = this.position.y;
    const pz = this.position.z;
    const r  = PLAYER_RADIUS;
    const h  = PLAYER_HEIGHT;

    // AABB: x ∈ [px-r, px+r], y ∈ [py, py+h], z ∈ [pz-r, pz+r]
    const minX = Math.floor(px - r), maxX = Math.floor(px + r);
    const minY = Math.floor(py),     maxY = Math.floor(py + h);
    const minZ = Math.floor(pz - r), maxZ = Math.floor(pz + r);

    this.onGround = false;

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          const bt = this.world.getBlock(bx, by, bz);
          if (!BLOCK_INFO[bt]?.solid) continue;

          // Block AABB: [bx, bx+1] × [by, by+1] × [bz, bz+1]
          const overlapX = Math.min(px+r, bx+1) - Math.max(px-r, bx);
          const overlapY = Math.min(py+h, by+1) - Math.max(py,   by);
          const overlapZ = Math.min(pz+r, bz+1) - Math.max(pz-r, bz);

          if (overlapX <= 0 || overlapY <= 0 || overlapZ <= 0) continue;

          if (axis === 'x') {
            if (px < bx + 0.5) this.position.x = bx   - r;
            else                this.position.x = bx+1 + r;
            this.velocity.x = 0;
          } else if (axis === 'y') {
            if (py < by + 0.5) {
              this.position.y = by   - h;
              this.velocity.y = 0;
            } else {
              this.position.y = by+1;
              this.velocity.y = 0;
              this.onGround   = true;
            }
          } else if (axis === 'z') {
            if (pz < bz + 0.5) this.position.z = bz   - r;
            else                this.position.z = bz+1 + r;
            this.velocity.z = 0;
          }
        }
      }
    }

    // Floor clamp
    if (this.position.y < 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.onGround   = true;
    }
  }

  // Raycasting for block interaction
  getTargetBlock() {
    const origin    = this.camera.position.clone();
    const direction = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(this.camera.quaternion)
      .normalize();

    const step    = 0.05;
    let   current = origin.clone();
    let   prev    = null;

    for (let t = 0; t < REACH; t += step) {
      current.addScaledVector(direction, step);
      const bx = Math.floor(current.x);
      const by = Math.floor(current.y);
      const bz = Math.floor(current.z);

      const bt = this.world.getBlock(bx, by, bz);
      if (BLOCK_INFO[bt]?.solid) {
        return {
          block:    new THREE.Vector3(bx, by, bz),
          previous: prev ? new THREE.Vector3(
            Math.floor(prev.x), Math.floor(prev.y), Math.floor(prev.z)
          ) : null,
          type: bt,
        };
      }
      prev = current.clone();
    }
    return null;
  }

  _savePosition() {
    try {
      const pos = { x: this.position.x, y: this.position.y, z: this.position.z };
      localStorage.setItem('mc_pos', JSON.stringify(pos));
    } catch (e) {}
  }

  _loadPosition() {
    try {
      const raw = localStorage.getItem('mc_pos');
      if (!raw) return;
      const pos = JSON.parse(raw);
      this.position.set(pos.x, pos.y + 1, pos.z);
    } catch (e) {}
  }
}
