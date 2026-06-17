import { BLOCK_TYPES, BLOCK_INFO } from './blocks.js';

const BLOCK_COLORS = {
  [BLOCK_TYPES.GRASS]:  '#5D8A3C',
  [BLOCK_TYPES.DIRT]:   '#8B5E3C',
  [BLOCK_TYPES.STONE]:  '#888888',
  [BLOCK_TYPES.WOOD]:   '#8B6914',
  [BLOCK_TYPES.LEAVES]: '#2D7A1F',
};

export class UI {
  constructor(inventory) {
    this.inventory    = inventory;
    this.fpsEl        = document.getElementById('fps');
    this.coordsEl     = document.getElementById('coords');
    this.chunkInfoEl  = document.getElementById('chunk-info');
    this.hotbarEl     = document.getElementById('hotbar');
    this.overlayEl    = document.getElementById('overlay');
    this.loadingEl    = document.getElementById('loading-screen');
    this.loadingBar   = document.getElementById('loading-bar');
    this.loadingText  = document.getElementById('loading-text');

    this._buildHotbar();

    // Prevent right-click context menu on canvas
    document.getElementById('game-canvas').addEventListener('contextmenu', e => e.preventDefault());

    // Overlay click to resume
    this.overlayEl.addEventListener('click', () => {
      document.getElementById('game-canvas').requestPointerLock();
    });

    // Pause on ESC (pointer lock handles this automatically)
    document.addEventListener('pointerlockchange', () => {
      const locked = !!document.pointerLockElement;
      this.overlayEl.classList.toggle('hidden', locked);
    });

    this._frameCount = 0;
    this._fpsTimer   = 0;
    this._fps        = 0;
  }

  _buildHotbar() {
    this.hotbarEl.innerHTML = '';
    this.slots = [];

    for (let i = 0; i < this.inventory.items.length; i++) {
      const bt = this.inventory.items[i];
      const info = BLOCK_INFO[bt];

      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';

      const numEl = document.createElement('span');
      numEl.className = 'slot-number';
      numEl.textContent = i + 1;

      const iconEl = document.createElement('div');
      iconEl.className = 'slot-icon';
      iconEl.style.background = BLOCK_COLORS[bt] || '#666';
      iconEl.style.width  = '32px';
      iconEl.style.height = '32px';
      iconEl.style.borderRadius = '3px';
      iconEl.style.border = '1px solid rgba(255,255,255,0.3)';

      const nameEl = document.createElement('span');
      nameEl.className = 'slot-name';
      nameEl.textContent = info?.name || '';

      slot.appendChild(numEl);
      slot.appendChild(iconEl);
      slot.appendChild(nameEl);

      slot.addEventListener('click', () => {
        this.inventory.selected = i;
        this._updateHotbarSelection();
      });

      this.hotbarEl.appendChild(slot);
      this.slots.push(slot);
    }

    this._updateHotbarSelection();
  }

  _updateHotbarSelection() {
    this.slots.forEach((s, i) => {
      s.classList.toggle('active', i === this.inventory.selected);
    });
  }

  update(dt, player, world) {
    // FPS
    this._frameCount++;
    this._fpsTimer += dt;
    if (this._fpsTimer >= 0.5) {
      this._fps = Math.round(this._frameCount / this._fpsTimer);
      this._frameCount = 0;
      this._fpsTimer   = 0;
      this.fpsEl.textContent = `FPS: ${this._fps}`;
    }

    // Coords
    const p = player.position;
    this.coordsEl.textContent =
      `X: ${p.x.toFixed(1)}  Y: ${p.y.toFixed(1)}  Z: ${p.z.toFixed(1)}`;

    // Chunk
    const [cx, cz] = world.worldToChunk(Math.floor(p.x), Math.floor(p.z));
    this.chunkInfoEl.textContent = `Chunk: ${cx}, ${cz}`;

    // Hotbar selection
    this._updateHotbarSelection();
  }

  setLoading(progress, text) {
    this.loadingBar.style.width = `${progress * 100}%`;
    if (text) this.loadingText.textContent = text;
  }

  hideLoading() {
    this.loadingEl.classList.add('fade-out');
    setTimeout(() => { this.loadingEl.style.display = 'none'; }, 600);
  }
}
