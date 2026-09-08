// Procedural surface assets: deterministic, generated locally, no CDN or image requests.
const random = (initial) => {
  let seed = initial;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
};

function texture(THREE, canvas, color = true) {
  const result = new THREE.CanvasTexture(canvas);
  if (color) result.colorSpace = THREE.SRGBColorSpace;
  result.wrapS = result.wrapT = THREE.RepeatWrapping;
  result.anisotropy = 4;
  return result;
}

export function createOutdoorEnvironment(THREE, renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#648daa');
  gradient.addColorStop(0.4, '#c1d5df');
  gradient.addColorStop(0.5, '#eee7d8');
  gradient.addColorStop(0.54, '#777a72');
  gradient.addColorStop(1, '#454c4b');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 512, 256);
  const glow = ctx.createRadialGradient(105, 79, 0, 105, 79, 46);
  glow.addColorStop(0, '#fff7df');
  glow.addColorStop(0.13, 'rgba(255,245,213,.9)');
  glow.addColorStop(1, 'rgba(255,245,213,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 512, 256);
  const input = texture(THREE, canvas);
  input.mapping = THREE.EquirectangularReflectionMapping;
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromEquirectangular(input);
  input.dispose(); generator.dispose();
  return target;
}

function grain(THREE, base, variation, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(128, 128);
  const rnd = random(seed);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const n = (rnd() - 0.5) * variation;
    pixels.data[i] = base[0] + n;
    pixels.data[i + 1] = base[1] + n;
    pixels.data[i + 2] = base[2] + n;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  return texture(THREE, canvas);
}

export function createHeroMaterials(THREE) {
  const concrete = grain(THREE, [165, 164, 154], 20, 47);
  const asphalt = grain(THREE, [67, 72, 75], 30, 29);
  const steel = grain(THREE, [230, 228, 223], 13, 83);
  // Periodic waves make a seamless tangent-space normal texture.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(256, 256);
  const wave = (x, y) => Math.sin(x * 7 + y * 3) * 0.32
    + Math.sin(x * 13 - y * 9) * 0.18 + Math.sin(x * 29 + y * 17) * 0.08;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = x / 256 * Math.PI * 2, v = y / 256 * Math.PI * 2;
    const dx = (wave(u + 0.012, v) - wave(u - 0.012, v)) * 1.8;
    const dy = (wave(u, v + 0.012) - wave(u, v - 0.012)) * 1.8;
    const n = new THREE.Vector3(-dx, -dy, 1).normalize();
    const i = (y * 256 + x) * 4;
    pixels.data[i] = (n.x * 0.5 + 0.5) * 255;
    pixels.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
    pixels.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const waterNormals = texture(THREE, canvas, false);
  waterNormals.repeat.set(28, 12);
  const painted = (color) => new THREE.MeshStandardMaterial({
    color, map: steel, roughness: 0.48, metalness: 0.28,
    bumpMap: steel, bumpScale: 0.012, envMapIntensity: 0.6,
  });
  return {
    ground: new THREE.MeshStandardMaterial({ map: concrete, color: 0x858a77, roughness: 0.98 }),
    concrete: new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.9, bumpMap: concrete, bumpScale: 0.035 }),
    road: new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.94, bumpMap: asphalt, bumpScale: 0.022 }),
    tower: painted(0xb65135),
    steel: painted(0x95412e),
    cable: new THREE.MeshStandardMaterial({ color: 0x8d8a7f, roughness: 0.42, metalness: 0.7 }),
    water: new THREE.MeshPhysicalMaterial({
      color: 0x173e50, roughness: 0.3, metalness: 0, ior: 1.333,
      normalMap: waterNormals, normalScale: new THREE.Vector2(0.28, 0.28),
      clearcoat: 0.6, clearcoatRoughness: 0.28, envMapIntensity: 0.7,
    }),
    waterNormals,
  };
}

// Assign texture scale in world units instead of stretching grain along a 320 m deck.
export function scaleBoxUV(geometry, width, height, depth, unit = 5) {
  const uv = geometry.attributes.uv;
  const scales = [[depth, height], [depth, height], [width, depth], [width, depth], [width, height], [width, height]];
  for (let face = 0; face < 6; face++) {
    for (let corner = 0; corner < 4; corner++) {
      const i = face * 4 + corner;
      uv.setXY(i, uv.getX(i) * scales[face][0] / unit, uv.getY(i) * scales[face][1] / unit);
    }
  }
  uv.needsUpdate = true;
}

export function scaleFacadeUV(geometry, width, height, depth) {
  const uv = geometry.attributes.uv;
  for (const face of [0, 1, 4, 5]) for (let corner = 0; corner < 4; corner++) {
    const i = face * 4 + corner;
    const span = face < 2 ? depth : width;
    uv.setXY(i, uv.getX(i) * span / 7.2, uv.getY(i) * height / 27);
  }
  uv.needsUpdate = true;
}

