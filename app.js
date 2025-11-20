/**
 * Main Application Logic
 *
 * Coordinates all components and handles the breathing training flow.
 */

import { builtInRoutines, routineCombos } from './routines.js';
import { initializeFirebase, loadCustomRoutines, saveCustomRoutine, deleteCustomRoutine, saveTrainingHistory, loadTrainingHistory, deleteHistoryEntry } from './firebase-config.js';
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
let isPaused = false;
let pausedTime = 0; // Time spent paused (to adjust start times)
let pauseStartTime = 0; // When pause started
let currentRoutine = null;
let currentCombo = null;
let comboRoutineIndex = 0;
let comboStartTime = 0; // Start time for entire combo
let routineStartTime = 0; // Start time for current routine in combo
let totalDurationSeconds = 0;
let startTime = 0;
let animationFrameId;
let currentScreen = 'routines';
let currentPhase;
let phaseStartTime;
let allAvailableRoutines = []; // Store all routines (built-in + custom) for combo lookups

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
            session.timestamp,
            session.id
        );
        historyList.appendChild(item);

        // Add delete button handler
        const deleteBtn = item.querySelector('.delete-history-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleDeleteHistory(session.id, session.routineName);
            });
        }
    });
}

/**
 * Start countdown before training begins
 */
function startCountdown(routine, combo = null) {
    if (isTrainingRunning) return;
    currentRoutine = routine;
    currentCombo = combo;
    comboRoutineIndex = combo ? 0 : -1;
    // Don't set comboStartTime here - set it when runTraining() actually starts
    isTrainingRunning = true;

    uiElements.mainScreen.classList.add('hidden');
    uiElements.historyScreen.classList.add('hidden');
    uiElements.trainingScreen.classList.remove('hidden');

    const displayName = combo ? `${combo.name} - ${routine.name}` : routine.name;
    uiElements.instructionText.textContent = `Get Ready: ${displayName}`;

    uiElements.progressBar.style.width = '0%';
    // Reset progress bar styling
    const container = uiElements.progressBar.parentElement;
    if (container) {
        container.style.background = '#374151'; // gray-700 default
        // Remove progress indicator if it exists
        const indicator = container.querySelector('.progress-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    uiElements.progressBar.style.background = '#6366f1'; // indigo-500 default

    resetCircleVisuals();
    uiElements.breathingCircle.style.transform = 'scale(0.5)';

    // Initialize audio context early with user interaction
    if (typeof Tone !== 'undefined') {
        Tone.start().catch(err => console.error('Tone.start error:', err));
    }

    let countdown = 3;
    uiElements.instructionText.textContent = `STARTING IN ${countdown}...`;
    playSound('start').catch(err => console.error('Sound error:', err));

    const interval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            uiElements.instructionText.textContent = `STARTING IN ${countdown}...`;
            playSound('start').catch(err => console.error('Sound error:', err));
        } else {
            clearInterval(interval);
            runTraining();
        }
    }, 1000);
}

/**
 * Start next routine in a combo sequence
 */
