import * as THREE from "three";

export default class CameraControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    // movement
    this.keys = { w: false, a: false, s: false, d: false, q: false, e: false };
    this.moveSpeed = 5;

    // rotation (pointer lock)
    this.isLocked = false;
    this.euler = new THREE.Euler(0, 0, 0, "YXZ");
    this.rotationSpeed = 0.002;

    // panning
    this.isPanning = false;
    this.panSpeed = 0.01;
    this.prevMouse = { x: 0, y: 0 };

    this._bindEvents();
  }

  _bindEvents() {
    // disable context menu
    this.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

    // pointer lock change
    document.addEventListener("pointerlockchange", () => {
      this.isLocked = document.pointerLockElement === this.domElement;
    });

    // mouse down
    this.domElement.addEventListener("mousedown", (e) => {
      if (e.button === 2) {
        // right click = rotate
        this.domElement.requestPointerLock();
      } else if (e.button === 0) {
        // left click = pan
        this.isPanning = true;
        this.prevMouse.x = e.clientX;
        this.prevMouse.y = e.clientY;
      }
    });

    document.addEventListener("mouseup", () => {
      this.isPanning = false;
    });

    // mouse move
    document.addEventListener("mousemove", (e) => {
      if (this.isLocked) {
        // rotation
        this.euler.setFromQuaternion(this.camera.quaternion);

        this.euler.y -= e.movementX * this.rotationSpeed;
        this.euler.x -= e.movementY * this.rotationSpeed;

        // clamp vertical look
        const PI_2 = Math.PI / 2;
        this.euler.x = Math.max(-PI_2, Math.min(PI_2, this.euler.x));

        this.camera.quaternion.setFromEuler(this.euler);
      } else if (this.isPanning) {
        // panning
        const dx = e.clientX - this.prevMouse.x;
        const dy = e.clientY - this.prevMouse.y;

        const right = new THREE.Vector3();
        this.camera.getWorldDirection(right);
        right.cross(this.camera.up);

        const up = this.camera.up.clone();

        this.camera.position.addScaledVector(right, -dx * this.panSpeed);
        this.camera.position.addScaledVector(up, dy * this.panSpeed);

        this.prevMouse.x = e.clientX;
        this.prevMouse.y = e.clientY;
      }
    });

    // keyboard
    document.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (k in this.keys) this.keys[k] = true;
    });

    document.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      if (k in this.keys) this.keys[k] = false;
    });
  }

  update(delta) {
    const velocity = this.moveSpeed * delta;

    if (this.keys.w) this._moveForward(velocity);
    if (this.keys.s) this._moveForward(-velocity);
    if (this.keys.a) this._moveRight(-velocity);
    if (this.keys.d) this._moveRight(velocity);
    if (this.keys.e) this._moveUp(velocity);
    if (this.keys.q) this._moveUp(-velocity);
  }

  _moveForward(dist) {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.camera.position.addScaledVector(dir, dist);
  }

  _moveUp(dist) {
    const up = new THREE.Vector3(0, 1, 0);
    up.applyQuaternion(this.camera.quaternion);
    this.camera.position.addScaledVector(up, dist);
  }

  _moveRight(dist) {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.cross(this.camera.up);
    this.camera.position.addScaledVector(dir, dist);
  }
}
