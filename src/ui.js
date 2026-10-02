/**
 * ui.js - User Interface Management, LocalStorage Persistence, and Speech Bubble
 */

const STORAGE_KEYS = {
  NAME: 'pocket_petrock_name',
  PETS: 'pocket_petrock_pets',
  ADOPTED: 'pocket_petrock_adopted_at'
};

function safeGetStorage(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val : fallback;
  } catch (err) {
    console.warn(`[PetRock] localStorage read error for "${key}":`, err);
    return fallback;
  }
}

function safeSetStorage(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (err) {
    console.warn(`[PetRock] localStorage write error for "${key}":`, err);
  }
}

export class UIManager {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;

    // Load persisted state
    this.rockName = safeGetStorage(STORAGE_KEYS.NAME, 'Rocky');
    this.petCount = parseInt(safeGetStorage(STORAGE_KEYS.PETS, '0'), 10) || 0;

    let storedAdopted = parseInt(safeGetStorage(STORAGE_KEYS.ADOPTED, '0'), 10);
    if (!storedAdopted) {
      storedAdopted = Date.now();
      safeSetStorage(STORAGE_KEYS.ADOPTED, storedAdopted);
    }
    this.adoptedAt = storedAdopted;

    // DOM Elements
    this.nameInput = document.getElementById('rock-name');
    this.statsLine = document.getElementById('stats-line');

    this.speechBubble = document.getElementById('speech-bubble');
    this.speechSpeaker = document.getElementById('speech-speaker');
    this.speechText = document.getElementById('speech-text');

    this.petBtn = document.getElementById('pet-btn');
    this.feedBtn = document.getElementById('feed-btn');
    this.stareBtn = document.getElementById('stare-btn');
    this.hideBtn = document.getElementById('hide-btn');
    this.hatBtn = document.getElementById('hat-btn');
    this.nightBtn = document.getElementById('night-btn');

    this.speechTimer = null;

    this.initEvents();
    this.render();
    this.startTimeTracker();
  }

  initEvents() {
    // Name editing
    if (this.nameInput) {
      this.nameInput.value = this.rockName;

      this.nameInput.addEventListener('change', () => {
        this.saveName();
      });

      this.nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.nameInput.blur();
        }
      });

      this.nameInput.addEventListener('blur', () => {
        this.saveName();
      });
    }

    // Button interactions
    if (this.petBtn) {
      this.petBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.callbacks.onPet) this.callbacks.onPet();
      });
    }

    if (this.feedBtn) {
      this.feedBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.callbacks.onFeed) this.callbacks.onFeed();
      });
    }

    if (this.stareBtn) {
      this.stareBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.callbacks.onStare) this.callbacks.onStare();
      });
    }

    if (this.hideBtn) {
      this.hideBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.callbacks.onHide) this.callbacks.onHide();
      });
    }

    if (this.hatBtn) {
      this.hatBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.callbacks.onHat) this.callbacks.onHat();
      });
    }

    if (this.nightBtn) {
      this.nightBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.callbacks.onNightToggle) this.callbacks.onNightToggle();
      });
    }
  }

  saveName() {
    if (!this.nameInput) return;
    let newName = this.nameInput.value.trim();
    if (!newName) {
      newName = 'Rocky';
    }
    this.rockName = newName;
    this.nameInput.value = newName;
    safeSetStorage(STORAGE_KEYS.NAME, newName);

    if (this.speechSpeaker) {
      this.speechSpeaker.textContent = this.rockName;
    }
  }

  getRockName() {
    return this.rockName;
  }

  getPetCount() {
    return this.petCount;
  }

  incrementPetCount() {
    this.petCount += 1;
    safeSetStorage(STORAGE_KEYS.PETS, this.petCount);
    this.updateStatsDisplay();
    return this.petCount;
  }

  formatTimeTogether(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    if (totalSeconds < 10) {
      return 'just now';
    }
    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes < 60) {
      return `${minutes}m ${seconds}s`;
    }
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    if (hours < 24) {
      return `${hours}h ${remMinutes}m`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }

  updateStatsDisplay() {
    if (!this.statsLine) return;
    const elapsed = Date.now() - this.adoptedAt;
    const timeStr = this.formatTimeTogether(elapsed);
    const petLabel = this.petCount === 1 ? '1 pet' : `${this.petCount} pets`;
    this.statsLine.innerHTML = `${petLabel} <span class="stats-dot">•</span> Together for ${timeStr}`;
  }

  startTimeTracker() {
    this.updateStatsDisplay();
    setInterval(() => {
      this.updateStatsDisplay();
    }, 1000);
  }

  render() {
    if (this.nameInput) {
      this.nameInput.value = this.rockName;
    }
    if (this.speechSpeaker) {
      this.speechSpeaker.textContent = this.rockName;
    }
    this.updateStatsDisplay();
  }

  /**
   * Display a deadpan message in the speech bubble above the rock
   */
  showSpeech(text, duration = 3800) {
    if (!this.speechBubble || !this.speechText || !this.speechSpeaker) return;

    this.speechSpeaker.textContent = this.rockName;
    this.speechText.textContent = text;

    this.speechBubble.classList.add('visible');

    if (this.speechTimer) {
      clearTimeout(this.speechTimer);
    }

    if (duration > 0) {
      this.speechTimer = setTimeout(() => {
        this.hideSpeech();
      }, duration);
    }
  }

  hideSpeech() {
    if (this.speechBubble) {
      this.speechBubble.classList.remove('visible');
    }
    if (this.speechTimer) {
      clearTimeout(this.speechTimer);
      this.speechTimer = null;
    }
  }

  /**
   * Updates speech bubble 2D position based on 3D projected coordinates,
   * keeping it within screen bounds.
   */
  updateSpeechPosition(screenX, screenY) {
    if (!this.speechBubble) return;

    // Clamp horizontally to prevent overflow offscreen
    const pad = 160;
    const clampedX = Math.max(pad, Math.min(window.innerWidth - pad, screenX));
    // Keep minimum vertical distance from top bar so it never collides
    const clampedY = Math.max(110, screenY);

    this.speechBubble.style.left = `${clampedX}px`;
    this.speechBubble.style.top = `${clampedY}px`;
  }

  setNightButtonState(isNight) {
    if (this.nightBtn) {
      this.nightBtn.textContent = isNight ? 'Day' : 'Night';
    }
  }

  setControlsDisabled(disabled) {
    if (this.petBtn) this.petBtn.disabled = disabled;
    if (this.feedBtn) this.feedBtn.disabled = disabled;
    if (this.stareBtn) this.stareBtn.disabled = disabled;
    if (this.hideBtn) this.hideBtn.disabled = disabled;
    if (this.hatBtn) this.hatBtn.disabled = disabled;
    if (this.nightBtn) this.nightBtn.disabled = disabled;
  }
}
