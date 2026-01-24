const stepsEl = document.getElementById("steps");
const contentEl = document.getElementById("content");
let versionPickerEl = document.getElementById("version-picker");
let versionSelectEl = document.getElementById("version-select");
const headerEl = contentEl.querySelector("header");
const wizardTitleEl = document.getElementById("wizard-title");
const stepTitleEl = document.getElementById("step-title");
const stepTextEl = document.getElementById("step-text");
const stepLinkEl = document.getElementById("step-link");
const navEl = contentEl.querySelector("nav");
const helpToggleEl = document.getElementById("help-toggle");
const helpEl = document.getElementById("help");
const videoEl = document.getElementById("video");
const supportLinkEl = document.getElementById("support-link");
const backBtn = document.getElementById("back");
const nextBtn = document.getElementById("next");
const chatLogEl = document.getElementById("chat-log");
const chatCurrentEl = document.getElementById("chat-current");
const overviewCloseEl = document.getElementById("overview-close");
const overviewHandleEl = document.getElementById("overview-handle");
const noteInputEl = document.getElementById("note-input");

const SUBMIT_ENDPOINT = "https://example.com/api/onboarding-feedback";
const HELP_INITIAL_LABEL = "I encountered a problem and need help";
const HELP_CRITICAL_LABEL =
  "I still have a critical problem and need to book a support call";

let config = null;
let currentStepIndex = 0;
let eventsAttached = false;
let clickLog = [];
let isFinished = false;
let summaryEl = null;
let stepNotes = [];

function getVersionParam() {
  const params = new URLSearchParams(window.location.search);
  return params.get("v");
}

function fetchJson(path) {
  return fetch(path).then((res) => {
    if (!res.ok) {
      throw new Error(`Failed to load ${path}`);
    }
    return res.json();
  });
}

function isVideoFile(url) {
  return /\.mp4($|\?)/i.test(url);
}

function buildVideoNode(url) {
  if (!url) {
    return null;
  }
  if (isVideoFile(url)) {
    const video = document.createElement("video");
    video.controls = true;
    video.src = url;
    video.width = 640;
    return video;
  }
  const iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.width = "640";
  iframe.height = "360";
  iframe.loading = "lazy";
  iframe.title = "Help video";
  return iframe;
}

function isChatLayout() {
  return Boolean(chatLogEl && chatCurrentEl);
}

function stripIds(node) {
  if (!node) {
    return;
  }
  if (node.id) {
    node.removeAttribute("id");
  }
  node.querySelectorAll("[id]").forEach((el) => {
    el.removeAttribute("id");
  });
}

function archiveCurrentChat() {
  if (!isChatLayout()) {
    return null;
  }
  const clone = chatCurrentEl.cloneNode(true);
  stripIds(clone);
  clone.classList.add("archived");
  chatLogEl.insertBefore(clone, chatCurrentEl);
  return clone;
}

function insertAfter(reference, node) {
  if (!isChatLayout()) {
    return;
  }
  if (!reference || !reference.parentNode) {
    chatLogEl.insertBefore(node, chatCurrentEl);
    return;
  }
  const next = reference.nextSibling;
  if (next) {
    chatLogEl.insertBefore(node, next);
  } else {
    chatLogEl.insertBefore(node, chatCurrentEl);
  }
}

function appendUserChat(text, afterEl = null) {
  if (!isChatLayout()) {
    return;
  }
  const bubble = document.createElement("div");
  bubble.className = "message user";
  bubble.textContent = text;
  insertAfter(afterEl, bubble);
}

function appendNoteBubble(text, stepIndex, afterEl = null) {
  if (!isChatLayout()) {
    return null;
  }
  const bubble = document.createElement("div");
  bubble.className = "message user has-edit";
  bubble.dataset.step = String(stepIndex);

  const textEl = document.createElement("span");
  textEl.className = "note-text";
  textEl.textContent = text;

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "edit-note";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", () => {
    const current = textEl.textContent || "";
    const next = window.prompt("Edit note", current);
    if (next === null) {
      return;
    }
    textEl.textContent = next.trim();
    const step = Number(bubble.dataset.step);
    if (!Number.isNaN(step)) {
      stepNotes[step] = textEl.textContent;
      syncNoteInputForStep();
    }
    scrollChatToBottom();
  });

  bubble.append(textEl, editBtn);
  insertAfter(afterEl, bubble);
  return bubble;
}

