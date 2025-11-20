/**
 * Audio Setup and Sound Effects
 *
 * Uses Tone.js for meditative sounds during breathing exercises.
 *
 * Note: Tone.js is loaded globally from CDN in index.html
 */

let volumeNode, meditativeSynth, finishBell;
let audioInitialized = false;

/**
 * Initialize audio components (called lazily on first use)
 */
function initializeAudio() {
    if (audioInitialized || typeof Tone === 'undefined') return;

    volumeNode = new Tone.Volume(-16).toDestination();

    meditativeSynth = new Tone.FMSynth({
        harmonicity: 0.8,
        modulationIndex: 2,
        envelope: { attack: 0.05, decay: 0.3, sustain: 0.1, release: 0.5 },
        modulation: { type: "triangle" },
        volume: -8
    }).connect(volumeNode);

    finishBell = new Tone.MembraneSynth({
        pitchDecay: 0.005,
        octaves: 10,
        envelope: { attack: 0.001, decay: 0.8, sustain: 0.01, release: 1.8 },
        volume: -10
    }).connect(volumeNode);

    audioInitialized = true;
}

/**
 * Play a sound effect for breathing phases
 * @param {string} type - Sound type: 'start', 'in', 'holdIn', 'out', 'holdOut', 'finish'
 * @param {number} duration - Duration in seconds (optional)
 */
export async function playSound(type, duration = 0.5) {
    if (typeof Tone === 'undefined') {
        console.warn('Tone.js not loaded yet');
        return;
    }

    initializeAudio();
    await Tone.start();
    let note;
    switch (type) {
        case 'start':
            note = "C6";
            meditativeSynth.triggerAttackRelease(note, "64n");
            break;
        case 'in':
            note = "G4";
            meditativeSynth.triggerAttackRelease(note, "0.1s");
            break;
        case 'holdIn':
            note = "A4";
            meditativeSynth.triggerAttackRelease(note, "0.1s");
            break;
        case 'out':
            note = "D4";
            meditativeSynth.triggerAttackRelease(note, "0.1s");
            break;
        case 'holdOut':
            note = "C4";
            meditativeSynth.triggerAttackRelease(note, "0.1s");
            break;
        case 'finish':
            finishBell.triggerAttackRelease("C3", 2);
            break;
    }
}
