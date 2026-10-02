/**
 * rock.js - Procedural 3D Pet Rock, Googly Eyes, Squish Physics,
 * Local Clipping, Hiding Underground, Sleeping/Night Eyes, and Hats/Accessories
 */
import * as THREE from 'three';

export const ROCK_BASE_RADIUS = 1.15;
export const ROCK_BOTTOM_Y = -0.72; // Local Y coordinate of flattened bottom

/**
 * Reusable procedural displacement function.
 * Given a normalized direction vector, returns the exact displaced surface point on the rock.
 * Deterministic layered sine waves produce natural stone lumpiness.
 */
export function getRockSurfacePoint(dir) {
  const v = dir.clone().normalize();
  const x = v.x;
  const y = v.y;
  const z = v.z;

  // Layered deterministic harmonic sine waves
  let displacement = 1.0;
  // Low frequency stone bulk
  displacement += 0.16 * Math.sin(x * 2.1 + 0.8) * Math.cos(y * 2.5);
  displacement += 0.13 * Math.cos(z * 2.3 + x * 1.5);
  // Medium frequency bumps
  displacement += 0.08 * Math.sin(x * 4.4 + y * 3.1) * Math.sin(z * 3.9);
  displacement += 0.05 * Math.cos(y * 5.6 - z * 3.5);
  // Fine stone faceting
  displacement += 0.03 * Math.sin(x * 8.1 + z * 7.4);

  let r = ROCK_BASE_RADIUS * displacement;

  let px = x * r;
  let py = y * r;
  let pz = z * r;

  // Widen horizontally slightly for friendly potato-rock proportions
  px *= 1.24;
  pz *= 1.08;

  // Flatten the bottom so it sits stably on the ground
  const flattenThreshold = -0.35;
  if (py < flattenThreshold) {
    const diff = py - flattenThreshold;
    py = flattenThreshold + diff * 0.25;
    if (py < ROCK_BOTTOM_Y) {
      py = ROCK_BOTTOM_Y;
    }
  }

  return new THREE.Vector3(px, py, pz);
}

export class PetRock {
  constructor() {
    this.group = new THREE.Group();

    // Damped spring squish state
    this.squash = 0;
    this.squashVelocity = 0;
    this.stiffness = 150;
    this.damping = 13;

    // Rotation & inertia
    this.angularVelocity = 0;
    this.idleTimer = 0;
    this.lastBackJokeTime = -999;

    // Stare contest state
    this.isStaring = false;
    this.stareTimer = 0;
    this.stareDuration = 4.0;
    this.onStareEnd = null;

    // Pebble feeding state
    this.activePebble = null;
    this.onFeedComplete = null;

    // Clipping plane & hiding state
    this.activeClippingPlane = null;
    this.hideState = 'idle'; // 'idle' | 'sinking' | 'hidden' | 'surfacing'
    this.hideTimer = 0;
    this.hideDuration = 3.0;
    this.hideYOffset = 0.0;
    this.hideTargetDepth = -1.72;
    this.hideTilt = 0.0;
    this.hideTargetTilt = -1.05;
    this.onHideEnd = null;

    // Day/Night sleeping state
    this.sleepProgress = 0.0;

    // Accessories / Hats (0: none, 1: crown, 2: top hat, 3: leaf)
    this.currentHatIndex = 0;
    this.currentHatGroup = null;

    // Create rock mesh and eyes
    this.initRockMesh();
    this.initEyes();

    // Set initial position
    this.updatePlantedPosition();
  }

  initRockMesh() {
    // icosahedron at detail level 3
    const baseGeo = new THREE.IcosahedronGeometry(1.0, 3);
    const posAttr = baseGeo.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < posAttr.count; i++) {
      vertex.fromBufferAttribute(posAttr, i);
      const displaced = getRockSurfacePoint(vertex);
      posAttr.setXYZ(i, displaced.x, displaced.y, displaced.z);
    }

    baseGeo.computeVertexNormals();

