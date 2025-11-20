/**
 * Main Application Logic
 *
 * Coordinates all components and handles the breathing training flow.
 */

import { builtInRoutines } from './routines.js';
import { initializeFirebase, loadCustomRoutines, saveCustomRoutine, deleteCustomRoutine, saveTrainingHistory, loadTrainingHistory } from './firebase-config.js';
import { playSound } from './audio.js';
import {
    renderRoutineSelector,
    showCustomMessage,
    resetCircleVisuals,
    transitionCircle,
    createHistoryItem,
    getUIElements
} from './ui.js';

// Application state
let isTrainingRunning = false;
let currentRoutine = null;
let totalDurationSeconds = 0;
let startTime = 0;
let animationFrameId;
let currentScreen = 'routines';
let currentPhase;
let phaseStartTime;

const uiElements = getUIElements();

/**
 * Switch between tabs (routines/history)
 */
function switchTab(tabName) {
    currentScreen = tabName;

    uiElements.routinesTabBtn.classList.remove('tab-active');
    uiElements.historyTabBtn.classList.remove('tab-active');

    uiElements.mainScreen.classList.add('hidden');
    uiElements.historyScreen.classList.add('hidden');

    if (tabName === 'routines') {
        uiElements.routinesTabBtn.classList.add('tab-active');
        uiElements.mainScreen.classList.remove('hidden');
    } else if (tabName === 'history') {
        uiElements.historyTabBtn.classList.add('tab-active');
        uiElements.historyScreen.classList.remove('hidden');
        loadTrainingHistory((sessions) => {
            renderHistory(sessions);
        }).catch(error => {
            console.error("Error loading history:", error);
            renderHistory([]);
        });
    }
}

/**
 * Render training history
 */
function renderHistory(sessions) {
    const historyList = uiElements.historyList;
    if (!historyList) return;

    historyList.innerHTML = '';

    if (sessions.length === 0) {
        historyList.innerHTML = '<p class="text-center text-gray-500 mt-8">No training sessions recorded yet.</p>';
        return;
    }

    sessions.forEach((session) => {
        const item = createHistoryItem(
            session.routineName,
            session.actualDurationSeconds,
            session.totalTargetSeconds,
            session.completed,
            session.timestamp
        );
        historyList.appendChild(item);
    });
}

/**
 * Start countdown before training begins
 */
function startCountdown(routine) {
    if (isTrainingRunning) return;
    currentRoutine = routine;
    isTrainingRunning = true;

    uiElements.mainScreen.classList.add('hidden');
    uiElements.historyScreen.classList.add('hidden');
    uiElements.trainingScreen.classList.remove('hidden');

    uiElements.instructionText.textContent = `Get Ready: ${routine.name}`;

    uiElements.progressBar.style.width = '0%';

    resetCircleVisuals();
    uiElements.breathingCircle.style.transform = 'scale(0.5)';

    let countdown = 3;
    uiElements.instructionText.textContent = `STARTING IN ${countdown}...`;
    playSound('start');

    const interval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            uiElements.instructionText.textContent = `STARTING IN ${countdown}...`;
            playSound('start');
        } else {
            clearInterval(interval);
            runTraining();
        }
    }, 1000);
}

/**
 * Transition to the first breathing phase
 */
function transitionToFirstPhase(phases) {
    const firstPhase = phases[0];
    uiElements.instructionText.textContent = firstPhase.name;
    playSound(firstPhase.key, firstPhase.duration);

    const duration = firstPhase.duration;

    if (firstPhase.key === 'in') {
        transitionCircle(1.0, duration);
    }
    else if (firstPhase.key === 'holdIn') {
        transitionCircle(1.0, 0.1);
    }
    else if (firstPhase.key === 'out') {
        transitionCircle(0.5, duration);
    }
    else if (firstPhase.key === 'holdOut') {
        transitionCircle(0.5, 0.1);
    }

    currentPhase = 0;
    phaseStartTime = Date.now();
}

