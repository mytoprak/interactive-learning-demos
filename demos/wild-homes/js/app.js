(function () {
  "use strict";

  const habitats = [
    { id: "arctic", name: "Arctic", artwork: "assets/habitats/arctic.webp" },
    { id: "ocean", name: "Ocean", artwork: "assets/habitats/ocean.webp" },
    { id: "rainforest", name: "Rainforest", artwork: "assets/habitats/rainforest.webp" },
    { id: "savanna", name: "Savanna", artwork: "assets/habitats/savanna.webp" }
  ];

  const animals = [
    {
      id: "polar-bear",
      name: "Polar Bear",
      habitatId: "arctic",
      artwork: "assets/animals/polar-bear.webp",
      fact: "Polar bears have thick fur and body fat that help them survive freezing temperatures."
    },
    {
      id: "penguin",
      name: "Penguin",
      habitatId: "arctic",
      artwork: "assets/animals/penguin.webp",
      fact: "Penguins have tightly packed feathers that trap a warm layer of air close to their bodies."
    },
    {
      id: "dolphin",
      name: "Dolphin",
      habitatId: "ocean",
      artwork: "assets/animals/dolphin.webp",
      fact: "Dolphins use clicks and echoes to explore their underwater world and find food."
    },
    {
      id: "sea-turtle",
      name: "Sea Turtle",
      habitatId: "ocean",
      artwork: "assets/animals/sea-turtle.webp",
      fact: "Sea turtles breathe air and can travel thousands of miles across the ocean."
    },
    {
      id: "toucan",
      name: "Toucan",
      habitatId: "rainforest",
      artwork: "assets/animals/toucan.webp",
      fact: "A toucan's large bill helps it reach fruit growing on thin rainforest branches."
    },
    {
      id: "sloth",
      name: "Sloth",
      habitatId: "rainforest",
      artwork: "assets/animals/sloth.webp",
      fact: "Sloths spend most of their lives in trees, moving slowly to conserve energy."
    },
    {
      id: "lion",
      name: "Lion",
      habitatId: "savanna",
      artwork: "assets/animals/lion.webp",
      fact: "Lions live in family groups called prides and rest for much of the day."
    },
    {
      id: "giraffe",
      name: "Giraffe",
      habitatId: "savanna",
      artwork: "assets/animals/giraffe.webp",
      fact: "A giraffe's long neck helps it reach leaves high in savanna trees."
    }
  ];

  const selectors = {
    introScreen: document.querySelector("#introScreen"),
    gameScreen: document.querySelector("#gameScreen"),
    completeScreen: document.querySelector("#completeScreen"),
    startButton: document.querySelector("#startButton"),
    playAgainButton: document.querySelector("#playAgainButton"),
    soundToggle: document.querySelector("#soundToggle"),
    soundLabel: document.querySelector("#soundLabel"),
    instructionPanel: document.querySelector("#instructionPanel"),
    habitatList: document.querySelector("#habitatList"),
    animalList: document.querySelector("#animalList"),
    progressText: document.querySelector("#progressText"),
    progressBar: document.querySelector("#progressBar"),
    factPanel: document.querySelector("#factPanel"),
    factImage: document.querySelector("#factImage"),
    factInitials: document.querySelector("#factInitials"),
    factAnimal: document.querySelector("#factAnimal"),
    factText: document.querySelector("#factText"),
    completeWorld: document.querySelector("#completeWorld")
  };

  const storageKey = "wildHomes.soundEnabled";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    selectedAnimalId: null,
    matchedIds: new Set(),
    animalOrder: [],
    soundEnabled: readSoundPreference(),
    audioContext: null,
    factTimer: null,
    drag: null,
    suppressClickUntil: 0
  };

  function init() {
    setSoundUi();
    renderCompleteWorld();
    renderGame();
    bindImageFallbacks(document);
    wireEvents();
  }

  function wireEvents() {
    selectors.startButton.addEventListener("click", () => {
      primeAudio();
      startGame();
      playSound("select");
    });

    selectors.playAgainButton.addEventListener("click", () => {
      primeAudio();
      startGame();
      playSound("select");
    });

    selectors.soundToggle.addEventListener("click", () => {
      state.soundEnabled = !state.soundEnabled;
      saveSoundPreference();
      setSoundUi();
      primeAudio();
      playSound("select");
    });

    document.addEventListener("pointermove", onPointerMove, { passive: false });
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", cancelPointerDrag);
  }

  function startGame() {
    cleanupDrag();
    window.clearTimeout(state.factTimer);
    state.selectedAnimalId = null;
    state.matchedIds = new Set();
    state.animalOrder = shuffle(animals.map((animal) => animal.id));
    selectors.factPanel.classList.remove("is-visible");
    switchScreen(selectors.gameScreen);
    renderGame();
    setInstruction("Drag an animal to its habitat, or select an animal and then a habitat.");

    window.requestAnimationFrame(() => {
      animateEntrance();
      const firstAnimal = selectors.animalList.querySelector("button:not(:disabled)");
      if (firstAnimal) firstAnimal.focus({ preventScroll: true });
    });
  }

  function switchScreen(nextScreen) {
    [selectors.introScreen, selectors.gameScreen, selectors.completeScreen].forEach((screen) => {
      const isNext = screen === nextScreen;
      screen.hidden = !isNext;
      screen.classList.toggle("is-active", isNext);
    });
  }

  function renderGame() {
    renderHabitats();
    renderAnimals();
    updateProgress();
  }

  function renderHabitats() {
    selectors.habitatList.innerHTML = habitats.map((habitat) => {
      const placed = animals.filter((animal) => animal.habitatId === habitat.id && state.matchedIds.has(animal.id));
      return `
        <button
          class="habitat-card habitat-${habitat.id}"
          type="button"
          data-habitat-id="${habitat.id}"
          aria-label="${habitat.name} habitat. ${placed.length} of 2 animals placed."
        >
          <span class="habitat-scene" aria-hidden="true">
            <img class="habitat-artwork" src="${habitat.artwork}" alt="" draggable="false" data-fallback-image>
            <span class="placed-animals">
              ${placed.map((animal) => `
                <span class="placed-animal"><img src="${animal.artwork}" alt="" data-fallback-image></span>
              `).join("")}
            </span>
          </span>
          <span class="habitat-label">
            <strong>${habitat.name}</strong>
            <span>${placed.length} / 2 home</span>
          </span>
        </button>
      `;
    }).join("");

    selectors.habitatList.querySelectorAll(".habitat-card").forEach((button) => {
      button.addEventListener("click", () => chooseHabitat(button.dataset.habitatId));
    });

    bindImageFallbacks(selectors.habitatList);
  }

  function renderAnimals() {
    const order = state.animalOrder.length ? state.animalOrder : animals.map((animal) => animal.id);
    selectors.animalList.innerHTML = order.map((id) => {
      const animal = getAnimal(id);
      const isMatched = state.matchedIds.has(id);
      const isSelected = state.selectedAnimalId === id;
      return `
        <button
          class="animal-card${isMatched ? " is-homed" : ""}${isSelected ? " is-selected" : ""}"
          type="button"
          data-animal-id="${id}"
          aria-pressed="${isSelected}"
          ${isMatched ? "disabled" : ""}
        >
          <span class="animal-art" aria-hidden="true">
            <img src="${animal.artwork}" alt="" draggable="false" data-fallback-image>
            <span>${getInitials(animal.name)}</span>
          </span>
          <strong>${animal.name}</strong>
          <small>${isMatched ? "At home" : "Drag or select"}</small>
        </button>
      `;
    }).join("");

    selectors.animalList.querySelectorAll(".animal-card").forEach((button) => {
      button.addEventListener("click", () => {
        if (Date.now() < state.suppressClickUntil) return;
        selectAnimal(button.dataset.animalId);
      });
      button.addEventListener("pointerdown", (event) => startPointerDrag(event, button.dataset.animalId));
    });

    bindImageFallbacks(selectors.animalList);
  }

  function selectAnimal(id) {
    if (state.matchedIds.has(id)) return;
    state.selectedAnimalId = state.selectedAnimalId === id ? null : id;
    playSound("select");

    if (state.selectedAnimalId) {
      setInstruction(`Now choose the habitat where ${getAnimal(id).name} belongs.`);
    } else {
      setInstruction("Choose an animal, then select its habitat.");
    }

    renderAnimals();
    const selected = selectors.animalList.querySelector(`[data-animal-id="${id}"]`);
    if (selected) selected.focus({ preventScroll: true });
  }

  function chooseHabitat(habitatId) {
    if (!state.selectedAnimalId) {
      setInstruction("Choose an animal first, then select a habitat.");
      markTemporary(selectors.habitatList.querySelector(`[data-habitat-id="${habitatId}"]`), "is-wrong");
      playSound("wrong");
      return;
    }

    evaluateMatch(state.selectedAnimalId, habitatId);
  }

  function evaluateMatch(animalId, habitatId, dragContext) {
    const animal = getAnimal(animalId);
    const source = dragContext?.source || selectors.animalList.querySelector(`[data-animal-id="${animalId}"]`);
    const target = selectors.habitatList.querySelector(`[data-habitat-id="${habitatId}"]`);

    if (animal.habitatId === habitatId) {
      state.matchedIds.add(animalId);
      state.selectedAnimalId = null;
      playSound("correct");
      setInstruction(`${animal.name} is home. Great job!`);
      showFact(animal);
      updateProgress();
      markTemporary(source, "is-correct");
      markTemporary(target, "is-correct");
      animateSnap(animal, source, target, dragContext?.ghost);
      clearDropHighlights();
      state.drag = null;

      window.setTimeout(() => {
        renderGame();
        if (state.matchedIds.size === animals.length) {
          completeGame();
        } else {
          focusNextAnimal();
        }
      }, reduceMotion ? 30 : 300);
    } else {
      state.selectedAnimalId = null;
      playSound("wrong");
      setInstruction(`${animal.name} lives somewhere else. Try again.`);
      markTemporary(source, "is-wrong");
      markTemporary(target, "is-wrong");
      returnDragGhost(dragContext?.ghost, source);
      clearDropHighlights();
      state.drag = null;
      window.setTimeout(renderAnimals, reduceMotion ? 30 : 280);
    }
  }

  function startPointerDrag(event, animalId) {
    if (event.button !== 0 || state.matchedIds.has(animalId)) return;
    const source = event.currentTarget;
    state.drag = {
      animalId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      moved: false,
      source,
      ghost: null,
      habitatId: null
    };
    source.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    const drag = state.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;

    drag.currentX = event.clientX;
    drag.currentY = event.clientY;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.moved && distance < 7) return;

    event.preventDefault();
    if (!drag.moved) {
      drag.moved = true;
      drag.source.classList.add("is-dragging");
      drag.ghost = createDragGhost(drag.source, event.clientX, event.clientY);
      state.selectedAnimalId = drag.animalId;
      playSound("select");
      setInstruction(`Drop ${getAnimal(drag.animalId).name} into the right habitat.`);
      selectors.habitatList.querySelectorAll(".habitat-card").forEach((card) => card.classList.add("is-drop-ready"));
    }

    positionGhost(drag.ghost, event.clientX, event.clientY);
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".habitat-card");
    drag.habitatId = target?.dataset.habitatId || null;
    selectors.habitatList.querySelectorAll(".habitat-card").forEach((card) => {
      card.classList.toggle("is-drop-hover", card === target);
    });
  }

  function onPointerUp(event) {
    const drag = state.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;

    drag.source.releasePointerCapture?.(event.pointerId);
    if (!drag.moved) {
      drag.source.classList.remove("is-dragging");
      state.drag = null;
      return;
    }

    state.suppressClickUntil = Date.now() + 420;
    const habitatId = drag.habitatId;
    if (habitatId) {
      evaluateMatch(drag.animalId, habitatId, drag);
    } else {
      state.selectedAnimalId = null;
      playSound("wrong");
      setInstruction("Drop the animal inside one of the habitat scenes.");
      markTemporary(drag.source, "is-wrong");
      returnDragGhost(drag.ghost, drag.source);
      clearDropHighlights();
      state.drag = null;
      window.setTimeout(renderAnimals, reduceMotion ? 30 : 280);
    }
  }

  function cancelPointerDrag(event) {
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    returnDragGhost(state.drag.ghost, state.drag.source);
    clearDropHighlights();
    state.drag.source.classList.remove("is-dragging");
    state.drag = null;
  }

  function createDragGhost(source, x, y) {
    const ghost = source.cloneNode(true);
    ghost.removeAttribute("id");
    ghost.removeAttribute("aria-pressed");
    ghost.className = "animal-card drag-ghost";
    ghost.disabled = true;
    document.body.appendChild(ghost);
    positionGhost(ghost, x, y);
    return ghost;
  }

  function positionGhost(ghost, x, y) {
    if (!ghost) return;
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
  }

  function animateSnap(animal, source, target, existingGhost) {
    if (reduceMotion || !target) {
      existingGhost?.remove();
      return;
    }

    const sourceRect = source?.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const ghost = existingGhost || (sourceRect ? createDragGhost(source, sourceRect.left + sourceRect.width / 2, sourceRect.top + sourceRect.height / 2) : null);
    if (!ghost) return;

    window.requestAnimationFrame(() => {
      positionGhost(ghost, targetRect.left + targetRect.width / 2, targetRect.top + targetRect.height * 0.45);
      ghost.classList.add("is-snapping");
    });
    window.setTimeout(() => ghost.remove(), 240);
  }

  function returnDragGhost(ghost, source) {
    if (!ghost) return;
    const rect = source?.getBoundingClientRect();
    if (rect && !reduceMotion) {
      positionGhost(ghost, rect.left + rect.width / 2, rect.top + rect.height / 2);
      ghost.style.opacity = "0";
      ghost.style.transform = "translate(-50%, -50%) scale(.82)";
      window.setTimeout(() => ghost.remove(), 210);
    } else {
      ghost.remove();
    }
  }

  function cleanupDrag() {
    state.drag?.ghost?.remove();
    state.drag = null;
    clearDropHighlights();
  }

  function clearDropHighlights() {
    selectors.habitatList.querySelectorAll(".habitat-card").forEach((card) => {
      card.classList.remove("is-drop-ready", "is-drop-hover");
    });
  }

  function showFact(animal) {
    window.clearTimeout(state.factTimer);
    selectors.factImage.classList.remove("is-hidden");
    selectors.factImage.src = animal.artwork;
    selectors.factInitials.textContent = getInitials(animal.name);
    selectors.factAnimal.textContent = animal.name;
    selectors.factText.textContent = animal.fact;
    selectors.factPanel.classList.add("is-visible");
    state.factTimer = window.setTimeout(() => selectors.factPanel.classList.remove("is-visible"), reduceMotion ? 2800 : 4300);
  }

  function completeGame() {
    playSound("complete");
    window.setTimeout(() => {
      selectors.factPanel.classList.remove("is-visible");
      switchScreen(selectors.completeScreen);
      selectors.playAgainButton.focus({ preventScroll: true });
      launchCelebration();
    }, reduceMotion ? 50 : 420);
  }

  function renderCompleteWorld() {
    selectors.completeWorld.innerHTML = habitats.map((habitat) => `
      <span class="complete-biome ${habitat.id}">
        <img class="complete-habitat-art" src="${habitat.artwork}" alt="" data-fallback-image>
        <span class="complete-animals">
          ${animals.filter((animal) => animal.habitatId === habitat.id).map((animal) => `<img src="${animal.artwork}" alt="" data-fallback-image>`).join("")}
        </span>
      </span>
    `).join("");
  }

  function updateProgress() {
    const matched = state.matchedIds.size;
    selectors.progressText.textContent = `${matched} / ${animals.length}`;
    selectors.progressBar.style.width = `${(matched / animals.length) * 100}%`;
  }

  function focusNextAnimal() {
    const next = selectors.animalList.querySelector("button:not(:disabled)");
    if (next) next.focus({ preventScroll: true });
  }

  function setInstruction(message) {
    selectors.instructionPanel.textContent = message;
  }

  function markTemporary(element, className) {
    if (!element) return;
    element.classList.add(className);
    window.setTimeout(() => element.classList.remove(className), reduceMotion ? 30 : 320);
  }

  function animateEntrance() {
    if (reduceMotion) return;
    document.querySelectorAll(".animal-card, .habitat-card").forEach((card, index) => {
      card.classList.add("card-enter");
      card.style.animationDelay = `${Math.min(index * 34, 260)}ms`;
      card.addEventListener("animationend", () => {
        card.classList.remove("card-enter");
        card.style.animationDelay = "";
      }, { once: true });
    });
  }

  function launchCelebration() {
    if (reduceMotion) return;
    const colors = ["#167a5b", "#237fc0", "#e7aa3d", "#e7796d", "#57ad67"];
    for (let index = 0; index < 44; index += 1) {
      const piece = document.createElement("span");
      piece.className = "celebration-piece";
      piece.style.left = `${8 + Math.random() * 84}%`;
      piece.style.background = colors[index % colors.length];
      piece.style.setProperty("--drift", `${-60 + Math.random() * 120}px`);
      piece.style.animationDelay = `${Math.random() * 220}ms`;
      document.body.appendChild(piece);
      window.setTimeout(() => piece.remove(), 2100);
    }
  }

  function readSoundPreference() {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved === null ? true : saved === "true";
    } catch (error) {
      return true;
    }
  }

  function saveSoundPreference() {
    try {
      window.localStorage.setItem(storageKey, String(state.soundEnabled));
    } catch (error) {
      // Sound remains usable for the current session if storage is unavailable.
    }
  }

  function setSoundUi() {
    selectors.soundToggle.setAttribute("aria-pressed", String(state.soundEnabled));
    selectors.soundToggle.setAttribute("aria-label", state.soundEnabled ? "Turn sound off" : "Turn sound on");
    selectors.soundLabel.textContent = state.soundEnabled ? "Sound On" : "Sound Off";
  }

  function primeAudio() {
    if (!state.soundEnabled || state.audioContext) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      state.audioContext = new AudioContext();
    } catch (error) {
      state.audioContext = null;
    }
  }

  function playSound(type) {
    if (!state.soundEnabled) return;
    primeAudio();
    const context = state.audioContext;
    if (!context) return;

    try {
      if (context.state === "suspended") context.resume().catch(() => {});
      const soundMap = {
        select: [460, 0.045, "sine", 0.025],
        correct: [690, 0.1, "triangle", 0.045],
        wrong: [190, 0.085, "sine", 0.032],
        complete: [760, 0.17, "sine", 0.055]
      };
      const [frequency, duration, wave, volume] = soundMap[type] || soundMap.select;
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(frequency, now);
      if (type === "complete") oscillator.frequency.exponentialRampToValueAtTime(1020, now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.025);
    } catch (error) {
      state.audioContext = null;
    }
  }

  function bindImageFallbacks(root) {
    root.querySelectorAll("[data-fallback-image]").forEach((image) => {
      if (image.dataset.fallbackBound === "true") return;
      image.dataset.fallbackBound = "true";
      image.addEventListener("error", () => image.classList.add("is-hidden"));
      image.addEventListener("load", () => image.classList.remove("is-hidden"));
    });
  }

  function getAnimal(id) {
    return animals.find((animal) => animal.id === id);
  }

  function getInitials(name) {
    return name.split(" ").map((part) => part.charAt(0)).join("").slice(0, 2).toUpperCase();
  }

  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
    }
    return copy;
  }

  init();
})();
