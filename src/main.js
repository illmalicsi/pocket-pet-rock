/**
 * main.js - Application Entry Point for Pocket Pet Rock
 */
import * as THREE from 'three';
import { isWebGLAvailable, SceneManager } from './scene.js';
import { PetRock } from './rock.js';
import { UIManager } from './ui.js';
import {
  getPetResponse,
  getRandomLine,
  FEED_LINES,
  STARE_LINES,
  BACK_LINES,
  HIDE_LINES,
  NIGHT_LINES,
  DAY_LINES,
  HAT_LINES
} from './lines.js';

function init() {
  const canvas = document.getElementById('webgl-canvas');
  const fallback = document.getElementById('webgl-fallback');
  const uiRoot = document.getElementById('ui-root');

  // Verify WebGL availability
  if (!isWebGLAvailable()) {
    if (fallback) fallback.style.display = 'flex';
    if (canvas) canvas.style.display = 'none';
    if (uiRoot) uiRoot.style.display = 'none';
    return;
  }

  // 1. Initialize 3D Scene
  const sceneManager = new SceneManager(canvas);

  // 2. Initialize Procedural Pet Rock
  const petRock = new PetRock();
  sceneManager.scene.add(petRock.group);

  // 3. Raycaster for tap detection
  const raycaster = new THREE.Raycaster();
  const mouseCoords = new THREE.Vector2();

  // 4. Trigger Pet Helper
  function triggerPet() {
    if (petRock.hideState !== 'idle') return;
    petRock.pet();
    const count = ui.incrementPetCount();
    const response = getPetResponse(count);
    ui.showSpeech(response);
  }

  // 5. Initialize UI Manager with all action callbacks
  const ui = new UIManager({
    onPet: () => {
      triggerPet();
    },
    onFeed: () => {
      if (petRock.isStaring || petRock.activePebble || petRock.hideState !== 'idle') return;

      ui.setControlsDisabled(true);
      petRock.feedPebble(() => {
        ui.setControlsDisabled(false);
        const line = getRandomLine(FEED_LINES);
        ui.showSpeech(line);
      });
    },
    onStare: () => {
      if (petRock.isStaring || petRock.activePebble || petRock.hideState !== 'idle') return;

      ui.setControlsDisabled(true);
      ui.showSpeech('...', 4200);

      petRock.startStareContest(() => {
        ui.setControlsDisabled(false);
        const line = getRandomLine(STARE_LINES);
        ui.showSpeech(line, 4500);
      });
    },
    onHide: () => {
      if (petRock.isStaring || petRock.activePebble || petRock.hideState !== 'idle') return;

      // Disable other action buttons while hiding
      ui.setControlsDisabled(true);
      ui.hideSpeech();

      const groundPlane = sceneManager.getGroundClippingPlane();
      petRock.startHide(groundPlane, () => {
        // Surfaced! Re-enable controls and announce nothing happened
        ui.setControlsDisabled(false);
        const line = getRandomLine(HIDE_LINES);
        ui.showSpeech(line, 3600);
      });
    },
    onHat: () => {
      if (petRock.hideState !== 'idle') return;

      const { type } = petRock.cycleHat();
      const lines = HAT_LINES[type] || HAT_LINES.bare;
      const line = getRandomLine(lines);
      ui.showSpeech(line, 3800);
    },
    onNightToggle: () => {
      const isNight = sceneManager.toggleNightMode();
      document.body.classList.toggle('night-mode', isNight);
      ui.setNightButtonState(isNight);

      const line = isNight ? getRandomLine(NIGHT_LINES) : getRandomLine(DAY_LINES);
      ui.showSpeech(line, 4000);
    }
  });

  // 6. Pointer & Drag Interaction (Pointer Events for mouse & touch)
  let isPointerDown = false;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let lastPointerX = 0;
  let activePointerId = null;

  canvas.addEventListener('pointerdown', (e) => {
    if (petRock.hideState !== 'idle') return;

    isPointerDown = true;
    activePointerId = e.pointerId;
    pointerStartX = e.clientX;
    pointerStartY = e.clientY;
    lastPointerX = e.clientX;

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {
      // Ignore if pointer capture fails
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isPointerDown || e.pointerId !== activePointerId || petRock.hideState !== 'idle') return;

    const deltaX = e.clientX - lastPointerX;
    lastPointerX = e.clientX;

    // Spin rock horizontally with inertia
    petRock.applyDrag(deltaX);
  });

  const endPointerInteraction = (e) => {
    if (!isPointerDown || (activePointerId !== null && e.pointerId !== activePointerId)) return;

    isPointerDown = false;

    try {
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}

    activePointerId = null;

    if (petRock.hideState !== 'idle') return;

    // Movement under ~6 pixels is treated as a tap
    const moveDist = Math.hypot(e.clientX - pointerStartX, e.clientY - pointerStartY);
    if (moveDist <= 6) {
      // Raycast to confirm tap hit the rock mesh
      const rect = canvas.getBoundingClientRect();
      mouseCoords.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseCoords.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouseCoords, sceneManager.camera);
      const intersects = raycaster.intersectObject(petRock.rockMesh, true);

      if (intersects.length > 0) {
        triggerPet();
      }
    }
  };

  canvas.addEventListener('pointerup', endPointerInteraction);
  canvas.addEventListener('pointercancel', endPointerInteraction);

  // 7. Animation Loop with precise timing
  const startTime = performance.now();
  let lastTime = startTime;
  const anchorVector = new THREE.Vector3();

  // Initial adoption greeting after brief pause
  setTimeout(() => {
    if (ui.getPetCount() === 0) {
      ui.showSpeech("Adoption finalized. I am ready to sit here.");
    }
  }, 900);

  function animate(currentTime = performance.now()) {
    requestAnimationFrame(animate);

    const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;
    const time = (currentTime - startTime) / 1000;

    // Update rock physics, eyes, breathing, hiding, and sleep state
    petRock.update(dt, time, sceneManager.nightProgress);

    // Update scene (dust motes, stars, dynamic lights & shadow)
    sceneManager.update(dt, time, petRock.squash, petRock.getShadowFactor());

    // Update speech bubble screen position from 3D anchor
    petRock.getSpeechAnchor(anchorVector);
    anchorVector.project(sceneManager.camera);

    const screenX = (anchorVector.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-(anchorVector.y * 0.5) + 0.5) * window.innerHeight;
    ui.updateSpeechPosition(screenX, screenY);

    // Check for back-of-the-rock view joke (only when idle and not hiding or staring)
    if (petRock.isFacingBack() && petRock.hideState === 'idle') {
      if (time - petRock.lastBackJokeTime > 9.0 && !petRock.isStaring) {
        petRock.lastBackJokeTime = time;
        const line = getRandomLine(BACK_LINES);
        ui.showSpeech(line, 3600);
      }
    }

    // Render WebGL frame
    sceneManager.render();
  }

  animate();
}

window.addEventListener('DOMContentLoaded', init);