/**
 * Run the breathing training
 */
function runTraining() {
    startTime = Date.now();
    totalDurationSeconds = currentRoutine.durationMinutes * 60;

    let elapsedTotalTime = 0;

    const phases = [
        { name: "BREATH IN", key: 'in', duration: currentRoutine.inhale },
        { name: "HOLD", key: 'holdIn', duration: currentRoutine.holdIn },
        { name: "BREATH OUT", key: 'out', duration: currentRoutine.exhale },
        { name: "HOLD OUT", key: 'holdOut', duration: currentRoutine.holdOut }
    ].filter(p => p.duration > 0);

    transitionToFirstPhase(phases);

    const updateLoop = (timestamp) => {
        if (!isTrainingRunning) return;

        const timeSinceLastPhase = (Date.now() - phaseStartTime) / 1000;

        if (timeSinceLastPhase >= phases[currentPhase].duration) {
            phaseStartTime = Date.now();

            currentPhase = (currentPhase + 1) % phases.length;

            const nextPhase = phases[currentPhase];
            uiElements.instructionText.textContent = nextPhase.name;
            playSound(nextPhase.key, nextPhase.duration);

            const duration = nextPhase.duration;
            if (nextPhase.key === 'in') {
                transitionCircle(1.0, duration);
            } else if (nextPhase.key === 'holdIn') {
                transitionCircle(1.0, 0.1);
            } else if (nextPhase.key === 'out') {
                transitionCircle(0.5, duration);
            } else if (nextPhase.key === 'holdOut') {
                transitionCircle(0.5, 0.1);
            }
        }

        elapsedTotalTime = (Date.now() - startTime) / 1000;
        uiElements.progressBar.style.width = `${(elapsedTotalTime / totalDurationSeconds) * 100}%`;

        if (elapsedTotalTime >= totalDurationSeconds) {
            const remainingTimeInCurrentPhase = phases[currentPhase].duration - timeSinceLastPhase;

            if (elapsedTotalTime >= totalDurationSeconds && remainingTimeInCurrentPhase <= 0) {
                stopTraining(true);
                return;
            }
        }

        animationFrameId = requestAnimationFrame(updateLoop);
    };

    animationFrameId = requestAnimationFrame(updateLoop);
}

/**
 * Stop the training session
 */
function stopTraining(completed = false) {
    isTrainingRunning = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    // Save history regardless of completion status
    if (currentRoutine) {
        const actualDurationSeconds = (Date.now() - startTime) / 1000;
        const totalTargetSeconds = currentRoutine.durationMinutes * 60;

        if (actualDurationSeconds > 5) {
            saveTrainingHistory(
                currentRoutine.name,
                actualDurationSeconds,
                totalTargetSeconds,
                completed
            );
        }
    }

    resetCircleVisuals();
    uiElements.breathingCircle.style.transform = 'scale(0.5)';
    uiElements.breathingCircle.style.transitionDuration = '0s';

    if (completed) {
        uiElements.instructionText.textContent = "TRAINING COMPLETE!";
        playSound('finish');
    } else {
        uiElements.instructionText.textContent = "Paused";
    }

    document.getElementById('stop-btn').classList.add('hidden');
    document.getElementById('back-btn').classList.remove('hidden');
}

/**
 * Handle creating a new custom routine
 */