    this.rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b857d,
      roughness: 0.94,
      metalness: 0.04,
      flatShading: true
    });

    this.rockMesh = new THREE.Mesh(baseGeo, this.rockMaterial);
    this.rockMesh.castShadow = true;
    this.rockMesh.receiveShadow = true;
    this.group.add(this.rockMesh);
  }

  initEyes() {
    this.eyeRadius = 0.22;
    this.pupilRadius = 0.088;

    const dirLeft = new THREE.Vector3(-0.30, 0.24, 0.92).normalize();
    const dirRight = new THREE.Vector3(0.30, 0.24, 0.92).normalize();

    const posLeft = getRockSurfacePoint(dirLeft);
    const posRight = getRockSurfacePoint(dirRight);

    this.eyeWhiteMaterial = new THREE.MeshStandardMaterial({
      color: 0xfafafa,
      roughness: 0.12,
      metalness: 0.08,
      flatShading: false
    });

    this.pupilMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.25,
      metalness: 0.05
    });

    this.leftEye = this.createSingleEye(posLeft, dirLeft, -1);
    this.rightEye = this.createSingleEye(posRight, dirRight, 1);

    this.rockMesh.add(this.leftEye.group);
    this.rockMesh.add(this.rightEye.group);
  }

  createSingleEye(surfacePos, direction, sideMultiplier) {
    const eyeGroup = new THREE.Group();

    const eyeWhiteGeo = new THREE.SphereGeometry(this.eyeRadius, 32, 24);
    const eyeWhiteMesh = new THREE.Mesh(eyeWhiteGeo, this.eyeWhiteMaterial);
    eyeWhiteMesh.castShadow = true;
    eyeGroup.add(eyeWhiteMesh);

    const pupilGeo = new THREE.SphereGeometry(this.pupilRadius, 20, 16);
    pupilGeo.scale(1.0, 1.0, 0.35);
    const pupilMesh = new THREE.Mesh(pupilGeo, this.pupilMaterial);
    pupilMesh.position.set(0, 0, this.eyeRadius * 0.94);
    eyeGroup.add(pupilMesh);

    const embeddedPos = surfacePos.clone().addScaledVector(direction, -this.eyeRadius * 0.18);
    eyeGroup.position.copy(embeddedPos);

    const outwardNormal = direction.clone().normalize();
    eyeGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), outwardNormal);

    return {
      group: eyeGroup,
      whiteMesh: eyeWhiteMesh,
      pupilMesh: pupilMesh,
      side: sideMultiplier,
      baseScale: 1.0,
      currentScale: 1.0,
      pupilBaseZ: this.eyeRadius * 0.94
    };
  }

  /**
   * Attach/detach ground clipping plane to every material on rock, eyes, and accessories
   */
  setClippingPlane(planeOrNull) {
    this.activeClippingPlane = planeOrNull;
    const planes = planeOrNull ? [planeOrNull] : [];

    this.rockMaterial.clippingPlanes = planes;
    this.rockMaterial.clipShadows = true;
    this.rockMaterial.needsUpdate = true;

    this.eyeWhiteMaterial.clippingPlanes = planes;
    this.eyeWhiteMaterial.clipShadows = true;
    this.eyeWhiteMaterial.needsUpdate = true;

    this.pupilMaterial.clippingPlanes = planes;
    this.pupilMaterial.clipShadows = true;
    this.pupilMaterial.needsUpdate = true;

    if (this.currentHatGroup) {
      this.currentHatGroup.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          obj.material.clippingPlanes = planes;
          obj.material.clipShadows = true;
          obj.material.needsUpdate = true;
        }
      });
    }
  }

  /**
   * Start hiding underground
   */
  startHide(groundPlane, onSurfacedCallback) {
    if (this.hideState !== 'idle' || this.isStaring || this.activePebble) return false;

    this.hideState = 'sinking';
    this.hideTimer = 0;
    this.onHideEnd = onSurfacedCallback;
    this.idleTimer = 0;

    // Turn on ground clipping plane for all materials
    this.setClippingPlane(groundPlane);
    return true;
  }

  /**
   * Returns current shadow shrink factor for hiding underground
   */
  getShadowFactor() {
    if (this.hideState === 'idle') return 1.0;
    if (this.hideState === 'hidden') return 0.32;
    // Sinking or surfacing: interpolate with hideYOffset
    const t = Math.min(1.0, Math.max(0.0, this.hideYOffset / this.hideTargetDepth));
    return THREE.MathUtils.lerp(1.0, 0.32, t);
  }

  /**
   * Cycle through accessories: Crown -> Top hat -> Leaf -> Bare
   */
  cycleHat() {
    this.currentHatIndex = (this.currentHatIndex + 1) % 4;

    // Remove previous hat
    if (this.currentHatGroup) {
      this.rockMesh.remove(this.currentHatGroup);
      this.currentHatGroup.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
      this.currentHatGroup = null;
    }

    let hatType = 'bare';

    if (this.currentHatIndex === 1) {
      // 1: Gold Crown
      hatType = 'crown';
      this.currentHatGroup = this.createCrown();
    } else if (this.currentHatIndex === 2) {
      // 2: Black Top Hat
      hatType = 'topHat';
      this.currentHatGroup = this.createTopHat();
    } else if (this.currentHatIndex === 3) {
      // 3: Single Flattened Green Leaf
      hatType = 'leaf';
      this.currentHatGroup = this.createLeaf();
    }

    if (this.currentHatGroup) {
      // Parent to rockMesh so it squishes and spins seamlessly
      this.rockMesh.add(this.currentHatGroup);

      // Apply clipping if rock is currently hiding
      if (this.activeClippingPlane) {
        this.currentHatGroup.traverse((obj) => {
          if (obj.isMesh && obj.material) {
            obj.material.clippingPlanes = [this.activeClippingPlane];
            obj.material.clipShadows = true;
            obj.material.needsUpdate = true;
          }
        });
      }
    }

    // Small squish upon wearing/changing accessory
    this.pet(2.2);

    return { index: this.currentHatIndex, type: hatType };
  }

  createCrown() {
    const crownGroup = new THREE.Group();

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xdeb836,
      roughness: 0.30,
      metalness: 0.82,
      flatShading: true
    });

    // Short cylinder body
    const baseCylinderGeo = new THREE.CylinderGeometry(0.35, 0.40, 0.18, 18);
    const baseMesh = new THREE.Mesh(baseCylinderGeo, goldMat);
    baseMesh.castShadow = true;
    crownGroup.add(baseMesh);

    // Six small cone spikes around the rim
    const spikeCount = 6;
    const rimRadius = 0.35;
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i * Math.PI * 2) / spikeCount;
      const spikeGeo = new THREE.ConeGeometry(0.065, 0.16, 8);
      const spikeMesh = new THREE.Mesh(spikeGeo, goldMat);
      spikeMesh.castShadow = true;
      spikeMesh.position.set(
        Math.cos(angle) * rimRadius,
        0.09 + 0.08,
        Math.sin(angle) * rimRadius
      );
      crownGroup.add(spikeMesh);
    }

    // Position securely on rock crest (crest is at y ~ 1.24)
    crownGroup.position.set(0, 1.22, 0.01);
    crownGroup.rotation.set(-0.06, 0, 0.02);
    return crownGroup;
  }

  createTopHat() {
    const hatGroup = new THREE.Group();

    const feltMat = new THREE.MeshStandardMaterial({
      color: 0x181818,
      roughness: 0.58,
      metalness: 0.08,
      flatShading: true
    });

    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xb52222,
      roughness: 0.38,
      metalness: 0.12,
      flatShading: true
    });

    // Wide brim
    const brimGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.038, 24);
    const brimMesh = new THREE.Mesh(brimGeo, feltMat);
    brimMesh.castShadow = true;
    brimMesh.position.set(0, 0, 0);
    hatGroup.add(brimMesh);

    // Tall crown cylinder
    const crownGeo = new THREE.CylinderGeometry(0.35, 0.38, 0.48, 24);
    const crownMesh = new THREE.Mesh(crownGeo, feltMat);
    crownMesh.castShadow = true;
    crownMesh.position.set(0, 0.25, 0);
    hatGroup.add(crownMesh);

    // Thin red band around the base of the crown
    const bandGeo = new THREE.CylinderGeometry(0.385, 0.385, 0.065, 24);
    const bandMesh = new THREE.Mesh(bandGeo, ribbonMat);
    bandMesh.castShadow = true;
    bandMesh.position.set(0, 0.052, 0);
    hatGroup.add(bandMesh);

    // Position tilted on top of rock head
    hatGroup.position.set(0, 1.21, 0.01);
    hatGroup.rotation.set(-0.08, 0.03, 0.05);
    return hatGroup;
  }

  createLeaf() {
    const leafGroup = new THREE.Group();

    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x489635,
      roughness: 0.65,
      metalness: 0.04,
      flatShading: true
    });

    // Single flattened leaf blade
    const leafGeo = new THREE.SphereGeometry(0.32, 14, 10);
    leafGeo.scale(1.0, 0.07, 0.52);
    const leafMesh = new THREE.Mesh(leafGeo, leafMat);
    leafMesh.castShadow = true;
    leafGroup.add(leafMesh);

    // Small stem
    const stemGeo = new THREE.CylinderGeometry(0.015, 0.022, 0.22, 8);
    const stemMesh = new THREE.Mesh(stemGeo, leafMat);
    stemMesh.position.set(-0.35, 0, 0);
    stemMesh.rotation.set(0, 0, Math.PI / 4);
    leafGroup.add(stemMesh);

    // Tilted charmingly on the rock's head
    leafGroup.position.set(0.14, 1.18, 0.16);
    leafGroup.rotation.set(-0.25, 0.45, -0.35);
    return leafGroup;
  }

  /**
   * Keep bottom planted firmly on the ground plane (y = 0),
   * accounting for squish and underground hide offset
   */
  updatePlantedPosition() {
    const sy = this.rockMesh.scale.y;
    // Sits at ground level y = 0, adjusted by hide offset when submerged
    this.rockMesh.position.y = -ROCK_BOTTOM_Y * sy + this.hideYOffset;
    this.rockMesh.rotation.x = this.hideTilt;
  }

  pet(intensity = 3.6) {
    if (this.hideState !== 'idle') return;
    this.squashVelocity += intensity;
    this.idleTimer = 0;
  }

  startStareContest(onEndCallback) {
    if (this.hideState !== 'idle') return;
    this.isStaring = true;
    this.stareTimer = 0;
    this.onStareEnd = onEndCallback;
    this.idleTimer = 0;
  }

  feedPebble(onCompleteCallback) {
    if (this.activePebble || this.hideState !== 'idle') return false;

    this.onFeedComplete = onCompleteCallback;

    const pebbleGeo = new THREE.IcosahedronGeometry(0.18, 2);
    const posAttr = pebbleGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i).normalize();
      const disp = 0.18 * (1.0 + 0.25 * Math.sin(v.x * 5) * Math.cos(v.y * 5));
      posAttr.setXYZ(i, v.x * disp, v.y * disp, v.z * disp);
    }
    pebbleGeo.computeVertexNormals();

    const pebbleMat = new THREE.MeshStandardMaterial({
      color: 0x6e6962,
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true
    });

    const mesh = new THREE.Mesh(pebbleGeo, pebbleMat);
    mesh.castShadow = true;

    mesh.position.set((Math.random() - 0.5) * 0.2, 3.4, (Math.random() - 0.5) * 0.15);
    this.group.add(mesh);

    this.activePebble = {
      mesh,
      velocityY: 0,
      gravity: -16.0,
      state: 'falling',
      absorbTimer: 0,
      absorbDuration: 0.25
    };

    return true;
  }

  applyDrag(deltaX) {
    if (this.hideState !== 'idle') return;
    const sensitivity = 0.0075;
    this.angularVelocity += deltaX * sensitivity;
    this.idleTimer = 0;
  }

  getSpeechAnchor(targetVector) {
    if (this.hideState !== 'idle') {
      // Anchored comfortably above peeking eyes
      const worldPos = new THREE.Vector3(0, 0.55, 0.25);
      this.group.localToWorld(worldPos);
      targetVector.copy(worldPos);
      return targetVector;
    }
    const crestY = this.rockMesh.position.y + 0.88 * this.rockMesh.scale.y;
    const worldPos = new THREE.Vector3(0, crestY, 0);
    this.group.localToWorld(worldPos);
    targetVector.copy(worldPos);
    return targetVector;
  }

  update(dt, time, nightProgress = 0.0) {
    this.idleTimer += dt;
    this.sleepProgress = nightProgress;

    // 1. Damped spring physics for squash
    const springForce = -this.stiffness * this.squash;
    const dampingForce = -this.damping * this.squashVelocity;
    const squashAcc = springForce + dampingForce;

    this.squashVelocity += squashAcc * dt;
    this.squash += this.squashVelocity * dt;
    this.squash = Math.max(-0.25, Math.min(0.65, this.squash));

    // 2. Hide underground state machine
    let dartPupilX = 0;
    if (this.hideState === 'sinking') {
      // Sink smoothly down into the ground and tilt back so only eyes peek above surface
      this.hideYOffset += (this.hideTargetDepth - this.hideYOffset) * Math.min(1.0, dt * 6.0);
      this.hideTilt += (this.hideTargetTilt - this.hideTilt) * Math.min(1.0, dt * 6.0);
      if (Math.abs(this.hideYOffset - this.hideTargetDepth) < 0.02) {
        this.hideYOffset = this.hideTargetDepth;
        this.hideTilt = this.hideTargetTilt;
        this.hideState = 'hidden';
        this.hideTimer = 0;
      }
    } else if (this.hideState === 'hidden') {
      this.hideTimer += dt;
      // Rapid darting pupils from side to side while peeking
      dartPupilX = Math.sin(this.hideTimer * 16.0) * 0.055;

      if (this.hideTimer >= this.hideDuration) {
        this.hideState = 'surfacing';
      }
    } else if (this.hideState === 'surfacing') {
      // Pop back up quickly and restore angle
      this.hideYOffset += (0 - this.hideYOffset) * Math.min(1.0, dt * 11.0);
      this.hideTilt += (0 - this.hideTilt) * Math.min(1.0, dt * 11.0);
      if (Math.abs(this.hideYOffset) < 0.02) {
        this.hideYOffset = 0;
        this.hideTilt = 0;
        this.rockMesh.rotation.x = 0;
        this.hideState = 'idle';
        // Remove clipping plane once fully surfaced
        this.setClippingPlane(null);
        // Strong pop-up squish
        this.squashVelocity += 4.5;

        if (this.onHideEnd) {
          this.onHideEnd();
          this.onHideEnd = null;
        }
      }
    }

    // 3. Idle breathing motion (slowed when sleeping)
    const breathRate = THREE.MathUtils.lerp(1.8, 0.8, this.sleepProgress);
    const breathAmp = THREE.MathUtils.lerp(0.012, 0.005, this.sleepProgress);
    const breath = Math.sin(time * breathRate) * breathAmp;

    // 4. Scale rock vertically down and horizontally out
    const scaleY = (1.0 - this.squash * 0.45) * (1.0 - breath);
    const scaleXZ = (1.0 + this.squash * 0.35) * (1.0 + breath);
    this.rockMesh.scale.set(scaleXZ, scaleY, scaleXZ);

    // 5. Update planted position
    this.updatePlantedPosition();

    // 6. Angular inertia & return to face camera
    if (this.hideState === 'idle') {
      this.group.rotation.y += this.angularVelocity * dt;
      this.angularVelocity *= Math.pow(0.90, dt * 60);

      if (this.idleTimer > 2.0 && Math.abs(this.angularVelocity) < 0.15) {
        const twoPi = Math.PI * 2;
        let angle = this.group.rotation.y % twoPi;
        if (angle > Math.PI) angle -= twoPi;
        if (angle < -Math.PI) angle += twoPi;
        this.group.rotation.y -= angle * (dt * 2.6);
      }
    }

    // 7. Stare contest update
    let stareEyeScale = 1.0;
    let starePupilScale = 1.0;

    if (this.isStaring) {
      this.stareTimer += dt;
      stareEyeScale = 1.35;
      starePupilScale = 1.45;

      if (this.stareTimer >= this.stareDuration) {
        this.isStaring = false;
        if (this.onStareEnd) {
          this.onStareEnd();
          this.onStareEnd = null;
        }
      }
    }

    // 8. Googly eyes animation with darting, squishing, and sleep flattening
    this.updateEye(this.leftEye, time, dt, stareEyeScale, starePupilScale, 0, dartPupilX);
    this.updateEye(this.rightEye, time, dt, stareEyeScale, starePupilScale, 1.2, dartPupilX);

    // 9. Pebble falling & absorption update
    this.updatePebble(dt);
  }

  updateEye(eye, time, dt, targetScale, targetPupilScale, phase, dartPupilX = 0) {
    eye.currentScale += (targetScale - eye.currentScale) * (dt * 10);

    // Night sleep: flatten eyes vertically (closed eyelids effect)
    const sleepFlattenY = 1.0 - this.sleepProgress * 0.78;
    eye.group.scale.set(eye.currentScale, eye.currentScale * sleepFlattenY, eye.currentScale);

    if (this.isStaring) {
      eye.pupilMesh.scale.set(targetPupilScale, targetPupilScale, 1.0);
      eye.pupilMesh.position.x += (0 - eye.pupilMesh.position.x) * (dt * 12);
      eye.pupilMesh.position.y += (0 - eye.pupilMesh.position.y) * (dt * 12);
    } else if (this.hideState === 'hidden') {
      // Rapid darting side to side while peeking above ground
      eye.pupilMesh.scale.set(1.0, 1.0, 1.0);
      eye.pupilMesh.position.x += (dartPupilX - eye.pupilMesh.position.x) * 0.6;
      eye.pupilMesh.position.y += (0.015 - eye.pupilMesh.position.y) * 0.4;
    } else {
      // Normal wandering drift (stops when sleeping)
      const driftMute = 1.0 - this.sleepProgress;
      const driftSpeed = 1.4;
      const driftRadius = 0.022 * driftMute;
      const driftX = Math.sin(time * driftSpeed + phase) * driftRadius;
      const driftY = Math.cos(time * driftSpeed * 0.85 + phase) * driftRadius - 0.015;

      const squishShiftY = -this.squash * 0.055;
      const squishShiftX = eye.side * this.squash * 0.028;

      // Night sleep: pupils sink downward and flatten
      const sleepPupilSink = -this.sleepProgress * 0.075;

      const targetPupilX = driftX + squishShiftX;
      const targetPupilY = driftY + squishShiftY + sleepPupilSink;

      eye.pupilMesh.position.x += (targetPupilX - eye.pupilMesh.position.x) * 0.35;
      eye.pupilMesh.position.y += (targetPupilY - eye.pupilMesh.position.y) * 0.35;

      const pupilScaleY = 1.0 - this.sleepProgress * 0.65;
      eye.pupilMesh.scale.set(1.0, pupilScaleY, 1.0);
    }
  }

  updatePebble(dt) {
    if (!this.activePebble) return;

    const p = this.activePebble;

    if (p.state === 'falling') {
      p.velocityY += p.gravity * dt;
      p.mesh.position.y += p.velocityY * dt;
      p.mesh.rotation.x += dt * 3;
      p.mesh.rotation.y += dt * 4;

      const rockTopY = this.rockMesh.position.y + 0.95 * this.rockMesh.scale.y;

      if (p.mesh.position.y <= rockTopY) {
        p.state = 'absorbing';
        p.absorbTimer = 0;
        this.pet(2.2);
      }
    } else if (p.state === 'absorbing') {
      p.absorbTimer += dt;
      const progress = Math.min(1.0, p.absorbTimer / p.absorbDuration);

      const scale = Math.max(0, 1.0 - progress);
      p.mesh.scale.setScalar(scale);
      p.mesh.position.y -= dt * 0.6;

      if (progress >= 1.0) {
        this.group.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.activePebble = null;

        if (this.onFeedComplete) {
          this.onFeedComplete();
          this.onFeedComplete = null;
        }
      }
    }
  }

  isFacingBack() {
    const twoPi = Math.PI * 2;
    let angle = this.group.rotation.y % twoPi;
    if (angle > Math.PI) angle -= twoPi;
    if (angle < -Math.PI) angle += twoPi;
    return Math.abs(angle) > 2.25;
  }
}