function captureChatAction(label) {
  if (!label || isFinished || !isChatLayout()) {
    return;
  }
  const noteText = noteInputEl ? noteInputEl.value.trim() : "";
  if (noteText) {
    stepNotes[currentStepIndex] = noteText;
  }
  const archivedStep = archiveCurrentChat();
  let lastInserted = archivedStep;
  if (noteText) {
    lastInserted = appendNoteBubble(noteText, currentStepIndex, archivedStep);
  }
  appendUserChat(label, lastInserted);
  scrollChatToBottom();
}

function resetChatHistory() {
  if (!isChatLayout()) {
    return;
  }
  chatLogEl.innerHTML = "";
  chatLogEl.appendChild(chatCurrentEl);
  chatCurrentEl.hidden = false;
  if (navEl) {
    navEl.hidden = false;
  }
  if (summaryEl) {
    summaryEl.remove();
    summaryEl = null;
  }
}

function scrollChatToBottom() {
  if (!isChatLayout()) {
    return;
  }
  requestAnimationFrame(() => {
    const lastBubble = chatLogEl.lastElementChild;
    if (lastBubble) {
      lastBubble.scrollIntoView({ block: "end", behavior: "smooth" });
    }
    chatLogEl.scrollTop = chatLogEl.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
  });
}

function setOverviewCollapsed(collapsed) {
  document.body.classList.toggle("overview-collapsed", collapsed);
}

function syncNoteInputForStep() {
  if (!noteInputEl) {
    return;
  }
  noteInputEl.value = stepNotes[currentStepIndex] || "";
}

function setupKeyboardAvoidance() {
  const root = document.documentElement;
  if (!window.visualViewport) {
    return;
  }
  const updateOffset = () => {
    const viewport = window.visualViewport;
    const offset = Math.max(
      0,
      window.innerHeight - viewport.height - viewport.offsetTop
    );
    root.style.setProperty("--keyboard-offset", `${offset}px`);
  };
  window.visualViewport.addEventListener("resize", updateOffset);
  window.visualViewport.addEventListener("scroll", updateOffset);
  updateOffset();
}

function renderSteps() {
  stepsEl.innerHTML = "";
  config.steps.forEach((step, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "step-item";
    item.textContent = `${index + 1}. ${step.title}`;
    if (index < currentStepIndex) {
      item.classList.add("step-completed");
      item.dataset.state = "completed";
    } else if (index === currentStepIndex) {
      item.classList.add("step-current");
      item.dataset.state = "current";
    } else {
      item.classList.add("step-upcoming");
      item.dataset.state = "upcoming";
    }
    item.addEventListener("click", () => {
      if (isFinished) {
        exitSummary(index);
      }
      currentStepIndex = index;
      logClick("Step selected");
      render();
    });
    stepsEl.appendChild(item);
  });
}

function renderStepContent(step) {
  if (wizardTitleEl) {
    wizardTitleEl.textContent = "";
  }
  if (stepTitleEl) {
    stepTitleEl.textContent = step.title || "";
  }
  stepTextEl.textContent = step.text || "";
  syncNoteInputForStep();

  if (step.link && step.link.url) {
    stepLinkEl.href = step.link.url;
    stepLinkEl.textContent = step.link.label || "Open link";
    stepLinkEl.hidden = false;
  } else {
    stepLinkEl.removeAttribute("href");
    stepLinkEl.textContent = "";
    stepLinkEl.hidden = true;
  }

  resetHelpState();

  if (step.help && step.help.support_url) {
    supportLinkEl.href = step.help.support_url;
    supportLinkEl.hidden = false;
  } else {
    supportLinkEl.hidden = true;
  }

  if (backBtn) {
    backBtn.disabled = currentStepIndex === 0;
  }
  nextBtn.disabled = currentStepIndex >= config.steps.length && isFinished;
  scrollChatToBottom();
}

function render() {
  if (isFinished) {
    return;
  }
  renderSteps();
  renderStepContent(config.steps[currentStepIndex]);
}

function setSummaryVisibility(visible) {
  if (isChatLayout()) {
    return;
  }
  const elements = [
    versionPickerEl,
    headerEl,
    stepTextEl,
    stepLinkEl,
    navEl,
    helpEl,
  ];
  elements.forEach((el) => {
    if (!el) {
      return;
    }
    if (visible) {
      if (el.dataset.prevDisplay === undefined) {
        el.dataset.prevDisplay = el.style.display || "";
      }
      el.style.display = "none";
    } else {
      const previous = el.dataset.prevDisplay ?? "";
      el.style.display = previous;
      delete el.dataset.prevDisplay;
    }
  });
  if (summaryEl) {
    summaryEl.hidden = !visible;
  }
}