function handleCreateRoutine(event) {
    event.preventDefault();

    const name = document.getElementById('input-name').value.trim();
    const inhale = parseInt(document.getElementById('input-in').value);
    const holdIn = parseInt(document.getElementById('input-hold-in').value);
    const exhale = parseInt(document.getElementById('input-out').value);
    const holdOut = parseInt(document.getElementById('input-hold-out').value);
    const minutes = parseInt(document.getElementById('input-minutes').value);

    if (!name || isNaN(inhale) || isNaN(holdIn) || isNaN(exhale) || isNaN(holdOut) || isNaN(minutes) || minutes < 1 || (inhale + holdIn + exhale + holdOut) === 0) {
        showCustomMessage("Please check all inputs. Name is required, duration must be at least 1 minute, and the total phase time must be greater than zero.", "red");
        return;
    }

    const newRoutine = {
        name: name,
        durationMinutes: minutes,
        inhale: inhale,
        holdIn: holdIn,
        exhale: exhale,
        holdOut: holdOut,
    };

    saveCustomRoutine(newRoutine).then(result => {
        if (result.success) {
            showCustomMessage("Routine saved successfully to cloud (syncing enabled)!", "green");
            uiElements.customRoutineForm.reset();
        } else {
            showCustomMessage("Failed to save routine. Check console for details.", "red");
        }
    });
}

/**
 * Handle deleting a custom routine
 */
function handleDelete(id, name) {
    const deleteModal = document.getElementById('delete-modal');
    document.getElementById('delete-routine-name').textContent = name;
    document.getElementById('confirm-delete-btn').onclick = () => {
        deleteCustomRoutine(id).then(result => {
            if (result.success) {
                showCustomMessage("Routine deleted successfully!", "green");
            } else {
                showCustomMessage("Failed to delete routine.", "red");
            }
        });
        deleteModal.classList.add('hidden');
    };
    document.getElementById('cancel-delete-btn').onclick = () => {
        deleteModal.classList.add('hidden');
    };
    deleteModal.classList.remove('hidden');
}

/**
 * Handle going back to main screen
 */
function handleBackToMain() {
    if (isTrainingRunning) {
        stopTraining(false);
    }

    uiElements.trainingScreen.classList.add('hidden');

    if (currentScreen === 'history') {
        switchTab('history');
    } else {
        switchTab('routines');
    }

    document.getElementById('stop-btn').classList.remove('hidden');
    document.getElementById('back-btn').classList.add('hidden');
}

/**
 * Initialize the application
 */
async function init() {
    // Set up event listeners
    uiElements.routinesTabBtn.addEventListener('click', () => switchTab('routines'));
    uiElements.historyTabBtn.addEventListener('click', () => switchTab('history'));

    document.getElementById('stop-btn').addEventListener('click', () => stopTraining(false));
    document.getElementById('back-btn').addEventListener('click', handleBackToMain);
    uiElements.customRoutineForm.addEventListener('submit', handleCreateRoutine);

    // Initialize Firebase
    const firebaseResult = await initializeFirebase();

    if (firebaseResult.success) {
        // Load custom routines with real-time updates (wait for auth)
        loadCustomRoutines((customRoutines) => {
            const allRoutines = [...builtInRoutines, ...customRoutines];
            renderRoutineSelector(
                allRoutines,
                startCountdown,
                handleDelete
            );

            uiElements.loadingState.classList.add('hidden');
            uiElements.appContent.classList.remove('hidden');
            uiElements.userIdDisplay.textContent = `Sync Status: Cloud Connected (Public Data)`;
        }).catch(error => {
            console.error("Error loading routines:", error);
            // Fallback to built-in routines if load fails
            renderRoutineSelector(
                builtInRoutines,
                startCountdown,
                handleDelete
            );
            uiElements.loadingState.classList.add('hidden');
            uiElements.appContent.classList.remove('hidden');
            uiElements.userIdDisplay.textContent = 'Sync Status: Using built-in routines only';
        });
    } else {
        // Fallback to built-in routines only
        renderRoutineSelector(
            builtInRoutines,
            startCountdown,
            handleDelete
        );
        uiElements.loadingState.classList.add('hidden');
        uiElements.appContent.classList.remove('hidden');
        uiElements.userIdDisplay.textContent = 'Sync Status: Connection Failed. Please check console for details.';
    }

    switchTab('routines');
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
