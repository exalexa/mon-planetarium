// Échantillonneur de relief : rayon de la surface la plus haute dans une direction donnée
import * as THREE from 'three';

const NLON = 128, NLAT = 64;
export class Sampler {
  constructor(obj, center, filter) {
    obj.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
    const m = new THREE.Matrix4();
    const v = new THREE.Vector3();
    const list = [];
    obj.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || !filter(o)) return;
      m.multiplyMatrices(inv, o.matrixWorld);
      const pos = o.geometry.attributes.position, idx = o.geometry.index;
      const n = idx ? idx.count : pos.count;
      for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m).sub(center);
        list.push(v.x, v.y, v.z);
      }
    });
    this.center = center.clone();
    this.tri = new Float32Array(list);
    this.count = this.tri.length / 9;
    this.cells = Array.from({ length: NLON * NLAT }, () => []);
    const T = this.tri, d = new THREE.Vector3();
    for (let t = 0; t < this.count; t++) {
      let la0 = 9, la1 = -9, lo = [];
      for (let j = 0; j < 3; j++) {
        d.set(T[t * 9 + j * 3], T[t * 9 + j * 3 + 1], T[t * 9 + j * 3 + 2]);
        const L = d.length(); if (L < 1e-9) continue;
        const lat = Math.asin(THREE.MathUtils.clamp(d.y / L, -1, 1));
        la0 = Math.min(la0, lat); la1 = Math.max(la1, lat);
        lo.push(Math.atan2(d.z, d.x));
      }
      if (!lo.length) continue;
      let lo0 = Math.min(...lo), lo1 = Math.max(...lo);
      const wrap = lo1 - lo0 > Math.PI;
      const i0 = Math.max(0, Math.floor(((la0 + Math.PI / 2) / Math.PI) * NLAT) - 1);
      const i1 = Math.min(NLAT - 1, Math.floor(((la1 + Math.PI / 2) / Math.PI) * NLAT) + 1);
      const polar = la1 > 1.35 || la0 < -1.35;
      const addLon = (a0, a1, row) => {
        const j0 = Math.floor(((a0 + Math.PI) / (2 * Math.PI)) * NLON) - 1, j1 = Math.floor(((a1 + Math.PI) / (2 * Math.PI)) * NLON) + 1;
        for (let j = j0; j <= j1; j++) this.cells[row * NLON + ((j % NLON) + NLON) % NLON].push(t);
      };
      for (let i = i0; i <= i1; i++) {
        if (polar) { for (let j = 0; j < NLON; j++) this.cells[i * NLON + j].push(t); continue; }
        if (wrap) {
          const pos = lo.filter((a) => a > 0), neg = lo.filter((a) => a <= 0);
          addLon(Math.min(...pos), Math.PI, i); addLon(-Math.PI, Math.max(...neg), i);
        } else addLon(lo0, lo1, i);
      }
    }
    this.cells = this.cells.map((c) => (c.length ? Int32Array.from(new Set(c)) : null));
  }
  // Rayon (distance au centre) de la surface la plus haute dans la direction dir (unitaire), et sa normale
  query(dir, out = {}) {
    const lat = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)), lon = Math.atan2(dir.z, dir.x);
    const i = Math.min(NLAT - 1, Math.max(0, Math.floor(((lat + Math.PI / 2) / Math.PI) * NLAT)));
    const j = Math.min(NLON - 1, Math.max(0, Math.floor(((lon + Math.PI) / (2 * Math.PI)) * NLON)));
    const cell = this.cells[i * NLON + j];
    out.r = -1;
    if (!cell) return out;
    const T = this.tri, dx = dir.x, dy = dir.y, dz = dir.z;
    for (let q = 0; q < cell.length; q++) {
      const o = cell[q] * 9;
      const ax = T[o], ay = T[o + 1], az = T[o + 2];
      const e1x = T[o + 3] - ax, e1y = T[o + 4] - ay, e1z = T[o + 5] - az;
      const e2x = T[o + 6] - ax, e2y = T[o + 7] - ay, e2z = T[o + 8] - az;
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-12) continue;
      const id = 1 / det;
      const tx = -ax, ty = -ay, tz = -az;
      const u = (tx * px + ty * py + tz * pz) * id;
      if (u < -1e-6 || u > 1 + 1e-6) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
      const vv = (dx * qx + dy * qy + dz * qz) * id;
      if (vv < -1e-6 || u + vv > 1 + 1e-6) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * id;
      if (t > out.r) {
        out.r = t;
        let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
        const L = Math.hypot(nx, ny, nz) || 1;
        const s = (nx * dx + ny * dy + nz * dz) < 0 ? -1 / L : 1 / L;
        out.nx = nx * s; out.ny = ny * s; out.nz = nz * s;
      }
    }
    return out;
  }
}
