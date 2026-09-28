(function () {
  "use strict";

  const scientists = [
    {
      id: "einstein",
      name: "Albert Einstein",
      years: "1879-1955",
      portrait: "assets/scientists/einstein.webp",
      discovery: "Theory of Relativity",
      fact: "Einstein's relativity theories changed how scientists describe space, time, gravity and motion at very high speeds."
    },
    {
      id: "newton",
      name: "Isaac Newton",
      years: "1643-1727",
      portrait: "assets/scientists/newton.webp",
      discovery: "Laws of Motion",
      fact: "Newton's three laws gave science a powerful mathematical way to explain how objects move and interact with forces."
    },
    {
      id: "curie",
      name: "Marie Curie",
      years: "1867-1934",
      portrait: "assets/scientists/curie.webp",
      discovery: "Radioactivity",
      fact: "Curie's work helped establish radioactivity as a field of study and led to the discovery of polonium and radium."
    },
    {
      id: "darwin",
      name: "Charles Darwin",
      years: "1809-1882",
      portrait: "assets/scientists/darwin.webp",
      discovery: "Theory of Evolution",
      fact: "Darwin gathered evidence for evolution by natural selection, a central idea in modern biology."
    },
    {
      id: "galileo",
      name: "Galileo Galilei",
      years: "1564-1642",
      portrait: "assets/scientists/galileo.webp",
      discovery: "Astronomical Observations",
      fact: "Galileo's telescope observations supported the view that Earth and other planets move around the Sun."
    },
    {
      id: "tesla",
      name: "Nikola Tesla",
      years: "1856-1943",
      portrait: "assets/scientists/tesla.webp",
      discovery: "Alternating Current",
      fact: "Tesla's alternating-current motor and power-system ideas helped make long-distance electric power practical."
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
    scientistList: document.querySelector("#scientistList"),
    discoveryList: document.querySelector("#discoveryList"),
    instructionPanel: document.querySelector("#instructionPanel"),
    progressText: document.querySelector("#progressText"),
    progressBar: document.querySelector("#progressBar"),
    factToast: document.querySelector("#factToast"),
    factPortrait: document.querySelector("#factPortrait"),
    factInitials: document.querySelector("#factInitials"),
    factScientist: document.querySelector("#factScientist"),
    factText: document.querySelector("#factText")
  };

  const storageKey = "greatScientists.soundEnabled";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    selectedScientistId: null,
    matchedIds: new Set(),
    discoveryOrder: [],
    soundEnabled: readSoundPreference(),
    audioContext: null,
    factTimer: null
  };

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
      // The control still works for the current session when storage is blocked.
    }
  }

  function init() {
    setSoundUi();
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
  }

  function startGame() {
    state.selectedScientistId = null;
    state.matchedIds = new Set();
    state.discoveryOrder = shuffle(scientists.map((item) => item.id));
    selectors.factToast.classList.remove("is-visible");
    switchScreen(selectors.gameScreen);
    renderGame();
    setInstruction("Select a scientist, then choose the matching discovery.");
    window.requestAnimationFrame(() => {
      animateCardEntrance();
      const firstScientist = selectors.scientistList.querySelector("button:not(:disabled)");
      if (firstScientist) {
        firstScientist.focus({ preventScroll: true });
      }
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
    renderScientists();
    renderDiscoveries();
    updateProgress();
  }

  function renderScientists() {
    selectors.scientistList.innerHTML = scientists.map((scientist) => {
      const isMatched = state.matchedIds.has(scientist.id);
      const isSelected = state.selectedScientistId === scientist.id;
      return `
        <button
          class="match-card scientist-card${isMatched ? " is-matched" : ""}${isSelected ? " is-selected" : ""}"
          type="button"
          data-card="scientist"
          data-id="${scientist.id}"
          aria-pressed="${isSelected}"
          ${isMatched ? "disabled" : ""}
        >
          <span class="portrait" aria-hidden="true">
            <img src="${scientist.portrait}" alt="" data-fallback-image>
            <span>${getInitials(scientist.name)}</span>
          </span>
          <span class="scientist-info">
            <strong>${scientist.name}</strong>
            <span>${scientist.years}</span>
          </span>
        </button>
      `;
    }).join("");

    selectors.scientistList.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => selectScientist(button.dataset.id));
    });

    bindImageFallbacks(selectors.scientistList);
  }

  function renderDiscoveries() {
    const order = state.discoveryOrder.length ? state.discoveryOrder : scientists.map((item) => item.id);
    selectors.discoveryList.innerHTML = order.map((id) => {
      const scientist = getScientist(id);
      const isMatched = state.matchedIds.has(id);
      return `
        <button
          class="match-card discovery-card${isMatched ? " is-matched" : ""}"
          type="button"
          data-card="discovery"
          data-id="${id}"
          ${isMatched ? "disabled" : ""}
        >
          <strong>${scientist.discovery}</strong>
        </button>
      `;
    }).join("");

    selectors.discoveryList.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => selectDiscovery(button.dataset.id));
    });
  }

  function selectScientist(id) {
    if (state.matchedIds.has(id)) return;
    state.selectedScientistId = id;
    playSound("select");
    setInstruction(`Now choose the discovery connected to ${getScientist(id).name}.`);
    renderGame();
  }

  function selectDiscovery(discoveryId) {
    if (state.matchedIds.has(discoveryId)) return;

    if (!state.selectedScientistId) {
      setInstruction("Choose a scientist first, then select a discovery.");
      markTemporary(selectors.discoveryList.querySelector(`[data-id="${discoveryId}"]`), "is-wrong");
      playSound("wrong");
      return;
    }

    const scientistId = state.selectedScientistId;
    const scientistButton = selectors.scientistList.querySelector(`[data-id="${scientistId}"]`);
    const discoveryButton = selectors.discoveryList.querySelector(`[data-id="${discoveryId}"]`);

    if (scientistId === discoveryId) {
      state.matchedIds.add(scientistId);
      state.selectedScientistId = null;
      playSound("correct");
      markTemporary(scientistButton, "is-correct");
      markTemporary(discoveryButton, "is-correct");
      showFact(getScientist(scientistId));
      setInstruction("Correct match. Keep going.");

      window.setTimeout(() => {
        renderGame();
        if (state.matchedIds.size === scientists.length) {
          completeGame();
        } else {
          focusNextOpenScientist();
        }
      }, reduceMotion ? 30 : 260);
    } else {
      playSound("wrong");
      setInstruction("Not quite. Try another pairing.");
      markTemporary(scientistButton, "is-wrong");
      markTemporary(discoveryButton, "is-wrong");
      state.selectedScientistId = null;
      window.setTimeout(renderGame, reduceMotion ? 30 : 300);
    }
  }

  function completeGame() {
    playSound("complete");
    window.setTimeout(() => {
      switchScreen(selectors.completeScreen);
      selectors.playAgainButton.focus({ preventScroll: true });
      launchConfetti();
    }, reduceMotion ? 60 : 420);
  }

  function updateProgress() {
    const matched = state.matchedIds.size;
    const total = scientists.length;
    selectors.progressText.textContent = `${matched} / ${total}`;
    selectors.progressBar.style.width = `${(matched / total) * 100}%`;
  }

  function setInstruction(message) {
    selectors.instructionPanel.textContent = message;
  }

  function showFact(scientist) {
    window.clearTimeout(state.factTimer);
    selectors.factPortrait.classList.remove("is-hidden");
    selectors.factPortrait.src = scientist.portrait;
    selectors.factInitials.textContent = getInitials(scientist.name);
    selectors.factScientist.textContent = scientist.name;
    selectors.factText.textContent = scientist.fact;
    selectors.factToast.classList.add("is-visible");
    state.factTimer = window.setTimeout(() => {
      selectors.factToast.classList.remove("is-visible");
    }, reduceMotion ? 2800 : 4700);
  }

  function focusNextOpenScientist() {
    const next = selectors.scientistList.querySelector("button:not(:disabled)");
    if (next) {
      next.focus({ preventScroll: true });
    }
  }

  function animateCardEntrance() {
    if (reduceMotion) return;
    document.querySelectorAll(".match-card").forEach((card, index) => {
      card.classList.add("card-enter");
      card.style.animationDelay = `${Math.min(index * 38, 260)}ms`;
      card.addEventListener("animationend", () => {
        card.classList.remove("card-enter");
        card.style.animationDelay = "";
      }, { once: true });
    });
  }

  function markTemporary(element, className) {
    if (!element) return;
    element.classList.add(className);
    window.setTimeout(() => element.classList.remove(className), reduceMotion ? 30 : 340);
  }

  function setSoundUi() {
    selectors.soundToggle.setAttribute("aria-pressed", String(state.soundEnabled));
    selectors.soundLabel.textContent = state.soundEnabled ? "Sound On" : "Sound Off";
    selectors.soundToggle.setAttribute("aria-label", state.soundEnabled ? "Turn sound off" : "Turn sound on");
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
      if (context.state === "suspended") {
        context.resume().catch(() => {});
      }

      const soundMap = {
        select: [440, 0.045, "sine", 0.03],
        correct: [660, 0.11, "triangle", 0.05],
        wrong: [180, 0.09, "sawtooth", 0.035],
        complete: [820, 0.18, "sine", 0.06]
      };
      const [frequency, duration, typeName, gainAmount] = soundMap[type] || soundMap.select;
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = typeName;
      oscillator.frequency.setValueAtTime(frequency, now);
      if (type === "complete") {
        oscillator.frequency.exponentialRampToValueAtTime(1040, now + duration);
      }

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(gainAmount, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.025);
    } catch (error) {
      state.audioContext = null;
    }
  }

  function launchConfetti() {
    if (reduceMotion || typeof window.confetti !== "function") return;
    const defaults = {
      particleCount: 70,
      spread: 60,
      ticks: 160,
      scalar: 0.86,
      colors: ["#2563eb", "#1fb6b2", "#7c3aed", "#16a34a"]
    };
    window.confetti({ ...defaults, origin: { x: 0.28, y: 0.28 } });
    window.setTimeout(() => window.confetti({ ...defaults, origin: { x: 0.72, y: 0.28 } }), 180);
  }

  function getScientist(id) {
    return scientists.find((scientist) => scientist.id === id);
  }

  function getInitials(name) {
    return name
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function bindImageFallbacks(root) {
    root.querySelectorAll("[data-fallback-image]").forEach((image) => {
      if (image.dataset.fallbackBound === "true") return;
      image.dataset.fallbackBound = "true";
      image.addEventListener("error", () => image.classList.add("is-hidden"));
      image.addEventListener("load", () => image.classList.remove("is-hidden"));
    });
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
