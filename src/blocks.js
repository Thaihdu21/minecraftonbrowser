// Block type definitions and texture atlas
export const BLOCK_TYPES = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
};

export const BLOCK_INFO = {
  [BLOCK_TYPES.AIR]: {
    name: 'Air',
    solid: false,
    color: null,
  },
  [BLOCK_TYPES.GRASS]: {
    name: 'Grass',
    solid: true,
    // [top, bottom, side] colors in hex
    colors: {
      top: 0x5D8A3C,
      bottom: 0x8B5E3C,
      side: 0x7A9E4E,
    },
  },
  [BLOCK_TYPES.DIRT]: {
    name: 'Dirt',
    solid: true,
    colors: {
      top: 0x8B5E3C,
      bottom: 0x8B5E3C,
      side: 0x8B5E3C,
    },
  },
  [BLOCK_TYPES.STONE]: {
    name: 'Stone',
    solid: true,
    colors: {
      top: 0x888888,
      bottom: 0x888888,
      side: 0x888888,
    },
  },
  [BLOCK_TYPES.WOOD]: {
    name: 'Wood',
    solid: true,
    colors: {
      top: 0xC8A464,
      bottom: 0xC8A464,
      side: 0x8B6914,
    },
  },
  [BLOCK_TYPES.LEAVES]: {
    name: 'Leaves',
    solid: true,
    colors: {
      top: 0x2D7A1F,
      bottom: 0x2D7A1F,
      side: 0x2D7A1F,
    },
  },
};

// Face directions: +X, -X, +Y, -Y, +Z, -Z
export const FACES = [
  { dir: [1, 0, 0],  corners: [[1,0,0],[1,1,0],[1,0,1],[1,1,1]], faceType: 'side'   },
  { dir: [-1,0, 0],  corners: [[0,0,1],[0,1,1],[0,0,0],[0,1,0]], faceType: 'side'   },
  { dir: [0, 1, 0],  corners: [[0,1,0],[1,1,0],[0,1,1],[1,1,1]], faceType: 'top'    },
  { dir: [0,-1, 0],  corners: [[0,0,1],[1,0,1],[0,0,0],[1,0,0]], faceType: 'bottom' },
  { dir: [0, 0, 1],  corners: [[0,0,1],[1,0,1],[0,1,1],[1,1,1]], faceType: 'side'   },  // Fixed winding
  { dir: [0, 0,-1],  corners: [[1,0,0],[0,0,0],[1,1,0],[0,1,0]], faceType: 'side'   },  // Fixed winding
];
