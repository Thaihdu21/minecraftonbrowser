export class Controls {
  constructor(camera, canvas) {
    this.camera  = camera;
    this.canvas  = canvas;
    this.enabled = false;

    this.keys = {
      w: false, a: false, s: false, d: false,
      space: false, shift: false,
    };

    this.yaw   = 0;
    this.pitch = 0;

    this.mouseLeft  = false;
    this.mouseRight = false;
    this.scroll     = 0;

    this._onMouseMove  = this._onMouseMove.bind(this);
    this._onKeyDown    = this._onKeyDown.bind(this);
    this._onKeyUp      = this._onKeyUp.bind(this);
    this._onMouseDown  = this._onMouseDown.bind(this);
    this._onMouseUp    = this._onMouseUp.bind(this);
    this._onWheel      = this._onWheel.bind(this);
    this._onLockChange = this._onLockChange.bind(this);

    document.addEventListener('mousemove',   this._onMouseMove);
    document.addEventListener('keydown',     this._onKeyDown);
    document.addEventListener('keyup',       this._onKeyUp);
    canvas.addEventListener('mousedown',     this._onMouseDown);
    document.addEventListener('mouseup',     this._onMouseUp);
    document.addEventListener('wheel',       this._onWheel, { passive: true });
    document.addEventListener('pointerlockchange', this._onLockChange);

    canvas.addEventListener('click', () => this.lock());
  }

  lock() {
    this.canvas.requestPointerLock();
  }

  unlock() {
    document.exitPointerLock();
  }

  _onLockChange() {
    this.enabled = document.pointerLockElement === this.canvas;
  }

  _onMouseMove(e) {
    if (!this.enabled) return;
    const sens = 0.002;
    this.yaw   -= e.movementX * sens;
    this.pitch -= e.movementY * sens;
    this.pitch  = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, this.pitch));

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  _onKeyDown(e) {
    switch (e.code) {
      case 'KeyW':      this.keys.w     = true; break;
      case 'KeyA':      this.keys.a     = true; break;
      case 'KeyS':      this.keys.s     = true; break;
      case 'KeyD':      this.keys.d     = true; break;
      case 'Space':     this.keys.space = true; e.preventDefault(); break;
      case 'ShiftLeft': this.keys.shift = true; break;
    }
  }

  _onKeyUp(e) {
    switch (e.code) {
      case 'KeyW':      this.keys.w     = false; break;
      case 'KeyA':      this.keys.a     = false; break;
      case 'KeyS':      this.keys.s     = false; break;
      case 'KeyD':      this.keys.d     = false; break;
      case 'Space':     this.keys.space = false; break;
      case 'ShiftLeft': this.keys.shift = false; break;
    }
  }

  _onMouseDown(e) {
    if (!this.enabled) return;
    if (e.button === 0) this.mouseLeft  = true;
    if (e.button === 2) this.mouseRight = true;
    e.preventDefault();
  }

  _onMouseUp(e) {
    if (e.button === 0) this.mouseLeft  = false;
    if (e.button === 2) this.mouseRight = false;
  }

  _onWheel(e) {
    this.scroll = Math.sign(e.deltaY);
  }

  consumeScroll() {
    const s = this.scroll;
    this.scroll = 0;
    return s;
  }

  consumeMouseLeft() {
    const v = this.mouseLeft;
    this.mouseLeft = false;
    return v;
  }

  consumeMouseRight() {
    const v = this.mouseRight;
    this.mouseRight = false;
    return v;
  }

  dispose() {
    document.removeEventListener('mousemove',   this._onMouseMove);
    document.removeEventListener('keydown',     this._onKeyDown);
    document.removeEventListener('keyup',       this._onKeyUp);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup',     this._onMouseUp);
    document.removeEventListener('wheel',       this._onWheel);
    document.removeEventListener('pointerlockchange', this._onLockChange);
  }
}
