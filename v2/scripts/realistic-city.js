/**
 * A small, deterministic city built in metres, with a clear central avenue.
 * All detail is batched by material. Only glass and lamp lenses emit at night.
 * The caller owns the city's world position and the existing flight camera.
 */
export function buildRealisticCity(THREE, city, mobile = false) {
  let seed = 230907;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const choose = values => values[Math.floor(random() * values.length)];
  const baseY = 2.58;
  const box = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, mobile ? 6 : 10);
  const matrix = new THREE.Object3D();
  const color = new THREE.Color();
  const buckets = new Map();
  const standard = options => new THREE.MeshStandardMaterial(options);
  const walls = standard({ color: 0xffffff, roughness: 0.84, metalness: 0.015 });
  const stone = standard({ color: 0xc0c2ba, roughness: 0.92 });
  const trim = standard({ color: 0xa8aca9, roughness: 0.62, metalness: 0.14 });
  const roof = standard({ color: 0x5b6466, roughness: 0.93 });
  const metal = standard({ color: 0x687273, roughness: 0.48, metalness: 0.45 });
  const glassDark = standard({ color: 0x4c6c74, roughness: 0.25, metalness: 0.34, envMapIntensity: 0.85, side: THREE.DoubleSide });
  const glassWarm = standard({ color: 0x708b8e, roughness: 0.28, metalness: 0.28,
    emissive: 0xffd39b, emissiveIntensity: 0, envMapIntensity: 0.8, side: THREE.DoubleSide });
  const glassCool = standard({ color: 0x607f88, roughness: 0.26, metalness: 0.32,
    emissive: 0xdce7ef, emissiveIntensity: 0, envMapIntensity: 0.85, side: THREE.DoubleSide });
  const lampLens = standard({ color: 0xddd5bc, roughness: 0.4,
    emissive: 0xffd6a0, emissiveIntensity: 0 });
  const foliage = standard({ color: 0xffffff, roughness: 1 });
  const bark = standard({ color: 0x655c4f, roughness: 1 });
  const paint = standard({ color: 0xffffff, roughness: 0.35, metalness: 0.16 });
  const rubber = standard({ color: 0x25292a, roughness: 0.95 });
  const marking = standard({ color: 0xc9c7b7, roughness: 0.96 });

  function add(name, material, x, y, z, w, h, d, tint, rotation = 0, geometry = box) {
    if (!buckets.has(name)) buckets.set(name, { material, geometry, entries: [] });
    buckets.get(name).entries.push({ x, y, z, w, h, d, tint, rotation });
  }

  // Subtle grain prevents the road from reading as a glossy model-making sheet.
  const asphaltCanvas = document.createElement('canvas');
  asphaltCanvas.width = asphaltCanvas.height = 128;
  const asphaltContext = asphaltCanvas.getContext('2d');
  const asphaltPixels = asphaltContext.createImageData(128, 128);
  for (let p = 0; p < asphaltPixels.data.length; p += 4) {
    const noise = Math.round(80 + random() * 13);
    asphaltPixels.data[p] = noise;
    asphaltPixels.data[p + 1] = noise + 3;
    asphaltPixels.data[p + 2] = noise + 4;
    asphaltPixels.data[p + 3] = 255;
  }
  asphaltContext.putImageData(asphaltPixels, 0, 0);
  const asphaltTexture = new THREE.CanvasTexture(asphaltCanvas);
  asphaltTexture.colorSpace = THREE.SRGBColorSpace;
  asphaltTexture.wrapS = asphaltTexture.wrapT = THREE.RepeatWrapping;
  asphaltTexture.repeat.set(18, 15);
  const asphalt = standard({ map: asphaltTexture, roughness: 0.97 });
  add('foundation', standard({ color: 0x858e86, roughness: 1 }), 0, 1.2, 0, 210, 2.4, 166);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(210, 166), asphalt);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 2.408;
  road.receiveShadow = true;
  city.add(road);

  // These bounds leave six-metre cross streets, and a 28-metre clear avenue.
  const columns = [[14, 35.5], [42.5, 66.5], [73.5, 103]];
  const blocksZ = [[-80, -65], [-59, -33], [-27, -1], [5, 31], [37, 63], [69, 80]];
  for (const sign of [-1, 1]) {
    for (const [left, right] of columns) {
      for (const [near, far] of blocksZ) {
        const x = sign * (left + right) / 2;
        const z = (near + far) / 2;
        add('sidewalks', stone, x, 2.49, z, right - left, 0.16, far - near);
        add('curbs', trim, x, 2.53, near, right - left, 0.13, 0.12);
        add('curbs', trim, x, 2.53, far, right - left, 0.13, 0.12);
        add('curbs', trim, sign * left, 2.53, z, 0.12, 0.13, far - near);
        add('curbs', trim, sign * right, 2.53, z, 0.12, 0.13, far - near);
      }
    }
    // Wide pavements alongside the boulevard; nothing obstructs its flight path.
    for (const [near, far] of blocksZ) {
      add('sidewalks', stone, sign * 11, 2.49, (near + far) / 2, 6, 0.16, far - near);
      add('curbs', trim, sign * 8, 2.53, (near + far) / 2, 0.12, 0.13, far - near);
    }
  }

  const crossStreets = [-62, -30, 2, 34, 66];
  const atIntersection = z => crossStreets.some(cross => Math.abs(cross - z) < 5);
  for (let z = -78; z < 80; z += 5.6) {
    if (atIntersection(z)) continue;
    add('road-markings', marking, 0, 2.422, z, 0.11, 0.015, 2.3);
    for (const x of [-39, 39, -70, 70]) {
      add('road-markings', marking, x, 2.422, z, 0.09, 0.015, 1.9);
    }
  }
  for (const cross of crossStreets) {
    for (const side of [-1, 1]) {
      for (let x = -6.3; x < 7; x += 1.25) {
        add('road-markings', marking, x, 2.425, cross + side * 4.25, 0.65, 0.015, 1.8);
      }
    }
  }

  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext('2d');
  const gradient = shadowContext.createRadialGradient(32, 32, 7, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(12,22,23,0.48)');
  gradient.addColorStop(0.55, 'rgba(12,22,23,0.26)');
  gradient.addColorStop(1, 'rgba(12,22,23,0)');
  shadowContext.fillStyle = gradient;
  shadowContext.fillRect(0, 0, 64, 64);
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas),
    transparent: true, depthWrite: false, toneMapped: false, opacity: 0.55 });
  function contactShadow(x, z, w, d) {
    add('contact-shadows', shadowMaterial, x, 2.575, z, w, d, 1, undefined, -Math.PI / 2, plane);
  }

  const facadeColors = [0xb7b9b3, 0xc4beb1, 0xaeb7b6, 0xd0ccc1, 0x9ca9a8, 0xb7b2a7];
  let buildingCount = 0;
  let windowCount = 0;
  function building(x, z, width, depth, floors, curtain = false, landmark = false) {
    const lobbyHeight = landmark ? 2.8 : 2.6;
    const floorHeight = 2.2;
    const height = lobbyHeight + (floors - 1) * floorHeight;
    const top = baseY + height;
    const wallColor = landmark ? 0xb9c1be : choose(facadeColors);
    buildingCount++;
    contactShadow(x, z, width * 1.65, depth * 1.65);
    add('building-masses', walls, x, baseY + height / 2, z, width, height, depth, wallColor);
    add('roofs', roof, x, top + 0.025, z, width - 0.16, 0.06, depth - 0.16);

    // Genuine floor spacing, consistent on the four façades, including the lobby.
    const facades = [
      { span: width, x, z: z + depth / 2 + 0.025, angle: 0 },
      { span: width, x, z: z - depth / 2 - 0.025, angle: 0 },
      { span: depth, x: x + width / 2 + 0.025, z, angle: Math.PI / 2 },
      { span: depth, x: x - width / 2 - 0.025, z, angle: Math.PI / 2 },
    ];
    for (const facade of facades) {
      const columns = Math.max(3, Math.floor(facade.span / (curtain ? 1.25 : 1.65)));
      const cell = (facade.span - 0.45) / columns;
      for (let floor = 0; floor < floors; floor++) {
        const y = baseY + (floor === 0 ? lobbyHeight * 0.52 : lobbyHeight + (floor - 0.5) * floorHeight);
        const paneHeight = floor === 0 ? 1.9 : curtain ? 1.99 : 1.25;
        for (let column = 0; column < columns; column++) {
          const offset = (column + 0.5 - columns / 2) * cell;
          const paneWidth = cell * (curtain ? 0.9 : 0.68);
          const occupied = random();
          const bucket = occupied < 0.25 ? 'warm-facade-panes' : occupied < 0.37 ? 'cool-facade-panes' : 'dark-facade-panes';
          const material = occupied < 0.25 ? glassWarm : occupied < 0.37 ? glassCool : glassDark;
          add(bucket, material, facade.x + (facade.angle ? 0 : offset), y,
            facade.z + (facade.angle ? offset : 0), paneWidth, paneHeight, 1, undefined, facade.angle, plane);
          windowCount++;
        }
      }
    }

    // Parapets conceal the roof edge instead of leaving a simple extruded box.
    const parapet = landmark ? 0.48 : 0.27;
    for (const side of [-1, 1]) {
      add('facade-trim', trim, x, top + parapet / 2, z + side * (depth / 2 - 0.09), width, parapet, 0.18);
      add('facade-trim', trim, x + side * (width / 2 - 0.09), top + parapet / 2, z, 0.18, parapet, depth);
    }
    // A restrained ground-floor cornice and a recessed dark entrance add scale.
    add('facade-trim', trim, x, baseY + lobbyHeight, z, width + 0.12, 0.13, depth + 0.12);
    add('dark-windows', glassDark, x, baseY + 1, z + depth / 2 + 0.055, 1.25, 1.95, 0.06);

    if (!mobile || floors > 7) {
      const plantWidth = Math.min(width * 0.27, 2.4);
      add('roof-equipment', metal, x + width * 0.19, top + 0.42, z - depth * 0.15, plantWidth, 0.72, 1.5);
      add('roofs', roof, x + width * 0.19, top + 0.79, z - depth * 0.15, plantWidth - 0.15, 0.055, 1.3);
      if (floors > 9) {
        add('building-masses', walls, x - width * 0.18, top + 0.9, z + depth * 0.15,
          width * 0.32, 1.8, depth * 0.32, wallColor);
      }
    }
    if (landmark) {
      // Paired stone piers and fine floor bands give the landmark a built façade.
      for (const side of [-1, 1]) {
        add('facade-trim', trim, x + side * (width / 2 - 0.2), baseY + height / 2,
          z + depth / 2 + 0.09, 0.19, height, 0.18);
      }
      for (let floor = 2; floor < floors; floor += 3) {
        add('facade-trim', trim, x, baseY + lobbyHeight + floor * floorHeight,
          z, width + 0.1, 0.12, depth + 0.1);
      }
      add('building-masses', walls, x, baseY + 1.15, z, width + 1.9, 2.3, depth + 1.6, 0xbebbae);
      add('dark-windows', glassDark, x, baseY + 1.02, z + depth / 2 + 0.83, width - 0.8, 1.7, 0.06);
    }
  }

  for (const side of [-1, 1]) {
    for (let column = 0; column < columns.length; column++) {
      const [left, right] = columns[column];
      const centerX = side * (left + right) / 2;
      for (const centerZ of [-46, -14, 18, 50]) {
        if (side === 1 && column === 0 && centerZ === -14) {
          building(20, -10, 9.8, 10.4, 26, true, true);
          building(29, -22.5, 8, 6, 6, false);
          continue;
        }
        const count = mobile && column === 2 ? 1 : 2;
        for (let b = 0; b < count; b++) {
          const x = centerX + (random() - 0.5) * 1.7;
          const z = centerZ + (count === 1 ? 0 : (b ? 7.1 : -7.1));
          const width = column === 0 ? 10 + random() * 4 : 11 + random() * 7;
          const depth = 7.5 + random() * 2.2;
          const highRise = random() < 0.2 && centerZ < 30;
          const floors = highRise ? 12 + Math.floor(random() * 7) : 3 + Math.floor(random() * 7);
          building(x, z, width, depth, floors, highRise || random() < 0.28);
        }
      }
      // A quieter perimeter prevents the city ending with a row of identical towers.
      if (!mobile || column < 2) {
        for (const z of [-72.5, 74.5]) building(centerX, z, 10 + random() * 5, 7, 3 + Math.floor(random() * 4), false);
      }
    }
  }

  const treeGeometry = new THREE.IcosahedronGeometry(1, mobile ? 1 : 2);
  const leafColors = [0x5c7957, 0x68805a, 0x4f7255, 0x718761];
  function tree(x, z, scale = 1) {
    const height = (2.8 + random() * 0.5) * scale;
    contactShadow(x, z, 4 * scale, 4 * scale);
    add('tree-trunks', bark, x, baseY + height * 0.4, z, 0.13 * scale, height * 0.8, 0.13 * scale,
      undefined, 0, cylinder);
    add('tree-crowns', foliage, x, baseY + height, z, 1.15 * scale, 1.35 * scale, 1.12 * scale,
      choose(leafColors), random() * Math.PI, treeGeometry);
    if (!mobile) {
      add('tree-crowns', foliage, x + 0.62 * scale, baseY + height - 0.25, z + 0.3 * scale,
        0.77 * scale, 0.95 * scale, 0.8 * scale, choose(leafColors), random() * Math.PI, treeGeometry);
    }
  }
  for (const side of [-1, 1]) {
    for (const z of [-53, -39, -21, -7, 11, 25, 43, 57]) {
      tree(side * 15.7, z, 0.9);
      if (!mobile) tree(side * 64.7, z, 0.9 + random() * 0.15);
    }
    for (const z of [-53, -21, 11, 43, 75]) {
      const x = side * 16;
      add('street-light-poles', metal, x, baseY + 2.2, z, 0.095, 4.4, 0.095, undefined, 0, cylinder);
      add('roof-equipment', metal, x - side * 0.45, baseY + 4.4, z, 1, 0.08, 0.12);
      add('lamp-lenses', lampLens, x - side * 0.82, baseY + 4.34, z, 0.43, 0.055, 0.22);
    }
  }

  // A handful of parked/moving-looking cars establishes a familiar human scale.
  for (let i = 0; i < (mobile ? 4 : 8); i++) {
    const x = i % 2 ? -3.6 : 3.6;
    const z = [-50, -16, 18, 48, -72, 8, 39, 75][i];
    const tint = choose([0xd0d1ca, 0x777e82, 0x394c58, 0xa1a7a0]);
    add('car-bodies', paint, x, 2.91, z, 1.55, 0.65, 3.5, tint);
    add('dark-windows', glassDark, x, 3.42, z - 0.05, 1.35, 0.53, 1.8);
    add('car-bodies', paint, x, 3.71, z - 0.05, 1.38, 0.09, 1.5, tint);
    for (const side of [-1, 1]) for (const axle of [-1, 1]) {
      add('car-wheels', rubber, x + side * 0.78, 2.71, z + axle * 1.08,
        0.3, 0.16, 0.3, undefined, Math.PI / 2, cylinder);
    }
  }

  for (const [name, batch] of buckets) {
    const instanced = new THREE.InstancedMesh(batch.geometry, batch.material, batch.entries.length);
    instanced.name = `city-${name}`;
    batch.entries.forEach((item, index) => {
      matrix.position.set(item.x, item.y, item.z);
      matrix.rotation.set(0, 0, 0);
      if (name === 'contact-shadows') matrix.rotation.x = item.rotation;
      else if (name === 'car-wheels') matrix.rotation.z = item.rotation;
      else matrix.rotation.y = item.rotation;
      matrix.scale.set(item.w, item.h, item.d);
      matrix.updateMatrix();
      instanced.setMatrixAt(index, matrix.matrix);
      if (item.tint !== undefined) instanced.setColorAt(index, color.setHex(item.tint));
    });
    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
    instanced.castShadow = ['building-masses', 'tree-crowns', 'car-bodies'].includes(name);
    instanced.receiveShadow = name !== 'contact-shadows';
    instanced.computeBoundingSphere();
    city.add(instanced);
  }
  city.userData.realisticCity = { buildings: buildingCount, windows: windowCount, batches: buckets.size + 1 };

  return {
    windowMaterials: [glassWarm, glassCool],
    updateLighting(dusk, night) {
      const evening = Math.max(0, Math.min(1, dusk));
      const darkness = Math.max(0, Math.min(1, night));
      glassWarm.emissiveIntensity = evening * 0.16 + darkness * 0.78;
      glassCool.emissiveIntensity = evening * 0.05 + darkness * 0.36;
      lampLens.emissiveIntensity = evening * 0.25 + darkness * 1.3;
      shadowMaterial.opacity = 0.55 - darkness * 0.27;
    },
  };
}
