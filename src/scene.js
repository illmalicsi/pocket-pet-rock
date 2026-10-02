/**
 * scene.js - WebGL Scene Setup, Three Lights, Soft Shadow, Dust Motes, Stars,
 * Responsive Camera, Local Clipping, and Day/Night Transitions
 */
import * as THREE from 'three';

export function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

/**
 * Creates a soft circular radial gradient texture for the contact shadow
 */
function createRadialShadowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.48)');
  gradient.addColorStop(0.3, 'rgba(0, 0, 0, 0.32)');
  gradient.addColorStop(0.65, 'rgba(0, 0, 0, 0.12)');
  gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  return texture;
}

/**
 * Creates a soft circular particle texture for dust motes and stars
 */
function createDustTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.5)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = false;
  return texture;
}

export class SceneManager {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.scene = new THREE.Scene();

    // 1. WebGLRenderer with pixel ratio capped at 2 and local clipping enabled
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.localClippingEnabled = true;

    // Horizontal clipping plane at ground level (y >= 0 is visible, y < 0 is clipped)
    this.groundClippingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.0);

    // 2. Perspective Camera looking slightly down at the rock
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
    this.updateCameraPlacement();

    // 3. Three lights: Warm hemisphere, warm directional key, cool dim rim
    this.initLights();

    // 4. Soft circular shadow
    this.initShadow();

    // 5. Shared particle texture
    this.particleTexture = createDustTexture();

    // 6. Field of ~140 slowly rising dust motes
    this.initDustMotes();

    // 7. Field of ~120 stars placed behind the rock for night mode
    this.initStars();

    // 8. Day / night state
    this.isNight = false;
    this.nightProgress = 0.0;

    // Watch for system color scheme changes
    this.colorSchemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    this.colorSchemeListener = () => this.syncThemeBackground();
    if (this.colorSchemeQuery) {
      this.colorSchemeQuery.addEventListener('change', this.colorSchemeListener);
    }

    // 9. Background synchronization with CSS variables
    this.syncThemeBackground();

    // Event listeners
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
  }

  getGroundClippingPlane() {
    return this.groundClippingPlane;
  }

  setNightMode(isNight) {
    this.isNight = isNight;
  }

  toggleNightMode() {
    this.isNight = !this.isNight;
    return this.isNight;
  }

  initLights() {
    // 1. Warm hemisphere light for soft ambient color
    this.hemiLight = new THREE.HemisphereLight(0xfff5e6, 0x827a70, 0.95);
    this.hemiLight.position.set(0, 15, 0);
    this.scene.add(this.hemiLight);

    // 2. Warm directional key light
    this.keyLight = new THREE.DirectionalLight(0xffedd4, 1.85);
    this.keyLight.position.set(3.2, 5.0, 4.2);
    this.scene.add(this.keyLight);

    // 3. Cool dim rim light so silhouette stays readable
    this.rimLight = new THREE.DirectionalLight(0x9bc2e8, 0.85);
    this.rimLight.position.set(-3.6, 2.5, -3.2);
    this.scene.add(this.rimLight);
  }

  initShadow() {
    const shadowGeo = new THREE.PlaneGeometry(3.6, 3.6);
    shadowGeo.rotateX(-Math.PI / 2);

    this.shadowTexture = createRadialShadowTexture();
    this.shadowMaterial = new THREE.MeshBasicMaterial({
      map: this.shadowTexture,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });

    this.shadowMesh = new THREE.Mesh(shadowGeo, this.shadowMaterial);
    this.shadowMesh.position.set(0, 0.005, 0); // Flat on ground
    this.scene.add(this.shadowMesh);
  }

  initDustMotes() {
    this.dustCount = 140;
    this.dustGeometry = new THREE.BufferGeometry();

    const positions = new Float32Array(this.dustCount * 3);
    this.dustVelocities = new Float32Array(this.dustCount);
    this.dustPhases = new Float32Array(this.dustCount);

    for (let i = 0; i < this.dustCount; i++) {
      // Bounding box: x: [-3.5, 3.5], y: [0.05, 3.8], z: [-2.5, 2.5]
      positions[i * 3] = (Math.random() - 0.5) * 7.0;
      positions[i * 3 + 1] = Math.random() * 3.8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5.0;

      // Slow rising speed
      this.dustVelocities[i] = 0.08 + Math.random() * 0.12;
      this.dustPhases[i] = Math.random() * Math.PI * 2;
    }

    this.dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.dustMaterial = new THREE.PointsMaterial({
      size: 0.07,
      map: this.particleTexture,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.NormalBlending,
      color: 0xecdcc8
    });

    this.dustPoints = new THREE.Points(this.dustGeometry, this.dustMaterial);
    this.scene.add(this.dustPoints);
  }

  initStars() {
    // Field of ~120 stars placed behind the rock
    this.starsCount = 120;
    this.starsGeometry = new THREE.BufferGeometry();

    const positions = new Float32Array(this.starsCount * 3);
    this.starTwinklePhases = new Float32Array(this.starsCount);

    for (let i = 0; i < this.starsCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 15.0;     // Wide spread X
      positions[i * 3 + 1] = 0.8 + Math.random() * 5.2;    // Spread Y above ground
      positions[i * 3 + 2] = -3.5 - Math.random() * 4.0;   // Deep behind the rock in Z
      this.starTwinklePhases[i] = Math.random() * Math.PI * 2;
    }

    this.starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.starsMaterial = new THREE.PointsMaterial({
      size: 0.085,
      map: this.particleTexture,
      transparent: true,
      opacity: 0.0, // Hidden during daytime
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xd8e6ff
    });

    this.starsPoints = new THREE.Points(this.starsGeometry, this.starsMaterial);
    this.scene.add(this.starsPoints);
  }

  syncThemeBackground() {
    // Read the background color from CSS variable --bg-color
    const computed = getComputedStyle(document.body);
    const bgColorStr = computed.getPropertyValue('--bg-color').trim() || '#f7f4ee';

    const color = new THREE.Color(bgColorStr);
    if (!this.scene.background) {
      this.scene.background = color.clone();
    }
  }

  updateCameraPlacement() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    // Pull camera back on narrow portrait screens so the rock is never cropped
    const baseDistance = 5.2;
    const baseHeight = 1.65;

    let distFactor = 1.0;
    if (aspect < 1.0) {
      // Smoothly pull back on narrower mobile screens
      distFactor = Math.min(1.75, 0.92 / Math.max(0.48, aspect));
    }

    this.camera.position.set(0, baseHeight * distFactor, baseDistance * distFactor);
    this.camera.lookAt(0, 0.72, 0);
  }

  handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);

    this.updateCameraPlacement();
    this.syncThemeBackground();
  }

  update(dt, time, rockSquash = 0, shadowFactor = 1.0) {
    // 1. Day / Night smooth transition
    const targetProgress = this.isNight ? 1.0 : 0.0;
    // Takes about 1.5s to smoothly transition
    this.nightProgress += (targetProgress - this.nightProgress) * Math.min(1.0, dt * 2.2);

    // Color definitions for day vs night
    const isSysDark = Boolean(this.colorSchemeQuery && this.colorSchemeQuery.matches);

    // Hemisphere light blending
    const dayHemiSky = isSysDark ? new THREE.Color(0xe8ddcc) : new THREE.Color(0xfff5e6);
    const dayHemiGround = isSysDark ? new THREE.Color(0x35312a) : new THREE.Color(0x827a70);
    const nightHemiSky = new THREE.Color(0x384f78);     // Cool ambient moonlight
    const nightHemiGround = new THREE.Color(0x161e2e);  // Deep cool ground

    this.hemiLight.color.copy(dayHemiSky).lerp(nightHemiSky, this.nightProgress);
    this.hemiLight.groundColor.copy(dayHemiGround).lerp(nightHemiGround, this.nightProgress);
    this.hemiLight.intensity = THREE.MathUtils.lerp(isSysDark ? 0.75 : 0.95, 0.52, this.nightProgress);

    // Directional Key light blending (dim and shift toward cool blue)
    const dayKeyColor = new THREE.Color(0xffedd4);
    const nightKeyColor = new THREE.Color(0x608ad1); // Cool luminous moonlight blue
    this.keyLight.color.copy(dayKeyColor).lerp(nightKeyColor, this.nightProgress);
    this.keyLight.intensity = THREE.MathUtils.lerp(1.85, 1.15, this.nightProgress);

    // Rim light blending
    const dayRimColor = new THREE.Color(0x9bc2e8);
    const nightRimColor = new THREE.Color(0x90baf8);
    this.rimLight.color.copy(dayRimColor).lerp(nightRimColor, this.nightProgress);
    this.rimLight.intensity = THREE.MathUtils.lerp(0.85, 1.30, this.nightProgress);

    // Stars field fade in and subtle twinkle
    if (this.starsMaterial) {
      const twinkle = 0.75 + 0.18 * Math.sin(time * 2.4);
      this.starsMaterial.opacity = this.nightProgress * twinkle;
    }

    // Smooth background color interpolation matching CSS variable
    const computed = getComputedStyle(document.body);
    const targetBgHex = computed.getPropertyValue('--bg-color').trim() || (this.isNight ? '#111317' : '#f7f4ee');
    const targetBg = new THREE.Color(targetBgHex);
    if (this.scene.background) {
      this.scene.background.lerp(targetBg, Math.min(1.0, dt * 3.5));
      this.renderer.setClearColor(this.scene.background, 1.0);
    }

    // 2. Animate dust motes rising gently
    if (this.dustGeometry) {
      const posAttr = this.dustGeometry.attributes.position;
      const array = posAttr.array;

      for (let i = 0; i < this.dustCount; i++) {
        const idx = i * 3;
        array[idx + 1] += this.dustVelocities[i] * dt;
        array[idx] += Math.sin(time * 0.8 + this.dustPhases[i]) * 0.0012;
        array[idx + 2] += Math.cos(time * 0.7 + this.dustPhases[i]) * 0.0012;

        if (array[idx + 1] > 3.8) {
          array[idx + 1] = 0.05;
          array[idx] = (Math.random() - 0.5) * 7.0;
          array[idx + 2] = (Math.random() - 0.5) * 5.0;
        }
      }
      posAttr.needsUpdate = true;

      // Dust opacity adjusts slightly at night
      this.dustMaterial.opacity = THREE.MathUtils.lerp(0.42, 0.22, this.nightProgress);
    }

    // 3. Dynamic shadow with rock squash and hiding shrink factor
    if (this.shadowMesh) {
      const baseScale = (1.0 + rockSquash * 0.28) * shadowFactor;
      this.shadowMesh.scale.set(baseScale, 1.0, baseScale);
      this.shadowMaterial.opacity = (0.80 + rockSquash * 0.12) * shadowFactor;
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
    if (this.colorSchemeQuery && this.colorSchemeListener) {
      this.colorSchemeQuery.removeEventListener('change', this.colorSchemeListener);
    }
    this.renderer.dispose();
  }
}
