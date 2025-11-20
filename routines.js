/**
 * Breathing Exercise Routines
 *
 * Easily adjustable breathing routines for the Zen Breath Trainer.
 *
 * Format for each routine:
 * - id: unique identifier (lowercase, no spaces)
 * - name: display name
 * - durationMinutes: total training duration in minutes
 * - inhale: seconds to breathe in
 * - holdIn: seconds to hold breath after inhaling (0 to skip)
 * - exhale: seconds to breathe out
 * - holdOut: seconds to hold breath after exhaling (0 to skip)
 *
 * Popular patterns:
 * - 4:7:8 (Relaxation): inhale 4, hold 7, exhale 8
 * - Box Breathing: 4:4:4:4 (inhale:holdIn:exhale:holdOut)
 * - Calm Down: 4:0:6:0 (simple inhale/exhale)
 */

export const builtInRoutines = [
    {
        id: 'lah',
        name: 'LAH',
        durationMinutes: 6,
        inhale: 4,
        holdIn: 0,
        exhale: 6,
        holdOut: 0,
        isCustom: false
    },
    {
        id: 'led',
        name: 'LED',
        durationMinutes: 3,
        inhale: 4,
        holdIn: 0,
        exhale: 12,
        holdOut: 0,
        isCustom: false
    },
    {
        id: 'cyclic-sighing',
        name: 'Cyclic Sighing',
        durationMinutes: 2,
        inhale: 5,
        holdIn: 2, // Used for "top-up inhale"
        exhale: 8,
        holdOut: 0,
        isCustom: false,
        phaseLabels: {
            holdIn: 'TOP-UP INHALE' // Custom label for the top-up phase
        }
    },
    {
        id: 'box',
        name: 'Box Breathing (4:4:4:4)',
        durationMinutes: 6,
        inhale: 4,
        holdIn: 4,
        exhale: 4,
        holdOut: 4,
        isCustom: false
    },
    {
        id: 'relax',
        name: 'Relaxation (4:7:8)',
        durationMinutes: 6,
        inhale: 4,
        holdIn: 7,
        exhale: 8,
        holdOut: 0,
        isCustom: false
    }
];

/**
 * Routine Combos - Sequences of routines that run in order
 *
 * Format:
 * - id: unique identifier
 * - name: display name
 * - routines: array of routine IDs to run in sequence
 * - transitionSound: sound to play between routines (optional)
 */
export const routineCombos = [
    {
        id: 'morning',
        name: 'Morning',
        routines: ['lah', 'led'],
        transitionSound: 'start'
    },
    {
        id: 'evening',
        name: 'Evening',
        routines: ['led', 'cyclic-sighing'],
        transitionSound: 'start'
    }
];