function exitSummary(targetStepIndex) {
  if (!isFinished) {
    return;
  }
  isFinished = false;
  if (isChatLayout()) {
    if (summaryEl) {
      summaryEl.remove();
      summaryEl = null;
    }
    if (chatCurrentEl) {
      chatCurrentEl.hidden = false;
    }
    if (navEl) {
      navEl.hidden = false;
    }
  }
  setSummaryVisibility(false);
  if (typeof targetStepIndex === "number") {
    currentStepIndex = targetStepIndex;
  }
}

function attachEvents() {
  if (eventsAttached) {
    return;
  }
  eventsAttached = true;
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (currentStepIndex > 0 && !isFinished) {
        logClick(backBtn.textContent);
        captureChatAction(backBtn.textContent);
        currentStepIndex -= 1;
        render();
      }
    });
  }

  nextBtn.addEventListener("click", () => {
    if (isFinished) {
      return;
    }
    logClick(nextBtn.textContent);
    captureChatAction(nextBtn.textContent);
    if (currentStepIndex >= config.steps.length - 1) {
      finishWizard("completed");
      scrollChatToBottom();
      return;
    }
    currentStepIndex += 1;
    render();
    scrollChatToBottom();
  });

  helpToggleEl.addEventListener("click", () => {
    if (!config || isFinished) {
      return;
    }
    logClick(helpToggleEl.textContent);
    captureChatAction(helpToggleEl.textContent);
    const step = config.steps[currentStepIndex];
    if (!step.help) {
      finishWizard("critical_problem");
      return;
    }
    if (helpToggleEl.textContent === HELP_INITIAL_LABEL) {
      helpToggleEl.textContent = HELP_CRITICAL_LABEL;
      const isHidden = helpEl.hidden;
      helpEl.hidden = !isHidden;
      if (isHidden && videoEl.children.length === 0) {
        const videoNode = buildVideoNode(step.help.video);
        if (videoNode) {
          videoEl.appendChild(videoNode);
        }
      }
      scrollChatToBottom();
      return;
    }
    finishWizard("critical_problem");
    scrollChatToBottom();
  });

  supportLinkEl.addEventListener("click", () => {
    logClick("Support link");
  });

  if (versionSelectEl) {
    versionSelectEl.addEventListener("change", () => {
      const selected = versionSelectEl.value;
      if (!selected || isFinished) {
        return;
      }
      logClick(`Version changed to ${selected}`);
      loadVersion(selected, true);
    });
  }

  if (overviewCloseEl) {
    overviewCloseEl.addEventListener("click", () => {
      setOverviewCollapsed(true);
    });
  }

  if (overviewHandleEl) {
    overviewHandleEl.addEventListener("click", () => {
      setOverviewCollapsed(false);
    });
  }

  if (noteInputEl) {
    noteInputEl.addEventListener("focus", () => {
      scrollChatToBottom();
    });
  }

}

function resolveVersion(versions, requested) {
  if (requested && versions.versions && versions.versions[requested]) {
    return requested;
  }
  return getLatestVersion(versions);
}

function getLatestVersion(versions) {
  if (versions.default) {
    return versions.default;
  }
  const keys = Object.keys(versions.versions || {});
  return keys[0] || null;
}

function updateVersionOptions(versions) {
  if (!versionSelectEl) {
    return;
  }
  versionSelectEl.innerHTML = "";
  Object.entries(versions.versions || {}).forEach(([version, label]) => {
    const option = document.createElement("option");
    option.value = version;
    option.textContent = label ? `${version} — ${label}` : version;
    versionSelectEl.appendChild(option);
  });
}

function updateUrl(version) {
  const url = new URL(window.location.href);
  if (version) {
    url.searchParams.set("v", version);
  } else {
    url.searchParams.delete("v");
  }
  window.history.replaceState({}, "", url);
}

function loadVersion(version, updateQueryParam) {
  return fetchJson(`content/${version}.json`)
    .then((loaded) => {
      config = loaded;
      currentStepIndex = 0;
      isFinished = false;
      stepNotes = new Array(config.steps.length).fill("");
      resetChatHistory();
      render();
      if (versionSelectEl) {
        versionSelectEl.value = version;
      }
      if (updateQueryParam) {
        updateUrl(version);
      }
    })
    .catch((err) => {
      stepsEl.textContent = "Failed to load onboarding content.";
      console.error(err);
    });
}

function ensureVersionPicker() {
  if (versionSelectEl || !contentEl) {
    return;
  }
  versionPickerEl = document.createElement("div");
  versionPickerEl.id = "version-picker";
  const label = document.createElement("label");
  label.htmlFor = "version-select";
  label.textContent = "Version";
  versionSelectEl = document.createElement("select");
  versionSelectEl.id = "version-select";
  versionPickerEl.append(label, versionSelectEl);
  contentEl.insertBefore(versionPickerEl, contentEl.firstChild);
}

