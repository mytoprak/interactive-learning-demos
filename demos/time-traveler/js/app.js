(function () {
  "use strict";

  const events = [
    {
      id: "printing-press",
      title: "The Printing Press",
      year: "c. 1440",
      order: 0,
      artwork: "assets/events/printing-press.webp",
      era: "Early Modern",
      fact: "Johannes Gutenberg's movable-type printing helped books and ideas spread much more widely."
    },
    {
      id: "columbus-voyage",
      title: "Columbus Reaches the Americas",
      year: "1492",
      order: 1,
      artwork: "assets/events/columbus-voyage.webp",
      era: "Age of Exploration",
      fact: "The voyage began sustained contact between Europe and the Americas, bringing enormous change and harm to Indigenous peoples."
    },
    {
      id: "steam-engine",
      title: "First Steam Engine",
      year: "1712",
      order: 2,
      artwork: "assets/events/steam-engine.webp",
      era: "Industrial Age",
      fact: "Thomas Newcomen built an early practical steam engine used to pump water from mines."
    },
    {
      id: "powered-flight",
      title: "First Powered Flight",
      year: "1903",
      order: 3,
      artwork: "assets/events/powered-flight.webp",
      era: "Age of Aviation",
      fact: "The Wright brothers achieved a sustained, controlled powered airplane flight."
    },
    {
      id: "human-in-space",
      title: "First Human in Space",
      year: "1961",
      order: 4,
      artwork: "assets/events/human-in-space.webp",
      era: "Space Age",
      fact: "Yuri Gagarin became the first human to travel into outer space."
    },
    {
      id: "moon-landing",
      title: "First Moon Landing",
      year: "1969",
      order: 5,
      artwork: "assets/events/moon-landing.webp",
      era: "Space Age",
      fact: "Apollo 11 landed humans on the Moon for the first time."
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
    timelineList: document.querySelector("#timelineList"),
    eventList: document.querySelector("#eventList"),
    progressText: document.querySelector("#progressText"),
    progressBar: document.querySelector("#progressBar"),
    timeNote: document.querySelector("#timeNote"),
    noteImage: document.querySelector("#noteImage"),
    noteInitials: document.querySelector("#noteInitials"),
    noteHeading: document.querySelector("#noteHeading"),
    noteText: document.querySelector("#noteText"),
    completeTimeline: document.querySelector("#completeTimeline")
  };

  const storageKey = "timeTraveler.soundEnabled";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    selectedEventId: null,
    placedIds: new Set(),
    eventOrder: [],
    soundEnabled: readSoundPreference(),
    audioContext: null,
    noteTimer: null,
    drag: null,
    suppressClickUntil: 0
  };

  function init() {
    setSoundUi();
    renderCompleteTimeline();
    renderTimeline();
    renderEvents();
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
    window.clearTimeout(state.noteTimer);
    state.selectedEventId = null;
    state.placedIds = new Set();
    state.eventOrder = shuffledEventIds();
    selectors.timeNote.classList.remove("is-visible");
    selectors.completeTimeline.classList.remove("is-pulsing");
    switchScreen(selectors.gameScreen);
    renderGame();
    setInstruction("Drag an event into its place, or select an event and then a timeline slot.");

    window.requestAnimationFrame(() => {
      animateEntrance();
      focusNextEvent();
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
    renderTimeline();
    renderEvents();
    updateProgress();
  }

  function renderTimeline() {
    selectors.timelineList.innerHTML = events.map((event, index) => {
      const isPlaced = state.placedIds.has(event.id);
      return `
        <button
          class="timeline-slot${isPlaced ? " is-filled" : ""}"
          type="button"
          data-slot-index="${index}"
          aria-label="Timeline position ${index + 1}. ${isPlaced ? `${event.year}, ${event.title}` : "Empty"}."
          ${isPlaced ? "disabled" : ""}
        >
          <span class="slot-sequence" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
          <span class="slot-marker" aria-hidden="true"></span>
          ${isPlaced ? `
            <span class="placed-event">
              <span class="placed-art"><img src="${event.artwork}" alt="" data-event-art="${event.id}" data-fallback-image><span>${getInitials(event.title)}</span></span>
              <span class="placed-copy"><small>${event.era}</small><strong>${event.title}</strong></span>
            </span>
            <span class="revealed-year">${event.year}</span>
          ` : `
            <span class="empty-slot"><span>Place event</span><small>Position ${index + 1}</small></span>
            <span class="hidden-year" aria-hidden="true">Year hidden</span>
          `}
        </button>
      `;
    }).join("");

    selectors.timelineList.querySelectorAll(".timeline-slot").forEach((button) => {
      button.addEventListener("click", () => chooseSlot(Number(button.dataset.slotIndex)));
    });

    bindImageFallbacks(selectors.timelineList);
  }

  function renderEvents() {
    const order = state.eventOrder.length ? state.eventOrder : events.map((event) => event.id);
    selectors.eventList.innerHTML = order.map((id) => {
      const event = getEvent(id);
      const isPlaced = state.placedIds.has(id);
      const isSelected = state.selectedEventId === id;
      return `
        <button
          class="event-card${isPlaced ? " is-placed" : ""}${isSelected ? " is-selected" : ""} event-${event.id}"
          type="button"
          data-event-id="${id}"
          aria-pressed="${isSelected}"
          ${isPlaced ? "disabled" : ""}
        >
          <span class="event-art" aria-hidden="true">
            <img src="${event.artwork}" alt="" draggable="false" data-event-art="${event.id}" data-fallback-image>
            <span>${getInitials(event.title)}</span>
          </span>
          <span class="event-copy">
            <small>${event.era}</small>
            <strong>${event.title}</strong>
            <span>Drag or select</span>
          </span>
        </button>
      `;
    }).join("");

    selectors.eventList.querySelectorAll(".event-card").forEach((button) => {
      button.addEventListener("click", () => {
        if (Date.now() < state.suppressClickUntil) return;
        selectEvent(button.dataset.eventId);
      });
      button.addEventListener("pointerdown", (event) => startPointerDrag(event, button.dataset.eventId));
    });

    bindImageFallbacks(selectors.eventList);
  }

  function selectEvent(id) {
    if (state.placedIds.has(id)) return;
    state.selectedEventId = state.selectedEventId === id ? null : id;
    playSound("select");

    if (state.selectedEventId) {
      setInstruction(`Now choose the correct timeline position for ${getEvent(id).title}.`);
    } else {
      setInstruction("Choose an event, then select its timeline position.");
    }

    renderEvents();
    const selected = selectors.eventList.querySelector(`[data-event-id="${id}"]`);
    if (selected) selected.focus({ preventScroll: true });
  }

  function chooseSlot(slotIndex) {
    if (!state.selectedEventId) {
      setInstruction("Choose an event first, then select a timeline position.");
      markTemporary(selectors.timelineList.querySelector(`[data-slot-index="${slotIndex}"]`), "is-wrong");
      playSound("wrong");
      return;
    }

    evaluatePlacement(state.selectedEventId, slotIndex);
  }

  function evaluatePlacement(eventId, slotIndex, dragContext) {
    const timelineEvent = getEvent(eventId);
    const source = dragContext?.source || selectors.eventList.querySelector(`[data-event-id="${eventId}"]`);
    const target = selectors.timelineList.querySelector(`[data-slot-index="${slotIndex}"]`);

    if (timelineEvent.order === slotIndex) {
      state.placedIds.add(eventId);
      state.selectedEventId = null;
      playSound("correct");
      setInstruction(`${timelineEvent.title} is in the right place.`);
      showTimeNote(timelineEvent);
      updateProgress();
      markTemporary(source, "is-correct");
      markTemporary(target, "is-correct");
      animateSnap(source, target, dragContext?.ghost);
      clearDropHighlights();
      state.drag = null;

      window.setTimeout(() => {
        renderGame();
        if (state.placedIds.size === events.length) {
          completeGame();
        } else {
          focusNextEvent();
        }
      }, reduceMotion ? 30 : 300);
    } else {
      state.selectedEventId = null;
      playSound("wrong");
      setInstruction(`${timelineEvent.title} belongs somewhere else in the timeline. Try again.`);
      markTemporary(source, "is-wrong");
      markTemporary(target, "is-wrong");
      returnDragGhost(dragContext?.ghost, source);
      clearDropHighlights();
      state.drag = null;
      window.setTimeout(renderEvents, reduceMotion ? 30 : 280);
    }
  }

  function startPointerDrag(event, eventId) {
    if (event.button !== 0 || state.placedIds.has(eventId)) return;
    const source = event.currentTarget;
    state.drag = {
      eventId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      source,
      ghost: null,
      slotIndex: null
    };
    source.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    const drag = state.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.moved && distance < 7) return;

    event.preventDefault();
    if (!drag.moved) {
      drag.moved = true;
      drag.source.classList.add("is-dragging");
      drag.ghost = createDragGhost(drag.source, event.clientX, event.clientY);
      state.selectedEventId = drag.eventId;
      playSound("select");
      setInstruction(`Place ${getEvent(drag.eventId).title} in the correct timeline position.`);
      selectors.timelineList.querySelectorAll(".timeline-slot:not(:disabled)").forEach((slot) => slot.classList.add("is-drop-ready"));
    }

    positionGhost(drag.ghost, event.clientX, event.clientY);
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".timeline-slot:not(:disabled)");
    drag.slotIndex = target ? Number(target.dataset.slotIndex) : null;
    selectors.timelineList.querySelectorAll(".timeline-slot").forEach((slot) => {
      slot.classList.toggle("is-drop-hover", slot === target);
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
    if (drag.slotIndex !== null) {
      evaluatePlacement(drag.eventId, drag.slotIndex, drag);
    } else {
      state.selectedEventId = null;
      playSound("wrong");
      setInstruction("Drop the event inside an empty timeline slot.");
      markTemporary(drag.source, "is-wrong");
      returnDragGhost(drag.ghost, drag.source);
      clearDropHighlights();
      state.drag = null;
      window.setTimeout(renderEvents, reduceMotion ? 30 : 280);
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
    ghost.className = "event-card drag-ghost";
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

  function animateSnap(source, target, existingGhost) {
    if (reduceMotion || !target) {
      existingGhost?.remove();
      return;
    }
    const sourceRect = source?.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const ghost = existingGhost || (sourceRect ? createDragGhost(source, sourceRect.left + sourceRect.width / 2, sourceRect.top + sourceRect.height / 2) : null);
    if (!ghost) return;
    window.requestAnimationFrame(() => {
      positionGhost(ghost, targetRect.left + targetRect.width / 2, targetRect.top + targetRect.height / 2);
      ghost.classList.add("is-snapping");
    });
    window.setTimeout(() => ghost.remove(), 250);
  }

  function returnDragGhost(ghost, source) {
    if (!ghost) return;
    const rect = source?.getBoundingClientRect();
    if (rect && !reduceMotion) {
      positionGhost(ghost, rect.left + rect.width / 2, rect.top + rect.height / 2);
      ghost.style.opacity = "0";
      ghost.style.transform = "translate(-50%, -50%) scale(.86)";
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
    selectors.timelineList.querySelectorAll(".timeline-slot").forEach((slot) => {
      slot.classList.remove("is-drop-ready", "is-drop-hover");
    });
  }

  function showTimeNote(timelineEvent) {
    window.clearTimeout(state.noteTimer);
    selectors.noteImage.classList.remove("is-hidden");
    selectors.noteImage.src = timelineEvent.artwork;
    selectors.noteImage.dataset.eventArt = timelineEvent.id;
    selectors.noteInitials.textContent = getInitials(timelineEvent.title);
    selectors.noteHeading.textContent = `${timelineEvent.year} · ${timelineEvent.title}`;
    selectors.noteText.textContent = timelineEvent.fact;
    selectors.timeNote.classList.add("is-visible");
    state.noteTimer = window.setTimeout(() => selectors.timeNote.classList.remove("is-visible"), reduceMotion ? 2800 : 4400);
  }

  function completeGame() {
    playSound("complete");
    window.setTimeout(() => {
      selectors.timeNote.classList.remove("is-visible");
      switchScreen(selectors.completeScreen);
      selectors.completeTimeline.classList.add("is-pulsing");
      selectors.playAgainButton.focus({ preventScroll: true });
    }, reduceMotion ? 50 : 430);
  }

  function renderCompleteTimeline() {
    selectors.completeTimeline.innerHTML = events.map((event) => `
      <span class="complete-event">
        <span class="complete-art"><img src="${event.artwork}" alt="" data-event-art="${event.id}" data-fallback-image></span>
        <strong>${event.year}</strong>
        <small>${event.title}</small>
      </span>
    `).join("");
  }

  function updateProgress() {
    const placed = state.placedIds.size;
    selectors.progressText.textContent = `${placed} / ${events.length}`;
    selectors.progressBar.style.width = `${(placed / events.length) * 100}%`;
  }

  function focusNextEvent() {
    const next = selectors.eventList.querySelector("button:not(:disabled)");
    if (next) next.focus({ preventScroll: true });
  }

  function setInstruction(message) {
    selectors.instructionPanel.textContent = message;
  }

  function markTemporary(element, className) {
    if (!element) return;
    element.classList.remove(className);
    window.requestAnimationFrame(() => element.classList.add(className));
    window.setTimeout(() => element.classList.remove(className), reduceMotion ? 40 : 420);
  }

  function animateEntrance() {
    if (reduceMotion) return;
    [...selectors.timelineList.children, ...selectors.eventList.children].forEach((element, index) => {
      element.classList.add("card-enter");
      element.style.animationDelay = `${Math.min(index * 42, 280)}ms`;
    });
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
      // Storage can be unavailable in restricted browsing modes.
    }
  }

  function setSoundUi() {
    selectors.soundToggle.setAttribute("aria-pressed", String(state.soundEnabled));
    selectors.soundToggle.setAttribute("aria-label", state.soundEnabled ? "Turn sound off" : "Turn sound on");
    selectors.soundLabel.textContent = state.soundEnabled ? "Sound On" : "Sound Off";
    selectors.soundToggle.classList.toggle("is-muted", !state.soundEnabled);
  }

  function primeAudio() {
    if (!state.soundEnabled || state.audioContext) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      state.audioContext = new AudioContext();
    } catch (error) {
      state.audioContext = null;
    }
  }

  function playSound(type) {
    if (!state.soundEnabled) return;
    try {
      primeAudio();
      const context = state.audioContext;
      if (!context) return;
      if (context.state === "suspended") context.resume().catch(() => {});
      const soundMap = {
        select: [420, 0.045, "sine", 0.022],
        correct: [640, 0.1, "triangle", 0.04],
        wrong: [170, 0.09, "sine", 0.03],
        complete: [720, 0.2, "sine", 0.052]
      };
      const [frequency, duration, wave, volume] = soundMap[type] || soundMap.select;
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(frequency, now);
      if (type === "complete") oscillator.frequency.exponentialRampToValueAtTime(1080, now + duration);
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

  function getEvent(id) {
    return events.find((event) => event.id === id);
  }

  function getInitials(title) {
    return title.split(" ").filter((word) => word.length > 2).map((word) => word.charAt(0)).join("").slice(0, 2).toUpperCase();
  }

  function shuffledEventIds() {
    const chronological = events.map((event) => event.id);
    const shuffled = shuffle(chronological);
    if (shuffled.every((id, index) => id === chronological[index])) {
      shuffled.push(shuffled.shift());
    }
    return shuffled;
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
