const stepsEl = document.getElementById("steps");
const contentEl = document.getElementById("content");
let versionPickerEl = document.getElementById("version-picker");
let versionSelectEl = document.getElementById("version-select");
const wizardTitleEl = document.getElementById("wizard-title");
const stepTitleEl = document.getElementById("step-title");
const stepTextEl = document.getElementById("step-text");
const stepLinkEl = document.getElementById("step-link");
const helpToggleEl = document.getElementById("help-toggle");
const helpEl = document.getElementById("help");
const videoEl = document.getElementById("video");
const supportLinkEl = document.getElementById("support-link");
const backBtn = document.getElementById("back");
const nextBtn = document.getElementById("next");

const SUBMIT_ENDPOINT = "https://example.com/api/onboarding-feedback";
const HELP_INITIAL_LABEL = "I encountered a problem and need help";
const HELP_CRITICAL_LABEL =
  "I still have a critical problem and need to book a support call";

let config = null;
let currentStepIndex = 0;
let eventsAttached = false;
let clickLog = [];
let isFinished = false;

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
        return;
      }
      currentStepIndex = index;
      logClick("Step selected");
      render();
    });
    stepsEl.appendChild(item);
  });
}

function renderStepContent(step) {
  wizardTitleEl.textContent = config.title || "Gnosis VPN Setup";
  stepTitleEl.textContent = step.title;
  stepTextEl.textContent = step.text || "";

  if (step.link && step.link.url) {
    stepLinkEl.href = step.link.url;
    stepLinkEl.textContent = step.link.label || "Open link";
    stepLinkEl.hidden = false;
  } else {
    stepLinkEl.hidden = true;
  }

  resetHelpState();

  if (step.help && step.help.support_url) {
    supportLinkEl.href = step.help.support_url;
    supportLinkEl.hidden = false;
  } else {
    supportLinkEl.hidden = true;
  }

  backBtn.disabled = currentStepIndex === 0;
  nextBtn.disabled = currentStepIndex >= config.steps.length && isFinished;
}

function render() {
  if (isFinished) {
    return;
  }
  renderSteps();
  renderStepContent(config.steps[currentStepIndex]);
}

function attachEvents() {
  if (eventsAttached) {
    return;
  }
  eventsAttached = true;
  backBtn.addEventListener("click", () => {
    if (currentStepIndex > 0 && !isFinished) {
      logClick(backBtn.textContent);
      currentStepIndex -= 1;
      render();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (isFinished) {
      return;
    }
    logClick(nextBtn.textContent);
    if (currentStepIndex >= config.steps.length - 1) {
      finishWizard("completed");
      return;
    }
    currentStepIndex += 1;
    render();
  });

  helpToggleEl.addEventListener("click", () => {
    if (!config || isFinished) {
      return;
    }
    logClick(helpToggleEl.textContent);
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
      return;
    }
    finishWizard("critical_problem");
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

  const summary = document.createElement("section");
  const title = document.createElement("h2");
  title.textContent = "Onboarding summary";

  const description = document.createElement("p");
  description.textContent =
    "Thanks for completing the flow. The log below will be submitted if you choose to send it.";

  const logOutput = document.createElement("pre");
  logOutput.textContent = JSON.stringify(clickLog, null, 2);

  const feedbackLabel = document.createElement("label");
  feedbackLabel.textContent = "Additional context or feedback";
  feedbackLabel.htmlFor = "feedback";

  const feedbackInput = document.createElement("textarea");
  feedbackInput.id = "feedback";
  feedbackInput.rows = 4;

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

  summary.append(
    title,
    description,
    logOutput,
    feedbackLabel,
    feedbackInput,
    submitBtn,
    statusEl,
    disclaimer
  );

  contentEl.innerHTML = "";
  contentEl.appendChild(summary);
}

function init() {
  clickLog = [];
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