function formatTimestamp(date) {
  const pad = (value, size = 2) => String(value).padStart(size, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const ms = pad(date.getMilliseconds(), 3);
  return `${year}-${month}-${day}--${hours}-${minutes}-${seconds}:${ms}`;
}

function logClick(buttonLabel) {
  const entry = {
    step: currentStepIndex + 1,
    time: formatTimestamp(new Date()),
    button: buttonLabel,
  };
  clickLog.push(entry);
}

function finishWizard(reason) {
  if (isFinished) {
    return;
  }
  isFinished = true;
  logClick(`Finished: ${reason}`);

  if (!summaryEl) {
    summaryEl = document.createElement(isChatLayout() ? "div" : "section");
    summaryEl.id = "summary";
    if (isChatLayout()) {
      summaryEl.className = "message assistant";
      chatLogEl.appendChild(summaryEl);
    } else {
      contentEl.appendChild(summaryEl);
    }
  }
  summaryEl.innerHTML = "";

  const title = document.createElement("h2");
  title.textContent = "Onboarding summary";

  const description = document.createElement("p");
  description.textContent =
    "Below is a summary of the steps you took and the buttons you clicked. This data will be submitted if you choose to send it.";

  const logTable = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Step", "Time", "Button", "Notes"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  logTable.appendChild(thead);

  const tbody = document.createElement("tbody");
  clickLog.forEach((entry) => {
    const row = document.createElement("tr");
    const stepCell = document.createElement("td");
    const stepTitle = config?.steps?.[entry.step - 1]?.title || "";
    stepCell.textContent = stepTitle
      ? `${entry.step}. ${stepTitle}`
      : String(entry.step);
    const timeCell = document.createElement("td");
    timeCell.textContent = entry.time;
    const buttonCell = document.createElement("td");
    buttonCell.textContent = entry.button;
    const notesCell = document.createElement("td");
    notesCell.textContent = stepNotes[entry.step - 1] || "";
    row.append(stepCell, timeCell, buttonCell, notesCell);
    tbody.appendChild(row);
  });
  logTable.appendChild(tbody);

  const feedbackLabel = document.createElement("label");
  feedbackLabel.textContent = "Additional context or feedback";
  feedbackLabel.htmlFor = "feedback";

  const feedbackInput = document.createElement("textarea");
  feedbackInput.id = "feedback";
  feedbackInput.rows = 4;

  const actionBar = document.createElement("nav");

  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.textContent = "Submit";

  const statusEl = document.createElement("p");
  statusEl.id = "submit-status";

  const disclaimer = document.createElement("p");
  disclaimer.innerHTML =
    'Submitting sends this data to our servers and is subject to our <a href="https://example.com/privacy" target="_blank" rel="noopener noreferrer">privacy policy</a>.';

  submitBtn.addEventListener("click", () => {
    const payload = {
      version: config?.version,
      reason,
      log: clickLog,
      notes: stepNotes,
      feedback: feedbackInput.value,
    };
    statusEl.textContent = "Submitting...";
    fetch(SUBMIT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Submission failed");
        }
        statusEl.textContent = "Submitted. Thank you.";
      })
      .catch(() => {
        statusEl.textContent = "Submission failed. Please try again later.";
      });
  });

  actionBar.append(submitBtn);

  summaryEl.append(
    title,
    description,
    logTable,
    feedbackLabel,
    feedbackInput,
    actionBar,
    statusEl,
    disclaimer
  );
  if (isChatLayout()) {
    if (chatCurrentEl) {
      chatCurrentEl.hidden = true;
    }
    if (navEl) {
      navEl.hidden = true;
    }
    scrollChatToBottom();
    return;
  }
  setSummaryVisibility(true);
}

function init() {
  clickLog = [];
  const shouldCollapseOverview = window.matchMedia("(max-width: 900px)").matches;
  setOverviewCollapsed(shouldCollapseOverview);
  setupKeyboardAvoidance();
  fetchJson("content/versions.json")
    .then((versions) => {
      ensureVersionPicker();
      updateVersionOptions(versions);
      const requested = getVersionParam();
      const version = resolveVersion(versions, requested);
      if (versionSelectEl) {
        versionSelectEl.value = version;
      }
      attachEvents();
      return loadVersion(version, !requested);
    })
    .catch((err) => {
      stepsEl.textContent = "Failed to load onboarding content.";
      console.error(err);
    });
}

init();

function resetHelpState() {
  helpEl.hidden = true;
  videoEl.innerHTML = "";
  helpToggleEl.textContent = HELP_INITIAL_LABEL;
}