// Soft billboard clusters retain the existing cloud paths while avoiding faceted balls.
// 2026-09-06: 256x192では拡大表示で粗さが見えたため512x384に（生成は一度きりなので実行時コスト増なし）
export function createCloudPuffs(THREE) {
  const W = 512, H = 384;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const rnd = random(357);
  const lobes = Array.from({ length: 18 }, (_, i) => ({
    x: (rnd() - 0.5) * 1.12,
    y: (rnd() - 0.5) * 0.35,
    z: rnd() * 0.2,
    radius: i < 5 ? 0.3 + rnd() * 0.09 : 0.12 + rnd() * 0.19,
  }));
  const pixels = ctx.createImageData(W, H);
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const x = (px / W - 0.5) * 2.1, y = (0.5 - py / H) * 1.4;
    const noise = Math.sin(x * 73 + Math.sin(y * 31)) * Math.sin(y * 67 + x * 17) * 0.004;
    let front = -10, luminance = 0, opacity = 0;
    for (const lobe of lobes) {
      const dx = x - lobe.x, dy = y - lobe.y;
      const radius = lobe.radius + noise;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance >= radius) continue;
      // 2026-09-06: 輪郭ランプを0.025→0.05に拡幅（至近距離での硬いフチを緩和）
      opacity = Math.max(opacity, Math.min(1, (radius - distance) / 0.05));
      const depth = Math.sqrt(radius * radius - distance * distance);
      if (depth + lobe.z > front) {
        front = depth + lobe.z;
        // Sunlight from upper left with a broad ambient fill and shaded underside.
        const diffuse = Math.max(0, (-dx * 0.42 + dy * 0.73 + depth * 0.53) / radius);
        luminance = 179 + diffuse * 65 + Math.max(-10, y * 21);
      }
    }
    if (!opacity) continue;
    const i = (py * W + px) * 4;
    pixels.data[i] = luminance;
    pixels.data[i + 1] = luminance + 3;
    pixels.data[i + 2] = luminance + 5;
    pixels.data[i + 3] = opacity * 242;
  }
  ctx.putImageData(pixels, 0, 0);
  // 2026-09-06: 雲くぐり等の至近距離でローブの継ぎ目・輪郭の階段が見えるため、
  // 半分に縮小→2倍に拡大（バイリニア補間）＋軽いブラーでスムージングしてからテクスチャ化する。
  // 生成は一度きりなので実行時コストは変わらない
  const half = document.createElement('canvas');
  half.width = W / 2; half.height = H / 2;
  const halfCtx = half.getContext('2d');
  halfCtx.imageSmoothingEnabled = true; halfCtx.imageSmoothingQuality = 'high';
  halfCtx.drawImage(canvas, 0, 0, W / 2, H / 2);
  const smooth = document.createElement('canvas');
  smooth.width = W * 2; smooth.height = H * 2;
  const smoothCtx = smooth.getContext('2d');
  smoothCtx.imageSmoothingEnabled = true; smoothCtx.imageSmoothingQuality = 'high';
  if ('filter' in smoothCtx) smoothCtx.filter = 'blur(2px)';
  smoothCtx.drawImage(half, 0, 0, W * 2, H * 2);
  const map = texture(THREE, smooth);
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  const material = new THREE.SpriteMaterial({ map, color: 0xffffff, transparent: true, depthWrite: false, fog: true });
  return { material, make: () => new THREE.Sprite(material) };
}

export function addBridgeDetails(THREE, world, concrete, steel, cable) {
  const dummy = new THREE.Object3D();
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), concrete, 4);
  for (let i = 0; i < 4; i++) {
    dummy.position.set(i % 2 ? 3.32 : -3.32, i < 2 ? 10.98 : 11.12, -120);
    dummy.scale.set(i < 2 ? 0.95 : 0.12, i < 2 ? 0.22 : 0.13, 320);
    dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
  }
  world.add(mesh);
  const bolts = [];
  for (const z of [-30, -150]) for (const x of [-4.2, 4.2]) {
    for (const y of [3.4, 7.5, 13.9, 18.5, 25.6, 31.8]) {
      for (const side of [-1, 1]) for (const dx of [-0.42, 0.42]) bolts.push([x + dx, y, z + side * 1.02]);
    }
  }
  const rivets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.065, 6, 4), cable, bolts.length);
  dummy.scale.set(1, 1, 0.6);
  bolts.forEach((p, i) => { dummy.position.set(...p); dummy.updateMatrix(); rivets.setMatrixAt(i, dummy.matrix); });
  world.add(rivets);
  const joints = new THREE.InstancedMesh(new THREE.BoxGeometry(7.6, 0.02, 0.075), steel, 16);
  dummy.scale.set(1, 1, 1);
  for (let i = 0; i < 16; i++) {
    dummy.position.set(0, 11.005, 26 - i * 20); dummy.updateMatrix(); joints.setMatrixAt(i, dummy.matrix);
  }
  world.add(joints);
}
