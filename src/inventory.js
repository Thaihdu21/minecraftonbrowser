import { BLOCK_TYPES } from './blocks.js';

const HOTBAR_SLOTS = 5;

export class Inventory {
  constructor() {
    this.items = [
      BLOCK_TYPES.GRASS,
      BLOCK_TYPES.DIRT,
      BLOCK_TYPES.STONE,
      BLOCK_TYPES.WOOD,
      BLOCK_TYPES.LEAVES,
    ];
    this.selected = 0;

    // Keyboard shortcuts 1-5
    document.addEventListener('keydown', (e) => {
      const n = parseInt(e.key);
      if (n >= 1 && n <= HOTBAR_SLOTS) {
        this.selected = n - 1;
      }
    });
  }

  getSelectedBlock() {
    return this.items[this.selected];
  }

  scroll(delta) {
    this.selected = ((this.selected + delta) % HOTBAR_SLOTS + HOTBAR_SLOTS) % HOTBAR_SLOTS;
  }
}
