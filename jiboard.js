'use strict';
const starttime = Date.now(); // DEBUG
// TODO I would like to ES6 module import also SVG.js and rxjs, and locally
// import ResizeObserver from a module folder rather than a .min.js I manually
// copied from a CDN. None of these things seem possible because the
// javascript module ecosystem is a massive mess that drives me nuts.
import './node_modules/tone/build/Tone.js';
import ResizeObserver from './resize-observer.min.js';
import {VariableSourceSubject} from './variablesourcesubject.js';
import {toneToString, ToneObject} from './toneobject.js';
import {generateEDOTones, EDOKey} from './edo.js';

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Global constants.

// TODO This is duplicated here and in toneobject.js. Fix.
const ALLPRIMES = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
  73, 79, 83, 89, 97,
];

const synth = new Tone.PolySynth( 10, Tone.Synth, {
  oscillator: {
    type: 'sine',
    // Relative amplitudes of overtones.
    partials: [1, 0.3, 0.2],
  },
}).toMaster();

function addEDOKeys() {
  const EDOTones = generateEDOTones();
  EDOTones.forEach((EDOTone) => {
    new EDOKey(
      EDOTone.frequency,
      EDOTone.keytype,
      scaleFig.keyCanvas,
      streams,
      synth
    );
  });
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Read the URL for parameter values to start with, and define a function for
// writing the URL.

// A global constant that holds the values of various parameters at the very
// start.  These values will be either hard-coded default values, or values
// read from the URL query string.
const startingParams = {};

// Hard-coded defaults.
const DEFAULT_URLPARAMS = {
  'originFreq': 261.626,
  'maxHarmNorm': 8.0,
  'pitchlineColor': '#c7c7c7',
  'pitchlineColorActive': '#000000',
  'showPitchlines': true,
  'showKeys': true,
  'showSteps': false,
  'toneRadius': 22.0,
  'toneLabelTextStyle': 'fractions',
  'toneColor': '#D82A1E',
  'toneColorActive': '#D8B71E',
  'baseToneBorderColor': '#000000',
  'baseToneBorderSize': 5.0,
  'opacityHarmNorm': true,
  'horizontalZoom': 300.0,
  'verticalZoom': 100.0,
  'midCoords': [0.0, 0.0],
  'axes': [
    {'yShift': 1.2, 'harmDistStep': 0.0},
    {'yShift': 1.8, 'harmDistStep': 1.5},
    {'yShift': 1.0, 'harmDistStep': 1.7},
  ],
  'baseTones': [new Map()],
  'settingsExpanded': true,
  'generalExpanded': true,
  'tonesExpanded': false,
  'styleExpanded': false,
};

function readURL() {
  const params = new URLSearchParams(decodeURIComponent(location.search));
  Object.entries(DEFAULT_URLPARAMS).forEach(([key, value]) => {
    if (params.has(key) && params.get(key) != 'undefined') {
      value = JSON.parse(params.get(key));
    }
    startingParams[key] = value;
  });
}

function updateURL(key, value) {
  const current = new URLSearchParams(decodeURIComponent(location.search));
  current.set(key, JSON.stringify(value));
  let queryStr = '';
  for (const [key, valueStr] of current.entries()) {
    queryStr += `${key}=${valueStr}&`;
  }
  queryStr = encodeURIComponent(queryStr);
  const newURL = window.location.pathname + '?' + queryStr;
  window.history.replaceState(null, '', newURL);
}

readURL();

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Setting up the canvasses and related functions.

// scaleFig is a global object that essentially functions as a namespace.
// Its fields are various global variables related to the SVG canvasses.
const scaleFig = {};

// Set up the SVG canvases.
scaleFig.canvas = new SVG('divCanvas');
scaleFig.keyCanvas = new SVG('divKeyCanvas');
scaleFig.keyCanvas.attr('preserveAspectRatio', 'none');
// Note that the order in which we create these groups sets their draw order,
// i.e. z-index.
scaleFig.svgGroups = {
  'pitchlines': scaleFig.canvas.group(),
  'tones': scaleFig.canvas.group(),
};

// Return a boolean for whether the coordinates (x, y) are in the current
// viewbox of the SVG canvas.
// function isInViewbox(x, y) {
//   const viewboxLeft = scaleFig.canvas.viewbox().x;
//   const viewboxRight = viewboxLeft + scaleFig.canvas.viewbox().width;
//   const viewboxTop = scaleFig.canvas.viewbox().y;
//   const viewboxBottom = viewboxTop + scaleFig.canvas.viewbox().height;
//   const inBoxHor = (viewboxLeft < x && x < viewboxRight);
//   const inBoxVer = (viewboxTop < y && y < viewboxBottom);
//   const inBox = inBoxHor && inBoxVer;
//   return inBox;
// }

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Create event streams for key presses. By streams I mean rxjs Observables.

// streams is a global object that works as a namespace for all globally
// available streams.
const streams = {};

const divPanMod = document.getElementById('divPanMod');
const divSustainMod = document.getElementById('divSustainMod');

const trueOnPanDown = rxjs.merge(
  rxjs.fromEvent(divPanMod, 'mousedown'),
  rxjs.fromEvent(divPanMod, 'touchstart'),
  rxjs.fromEvent(divPanMod, 'pointerdown').pipe(rxjs.operators.map((ev) => {
    // Allow pointer event target to jump between objects when pointer is
    // moved.
    ev.target.releasePointerCapture(ev.pointerId);
    return ev;
  })),
  rxjs.fromEvent(window, 'keydown').pipe(
    // TODO Define the keyCodes somewhere else.
    rxjs.operators.filter((ev) => ev.keyCode == 17)
  ),
).pipe(rxjs.operators.map((ev) => true));

const falseOnPanUp = rxjs.merge(
  rxjs.fromEvent(divPanMod, 'mouseup'),
  rxjs.fromEvent(divPanMod, 'mouseleave'),
  rxjs.fromEvent(divPanMod, 'touchend'),
  rxjs.fromEvent(divPanMod, 'touchcancel'),
  rxjs.fromEvent(divPanMod, 'pointerup'),
  rxjs.fromEvent(divPanMod, 'pointerleave'),
  rxjs.fromEvent(window, 'keyup').pipe(
    // TODO Define the keyCodes somewhere else.
    rxjs.operators.filter((ev) => ev.keyCode == 17)
  ),
).pipe(rxjs.operators.map((ev) => false));

streams.panDown = rxjs.merge(trueOnPanDown, falseOnPanUp).pipe(
  rxjs.operators.startWith(false)
);

const trueOnSustainDown = rxjs.merge(
  rxjs.fromEvent(divSustainMod, 'mousedown'),
  rxjs.fromEvent(divSustainMod, 'touchstart'),
  rxjs.fromEvent(divSustainMod, 'pointerdown').pipe(rxjs.operators.map((ev) => {
    // Allow pointer event target to jump between objects when pointer is
    // moved.
    ev.target.releasePointerCapture(ev.pointerId);
    return ev;
  })),
  rxjs.fromEvent(window, 'keydown').pipe(
    // TODO Define the keyCodes somewhere else.
    rxjs.operators.filter((ev) => ev.keyCode == 16)
  ),
).pipe(rxjs.operators.map((ev) => true));

const falseOnSustainUp = rxjs.merge(
  rxjs.fromEvent(divSustainMod, 'mouseup'),
  rxjs.fromEvent(divSustainMod, 'mouseleave'),
  rxjs.fromEvent(divSustainMod, 'touchend'),
  rxjs.fromEvent(divSustainMod, 'touchcancel'),
  rxjs.fromEvent(divSustainMod, 'pointerup'),
  rxjs.fromEvent(divSustainMod, 'pointerleave'),
  // TODO Define the keyCodes somewhere else.
  rxjs.fromEvent(window, 'keyup').pipe(
    rxjs.operators.filter((ev) => ev.keyCode == 16)
  ),
).pipe(rxjs.operators.map((ev) => false));

streams.sustainDown = new rxjs.BehaviorSubject(false);
rxjs.merge(trueOnSustainDown, falseOnSustainUp).subscribe(streams.sustainDown);

// TODO Hard-coded color constants should be moved elsewhere. Maybe make it a
// CSS class whether they are up or down?
streams.panDown.subscribe((value) => {
  if (value) {
    divPanMod.style.background = '#FF3900';
  } else {
    divPanMod.style.background = '#FF9273';
  }
});

streams.sustainDown.subscribe((value) => {
  if (value) {
    divSustainMod.style.background = '#FFAA00';
  } else {
    divSustainMod.style.background = '#FFD073';
  }
});

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Create event streams for panning the canvas.

// Check whether a given event has clientX and clientY coordinates.
function eventHasCoords(ev) {
  return ('clientX' in ev && 'clientY' in ev &&
    !isNaN(ev.clientX) && !isNaN(ev.clientY));
}

// Get clientX and clientY from an event, if it has them, if not, return
// [NaN, NaN]. The same function should work for mouse, touch and pointer
// events, and in at least Firefox and Chrome.
function eventClientCoords(ev) {
  if (eventHasCoords(ev)) {
    return [ev.clientX, ev.clientY];
  } else if ('touches' in ev) {
    // TODO This length-1 thing makes it pick the coordinates of the last
    // touch point. What we should really do is take the first touch point
    // that is not the one holding the pan modifier div down. This would be
    // either [0] or [1] depending on whether we are using touch or keyboard
    // to toggle panning.
    const touch = ev.touches[ev.touches.length-1];
    if (eventHasCoords(touch)) {
      return [touch.clientX, touch.clientY];
    }
  }
  return [NaN, NaN];
}

// A stream that returns a pair of x, y coordinates for a click of the canvas,
// presuming that these coordinates exist for the type of click executed.
// Events that don't have client coordinates well defined are filtered out.
streams.clientCoordsOnClick = rxjs.merge(
  rxjs.fromEvent(scaleFig.canvas, 'mousedown').pipe(rxjs.operators.filter(
    (ev) => ev.buttons == 1)
  ),
  rxjs.fromEvent(scaleFig.canvas, 'touchstart'),
  rxjs.fromEvent(scaleFig.canvas, 'pointerdown').pipe(rxjs.operators.filter(
    (ev) => ev.buttons == 1)
  ),
).pipe(
  rxjs.operators.map(eventClientCoords),
  rxjs.operators.filter(([x, y]) => !isNaN(x) && !isNaN(y)),
);

// Streams that return true/false when the canvas is down-clicked or released.
const trueOnCanvasOn = streams.clientCoordsOnClick.pipe(
  rxjs.operators.map((ev) => true)
);
const falseOnCanvasOff = rxjs.merge(
  rxjs.fromEvent(scaleFig.canvas, 'mouseup'),
  rxjs.fromEvent(scaleFig.canvas, 'mouseleave'),
  rxjs.fromEvent(scaleFig.canvas, 'touchend'),
  rxjs.fromEvent(scaleFig.canvas, 'touchcancel'),
  rxjs.fromEvent(scaleFig.canvas, 'pointerup'),
  rxjs.fromEvent(scaleFig.canvas, 'pointerleave'),
).pipe(rxjs.operators.map((ev) => false));
const canvasOn = rxjs.merge(falseOnCanvasOff, trueOnCanvasOn).pipe(
  rxjs.operators.startWith(false)
);

// A stream that returns whether we are in canvas-panning mode.
streams.panning = rxjs.combineLatest(streams.panDown, canvasOn).pipe(
  rxjs.operators.map(([v1, v2]) => v1 && v2)
);

// Streams for the latest coordinates for the mid-point of the canvas.
// midCoords returns this whenever it changes, midCoordOnClick returns the
// latest value whenever the canvas is clicked. midCoords is here only
// initialized with a starting value.
streams.midCoords = new rxjs.BehaviorSubject();
streams.midCoords.next(startingParams['midCoords']);
streams.midCoordsOnClick = streams.midCoords.pipe(
  rxjs.operators.sample(streams.clientCoordsOnClick)
);

// Return the client-coordinates of the pointer on the canvas every time the
// pointer is moved.
// TODO Instead of having this get called on every move, we could just create
// the listener for this whenever panning is set to true, and remove it when
// its set to false. Could be faster?
streams.clientCoordsOnMove = rxjs.merge(
  rxjs.fromEvent(scaleFig.canvas, 'mousemove'),
  rxjs.fromEvent(scaleFig.canvas, 'touchmove'),
  rxjs.fromEvent(scaleFig.canvas, 'pointermove')
).pipe(
  rxjs.operators.map((ev) => {
    // To not duplicate events as touch/pointer/mouse.
    ev.preventDefault();
    return eventClientCoords(ev);
  }),
  rxjs.operators.filter(([x, y]) => !isNaN(x) && !isNaN(y)),
);

// Make midCoords emit a new value every time the pointer is moved on the
// canvas, and we are in panning mode.
streams.clientCoordsOnMove.pipe(
  rxjs.operators.withLatestFrom(
    rxjs.combineLatest(streams.panning, streams.clientCoordsOnClick,
      streams.midCoordsOnClick)
  ),
  rxjs.operators.filter((arg) => arg[1][0]), // Filter out panning=false.
  rxjs.operators.map((x) => {
    const ccOnMove = x[0];
    const ccOnClick= x[1][1];
    const mcOnClick = x[1][2];
    const midX = mcOnClick[0] - ccOnMove[0] + ccOnClick[0];
    const midY = mcOnClick[1] - ccOnMove[1] + ccOnClick[1];
    return [midX, midY];
  }),
).subscribe((x) => streams.midCoords.next(x));

// Use ResizeObserver to make Observables out of the sizes of elements.
// TODO Turn this into a new subclass of Subject?
streams.canvasSize = new rxjs.Subject();
new ResizeObserver((entries, observer) => {
  for (const entry of entries) {
    const cbs = entry.contentBoxSize;
    const width = cbs.inlineSize;
    const height = cbs.blockSize;
    streams.canvasSize.next([width, height]);
  }
}).observe(document.getElementById('divCanvas'));

streams.keyCanvasSize = new rxjs.Subject();
new ResizeObserver((entries, observer) => {
  for (const entry of entries) {
    const cbs = entry.contentBoxSize;
    const width = cbs.inlineSize;
    const height = cbs.blockSize;
    streams.keyCanvasSize.next([width, height]);
  }
}).observe(document.getElementById('divKeyCanvas'));

streams.settingsSize = new rxjs.Subject();
new ResizeObserver((entries, observer) => {
  for (const entry of entries) {
    const cbs = entry.contentBoxSize;
    const width = cbs.inlineSize;
    const height = cbs.blockSize;
    streams.settingsSize.next([width, height]);
  }
}).observe(document.getElementById('divSettings'));

streams.canvasViewbox = new rxjs.BehaviorSubject(scaleFig.canvas.viewbox());
// Adjust the canvas viewbox every time the canvas is resized or we pan to
// change the mid-point.
rxjs.combineLatest(streams.canvasSize, streams.midCoords).subscribe(
  ([boxSize, coords]) => {
    const canvas = scaleFig.canvas;
    const [w, h] = boxSize;
    const [x, y] = coords;
    canvas.viewbox(-w/2+x, -h/2+y, w, h);
    streams.canvasViewbox.next(canvas.viewbox());
  }
);

// Adjust the canvas viewbox for the EDO keyboard every time the key canvas is
// resized or we pan to change the mid-point.
rxjs.combineLatest(streams.keyCanvasSize, streams.midCoords).subscribe(
  ([boxSize, coords]) => {
    const w = boxSize[0];
    const x = coords[0];
    const keyCanvas = scaleFig.keyCanvas;
    keyCanvas.viewbox(-w/2+x, 0, w, 1);
  }
);

// Adjust divSettingsInner height every time the size of divSettings changes.
streams.settingsSize.subscribe(
  (boxSize) => {
    // TODO This is a little ugly, since we listen to a stream of
    // contentBoxSize, but don't actually use those values for anything, but
    // get the offsetHeights in this function.
    const div = document.getElementById('divSettings');
    const header = document.getElementById('settingsHeader');
    const divInner = document.getElementById('divSettingsInner');
    const innerHeight = div.offsetHeight - header.offsetHeight;
    divInner.style.height = `${innerHeight}px`;
  }
);

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Create event streams for various variables and settings.

// Each element of this array describes one UI element and a corresponding
// parameter name, event, and proprety. Each UI element will then be turned
// into an event stream of the given name, made to emit observablePropertyy of
// the elements, and initialized with the appropriate value.
const streamElements = [
  {
    'paramName': 'originFreq',
    'elemName': 'numOriginFreq',
    'eventName': 'input',
    'observableProperty': 'value',
    'parser': parseFloat,
  },
  {
    'paramName': 'toneRadius',
    'elemName': 'numToneRadius',
    'eventName': 'input',
    'observableProperty': 'value',
    'parser': parseFloat,
  },
  {
    'paramName': 'toneColor',
    'elemName': 'toneColor',
    'eventName': 'input',
    'observableProperty': 'value',
  },
  {
    'paramName': 'toneColorActive',
    'elemName': 'toneColorActive',
    'eventName': 'input',
    'observableProperty': 'value',
  },
  {
    'paramName': 'baseToneBorderColor',
    'elemName': 'baseToneBorderColor',
    'eventName': 'input',
    'observableProperty': 'value',
  },
  {
    'paramName': 'baseToneBorderSize',
    'elemName': 'numBaseToneBorderSize',
    'eventName': 'input',
    'observableProperty': 'value',
    'parser': parseFloat,
  },
  {
    'paramName': 'opacityHarmNorm',
    'elemName': 'cboxOpacityHarmNorm',
    'eventName': 'click',
    'observableProperty': 'checked',
  },
  {
    'paramName': 'showPitchlines',
    'elemName': 'cboxPitchlines',
    'eventName': 'click',
    'observableProperty': 'checked',
  },
  {
    'paramName': 'showKeys',
    'elemName': 'cboxKeys',
    'eventName': 'click',
    'observableProperty': 'checked',
  },
  {
    'paramName': 'showSteps',
    'elemName': 'cboxSteps',
    'eventName': 'click',
    'observableProperty': 'checked',
  },
  {
    'paramName': 'pitchlineColor',
    'elemName': 'colorPitchlines',
    'eventName': 'input',
    'observableProperty': 'value',
  },
  {
    'paramName': 'pitchlineColorActive',
    'elemName': 'colorPitchlinesActive',
    'eventName': 'input',
    'observableProperty': 'value',
  },
  {
    'paramName': 'horizontalZoom',
    'elemName': 'rangeHorzZoom',
    'eventName': 'input',
    'observableProperty': 'value',
    'parser': parseFloat,
  },
  {
    'paramName': 'verticalZoom',
    'elemName': 'rangeVertZoom',
    'eventName': 'input',
    'observableProperty': 'value',
    'parser': parseFloat,
  },
  {
    'paramName': 'maxHarmNorm',
    'elemName': 'numMaxHarmNorm',
    'eventName': 'input',
    'observableProperty': 'value',
    'parser': parseFloat,
  },
];

streamElements.forEach((e) => {
  const elem = document.getElementById(e.elemName);
  streams[e.paramName] = new rxjs.BehaviorSubject(startingParams[e.paramName]);
  const eventStream = rxjs.fromEvent(elem, e.eventName);
  let valueStream;
  if (e.hasOwnProperty('parser')) {
    valueStream = eventStream.pipe(rxjs.operators.map(
      (x) => {
        return e.parser(x.target[e.observableProperty])
      }
    ));
  } else {
    valueStream = eventStream.pipe(
      rxjs.operators.pluck('target', e.observableProperty)
    );
  }
  valueStream.subscribe((x) => streams[e.paramName].next(x));

  // Every time a new value is emitted, update the UI element(s) and the URL.
  streams[e.paramName].subscribe((value) => {
    // TODO Check that this works for checkboxes on Chrome (seems at the moment
    // it doesn't.)
    elem[e.observableProperty] = value;
    updateURL(e.paramName, value);
  });
});

// We do the toneLabel one manually, since it requires merging three streams.
const radioToneLabelNone = document.getElementById('radioToneLabelNone');
const radioToneLabelEDO = document.getElementById('radioToneLabelEDO');
const radioToneLabelFrac = document.getElementById('radioToneLabelFrac');
streams.toneLabelTextStyle = rxjs.merge(
  rxjs.fromEvent(radioToneLabelNone, 'click'),
  rxjs.fromEvent(radioToneLabelEDO, 'click'),
  rxjs.fromEvent(radioToneLabelFrac, 'click'),
).pipe(
  rxjs.operators.pluck('target', 'value'),
  rxjs.operators.startWith(startingParams['toneLabelTextStyle'])
);
streams.toneLabelTextStyle.subscribe((value) => {
  if (value == 'EDO') {
    radioToneLabelEDO.checked = true;
  } else if (value == 'none') {
    radioToneLabelNone.checked = true;
  } else if (value == 'fractions') {
    radioToneLabelFrac.checked = true;
  }
  updateURL('toneLabelTextStyle', value);
});

// Set up some extra subscriptions for a few parameters that have a global
// impact.

streams.showKeys.subscribe((value) => {
  const divCanvas = document.getElementById('divCanvas');
  const divKeyCanvas = document.getElementById('divKeyCanvas');
  // Note that these trigger further resizing events through ResizeObservers
  // defined earlier.
  if (value) {
    divCanvas.style.height = '80%';
    divKeyCanvas.style.height = '20%';
  } else {
    divCanvas.style.height = '100%';
    divKeyCanvas.style.height = '0%';
  }
});

streams.showPitchlines.subscribe((value) => {
  if (value) {
    scaleFig.svgGroups.pitchlines.attr('visibility', 'inherit');
  } else {
    scaleFig.svgGroups.pitchlines.attr('visibility', 'hidden');
  }
});

// TODO Make new values be registered.
streams.baseTones = new rxjs.BehaviorSubject();
const startingBaseTones = new Map();
startingParams['baseTones'].forEach((bt) => {
  const btStr = toneToString(bt);
  startingBaseTones.set(btStr, bt);
});
streams.baseTones.next(startingBaseTones);
streams.opacityHarmNorm = new rxjs.BehaviorSubject();
streams.opacityHarmNorm.next(startingParams['opacityHarmNorm']);

// Take Observables, each of which returns Maps, combineLatest on it merge the
// Maps.
function combineAndMerge(...x) {
  const combined = rxjs.combineLatest(...x).pipe(
    rxjs.operators.map((ms) => {
      // ms is an array of Maps, that we merge into a single map.
      const arrs = [];
      ms.forEach((m) => {
        arrs.push(...m)
      });
      return new Map(arrs);
    }));
  return combined;
}

streams.primes = new rxjs.BehaviorSubject([]);
streams.harmDistSteps = new VariableSourceSubject(combineAndMerge, new Map());
streams.yShifts = new VariableSourceSubject(combineAndMerge, new Map());
// Associate each prime to each it's streams, to make it possible to remove the
// right ones with removeSource.
const yShiftStreams = new Map();
const harmDistStepStreams = new Map();

// TODO What's the right place to have this bit?
const allTones = new Map();
streams.baseTones.subscribe((baseTones) => {
  // We only have to care about creating new Tones here. Each tone object
  // subscribes to baseTones to check if its own isBase should change.
  baseTones.forEach((bt, btStr) => {
    if (!allTones.has(btStr)) {
      new ToneObject(bt, true, scaleFig.svgGroups, streams, allTones, synth);
    }
  });
});

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Event listeners for adding new intervals and axes.

function addAxis(
  startingYyshift = 0.0,
  startingHarmStep = streams.maxHarmNorm.getValue()
) {
  const prime = ALLPRIMES[streams.primes.getValue().length];

  const inNumYshift = document.createElement('input');
  inNumYshift.id = `inNumYshift_${prime}`;
  inNumYshift.type = 'number';
  inNumYshift.min = -10;
  inNumYshift.max = 10;
  inNumYshift.step = 0.01;
  inNumYshift.style.width = '80px';

  const inRangeYshift = document.createElement('input');
  inRangeYshift.id = `inRangeYshift_${prime}`;
  inRangeYshift.type = 'range';
  inRangeYshift.step = 0.01;
  inRangeYshift.max = 10.0;
  inRangeYshift.min = -10.0;

  const inNumHarmdiststep = document.createElement('input');
  inNumHarmdiststep.id = `inNumHarmdiststep_${prime}`;
  inNumHarmdiststep.type = 'number';
  inNumHarmdiststep.min = -20;
  inNumHarmdiststep.max = 20;
  inNumHarmdiststep.step = 0.01;
  inNumHarmdiststep.style.width = '80px';

  const inRangeHarmdiststep = document.createElement('input');
  inRangeHarmdiststep.id = `inRangeHarmdiststep_${prime}`;
  inRangeHarmdiststep.type = 'range';
  inRangeHarmdiststep.step = 0.01;
  inRangeHarmdiststep.max = 10.0;
  inRangeHarmdiststep.min = 0.0;

  const parYShift = document.createElement('p');
  parYShift.innerHTML = 'y-shift: ';
  parYShift.appendChild(inNumYshift);
  parYShift.appendChild(inRangeYshift);

  const parHarmDistStep = document.createElement('p');
  parHarmDistStep.innerHTML = 'Harmonic distance: ';
  parHarmDistStep.appendChild(inNumHarmdiststep);
  parHarmDistStep.appendChild(inRangeHarmdiststep);

  const divAxis = document.createElement('div');
  divAxis.id = `divAxis_${prime}`;
  divAxis.innerHTML = `Axis: ${prime}`;
  divAxis.appendChild(parYShift);
  divAxis.appendChild(parHarmDistStep);

  document.getElementById('contentAxes').appendChild(divAxis);

  const yShiftStream = new rxjs.BehaviorSubject(
    new Map([[prime, startingYyshift]])
  );
  rxjs.merge(
    rxjs.fromEvent(inNumYshift, 'input'),
    rxjs.fromEvent(inRangeYshift, 'input'),
  ).pipe(
    rxjs.operators.pluck('target', 'value'),
    rxjs.operators.map((value) => {
      return new Map([[prime, value]]);
    }),
  ).subscribe(yShiftStream);
  yShiftStream.subscribe((m) => {
    const value = m.get(prime);
    inNumYshift.value = value;
    // TODO This used be value.toString(). Why?
    inRangeYshift.value = value;
  });

  const harmStepStream = new rxjs.BehaviorSubject(
    new Map([[prime, startingHarmStep]])
  );
  rxjs.merge(
    rxjs.fromEvent(inNumHarmdiststep, 'input'),
    rxjs.fromEvent(inRangeHarmdiststep, 'input'),
  ).pipe(
    rxjs.operators.pluck('target', 'value'),
    rxjs.operators.map((value) => {
      return new Map([[prime, value]]);
    }),
  ).subscribe(harmStepStream);
  harmStepStream.subscribe((m) => {
    const value = m.get(prime);
    inNumHarmdiststep.value = value;
    // TODO This used be value.toString(). Why?
    inRangeHarmdiststep.value = value;
  });

  streams.harmDistSteps.addSource(harmStepStream);
  streams.yShifts.addSource(yShiftStream);
  const primes = streams.primes.getValue();
  primes.push(prime);
  streams.primes.next(primes);
  yShiftStreams.set(prime, yShiftStream);
  harmDistStepStreams.set(prime, harmStepStream);
}

function removeAxis() {
  const primes = streams.primes.getValue();
  const prime = primes.pop();
  const divAxis = document.getElementById(`divAxis_${prime}`);
  document.getElementById('contentAxes').removeChild(divAxis);
  const yShiftStream = yShiftStreams.get(prime);
  const harmStepStream = harmDistStepStreams.get(prime);
  streams.yShifts.removeSource(yShiftStream);
  streams.harmDistSteps.removeSource(harmStepStream);
  yShiftStreams.delete(prime);
  harmDistStepStreams.delete(prime);
  streams.primes.next(primes);

  // TODO This used to have a bit that went through baseTones, and removed all
  // the ones that had a component along this axis. Should we have something
  // similar now?
}

const buttAddAxis = document.getElementById('buttAddAxis');
buttAddAxis.onclick = function buttAddAxisOnclick() {
  addAxis();
  updateURL();
}

const buttRemoveAxis = document.getElementById('buttRemoveAxis');
buttRemoveAxis.onclick = function buttRemoveAxisOnclick() {
  removeAxis();
  updateURL();
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

/*
function checkTones() {
  // Some consistency checks, for testing purposes.
  const svgTones = [];
  const svgPitchlines = [];
  const svgSteps = [];

  Object.entries(scaleFig.tones).forEach(([coords, tone]) => {
    const inbounds = tone.inbounds;
    const inclosure = tone.inclosure;
    const isboundary = coords in scaleFig.boundaryTones;
    svgTones.push(tone.svgTone);
    svgPitchlines.push(tone.svgPitchline);

    if (inbounds && !inclosure) {
      const msg = `Error: tone ${coords} is inbounds but not inclosure.`;
      console.log(msg);
    }

    // TODO Some kind of check of the fact that inbounds and inclosure should
    // match when viewbox is large enough.

    if (!inclosure && !isboundary) {
      const msg = `Error: tone ${coords} is not inclosure, but also is not \
boundary.`;
      console.log(msg);
    }

    Object.entries(tone.incomingSteps).forEach(([label, step]) => {
      const isEndpoint = step.endpoint == tone;
      if (!isEndpoint) {
        const msg = `Error: tone ${endpoint} claims to be the endpoint of step\
 ${step} , but isn't actually.`;
        console.log(msg);
      }
    });

    Object.entries(tone.steps).forEach(([label, step]) => {
      const svgStep = step.svgStep;
      svgSteps.push(svgStep);
      if (step.hasEndpoint) {
        const endpoint = step.endpoint;
        const endpointKnows = endpoint.incomingSteps[label] === step;
        if (!endpointKnows) {
          const msg = `Error: tone ${endpoint} is the endpoint of step ${step}\
 , but doesn't know it.`;
          console.log(msg);
        }

        const interval = scaleFig.stepIntervals[label].interval;
        const endpointCoords = sumTones(tone.coords, interval);
        if (!tonesEqual(endpointCoords, endpoint.coords)) {
          const msg = `Error: tone ${endpoint} is the endpoint of step ${step}\
 , but the correct endpoint is at ${endpointCoords}.`;
          console.log(msg);
        }
      } else {
        const interval = scaleFig.stepIntervals[label].interval;
        const endpointCoords = sumTones(tone.coords, interval);
        const endpointExists = endpointCoords in scaleFig.tones;
        if (endpointExists) {
          const msg = `Error: tone at ${endpointCoords} should be the endpoint 
\of a step from ${step.origin.coords}, but no endpoint has been set.`;
          console.log(msg);
        }
      }

      const stepInterval = scaleFig.stepIntervals[step.label];
      const svgInGroup = stepInterval.svgGroup.has(svgStep);
      if (!svgInGroup) {
        const msg = `Error: svgStep ${svgStep.id()} is not in the step group.`;
        console.log(msg);
      }
    });

    Object.entries(scaleFig.stepIntervals).forEach(([label, stepInterval]) => {
      const hasStep = label in tone.steps;
      if (!hasStep) {
        const msg = `Error: tone ${tone} does not have a step ${label}.`;
        console.log(msg);
      }
    });
  });

  Object.entries(scaleFig.boundaryTones).forEach(([coords, tone]) => {
    const inclosure = tone.inclosure;
    const intones = coords in scaleFig.tones;

    if (!intones) {
      const msg = `Error: tone ${coords} is in boundaryTones, but not in \
tones.`;
      console.log(msg);
    }

    if (inclosure) {
      const msg = `Error: tone ${coords} is boundary, but also inclosure.`;
      console.log(msg);
    }
  });

  svgTones.forEach((svgTone) => {
    const inGroup = scaleFig.svgGroups.tones.has(svgTone);
    if (!inGroup) {
      const msg = `Error: svgTone ${svgTone.id()} is not in the tone group.`;
      console.log(msg);
    }
  });

  svgPitchlines.forEach((svgPitchline) => {
    const inGroup = scaleFig.svgGroups.pitchlines.has(svgPitchline);
    if (!inGroup) {
      const msg = `Error: svgPitchline ${svgPitchline.id()} is not in the \
pitchline group.`;
      console.log(msg);
    }
  });

  scaleFig.svgGroups.pitchlines.children().forEach((svgPitchline) => {
    const hasParent = svgPitchlines.includes(svgPitchline);
    if (!hasParent) {
      const msg = `Error: svgPitchline ${svgPitchline.id()} is not the \
pitchline of any tone.`;
      console.log(msg);
    }
  });

  scaleFig.svgGroups.tones.children().forEach((svgTone) => {
    const hasParent = svgTones.includes(svgTone);
    if (!hasParent) {
      const msg = `Error: svgTone ${svgTone.id()} is not the \
tone of any tone.`;
      console.log(msg);
    }
  });
}
*/

/*
function yShiftOnchange(prime, shift) {
  const pStr = prime.toString();
  const inNum = document.getElementById(`inNumYshift_${prime}`);
  const inRange = document.getElementById(`inRangeYshift_${prime}`);
  if (inNum != null) inNum.value = shift;
  if (inRange != null) inRange.value = shift.toString();
  // TODO Reading scaleFig from global scope?
  const oldShift = scaleFig.yShifts[pStr];
  scaleFig.yShifts[pStr] = shift;
  repositionAll(scaleFig);
  // TODO We assume here that the viewbox is always centered at the origin.
  if (Math.abs(oldShift) > Math.abs(shift)) {
    generateTones();
  } else {
    deleteTones();
  }
  updateURL();
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

resizeCanvas();
resizeKeyCanvas();
resizeSettings();

readURL();
updateURL();

streams.horizontalZoom.subscribe((value) => updateURL());
streams.verticalZoom.subscribe((value) => updateURL());
checkTones(); // TODO Only here for testing during development.
*/

const buttToggleSettings = document.getElementById('buttToggleSettings');
streams.settingsExpanded = new rxjs.BehaviorSubject(
  DEFAULT_URLPARAMS['settingsExpanded']
);
rxjs.fromEvent(buttToggleSettings, 'click').subscribe((ev) => {
  const expanded = streams.settingsExpanded.getValue();
  streams.settingsExpanded.next(!expanded);
});
streams.settingsExpanded.subscribe((expanded) => {
  const divSettings = document.getElementById('divSettings');
  const divCanvas = document.getElementById('divCanvas');
  const divKeyCanvas = document.getElementById('divKeyCanvas');
  const button = document.getElementById('buttToggleSettings');
  if (expanded) {
    button.style.transform = '';
    button.style.borderLeft = '1px solid black';
    button.style.borderRight = 'none';
    button.style.right = '20%';
    divSettings.style.right = '0';
    divCanvas.style.width = '80%';
    divKeyCanvas.style.width = '80%';
  } else {
    button.style.transform = 'scale(-1, 1)';
    button.style.borderRight = '1px solid black';
    button.style.borderLeft = 'none';
    button.style.right = 0;
    divSettings.style.right = '-20%';
    divCanvas.style.width = '100%';
    divKeyCanvas.style.width = '100%';
  }
  updateURL();
});

const headGeneral = document.getElementById('headGeneral');
streams.generalExpanded = new rxjs.BehaviorSubject(
  DEFAULT_URLPARAMS['generalExpanded']
);
rxjs.fromEvent(headGeneral, 'click').subscribe((ev) => {
  const expanded = streams.generalExpanded.getValue();
  streams.generalExpanded.next(!expanded);
});
streams.generalExpanded.subscribe((expanded) => {
  const contentGeneral = document.getElementById('contentGeneral');
  const iconGeneral = document.getElementById('iconGeneral');
  if (expanded) {
    iconGeneral.style.transform = 'rotate(-90deg)';
    contentGeneral.style.display = 'block';
  } else {
    iconGeneral.style.transform = 'rotate(90deg)';
    contentGeneral.style.display = 'none';
  }
  updateURL();
});

const headTones = document.getElementById('headTones');
streams.tonesExpanded = new rxjs.BehaviorSubject(
  DEFAULT_URLPARAMS['tonesExpanded']
);
rxjs.fromEvent(headTones, 'click').subscribe((ev) => {
  const expanded = streams.tonesExpanded.getValue();
  streams.tonesExpanded.next(!expanded);
});
streams.tonesExpanded.subscribe((expanded) => {
  const contentTones = document.getElementById('contentTones');
  const iconTones = document.getElementById('iconTones');
  if (expanded) {
    iconTones.style.transform = 'rotate(-90deg)';
    contentTones.style.display = 'block';
  } else {
    iconTones.style.transform = 'rotate(90deg)';
    contentTones.style.display = 'none';
  }
  updateURL();
});

const headStyle = document.getElementById('headStyle');
streams.styleExpanded = new rxjs.BehaviorSubject(
  DEFAULT_URLPARAMS['styleExpanded']
);
rxjs.fromEvent(headStyle, 'click').subscribe((ev) => {
  const expanded = streams.styleExpanded.getValue();
  streams.styleExpanded.next(!expanded);
});
streams.styleExpanded.subscribe((expanded) => {
  const contentStyle = document.getElementById('contentStyle');
  const iconStyle = document.getElementById('iconStyle');
  if (expanded) {
    iconStyle.style.transform = 'rotate(-90deg)';
    contentStyle.style.display = 'block';
  } else {
    iconStyle.style.transform = 'rotate(90deg)';
    contentStyle.style.display = 'none';
  }
  updateURL();
});

addEDOKeys();

// TODO Make default be read from URL
addAxis(1.2, 0.0)
addAxis(1.8, 1.5)
addAxis(1.0, 1.7)

// DEBUG
//new ToneObject(new Map(), true, streams, allTones)
//const t1 = new Map()
//const t2 = new Map()
//const t3 = new Map()
//t1.set(2, -1)
//t1.set(3, 1)
//t2.set(2, -1)
//t2.set(5, 1)
//t3.set(2, 1)
//new ToneObject(t1, false, streams, allTones)
//new ToneObject(t2, false, streams, allTones)
//new ToneObject(t3, false, streams, allTones)
const endtime = Date.now(); // DEBUG
console.log('Seconds till the end of script:', (endtime - starttime)/1000.0); // DEBUG
