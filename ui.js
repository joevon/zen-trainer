/**
 * UI Rendering Functions
 *
 * Handles all DOM manipulation and UI updates.
 */

import { builtInRoutines } from './routines.js';

/**
 * Render the routine selector with built-in and custom routines
 */
export function renderRoutineSelector(routines, combos = [], onRoutineSelect, onRoutineDelete) {
    const selector = document.getElementById('routine-selector');
    if (!selector) return;

    selector.innerHTML = '';

    // Combo section (at the top)
    const comboSection = document.createElement('div');
    comboSection.className = 'grid grid-cols-2 md:grid-cols-4 gap-3 mb-6';

    const builtInSection = document.createElement('div');
    builtInSection.className = 'grid grid-cols-2 md:grid-cols-4 gap-3 mb-6';

    const customSection = document.createElement('div');
    customSection.className = 'grid grid-cols-2 md:grid-cols-4 gap-3';

    routines.forEach(routine => {
        const card = document.createElement('div');
        card.className = `p-4 rounded-xl shadow-lg cursor-pointer transition duration-300 transform hover:scale-[1.03] flex flex-col justify-between ${routine.isCustom ? 'bg-gray-700 hover:bg-gray-600' : 'bg-indigo-600 hover:bg-indigo-700'}`;
        card.dataset.routineId = routine.id;

        card.innerHTML = `
            <h3 class="text-lg font-bold text-white mb-1">${routine.name}</h3>
            <p class="text-sm text-indigo-200">${routine.inhale}:${routine.holdIn}:${routine.exhale}:${routine.holdOut}</p>
            <p class="text-xs text-indigo-300">${routine.durationMinutes} min</p>
            ${routine.isCustom ? `<button class="delete-custom-btn mt-2 text-xs text-red-300 hover:text-red-400 self-end" data-id="${routine.id}">Delete</button>` : ''}
        `;

        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('delete-custom-btn')) {
                onRoutineSelect(routine);
            }
        });

        if (routine.isCustom) {
            const deleteBtn = card.querySelector('.delete-custom-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    onRoutineDelete(routine.id, routine.name);
                });
            }
            customSection.appendChild(card);
        } else {
            builtInSection.appendChild(card);
        }
    });

    // Render combos
    combos.forEach(combo => {
        const card = document.createElement('div');
        card.className = 'p-4 rounded-xl shadow-lg cursor-pointer transition duration-300 transform hover:scale-[1.03] flex flex-col justify-between bg-purple-600 hover:bg-purple-700';
        card.dataset.comboId = combo.id;

        const routineNames = combo.routines.map(id => {
            const routine = routines.find(r => r.id === id);
            return routine ? routine.name : id;
        }).join(' + ');

        card.innerHTML = `
            <h3 class="text-lg font-bold text-white mb-1">${combo.name}</h3>
            <p class="text-sm text-purple-200">${routineNames}</p>
            <p class="text-xs text-purple-300">Combo</p>
        `;

        card.addEventListener('click', () => {
            // Find first routine in combo
            const firstRoutineId = combo.routines[0];
            const firstRoutine = routines.find(r => r.id === firstRoutineId);
            if (firstRoutine) {
                onRoutineSelect(firstRoutine, combo);
            }
        });

        comboSection.appendChild(card);
    });

    // Add combo section if there are combos
    if (comboSection.children.length > 0) {
        const comboHeader = document.createElement('h2');
        comboHeader.className = 'text-xl font-semibold mb-3 mt-4 text-indigo-300';
        comboHeader.textContent = 'Routine Combos';
        selector.appendChild(comboHeader);
        selector.appendChild(comboSection);
    }

    const builtInHeader = document.createElement('h2');
    builtInHeader.className = 'text-xl font-semibold mb-3 mt-4 text-indigo-300';
    builtInHeader.textContent = 'Predefined Routines';
    selector.appendChild(builtInHeader);
    selector.appendChild(builtInSection);

    if (customSection.children.length > 0) {
        const customHeader = document.createElement('h2');
        customHeader.className = 'text-xl font-semibold mb-3 mt-6 text-indigo-300';
        customHeader.textContent = 'Your Saved Routines';
        selector.appendChild(customHeader);
        selector.appendChild(customSection);
    }
}

