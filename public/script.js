import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import CameraControls from "./CameraControls.js";
import Processor from "./processor.js";
import CodeGen from "./codegen.js";

const previewElement = document.querySelector("#preview");
const previewBox = previewElement.getBoundingClientRect();

let cuboids = [];
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75, // fov
  previewBox.width / previewBox.height, // aspect ratio
  0.1, // near
  1000, // far
);
camera.position.set(0, 5, 5);
camera.rotation.set(-45, 0, 0);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(previewBox.width, previewBox.height);
previewElement.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const light = new THREE.DirectionalLight(0xffffff, 1);
scene.add(light);

let model = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
);
scene.add(model);

const controls = new CameraControls(camera, renderer.domElement);
const grid = new THREE.GridHelper(
  100, // size
  100, // divisions
  0x888888, // center line color
  0x444444, // other lines
);
scene.add(grid);

const gizmoScene = new THREE.Scene();
const gizmoCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
gizmoCamera.position.set(0, 0, 3);
const gizmoAxis = new THREE.AxesHelper(1);
gizmoScene.add(gizmoAxis);

// rendering
const clock = new THREE.Clock();
function animate(time) {
  const dt = clock.getDelta();

  controls.update(dt);

  // main scene render
  light.position.copy(camera.position);
  renderer.setViewport(0, 0, previewBox.width, previewBox.height);
  renderer.render(scene, camera);

  // render bottom-right 120x120 gizmo
  gizmoAxis.quaternion.copy(camera.quaternion).invert(); // match rotation
  renderer.clearDepth();
  renderer.setScissorTest(true);
  renderer.setViewport(preview.width - 130, 10, 120, 120);
  renderer.setScissor(preview.width - 130, 10, 120, 120);
  renderer.render(gizmoScene, gizmoCamera);
  renderer.setScissorTest();
}

renderer.setAnimationLoop(animate);

// controls
draggableElement(
  document.querySelector("#controls"),
  document.querySelector("#controls > div[name='wbar']"),
);
function draggableElement(elem, dragger) {
  let pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;

  dragger.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    elem.style.top = elem.offsetTop - pos2 + "px";
    elem.style.left = elem.offsetLeft - pos1 + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

document.querySelector("#loadmodel").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const content = await file.text();
  const loader = new OBJLoader();
  const obj = loader.parse(content);

  const material = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 0.1,
    roughness: 0.8,
  });

  obj.traverse((child) => {
    if (child.isMesh) {
      child.material = material;
    }
  });

  obj.position.set(0, 0, 0);

  // dispose and reuse
  scene.remove(model);
  model?.geometry?.dispose();
  model?.material?.dispose();
  model = obj;
  scene.add(model);

  e.target.value = document.location.hash = "";
});

// called from the dom onclick
function _gprocess() {
  if (!model) return;
  const processor = new Processor(0.01);
  cuboids = processor.process(model);

  console.log(`Generated ${cuboids.length} parts`);

  // dispose model
  scene.remove(model);
  model?.geometry?.dispose();
  model?.material?.dispose();

  const geometry = new THREE.BoxGeometry(1, 1, 1); // base 1x1x1 geom
  const material = new THREE.MeshStandardMaterial({ color: 0x44aa88 });

  const instancedMesh = new THREE.InstancedMesh(
    geometry,
    material,
    cuboids.length,
  );

  const dummy = new THREE.Object3D();
  cuboids.forEach((cuboid, index) => {
    dummy.position.copy(cuboid.position);
    dummy.quaternion.copy(cuboid.rotation);
    dummy.scale.copy(cuboid.size);

    dummy.updateMatrix();
    instancedMesh.setMatrixAt(index, dummy.matrix);
  });

  model = instancedMesh;
  scene.add(instancedMesh);
}

async function _gcodegen() {
  if (!cuboids || !cuboids.length) return;
  const generator = new CodeGen();
  generator.process(cuboids);
  generator.generate();
  const code = await generator.emit();
  document.querySelector("#codegenOutput").textContent = code;
}

window.funcs = {
  process: _gprocess,
  codegen: _gcodegen,
};
