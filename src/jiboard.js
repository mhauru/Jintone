'use strict';
import {SVG} from '@svgdotjs/svg.js';
import {setupToggletips} from './toggletips.js';
import {readURL, setupStreams} from './streams.js';
import {toneToString, JITone} from './jitone.js';
import {EDOTones} from './edo.js';
import {EDOKey} from './edokey.js';
import {EqualLoudnessSynth} from './equalloudnesssynth.js';
import {addGeneratingInterval} from './tonesettings.js';

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Hard-coded default parameters.
const DEFAULT_URLPARAMS = new Map();
DEFAULT_URLPARAMS.set('originFreq', 261.626);
DEFAULT_URLPARAMS.set('maxHarmNorm', 8.0);
DEFAULT_URLPARAMS.set('pitchlineColor', '#c7c7c7');
DEFAULT_URLPARAMS.set('pitchlineColorActive', '#000000');
DEFAULT_URLPARAMS.set('showPitchlines', true);
DEFAULT_URLPARAMS.set('showKeys', true);
DEFAULT_URLPARAMS.set('showSteps', false);
DEFAULT_URLPARAMS.set('toneRadius', 30.0);
DEFAULT_URLPARAMS.set('toneLabelTextStyle', 'reducedfractions');
DEFAULT_URLPARAMS.set('toneColor', '#D82A1E');
DEFAULT_URLPARAMS.set('toneColorActive', '#D8B71E');
DEFAULT_URLPARAMS.set('rootToneBorderColor', '#000000');
DEFAULT_URLPARAMS.set('rootToneBorderSize', 5.0);
DEFAULT_URLPARAMS.set('minToneOpacity', 0.15);
DEFAULT_URLPARAMS.set('horizontalZoom', 400.0);
DEFAULT_URLPARAMS.set('verticalZoom', 120.0);
DEFAULT_URLPARAMS.set('midCoords', [0.0, 0.0]);
DEFAULT_URLPARAMS.set('settingsExpanded', false);
DEFAULT_URLPARAMS.set('helpExpanded', false);
const genInts = [
  new Map([[2, 1]]),
  new Map([[3, 1], [2, -1]]),
  new Map([[5, 1], [2, -2]]),
];
const genIntStrs = genInts.map(toneToString);
DEFAULT_URLPARAMS.set(
  'generatingIntervals', new Map(genIntStrs.map((e, i) => [e, genInts[i]])),
);
DEFAULT_URLPARAMS.set(
  'yShifts',
  new Map([[genIntStrs[0], 1.2], [genIntStrs[1], 0.6], [genIntStrs[2], 2.0]]),
);
DEFAULT_URLPARAMS.set(
  'harmDistSteps',
  new Map([[genIntStrs[0], 0.0], [genIntStrs[1], 1.6], [genIntStrs[2], 1.7]]),
);

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Global constants.
const synth = new EqualLoudnessSynth();
// scaleFig is a global object that essentially functions as a namespace.
// Its fields are various global variables related to the SVG canvasses.
const scaleFig = {};
scaleFig.canvas = new SVG().addTo('#divCanvas').size('100%', '100%');
scaleFig.keyCanvas = new SVG().addTo('#divKeyCanvas').size('100%', '100%');
scaleFig.keyCanvas.attr('preserveAspectRatio', 'none');
// Note that the order in which we create these groups sets their draw order,
// i.e. z-index.
scaleFig.svgGroups = {
  'pitchlines': scaleFig.canvas.group(),
  'tones': scaleFig.canvas.group(),
};
// A global constant that holds the values of various parameters at the very
// start. These values will be either hard-coded default values, or values
// read from the URL query string.
const startingParams = readURL(DEFAULT_URLPARAMS);
// streams is a global object that works as a namespace for all globally
// available rxjs observables.
const streams = setupStreams(startingParams, DEFAULT_URLPARAMS, scaleFig);
// allTones is a map that keeps track of all the tones currently in the
// keyboard. Keys are string representations, values are JITones.
const allTones = new Map();

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Make the toggletips react to being clicked.
setupToggletips();

// Create the root tone.
new JITone(new Map(), true, scaleFig.svgGroups, streams, allTones, synth);

// Create the EDO keys.
EDOTones.forEach((EDOTone) => {
  new EDOKey(
    EDOTone.frequency,
    EDOTone.keytype,
    scaleFig.keyCanvas,
    streams,
    synth,
  );
});

// Start listening to changes to the tone settings.
document.getElementById('buttAddGeneratingInterval').onclick = () => {
  const genInt = readNewGeneratingInterval();
  addGeneratingInterval(genInt, streams);
};

// Create the starting generating intervals (read from defaults or from the
// URL).
for (
  const [genIntStr, genInt] of startingParams['generatingIntervals'].entries()
) {
  const yShift = startingParams['yShifts'].get(genIntStr);
  const hds = startingParams['harmDistSteps'].get(genIntStr);
  addGeneratingInterval(genInt, streams, yShift, hds);
}

// Show the starting pop-up.
if (!streams.helpExpanded.getValue()) {
  const startPopUp = document.getElementById('startPopUp');
  startPopUp.style.display = 'block';
  // Remove the starting pop up once anything is clicked.
  document.body.addEventListener(
    'pointerdown',
    (e) => {
      startPopUp.style.display = 'none';
    },
    {once: true},
  );
}