/**
 * Format duration in seconds to readable string
 */
export function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes} min ${remainingSeconds} sec`;
}

/**
 * Create a history item element
 */
export function createHistoryItem(name, actualDuration, totalTarget, completed, timestamp, id) {
    const item = document.createElement('div');
    const bgColor = completed ? 'bg-green-900/20 hover:bg-green-900/30' : 'bg-red-900/20 hover:bg-red-900/30';
    const statusText = completed
        ? '<span class="text-xs font-bold text-green-400">Completed</span>'
        : `<span class="text-xs font-bold text-red-400">Stopped</span>`;

    item.className = `p-4 rounded-lg shadow-md flex justify-between items-center transition duration-200 ${bgColor}`;

    const date = new Date(timestamp);
    const formattedDate = date.toLocaleDateString();
    const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const durationText = completed
        ? formatDuration(actualDuration)
        : `${formatDuration(actualDuration)} / ${formatDuration(totalTarget)}`;

    const durationColor = completed ? 'text-green-300' : 'text-red-300';

    item.innerHTML = `
        <div class="flex-1">
            <p class="text-lg font-semibold text-indigo-300 mb-1">${name}</p>
            <p class="text-xs text-gray-400">
                ${statusText}
                <span class="${durationColor} ml-2">${durationText}</span>
            </p>
        </div>
        <div class="text-right mr-4">
            <p class="text-sm text-gray-300">${formattedDate}</p>
            <p class="text-xs text-gray-400">${formattedTime}</p>
        </div>
        <button class="delete-history-btn px-3 py-1 text-xs text-red-300 hover:text-red-400 hover:bg-red-900/20 rounded transition duration-150" data-id="${id}">
            Delete
        </button>
    `;
    return item;
}

/**
 * Show a notification message
 */
export function showCustomMessage(message, type = "blue") {
    const msgEl = document.getElementById('notification-message');
    if (!msgEl) return;

    msgEl.textContent = message;
    msgEl.className = `p-3 rounded-lg text-sm text-center font-semibold mb-4 w-full
        ${type === 'green' ? 'bg-green-600 text-white' : type === 'red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`;
    msgEl.classList.remove('hidden');
    setTimeout(() => { msgEl.classList.add('hidden'); }, 3000);
}

/**
 * Reset breathing circle visuals
 */
export function resetCircleVisuals() {
    const circle = document.getElementById('breathing-circle');
    if (!circle) return;

    circle.style.transitionDuration = '0s';
    void circle.offsetWidth;
}

/**
 * Transition the breathing circle to a new scale
 */
export function transitionCircle(scaleTarget, duration) {
    const circle = document.getElementById('breathing-circle');
    if (!circle) return;

    requestAnimationFrame(() => {
        circle.style.transitionDuration = '0s';
        requestAnimationFrame(() => {
            circle.style.transitionDuration = `${duration}s`;
            requestAnimationFrame(() => {
                circle.style.transform = `scale(${scaleTarget})`;
            });
        });
    });
}

/**
 * Get UI element references
 */
export function getUIElements() {
    return {
        loadingState: document.getElementById('loading-state'),
        appContent: document.getElementById('app-content'),
        userIdDisplay: document.getElementById('user-id-display'),
        routineSelector: document.getElementById('routine-selector'),
        mainScreen: document.getElementById('main-screen'),
        historyScreen: document.getElementById('history-screen'),
        trainingScreen: document.getElementById('training-screen'),
        instructionText: document.getElementById('instruction-text'),
        progressBar: document.getElementById('progress-bar'),
        breathingCircle: document.getElementById('breathing-circle'),
        customRoutineForm: document.getElementById('custom-routine-form'),
        routinesTabBtn: document.getElementById('routines-tab'),
        historyTabBtn: document.getElementById('history-tab'),
        historyList: document.getElementById('history-list'),
    };
}