function startNextComboRoutine() {
    if (!currentCombo || comboRoutineIndex >= currentCombo.routines.length - 1) {
        stopTraining(true);
        return;
    }

    comboRoutineIndex++;
    const nextRoutineId = currentCombo.routines[comboRoutineIndex];

    // Find the routine from all available routines (built-in + custom)
    const nextRoutine = allAvailableRoutines.find(r => r.id === nextRoutineId);

    if (!nextRoutine) {
        console.error("Routine not found:", nextRoutineId);
        stopTraining(false);
        return;
    }

    // Play transition sound
    if (currentCombo.transitionSound) {
        playSound(currentCombo.transitionSound).catch(err => console.error('Sound error:', err));
    }

    // Update display
    uiElements.instructionText.textContent = `Transitioning to: ${nextRoutine.name}`;

    // Small pause before starting next routine
    setTimeout(() => {
        currentRoutine = nextRoutine;
        routineStartTime = Date.now(); // Reset routine start time
        // Progress bar gradient already set, just continue

        // Reset phase tracking
        const phaseLabels = currentRoutine.phaseLabels || {};
        const phases = [
            { name: "BREATH IN", key: 'in', duration: currentRoutine.inhale },
            { name: phaseLabels.holdIn || "HOLD", key: 'holdIn', duration: currentRoutine.holdIn },
            { name: "BREATH OUT", key: 'out', duration: currentRoutine.exhale },
            { name: "HOLD OUT", key: 'holdOut', duration: currentRoutine.holdOut }
        ].filter(p => p.duration > 0);

        transitionToFirstPhase(phases);

        // Continue the update loop
        const updateLoop = (timestamp) => {
            if (!isTrainingRunning || isPaused) {
                if (isPaused) {
                    // Keep requesting animation frames while paused so we can resume
                    animationFrameId = requestAnimationFrame(updateLoop);
                }
                return;
            }

            const timeSinceLastPhase = (Date.now() - phaseStartTime) / 1000;

            if (timeSinceLastPhase >= phases[currentPhase].duration) {
                phaseStartTime = Date.now();

                currentPhase = (currentPhase + 1) % phases.length;

                const nextPhase = phases[currentPhase];
                uiElements.instructionText.textContent = nextPhase.name;
                playSound(nextPhase.key, nextPhase.duration).catch(err => console.error('Sound error:', err));

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

            const elapsedTotalTime = comboStartTime ? (Date.now() - comboStartTime) / 1000 : 0;
            const elapsedRoutineTime = (Date.now() - routineStartTime) / 1000;
            const routineDuration = currentRoutine.durationMinutes * 60;

            updateProgressBar(elapsedTotalTime, elapsedRoutineTime);

            // Check if current routine is complete
            if (elapsedRoutineTime >= routineDuration) {
                const remainingTimeInCurrentPhase = phases[currentPhase].duration - timeSinceLastPhase;
                if (remainingTimeInCurrentPhase <= 0) {
                    // Check if more routines in combo
                    if (comboRoutineIndex < currentCombo.routines.length - 1) {
                        startNextComboRoutine();
                        return;
                    } else {
                        stopTraining(true);
                        return;
                    }
                }
            }

            animationFrameId = requestAnimationFrame(updateLoop);
        };

        animationFrameId = requestAnimationFrame(updateLoop);
    }, 2000); // 2 second pause between routines
}

/**
 * Initialize progress bar gradient for combos
 */
function initializeComboProgressBar() {
    const container = uiElements.progressBar.parentElement;

    if (!currentCombo || currentCombo.routines.length <= 1) {
        // Reset to single color for non-combo
        if (container) {
            container.style.background = '#374151'; // gray-700
        }
        uiElements.progressBar.style.background = '#6366f1'; // indigo-500
        return;
    }

    const routineDurations = currentCombo.routines.map(routineId => {
        const routine = allAvailableRoutines.find(r => r.id === routineId);
        return routine ? routine.durationMinutes * 60 : 0;
    });

    const totalDuration = routineDurations.reduce((sum, d) => sum + d, 0);
    let cumulativePercent = 0;
    const colorStops = [];

    // Define colors for each routine segment
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b']; // indigo, purple, pink, amber

    routineDurations.forEach((duration, index) => {
        const percent = (duration / totalDuration) * 100;
        cumulativePercent += percent;
        colorStops.push(`${colors[index % colors.length]} ${cumulativePercent - percent}%`);
        colorStops.push(`${colors[index % colors.length]} ${cumulativePercent}%`);
    });

    // Set gradient background on the CONTAINER so full gradient is always visible
    if (container) {
        container.style.background = `linear-gradient(to right, ${colorStops.join(', ')})`;
        container.style.backgroundSize = '100% 100%';
        container.style.position = 'relative'; // For progress indicator
    }

    // Progress bar filled portion will be set dynamically based on current routine
    // Don't set gradient here - it will be set in updateProgressBar based on current routine
    uiElements.progressBar.style.background = colors[0]; // Default to first color

    // Add progress indicator (vertical line showing current position)
    let indicator = container.querySelector('.progress-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'progress-indicator';
        indicator.style.cssText = 'position: absolute; top: 0; width: 2px; height: 100%; background: white; box-shadow: 0 0 4px rgba(255,255,255,0.8); z-index: 10; pointer-events: none;';
        container.appendChild(indicator);
    }
}

/**
 * Update progress bar with multi-color support for combos
 */
function updateProgressBar(elapsedTotalTime, elapsedRoutineTime) {
    const progressPercent = Math.min((elapsedTotalTime / totalDurationSeconds) * 100, 100);

    // For combos, create a gradient that shows completed routines' colors
    if (currentCombo && currentCombo.routines.length > 1) {
        const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b']; // indigo, purple, pink, amber

        // Calculate routine durations and boundaries
        const routineDurations = currentCombo.routines.map(routineId => {
            const routine = allAvailableRoutines.find(r => r.id === routineId);
            return routine ? routine.durationMinutes * 60 : 0;
        });

        const totalDuration = routineDurations.reduce((sum, d) => sum + d, 0);
        const filledColorStops = [];
        let cumulativePercent = 0;

        // Build gradient for filled portion up to current progress
        for (let i = 0; i <= comboRoutineIndex; i++) {
            const routinePercent = (routineDurations[i] / totalDuration) * 100;
            const routineStartPercent = cumulativePercent;
            const routineEndPercent = Math.min(cumulativePercent + routinePercent, progressPercent);

            if (routineEndPercent > routineStartPercent) {
                const routineColor = colors[i % colors.length];
                // If this is the current routine and we're partway through it
                if (i === comboRoutineIndex && routineEndPercent < cumulativePercent + routinePercent) {
                    // Current routine - use its color up to current progress
                    filledColorStops.push(`${routineColor} ${routineStartPercent}%`);
                    filledColorStops.push(`${routineColor} ${routineEndPercent}%`);
                } else if (i < comboRoutineIndex) {
                    // Completed routine - use its full color
                    filledColorStops.push(`${routineColor} ${routineStartPercent}%`);
                    filledColorStops.push(`${routineColor} ${routineEndPercent}%`);
                } else {
                    // Current routine, fully completed
                    filledColorStops.push(`${routineColor} ${routineStartPercent}%`);
                    filledColorStops.push(`${routineColor} ${routineEndPercent}%`);
                }
            }

            cumulativePercent += routinePercent;
            if (cumulativePercent >= progressPercent) break;
        }

        // Set gradient background for filled portion
        if (filledColorStops.length > 0) {
            uiElements.progressBar.style.background = `linear-gradient(to right, ${filledColorStops.join(', ')})`;
        } else {
            // Fallback to current routine color
            uiElements.progressBar.style.background = colors[comboRoutineIndex % colors.length];
        }
    }

    // Update width
    uiElements.progressBar.style.width = `${progressPercent}%`;

    // Update progress indicator position (vertical line showing current position)
    const container = uiElements.progressBar.parentElement;
    if (container) {
        let indicator = container.querySelector('.progress-indicator');
        if (indicator) {
            indicator.style.left = `${progressPercent}%`;
        }
    }
}

/**
 * Transition to the first breathing phase
 */
function transitionToFirstPhase(phases) {
    const firstPhase = phases[0];
    uiElements.instructionText.textContent = firstPhase.name;
    playSound(firstPhase.key, firstPhase.duration).catch(err => console.error('Sound error:', err));

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
    routineStartTime = Date.now(); // Track when current routine started
    comboStartTime = currentCombo ? Date.now() : null; // Set combo start time when training actually starts

    // Calculate total duration: if combo, sum all routines; otherwise just current routine
    if (currentCombo) {
        totalDurationSeconds = currentCombo.routines.reduce((total, routineId) => {
            const routine = allAvailableRoutines.find(r => r.id === routineId);
            return total + (routine ? routine.durationMinutes * 60 : 0);
        }, 0);
        // Initialize progress bar gradient for combo
        initializeComboProgressBar();
    } else {
        totalDurationSeconds = currentRoutine.durationMinutes * 60;
        // Reset to single color for non-combo
        const container = uiElements.progressBar.parentElement;
        if (container) {
            container.style.background = '#374151'; // gray-700
        }
        uiElements.progressBar.style.background = '#6366f1';
    }

    let elapsedTotalTime = 0;

    // Get phase labels from routine (for custom labels like "TOP-UP INHALE")
    const phaseLabels = currentRoutine.phaseLabels || {};

    const phases = [
        { name: "BREATH IN", key: 'in', duration: currentRoutine.inhale },
        { name: phaseLabels.holdIn || "HOLD", key: 'holdIn', duration: currentRoutine.holdIn },
        { name: "BREATH OUT", key: 'out', duration: currentRoutine.exhale },
        { name: "HOLD OUT", key: 'holdOut', duration: currentRoutine.holdOut }
    ].filter(p => p.duration > 0);

    transitionToFirstPhase(phases);

    const updateLoop = (timestamp) => {
        if (!isTrainingRunning || isPaused) {
            if (isPaused) {
                // Keep requesting animation frames while paused so we can resume
                animationFrameId = requestAnimationFrame(updateLoop);
            }
            return;
        }

        const timeSinceLastPhase = (Date.now() - phaseStartTime) / 1000;

        if (timeSinceLastPhase >= phases[currentPhase].duration) {
            phaseStartTime = Date.now();

            currentPhase = (currentPhase + 1) % phases.length;

            const nextPhase = phases[currentPhase];
            uiElements.instructionText.textContent = nextPhase.name;
            playSound(nextPhase.key, nextPhase.duration).catch(err => console.error('Sound error:', err));

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

        // Calculate elapsed time: for combos, use combo start time; otherwise use routine start time
        // Subtract paused time to account for pauses
        const currentPausedTime = isPaused ? pausedTime + ((Date.now() - pauseStartTime) / 1000) : pausedTime;
        const elapsedTotalTime = currentCombo && comboStartTime
            ? ((Date.now() - comboStartTime) / 1000) - currentPausedTime
            : ((Date.now() - startTime) / 1000) - currentPausedTime;
        const elapsedRoutineTime = ((Date.now() - routineStartTime) / 1000) - currentPausedTime;
        const routineDuration = currentRoutine.durationMinutes * 60;

        // Update progress bar with multi-color support for combos
        updateProgressBar(elapsedTotalTime, elapsedRoutineTime);

        // Check if current routine in combo is complete
        if (currentCombo && elapsedRoutineTime >= routineDuration) {
            const remainingTimeInCurrentPhase = phases[currentPhase].duration - timeSinceLastPhase;
            if (remainingTimeInCurrentPhase <= 0) {
                // Move to next routine in combo
                if (comboRoutineIndex < currentCombo.routines.length - 1) {
                    startNextComboRoutine();
                    return;
                } else {
                    stopTraining(true);
                    return;
                }
            }
        } else if (!currentCombo && elapsedTotalTime >= totalDurationSeconds) {
            const remainingTimeInCurrentPhase = phases[currentPhase].duration - timeSinceLastPhase;
            if (remainingTimeInCurrentPhase <= 0) {
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
        // Calculate actual duration accounting for paused time
        const finalPausedTime = isPaused ? pausedTime + ((Date.now() - pauseStartTime) / 1000) : pausedTime;
        const actualDurationSeconds = ((Date.now() - startTime) / 1000) - finalPausedTime;
        const totalTargetSeconds = currentRoutine.durationMinutes * 60;

        console.log("Attempting to save history:", {
            routineName: currentRoutine.name,
            actualDuration: actualDurationSeconds,
            targetDuration: totalTargetSeconds,
            completed: completed
        });

        if (actualDurationSeconds > 5) {
            // Use combo name if it's a combo, otherwise use routine name
            const historyName = currentCombo ? currentCombo.name : currentRoutine.name;
            const historyTargetSeconds = currentCombo
                ? totalDurationSeconds
                : totalTargetSeconds;

            saveTrainingHistory(
                historyName,
                actualDurationSeconds,
                historyTargetSeconds,
                completed
            ).then(result => {
                console.log("Save history result:", result);
                if (result.success) {
                    console.log("✅ History saved successfully!");
                } else {
                    console.error("❌ Failed to save history:", result.error);
                }
            }).catch(error => {
                console.error("❌ Error saving history:", error);
            });
        } else {
            console.log("Skipping history save - duration too short:", actualDurationSeconds);
        }
    }

    resetCircleVisuals();
    uiElements.breathingCircle.style.transform = 'scale(0.5)';
    uiElements.breathingCircle.style.transitionDuration = '0s';

    if (completed) {
        uiElements.instructionText.textContent = "TRAINING COMPLETE!";
        playSound('finish');
    }

    // Reset pause state
    isPaused = false;
    pausedTime = 0;
    pauseStartTime = 0;

    // Immediately return to routines screen
    uiElements.trainingScreen.classList.add('hidden');
    if (currentScreen === 'history') {
        switchTab('history');
    } else {
        switchTab('routines');
    }

    // Reset button states
    document.getElementById('stop-btn').classList.remove('hidden');
    document.getElementById('pause-btn').classList.remove('hidden');
    document.getElementById('resume-btn').classList.add('hidden');
    document.getElementById('back-btn').classList.add('hidden');
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
 * Handle pausing training
 */
function pauseTraining() {
    console.log('pauseTraining called', { isTrainingRunning, isPaused });
    if (!isTrainingRunning || isPaused) {
        console.log('Cannot pause:', { isTrainingRunning, isPaused });
        return;
    }

    isPaused = true;
    pauseStartTime = Date.now();
    console.log('Training paused at:', pauseStartTime);
    uiElements.instructionText.textContent = "PAUSED";

    // Hide pause button, show resume button
    const pauseBtn = document.getElementById('pause-btn');
    const resumeBtn = document.getElementById('resume-btn');
    if (pauseBtn) pauseBtn.classList.add('hidden');
    if (resumeBtn) resumeBtn.classList.remove('hidden');
    console.log('Pause button hidden, resume button shown');
}

/**
 * Handle resuming training
 */
function resumeTraining() {
    console.log('resumeTraining called', { isTrainingRunning, isPaused });
    if (!isTrainingRunning || !isPaused) {
        console.log('Cannot resume:', { isTrainingRunning, isPaused });
        return;
    }

    // Add the paused time to our total paused time
    const pauseDuration = (Date.now() - pauseStartTime) / 1000;
    pausedTime += pauseDuration;
    isPaused = false;
    console.log('Training resumed. Pause duration:', pauseDuration, 'Total paused time:', pausedTime);

    // Hide resume button, show pause button
    const resumeBtn = document.getElementById('resume-btn');
    const pauseBtn = document.getElementById('pause-btn');
    if (resumeBtn) resumeBtn.classList.add('hidden');
    if (pauseBtn) pauseBtn.classList.remove('hidden');

    // Restore instruction text
    const phaseLabels = currentRoutine.phaseLabels || {};
    const phases = [
        { name: "BREATH IN", key: 'in', duration: currentRoutine.inhale },
        { name: phaseLabels.holdIn || "HOLD", key: 'holdIn', duration: currentRoutine.holdIn },
        { name: "BREATH OUT", key: 'out', duration: currentRoutine.exhale },
        { name: "HOLD OUT", key: 'holdOut', duration: currentRoutine.holdOut }
    ].filter(p => p.duration > 0);

    uiElements.instructionText.textContent = phases[currentPhase].name;
}

/**
 * Handle deleting a history entry
 */
function handleDeleteHistory(id, name) {
    if (confirm(`Delete training session: ${name}?`)) {
        deleteHistoryEntry(id).then(result => {
            if (result.success) {
                showCustomMessage("History entry deleted successfully!", "green");
            } else {
                showCustomMessage("Failed to delete history entry.", "red");
            }
        });
    }
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
    document.getElementById('pause-btn').classList.remove('hidden');
    document.getElementById('resume-btn').classList.add('hidden');
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

    const pauseBtn = document.getElementById('pause-btn');
    const resumeBtn = document.getElementById('resume-btn');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            console.log('Pause button clicked');
            pauseTraining();
        });
    } else {
        console.error('Pause button not found!');
    }
    if (resumeBtn) {
        resumeBtn.addEventListener('click', () => {
            console.log('Resume button clicked');
            resumeTraining();
        });
    } else {
        console.error('Resume button not found!');
    }

    document.getElementById('back-btn').addEventListener('click', handleBackToMain);
    uiElements.customRoutineForm.addEventListener('submit', handleCreateRoutine);

    // Initialize Firebase
    const firebaseResult = await initializeFirebase();

    if (firebaseResult.success) {
        // Load custom routines with real-time updates (wait for auth)
        loadCustomRoutines((customRoutines) => {
            allAvailableRoutines = [...builtInRoutines, ...customRoutines];
            renderRoutineSelector(
                allAvailableRoutines,
                routineCombos,
                startCountdown,
                handleDelete
            );

            uiElements.loadingState.classList.add('hidden');
            uiElements.appContent.classList.remove('hidden');
            uiElements.userIdDisplay.textContent = `Sync Status: Cloud Connected (Public Data)`;
        }).catch(error => {
            console.error("Error loading routines:", error);
            // Fallback to built-in routines if load fails
            allAvailableRoutines = [...builtInRoutines];
            renderRoutineSelector(
                allAvailableRoutines,
                routineCombos,
                startCountdown,
                handleDelete
            );
            uiElements.loadingState.classList.add('hidden');
            uiElements.appContent.classList.remove('hidden');
            uiElements.userIdDisplay.textContent = 'Sync Status: Using built-in routines only';
        });
    } else {
        // Fallback to built-in routines only
        allAvailableRoutines = [...builtInRoutines];
        renderRoutineSelector(
            allAvailableRoutines,
            routineCombos,
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
