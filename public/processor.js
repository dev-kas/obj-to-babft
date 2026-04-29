import * as THREE from "three";

export default class Processor {
  constructor(minBlockSize = 0.5, thickness = null) {
    this.minBlockSize = minBlockSize;
    this.thickness = thickness !== null ? thickness : minBlockSize;

    this._tempVec3 = new THREE.Vector3();
    this._tempVec2 = new THREE.Vector2();
  }

  process(model) {
    const cuboids = new Map();
    const triangles = this.extractTriangles(model);

    const groups = this.groupTrianglesByPlane(triangles);
    for (const group of groups) {
      this.processPlaneGroup(group, cuboids);
    }

    return Array.from(cuboids.values());
  }

  extractTriangles(model) {
    const triangles = [];
    model.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      child.updateMatrixWorld();
      const geom = child.geometry;
      const pos = geom.attributes.position;
      const index = geom.index;
      const matrix = child.matrixWorld;

      if (index) {
        for (let i = 0; i < index.count; i += 3) {
          triangles.push(
            new THREE.Triangle(
              new THREE.Vector3()
                .fromBufferAttribute(pos, index.getX(i))
                .applyMatrix4(matrix),
              new THREE.Vector3()
                .fromBufferAttribute(pos, index.getX(i + 1))
                .applyMatrix4(matrix),
              new THREE.Vector3()
                .fromBufferAttribute(pos, index.getX(i + 2))
                .applyMatrix4(matrix),
            ),
          );
        }
      } else {
        for (let i = 0; i < pos.count; i += 3) {
          triangles.push(
            new THREE.Triangle(
              new THREE.Vector3()
                .fromBufferAttribute(pos, i)
                .applyMatrix4(matrix),
              new THREE.Vector3()
                .fromBufferAttribute(pos, i + 1)
                .applyMatrix4(matrix),
              new THREE.Vector3()
                .fromBufferAttribute(pos, i + 2)
                .applyMatrix4(matrix),
            ),
          );
        }
      }
    });
    return triangles;
  }

  groupTrianglesByPlane(triangles) {
    const planeMap = new Map();

    for (const tri of triangles) {
      const normal = new THREE.Vector3();
      tri.getNormal(normal);
      if (normal.lengthSq() === 0) continue;

      const nx = normal.x.toFixed(4);
      const ny = normal.y.toFixed(4);
      const nz = normal.z.toFixed(4);

      const d = normal.dot(tri.a).toFixed(4);
      const key = `${nx}_${ny}_${nz}_${d}`;

      if (!planeMap.has(key)) {
        planeMap.set(key, {
          normal: normal,
          triangles: [],
        });
      }
      planeMap.get(key).triangles.push(tri);
    }
    return Array.from(planeMap.values());
  }

  processPlaneGroup(group, cuboids) {
    const { normal, triangles } = group;

    const refTri = triangles[0];
    const xAxis = new THREE.Vector3()
      .subVectors(refTri.b, refTri.a)
      .normalize();
    if (xAxis.lengthSq() === 0) xAxis.set(1, 0, 0).cross(normal).normalize();
    const yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();

    const rotationMatrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, normal);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(
      rotationMatrix,
    );

    const project = (v3) => {
      const local = new THREE.Vector3().subVectors(v3, refTri.a);
      return new THREE.Vector2(local.dot(xAxis), local.dot(yAxis));
    };

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    const projectedTriangles = triangles.map((tri) => {
      const a2 = project(tri.a),
        b2 = project(tri.b),
        c2 = project(tri.c);
      minX = Math.min(minX, a2.x, b2.x, c2.x);
      maxX = Math.max(maxX, a2.x, b2.x, c2.x);
      minY = Math.min(minY, a2.y, b2.y, c2.y);
      maxY = Math.max(maxY, a2.y, b2.y, c2.y);
      return [a2, b2, c2];
    });

    const step = this.minBlockSize;
    const cols = Math.ceil((maxX - minX) / step);
    const rows = Math.ceil((maxY - minY) / step);

    const grid = new Array(cols * rows).fill(false);

    for (let r = 0; r < rows; r++) {
      for (let cL = 0; cL < cols; cL++) {
        const x = minX + cL * step + step / 2;
        const y = minY + r * step + step / 2;
        this._tempVec2.set(x, y);

        for (const [v1, v2, v3] of projectedTriangles) {
          if (this.isPointInTriangle2D(this._tempVec2, v1, v2, v3)) {
            grid[r * cols + cL] = true;
            break;
          }
        }
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let cL = 0; cL < cols; cL++) {
        if (grid[r * cols + cL]) {
          let w = 1;
          while (cL + w < cols && grid[r * cols + (cL + w)]) w++;

          let h = 1;
          let canExpandHeight = true;
          while (r + h < rows && canExpandHeight) {
            for (let i = 0; i < w; i++) {
              if (!grid[(r + h) * cols + (cL + i)]) {
                canExpandHeight = false;
                break;
              }
            }
            if (canExpandHeight) h++;
          }

          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) grid[(r + y) * cols + (cL + x)] = false;
          }

          const centerX = minX + cL * step + (w * step) / 2;
          const centerY = minY + r * step + (h * step) / 2;

          const position3D = refTri.a
            .clone()
            .addScaledVector(xAxis, centerX)
            .addScaledVector(yAxis, centerY);

          const hash = `${Math.round(position3D.x * 1000)}_${Math.round(position3D.y * 1000)}_${Math.round(position3D.z * 1000)}`;

          if (!cuboids.has(hash)) {
            cuboids.set(hash, {
              position: position3D,
              rotation: quaternion.clone(),
              size: new THREE.Vector3(w * step, h * step, this.thickness),
            });
          }
        }
      }
    }
  }

  isPointInTriangle2D(pt, v1, v2, v3) {
    const sign = (p1, p2, p3) =>
      (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
    const d1 = sign(pt, v1, v2),
      d2 = sign(pt, v2, v3),
      d3 = sign(pt, v3, v1);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  }
}
