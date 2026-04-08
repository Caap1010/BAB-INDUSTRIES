(() => {
    const now = new Date();
    const footerYearNodes = document.querySelectorAll("[data-current-year]");
    footerYearNodes.forEach((node) => {
        node.textContent = String(now.getFullYear());
    });
})();

(() => {
    const timerRoot = document.querySelector("[data-focus-timer]");
    if (!timerRoot) {
        return;
    }

    const display = timerRoot.querySelector("[data-timer-display]");
    const reminder = timerRoot.querySelector("[data-timer-reminder]");
    const pauseButton = timerRoot.querySelector("[data-timer-pause]");
    const resetButton = timerRoot.querySelector("[data-timer-reset]");
    const autoToggle = document.getElementById("auto-finish-toggle");
    const autoFinishForm = document.getElementById("auto-finish-form");

    const storageEndKey = "micro_tasking_focus_end";
    const storageTaskKey = "micro_tasking_focus_task";

    const defaultMinutes = Number.parseInt(timerRoot.dataset.focusMinutes || "25", 10) || 25;
    const suggestedTaskId = String(timerRoot.dataset.suggestedTaskId || "").trim();
    const startedFromServer = timerRoot.dataset.focusStarted === "1";
    const defaultSeconds = defaultMinutes * 60;

    let pausedSeconds = 0;
    let autoSubmitDone = false;
    let endTimestamp = Number.parseInt(localStorage.getItem(storageEndKey) || "0", 10) || 0;

    const formatTime = (seconds) => {
        const safe = Math.max(0, seconds);
        const mins = Math.floor(safe / 60)
            .toString()
            .padStart(2, "0");
        const secs = (safe % 60).toString().padStart(2, "0");
        return `${mins}:${secs}`;
    };

    const render = (seconds) => {
        if (display) {
            display.textContent = formatTime(seconds);
        }
    };

    const currentRemaining = () => {
        if (pausedSeconds > 0) {
            return pausedSeconds;
        }
        if (endTimestamp > 0) {
            return Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000));
        }
        return defaultSeconds;
    };

    const setReminder = (text) => {
        if (reminder) {
            reminder.textContent = text;
        }
    };

    const persistEnd = () => {
        if (endTimestamp > 0) {
            localStorage.setItem(storageEndKey, String(endTimestamp));
            if (suggestedTaskId) {
                localStorage.setItem(storageTaskKey, suggestedTaskId);
            }
        } else {
            localStorage.removeItem(storageEndKey);
            localStorage.removeItem(storageTaskKey);
        }
    };

    const markComplete = () => {
        endTimestamp = 0;
        pausedSeconds = 0;
        persistEnd();
        render(0);
        setReminder("Focus session complete. Review and submit the task if it is genuinely finished.");

        const canAutoSubmit =
            Boolean(autoToggle && autoToggle.checked) &&
            Boolean(autoFinishForm) &&
            Boolean(suggestedTaskId) &&
            !autoSubmitDone;

        if (canAutoSubmit) {
            autoSubmitDone = true;
            autoFinishForm.submit();
        }
    };

    if (startedFromServer) {
        endTimestamp = Date.now() + defaultSeconds * 1000;
        pausedSeconds = 0;
        autoSubmitDone = false;
        persistEnd();
        setReminder("Focus timer started. Keep one tab, one task, one outcome.");
    }

    const tick = () => {
        const remaining = currentRemaining();
        render(remaining);

        if (endTimestamp > 0 && remaining > 0 && remaining % 300 === 0) {
            setReminder(`Stay focused: ${formatTime(remaining)} remaining.`);
        }

        if (endTimestamp > 0 && remaining === 0) {
            markComplete();
        }
    };

    if (pauseButton) {
        pauseButton.addEventListener("click", () => {
            if (endTimestamp > 0) {
                pausedSeconds = currentRemaining();
                endTimestamp = 0;
                persistEnd();
                pauseButton.textContent = "Resume";
                setReminder("Timer paused. Resume when you are ready to continue.");
                render(pausedSeconds);
                return;
            }

            if (pausedSeconds > 0) {
                endTimestamp = Date.now() + pausedSeconds * 1000;
                pausedSeconds = 0;
                persistEnd();
                pauseButton.textContent = "Pause";
                setReminder("Timer resumed. Keep momentum.");
            }
        });
    }

    if (resetButton) {
        resetButton.addEventListener("click", () => {
            pausedSeconds = 0;
            endTimestamp = Date.now() + defaultSeconds * 1000;
            autoSubmitDone = false;
            persistEnd();
            if (pauseButton) {
                pauseButton.textContent = "Pause";
            }
            setReminder("Timer reset for a fresh focus block.");
            tick();
        });
    }

    if (pauseButton && endTimestamp === 0 && pausedSeconds > 0) {
        pauseButton.textContent = "Resume";
    }

    tick();
    setInterval(tick, 1000);
})();
