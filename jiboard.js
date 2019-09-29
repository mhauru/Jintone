'use strict';
//import './node_modules/rxjs/Rx.js';
//import './node_modules/rxjs/index.js';
//import './node_modules/rxjs/bundles/rxjs.umd.min.js';
//import 'https://unpkg.com/rxjs/bundles/rxjs.umd.min.js';
import ResizeObserver from './node_modules/@juggle/resize-observer/lib/ResizeObserver.js';
//import('https://unpkg.com/rxjs/bundles/rxjs.umd.min.js').then((module) => {
//  console.log(module);
//});
//import './node_modules/tone/build/Tone.js';
//import('./node_modules/svgjs/dist/svg.min.js').then((module) => {
//  console.log(module);
//});

console.log('Done importing') // DEBUG
// TODO:
// - Should we change all the objects that really work only as dictonaries into
//   Maps?

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Global constants.

/*
// TODO Turn this into a generator that actually returns arbitrarily many
// primes.
const ALLPRIMES = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
  73, 79, 83, 89, 97,
];
const edofactor = Math.pow(2, 1/12);
const edofactorlog = Math.log2(edofactor);
const synth = new Tone.PolySynth(10, Tone.Synth).toMaster();

function startTone(tone) {
  synth.triggerAttack(tone);
}

function stopTone(tone) {
  synth.triggerRelease(tone);
}

const EDOTones = [];

function generateEDOTones() {
  const keytypes = [
    'C', 'black', 'D', 'black', 'E', 'F', 'black', 'G', 'black', 'A', 'black',
    'B',
  ];
  const letters = [
    'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯',
    'B',
  ];
  for (let octave = -1; octave < 10; octave++) {
    const baseFrequency = 523.251*Math.pow(2, octave-5);
    for (let i = 0; i < 12; i++) {
      const frequency = baseFrequency * Math.pow(edofactor, i);
      const letter = letters[i];
      const keytype = keytypes[i];
      const EDOTone = {
        'frequency': frequency,
        'letter': letter,
        'octave': octave,
        'keytype': keytype,
      };
      EDOTones.push(EDOTone);
    }
  }
}

generateEDOTones();

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Read the URL for parameter values to start with, and define a function for
// writing the URL.

// A global constant that holds the values of various parameters at the very
// start. These values will be either hard-coded default values, or values read
// from the URL query string.
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
  'horizontalZoom': 300,
  'verticalZoom': 100,
  'midX': 0.0,
  'midY': 0.0,
  'axes': [
    {'yShift': 1.2, 'harmDistStep': 0.0},
    {'yShift': 1.8, 'harmDistStep': 1.5},
    {'yShift': 1.0, 'harmDistStep': 1.7},
  ],
  'baseTones': [new Map()],
  'stepIntervals': [
    {'interval': [1, 0, 0], 'color': '#1d181e', 'show': true},
    {'interval': [-1, 1, 0], 'color': '#17726F', 'show': true},
    {'interval': [-2, 0, 1], 'color': '#774579', 'show': true},
  ],
  'settingsExpanded': true,
  'generalExpanded': true,
  'tonesExpanded': false,
  'stepIntervalsExpanded': false,
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
// Generic utility functions and classes.

function iteratorUnion(it1, it2) {
  return new Set([...it1, ...it2]);
}

function toneToString(tone) {
  return [...tone.entries()].sort().toString();
}

class VariableSourceSubject extends rxjs.Subject {
  constructor(joinFunction) {
    super();
    this.joinFunction = joinFunction;
    this.sources = new Set();
  }

  addSource(source) {
    this.sources.add(source);
    this.renewInnerSubscription();
  }

  removeSource(source) {
    this.sources.delete(source);
    this.renewInnerSubscription();
  }

  hasSource(source) {
    return this.sources.has(source);
  }

  renewInnerSubscription() {
    const innerObservable = this.joinFunction(...this.sources);
    if (this.innerSubscription) {
      this.innerSubscription.unsubscribe();
    }
    this.innerSubscription = innerObservable.subscribe(this);
  }
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Functions for arithmetic with coordinate representations of tones.

// Check whether two tones are equal.
function tonesEqual(tone1, tone2) {
  return [...subtractTone(tone1, tone2).values()].every((d) => d == 0);
}

// Take the difference tone1 - tone2.
function subtractTone(tone1, tone2) {
  const diff = new Map();
  iteratorUnion(tone1.keys(), tone2.keys()).forEach((key) => {
    const c1 = tone1.get(key) || 0;
    const c2 = tone2.get(key) || 0;
    const d = c1 - c2;
    if (d != 0) diff.set(key, d);
  });
  return diff;
}

// Sum tone1 + tone2.
function sumTones(tone1, tone2) {
  const sum = new Map();
  iteratorUnion(tone1.keys(), tone2.keys()).forEach((key) => {
    const c1 = tone1.get(key) || 0;
    const c2 = tone2.get(key) || 0;
    const d = c1 + c2;
    if (d != 0) sum.set(key, d);
  });
  return sum;
}

// Given an interval, compute the fraction representation as [num, denom].
function fraction(interval) {
  let num = 1.0;
  let denom = 1.0;
  interval.forEach(([p, c]) => {
    // TODO Could we rely on always assuming that c != 0?
    if (c > 0) num *= Math.pow(p, c);
    else denom *= Math.pow(p, -c);
  });
  return [num, denom];
}

// Find the unique prime decomposition of a fraction, and return the
// corresponding tone.
function primeDecompose(num, denom) {
  const tone = new Map();
  let i = 0;
  // Go through primes p, one by one starting from the smallest, taking out
  // factors of p from both the numerator and denominator. Once neither is
  // divisible by p any more, move to the next prime. Return once the numerator
  // and denominator have both been reduced to 1.
  while (i < ALLPRIMES.length) {
    const p = scaleFig.primes[i];
    const numDivisible = (num % p == 0);
    const denomDivisible = (denom % p == 0);
    if (numDivisible) {
      num = num / p;
      const newValue = (tone.get(p) || 0) + 1;
      if (newValue != 0) tone.set(p, newValue);
      else tone.delete(p);
    }
    if (denomDivisible) {
      denom = denom / p;
      const newValue = (tone.get(p) || 0) - 1;
      if (newValue != 0) tone.set(p, newValue);
      else tone.delete(p);
    }
    if (num == 1 && denom == 1) return tone;
    if (!numDivisible && !denomDivisible) {
      // We've exhausted this prime, go to the next one.
      i += 1;
    }
  }
  // TODO We should actually raise an error or something if we get here,
  // because too large primes were involved.
  return tone;
}

// Given an interval, compute the corresponding multiplicative factor for the
// pitch, as a float.
function pitchFactor(interval) {
  let pf = 1.0;
  interval.forEach(([p, c]) => {
    pf *= Math.pow(p, c);
  });
  return pf;
}

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
  'steps': scaleFig.canvas.group(),
  'tones': scaleFig.canvas.group(),
};

// Return a boolean for whether the coordinates (x, y) are in the current
// viewbox of the SVG canvas.
function isInViewbox(x, y) {
  const viewboxLeft = scaleFig.canvas.viewbox().x;
  const viewboxRight = viewboxLeft + scaleFig.canvas.viewbox().width;
  const viewboxTop = scaleFig.canvas.viewbox().y;
  const viewboxBottom = viewboxTop + scaleFig.canvas.viewbox().height;
  const inBoxHor = (viewboxLeft < x && x < viewboxRight);
  const inBoxVer = (viewboxTop < y && y < viewboxBottom);
  const inBox = inBoxHor && inBoxVer;
  return inBox;
}

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
  rxjs.fromEvent(divPanMod, 'pointerdown').pipe(map((ev) => {
    // Allow pointer event target to jump between objects when pointer is
    // moved.
    ev.target.releasePointerCapture(ev.pointerId);
    return ev;
  })),
  rxjs.fromEvent(window, 'keydown').pipe(filter((ev) => e.keyCode == 17)),
).pipe(map((ev) => true));

const falseOnPanUp = rxjs.merge(
  rxjs.fromEvent(divPanMod, 'mouseup'),
  rxjs.fromEvent(divPanMod, 'mouseleave'),
  rxjs.fromEvent(divPanMod, 'touchend'),
  rxjs.fromEvent(divPanMod, 'touchcancel'),
  rxjs.fromEvent(divPanMod, 'pointerup'),
  rxjs.fromEvent(divPanMod, 'pointerleave'),
  rxjs.fromEvent(window, 'keyup').pipe(filter((ev) => e.keyCode == 17)),
).pipe(map((ev) => false));

streams.panDown = rxjs.merge(trueOnPanDown, falseOnPanUp).pipe(
  startWith(false)
);

const trueOnSustainDown = rxjs.merge(
  rxjs.fromEvent(divSustainMod, 'mousedown'),
  rxjs.fromEvent(divSustainMod, 'touchstart'),
  rxjs.fromEvent(divSustainMod, 'pointerdown').pipe(map((ev) => {
    // Allow pointer event target to jump between objects when pointer is
    // moved.
    ev.target.releasePointerCapture(ev.pointerId);
    return ev;
  })),
  rxjs.fromEvent(window, 'keydown').pipe(filter((ev) => e.keyCode == 16)),
).pipe(map((ev) => true));

const falseOnSustainUp = rxjs.merge(
  rxjs.fromEvent(divSustainMod, 'mouseup'),
  rxjs.fromEvent(divSustainMod, 'mouseleave'),
  rxjs.fromEvent(divSustainMod, 'touchend'),
  rxjs.fromEvent(divSustainMod, 'touchcancel'),
  rxjs.fromEvent(divSustainMod, 'pointerup'),
  rxjs.fromEvent(divSustainMod, 'pointerleave'),
  rxjs.fromEvent(window, 'keyup').pipe(filter((ev) => e.keyCode == 16)),
).pipe(map((ev) => false));

streams.sustainDown = rxjs.merge(trueOnSustainDown, falseOnSustainUp).pipe(
  startWith(false)
);

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
  return ('clientX' in ev && 'clientY' in ev
    && !isNaN(ev.clientX) && !isNaN(ev.clientY));
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
const clientCoordsOnClick = rxjs.merge(
  rxjs.fromEvent(scaleFig.canvas, 'mousedown').pipe(filter(
    (ev) => ev.buttons == 1)
  ),
  rxjs.fromEvent(scaleFig.canvas, 'touchstart'),
  rxjs.fromEvent(scaleFig.canvas, 'pointerdown').pipe(filter(
    (ev) => ev.buttons == 1)
  ),
).pipe(
  map(eventClientCoords),
  filter(([x, y]) => !isNaN(x) && !isNaN(y)),
);

const trueOnCanvasOn = streams.clientCoordsOnClick.pipe(map((ev) => true));
const falseOnCanvasOff = rxjs.merge(
  rxjs.fromEvent(scaleFig.canvas, 'mouseup'),
  rxjs.fromEvent(scaleFig.canvas, 'mouseleave'),
  rxjs.fromEvent(scaleFig.canvas, 'touchend'),
  rxjs.fromEvent(scaleFig.canvas, 'touchcancel'),
  rxjs.fromEvent(scaleFig.canvas, 'pointerup'),
  rxjs.fromEvent(scaleFig.canvas, 'pointerleave'),
).pipe(map((ev) => false));
const canvasOn = rxjs.merge(falseOnCanvasOff, trueOnCanvasOn).pipe(
  startWith(false)
);

streams.panning = rxjs.combineLatest(streams.panDown, canvasOn).pipe(map(
  ([v1, v2]) => v1 && v2
));

streams.midCoords = new BehaviorSubject();
midCoords.next(startingParams['midCoords']);

const midCoordsOnClick = streams.midCoords(
  rxjs.operators.sample(clientCoordsOnClick)
);

// TODO Instead of having this get called on every move, we could just create
// the listener for this whenever panning is set to true, and remove it when
// its set to false. Could be faster?
const clientCoordsOnMove = rxjs.merge(
  rxjs.fromEvent(scaleFig.canvas, 'mousemove'),
  rxjs.fromEvent(scaleFig.canvas, 'touchmove'),
  rxjs.fromEvent(scaleFig.canvas, 'pointermove')
).pipe(
  map((ev) => {
    // To not duplicate events as touch/pointer/mouse.
    ev.preventDefault();
    return eventClientCoords(ev);
  }),
  filter(([x, y]) => !isNaN(x) && !isNaN(y)),
);

midCoords.subscribe(streams.clientCoordsOnMove.pipe(
  rxjs.operators.withLatestFrom(
    rxjs.combineLatest(streams.panning, clientCoordsOnClick, midCoordsOnClick)
  ),
  filter((arg) => arg[1]), // Filter out panning=false.
  map(([ccOnMove, panning, ccOnClick, mcOnClick]) => {
    const midX = mcOnClick[0] - ccOnMove[0] + ccOnClick[0];
    const midY = mcOnClick[1] - ccOnMove[1] + ccOnClick[1];
    return [midX, midY]
  }),
));

// TODO CONTINUE HERE.
// Fix the functions below, probably by using
// https://github.com/juggle/resize-observer
// and subscribing to combineLatest of some clientHeights and Widths, and
// midCoords. Once this is done, the next section until the beginning of
// comments is probably fine already.

midCoords.subscribe((val) => resizeCanvas(val));
resizeKeyCanvas();

function resizeCanvas(midCoords) {
  const divCanvas = document.getElementById('divCanvas');
  const h = divCanvas.clientHeight;
  const w = divCanvas.clientWidth;
  const canvas = scaleFig.canvas;
  canvas.viewbox(-w/2+midCoords[0], -h/2+scaleFig.midCoords[1], w, h);
}

function resizeKeyCanvas() {
  const divKeyCanvas = document.getElementById('divKeyCanvas');
  const w = divKeyCanvas.clientWidth;
  const keyCanvas = scaleFig.keyCanvas;
  keyCanvas.viewbox(-w/2+scaleFig.midX, 0, w, 1);
}

function resizeSettings() {
  const div = document.getElementById('divSettings');
  const header = document.getElementById('settingsHeader');
  const divInner = document.getElementById('divSettingsInner');
  const innerHeight = div.offsetHeight - header.offsetHeight;
  divInner.style.height = `${innerHeight}px`;
}

window.onresize = function(evt) {
  resizeCanvas();
  resizeKeyCanvas();
  resizeSettings();
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Create event streams for various variables and settings.

// Each element of this array describes one UI element and a corresponding
// parameter name and event. Each UI element will then be turned into an event
// stream of the given name, and initialized with the appropriate value.
const streamElements = [
  {
    'paramName': 'originFreq',
    'elemName': 'numOriginFreq',
    'eventName': 'input',
  },
  {
    'paramName': 'toneRadius',
    'elemName': 'numToneRadius',
    'eventName': 'input',
  },
  {
    'paramName': 'toneColor',
    'elemName': 'toneColor',
    'eventName': 'input',
  },
  {
    'paramName': 'toneColorActive',
    'elemName': 'toneColorActive',
    'eventName': 'input',
  },
  {
    'paramName': 'baseToneBorderColor',
    'elemName': 'baseToneBorderColor',
    'eventName': 'input',
  },
  {
    'paramName': 'baseToneBorderSize',
    'elemName': 'numBaseToneBorderSize',
    'eventName': 'input',
  },
  {
    'paramName': 'opacityHarmNorm',
    'elemName': 'cboxOpacityHarmNorm',
    'eventName': 'click',
  },
  {
    'paramName': 'showPitchlines',
    'elemName': 'cboxPitchlines',
    'eventName': 'click',
  },
  {
    'paramName': 'showKeys',
    'elemName': 'cboxKeys',
    'eventName': 'click',
  },
  {
    'paramName': 'showSteps',
    'elemName': 'cboxSteps',
    'eventName': 'click',
  },
  {
    'paramName': 'pitchlineColor',
    'elemName': 'colorPitchlines',
    'eventName': 'input',
  },
  {
    'paramName': 'pitchlineColorActive',
    'elemName': 'colorPitchlinesActive',
    'eventName': 'input',
  },
  {
    'paramName': 'horizontalZoom',
    'elemName': 'rangeHorzZoom',
    'eventName': 'input',
  },
  {
    'paramName': 'verticalZoom',
    'elemName': 'rangeVertZoom',
    'eventName': 'input',
  },
  {
    'paramName': 'maxHarmNorm',
    'elemName': 'numMaxHarmNorm',
    'eventName': 'input',
  },
];

streamElements.forEach((e) => {
  const elem = document.getElementById(e.elemName);
  streams[e.paramName] = rxjs.fromEvent(elem, e.eventName).pipe(
    rxjs.operators.pluck('target', 'value'),
    rxjs.operators.startWith(startingParams[e.paramName])
  );

  // Every time a new value is emitted, update the UI element(s) and the URL.
  streams[e.paramName].subscribe((value) => {
    elem.value = value;
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
  if (value) {
    divCanvas.style.height = '80%';
    divKeyCanvas.style.height = '20%';
  } else {
    divCanvas.style.height = '100%';
    divKeyCanvas.style.height = '0%';
  }
  resizeCanvas();
  resizeKeyCanvas();
});

streams.showPitchlines.subscribe((value) => {
  if (value) {
    scaleFig.svgGroups.pitchlines.attr('visibility', 'inherit');
  } else {
    scaleFig.svgGroups.pitchlines.attr('visibility', 'hidden');
  }
});

streams.showSteps.subscribe((value) => {
  if (value) {
    scaleFig.svgGroups.steps.attr('visibility', 'inherit');
  } else {
    scaleFig.svgGroups.steps.attr('visibility', 'hidden');
  }
});


/*
function divSustainModOn() {
  scaleFig.shiftDown = true;
}

function divSustainModOff() {
  scaleFig.shiftDown = false;
  scaleFig.sustainedTones.forEach((tone) => {
    tone.toneOff();
  });
  scaleFig.sustainedTones = [];
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Event listeners for adding new intervals and axes.

const buttAddInterval = document.getElementById('buttAddInterval');
function buttAddIntervalOnclick(value) {
  const interval = new Array(scaleFig.primes.length).fill(0);
  const color = '#000000';
  const show = true;
  addStepInterval(interval, color, show);
  updateURL();
}
buttAddInterval.onclick = function() {
  buttAddIntervalOnclick(this.checked);
};

const buttAddAxis = document.getElementById('buttAddAxis');
function buttAddAxisOnclick(value) {
  addAxis();
  updateURL();
}
buttAddAxis.onclick = function() {
  buttAddAxisOnclick(this.checked);
};

const buttRemoveAxis = document.getElementById('buttRemoveAxis');
function buttRemoveAxisOnclick(value) {
  removeAxis();
  updateURL();
}
buttRemoveAxis.onclick = function() {
  buttRemoveAxisOnclick(this.checked);
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class StepInterval {
  constructor(label, interval, color, show) {
    this.label = label;
    this._interval_ = [];
    this.initializeHtml();
    this.setListeners();
    this.svgGroup = scaleFig.svgGroups.steps.group();
    this.interval = interval;
    this.color = color;
    this.show = show;
  }

  initializeHtml() {
    const div = document.createElement('div');
    div.innerHTML = `Interval ${this.label}<br>`;
    this.div = div;

    const inFractionRep = document.createElement('input');
    inFractionRep.type = 'text';
    inFractionRep.size = '3';
    this.inFractionRep = inFractionRep;

    const inCoordinateRep = document.createElement('input');
    inCoordinateRep.type = 'text';
    inCoordinateRep.size = '7';
    this.inCoordinateRep = inCoordinateRep;

    const spanDecimalRep = document.createElement('span');
    this.spanDecimalRep = spanDecimalRep;

    const spanNameRep = document.createElement('span');
    this.spanNameRep = spanNameRep;

    const inColor = document.createElement('input');
    inColor.type = 'color';
    this.inColor = inColor;

    const inShow = document.createElement('input');
    inShow.type = 'checkbox';
    this.inShow = inShow;

    const buttDelete = document.createElement('button');
    buttDelete.innerHTML = 'Delete';
    this.buttDelete = buttDelete;

    const parReps = document.createElement('p');
    parReps.innerHTML = 'Interval: ';
    parReps.appendChild(inFractionRep);
    parReps.appendChild(inCoordinateRep);
    parReps.appendChild(spanDecimalRep);
    parReps.appendChild(spanNameRep);
    this.parReps = parReps;
    div.appendChild(parReps);

    const parColor = document.createElement('p');
    parColor.innerHTML = 'Color: ';
    parColor.appendChild(inColor);
    this.parColor = parColor;
    div.appendChild(parColor);

    const parShow = document.createElement('p');
    parShow.innerHTML = 'Show: ';
    parShow.appendChild(inShow);
    this.parShow = parShow;
    div.appendChild(parShow);

    const parDelete = document.createElement('p');
    parShow.appendChild(buttDelete);
    this.parDelete = parDelete;
    div.appendChild(parDelete);
  }

  setListeners() {
    const t = this;
    this.inColor.oninput = function() {
      t.color = this.value;
    };
    this.inShow.onclick = function() {
      t.show = this.checked;
    };
    this.buttDelete.onclick = function() {
      deleteStepInterval(t.label);
    };
    this.inCoordinateRep.onchange = function() {
      // TODO Sanitize and check input format.
      // TODO Check that this interval doesn't exist already. Same in the other
      // setter functions.
      const interval = t.parseInCoordinateRepValue(this.value);
      t.interval = interval;
    };
    this.inFractionRep.onchange = function() {
      const interval = t.parseInFractionRepValue(this.value);
      t.interval = interval;
    };
  }

  get pitchFactor() {
    return pitchFactor(this.interval);
  }

  get fraction() {
    return fraction(this.interval);
  }

  // TODO Static method?
  parseInFractionRepValue(value) {
    const [numStr, denomStr] = value.split('/');
    if (denomStr == undefined) denom = '1';
    const num = Number(numStr);
    const denom = Number(denomStr);
    const tone = primeDecompose(num, denom);
    while (tone.length < scaleFig.primes.length) {
      tone.push(0.0);
    }
    return tone;
  }

  // TODO Static method?
  parseInCoordinateRepValue(value) {
    return JSON.parse(value);
  }

  setFractionRepValue(tone) {
    const [num, denom] = fraction(tone);
    const str = num.toString() + '/' + denom.toString();
    this.inFractionRep.value = str;
  }

  setDecimalRepValue(tone) {
    const pf = pitchFactor(tone);
    this.spanDecimalRep.innerHTML = pf.toString();
  }

  setCoordinateRepValue(tone) {
    this.inCoordinateRep.value = JSON.stringify(tone);
  }

  get color() {
    return this._color_;
  }
  set color(color) {
    this._color_ = color;
    this.inColor.value = color;
    // TODO Should all these global calls happen here, in this class?
    recolorSteps();
    updateURL();
  }

  get show() {
    return this._show_;
  }
  set show(show) {
    this._show_ = show;
    this.inShow.checked = show;
    if (show) {
      this.svgGroup.attr('visibility', 'inherit');
    } else {
      this.svgGroup.attr('visibility', 'hidden');
    }
    updateURL();
  }

  get interval() {
    return this._interval_;
  }
  set interval(interval) {
    if (this._interval_ == interval) return;
    const _interval_ = this._interval_;
    _interval_.splice(0, _interval_.length);
    _interval_.splice(0, interval.length, ...interval);
    this.setCoordinateRepValue(_interval_);
    this.setDecimalRepValue(_interval_);
    this.setFractionRepValue(_interval_);
    // TODO Check name, set nameRep
    // TODO Should all these global calls happen here, in this class?
    updateStepEndpoints();
    repositionSteps();
    reopacitateSteps();
    updateURL();
  }
}

class Step {
  constructor(label, origin) {
    this.label = label;
    this.origin = origin;
    this.updateEndpoint();
    this.initializeSvg();
    this.position();
    this.color();
    this.opacitate();
  }

  initializeSvg() {
    const grad = scaleFig.canvas.gradient('linear', function(stop) {
      stop.at({'offset': 0});
      stop.at({'offset': 1});
    });
    grad.attr('gradientUnits', 'userSpaceOnUse');
    const svgGroup = scaleFig.stepIntervals[this.label].svgGroup;
    const svgStep = svgGroup.line(0, 0, 0, 0).attr({
      'visibility': 'hidden',
      'stroke': grad,
      'stroke-width': 2.5,
      'stroke-linecap': 'butt',
      'stroke-linejoin': 'miter',
      'stroke-miterlimit': 4,
      'stroke-opacity': 1,
    });
    this.grad = grad;
    this.svgStep = svgStep;
  }

  updateEndpoint() {
    const originCoords = this.origin.coords;
    const interval = scaleFig.stepIntervals[this.label].interval;
    const endpointCoords = sumTones(originCoords, interval);
    const endpoint = scaleFig.tones[endpointCoords];
    this.endpoint = endpoint;
    if (!(endpoint === undefined)) {
      endpoint.incomingSteps[this.label] = this;
    }
  }

  get hasEndpoint() {
    return !(this.endpoint === undefined);
  }

  opacitate() {
    if (!(this.hasEndpoint)) return;
    const svgStep = this.svgStep;
    const grad = this.grad;
    const relHn1 = this.origin.relHarmNorm;
    const relHn2 = this.endpoint.relHarmNorm;
    grad.get(0).attr('stop-opacity', relHn1);
    grad.get(1).attr('stop-opacity', relHn2);
    // TODO This used to be || instead of &&. That allowed drawing dangling
    // steps to tones that were not visible. However, there's no guarantee that
    // these endpoint tones will even be generated, since generation is
    // strictly based on the viewbox and harmonic distance, and not on what the
    // stepIntervals are. Rethink how to decide which steps to draw. Should we
    // draw steps to tones that are outside the viewbox? (note that they could
    // be faaaar out.) Should we draw steps to tones that are outside the
    // harmonic distance limit? If so, we should probably opacitate them
    // correctly, namely not round all negative relHns to 0. Maybe the right
    // way to go would be to separate drawing of steps from an endpoint tone
    // existing, but this requires separate functions for evaluating relHns,
    // and makes it harder to avoid duplicates and/or make steps be removed
    // correctly if and only if both endpoints are removed.
    if (relHn1 > 0 && relHn2 > 0) {
      svgStep.attr('visibility', 'inherit');
    } else {
      svgStep.attr('visibility', 'hidden');
    }
  }

  color() {
    if (!(this.hasEndpoint)) return;
    const color = scaleFig.stepIntervals[this.label].color;
    const grad = this.grad;
    grad.get(0).attr('stop-color', color);
    grad.get(1).attr('stop-color', color);
  }

  position() {
    if (!(this.hasEndpoint)) return;
    const svgStep = this.svgStep;
    const grad = this.grad;
    const origin = this.origin;
    const endpoint = this.endpoint;
    const [x1, y1] = [origin.xpos, origin.ypos];
    const [x2, y2] = [endpoint.xpos, endpoint.ypos];
    const r = scaleFig.style['toneRadius'];
    const stepLength = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
    const x1Edge = x1 - r*(x1-x2)/stepLength;
    const y1Edge = y1 - r*(y1-y2)/stepLength;
    const x2Edge = x2 + r*(x1-x2)/stepLength;
    const y2Edge = y2 + r*(y1-y2)/stepLength;
    svgStep.attr('x1', x1Edge);
    svgStep.attr('x2', x2Edge);
    svgStep.attr('y1', y1Edge);
    svgStep.attr('y2', y2Edge);
    grad.attr('x1', x1);
    grad.attr('x2', x2);
    grad.attr('y1', y1);
    grad.attr('y2', y2);
  }

  destroy() {
    this.svgStep.remove();
    delete this.origin.steps[this.label];
    if (this.hasEndpoint) {
      delete this.endpoint.incomingSteps[this.label];
    }
  }
}

// TODO The 'Object' part of the name is to avoid a name collission with
// Tone.js. Think about namespace management.
class ToneObject {
  // TODO Everything is recomputed from the minimal set of data necessary to
  // store.  This is easy, but slow. Optimize if necessary by storing some of
  // the data, avoiding recomputation if nothing has changed.
  constructor(coordinates, isBase) {
    this.isOn = false;
    this.isBeingClicked = false;
    this.coords = coordinates;
    this._isBase_ = isBase;
    this.steps = {};
    this.incomingSteps = {};

    this.svgTone = scaleFig.svgGroups['tones'].group();
    this.svgCircle = this.svgTone.circle(1.0);
    this.svgLabel = this.svgTone.text('');
    // TODO Where do these numbers come from?
    const pitchlineGroup = scaleFig.svgGroups['pitchlines'];
    this.svgPitchline = pitchlineGroup.path('M 0,-1000 V 2000');
    this.positionSvg();
    this.setLabelText();
    this.colorSvg();
    this.scaleSvgTone();
    this.setListeners();
    this.addSteps();
  }

  toneOn() {
    if (!this.isOn) {
      this.isOn = true;
      const toneColorActive = scaleFig.style['toneColorActive'];
      this.svgCircle.attr('fill', toneColorActive);
      const pitchlineColorActive = scaleFig.style['pitchlineColorActive'];
      this.svgPitchline.attr('stroke', pitchlineColorActive);
      startTone(this.frequency);
    }
  }

  toneOff() {
    if (scaleFig.shiftDown) {
      scaleFig.sustainedTones.push(this);
    } else if (!this.isBeingClicked) {
      this.isOn = false;
      const toneColor = scaleFig.style['toneColor'];
      this.svgCircle.attr('fill', toneColor);
      const pitchlineColor = scaleFig.style['pitchlineColor'];
      this.svgPitchline.attr('stroke', pitchlineColor);
      stopTone(this.frequency);
    }
  }

  setListeners() {
    // TODO We fire a lot of events, mouse, touch and pointer ones. Depending
    // on the browser, the same click or touch may fire several, e.g. both
    // touch and mouse or both pointer and mouse. This ensures maximum
    // compatibility with different browsers, but probably costs something in
    // performance. Note though that the same tone isn't played twice. Come
    // back to this later and check whether we could switch for instance using
    // only PointerEvents, once they have widespread support.
    const t = this;
    function eventOn(ev) {
      if (!scaleFig.ctrlDown) {
        t.isBeingClicked = true;
        t.toneOn();
        // preventDefault stops touch events from also generating mouse events,
        // causing duplication of events.
        ev.preventDefault();
      }
    };
    function eventOff(ev) {
      t.isBeingClicked = false;
      t.toneOff();
    };
    function eventOnMouse(ev) {
      if (ev.buttons == 1) {
        eventOn(ev);
      }
    };
    function eventOffMouse(ev) {
      eventOff(ev);
    };
    function eventOnTouch(ev) {
      eventOn(ev);
    };
    function eventOffTouch(ev) {
      eventOff(ev);
    };
    function eventOnPointer(ev) {
      // Allow pointer event target to jump between objects when pointer is
      // moved.
      ev.target.releasePointerCapture(ev.pointerId);
      if (ev.buttons == 1) {
        eventOn(ev);
      }
    };
    function eventOffPointer(ev) {
      // Allow pointer event target to jump between objects when pointer is
      // moved.
      ev.target.releasePointerCapture(ev.pointerId);
      eventOff(ev);
    };
    // TODO Could switch to PointerEvents once they have a bit more support
    // across different browsers: https://caniuse.com/#feat=pointer
    const svgTone = this.svgTone;
    svgTone.mousedown(eventOnMouse);
    svgTone.mouseup(eventOffMouse);
    svgTone.mouseleave(eventOffMouse);
    svgTone.mouseenter(eventOnMouse);
    svgTone.touchstart(eventOnTouch);
    svgTone.touchend(eventOffTouch);
    svgTone.touchcancel(eventOffTouch);
    svgTone.on('pointerdown', eventOnPointer);
    svgTone.on('pointerup', eventOffPointer);
    svgTone.on('pointerleave', eventOffPointer);
    svgTone.on('pointerenter', eventOnPointer);

    // Reactive stuff
    const pf = pitchFactor(this.coords);

    const xpos = streams.horizontalZoom.pipe(
      rxjs.operators.map((zoom) => {
        return zoom * Math.log2(pf);
      })
    );

    const ypos = streams.verticalZoom.pipe(
      rxjs.operators.map((zoom) => {
        let y = 0.0;
        this.coords.forEach(([p, c]) => {
          const pStr = p.toString();
          // TODO Is the check necessary?
          if (scaleFig.yShifts.hasOwnProperty(pStr)) {
            y += -scaleFig.yShifts[pStr] * c;
          }
        });
        y *= zoom;
        return y;
      })
    );

    const harmDistsCombined = new VariableSourceSubject(rxjs.combineLatest);
    const harmDists = new Map();

    streams.baseTones.subscribe((baseTones) => {
      // Remove harmDists if the corresponding baseTone is no longer a
      // baseTone.
      for (const baseTone of harmDists.keys()) {
        if (!(baseTone in baseTones)) {
          harmDistsCombined.removeSource(harmDists.get(baseTone));
          harmDists.delete(baseTone);
        }
      }

      // Add new harmDists if new baseTones are present.
      baseTones.forEach((baseTone) => {
        if (!harmDists.has(baseTone)) {
          const interval = subtractTone(this.coords, baseTone);
          const primes = [...interval.keys()];
          const facts = primes.map((p) => Math.abs(interval[p]));
          const steps = primes.map((p) => streams.harmDistSteps[p]);
          const dist = rxjs.combineLatest(...steps).pipe(rxjs.operators.map(
            (...v) => {
              let d = 0;
              for (let i = 0; i < v.length; i++) {
                const c = facts[i];
                const s = v[i];
                if (c != 0.0) d += s*c;
              }
              return d;
            }));
          harmDists.set(baseTone, dist);
          harmDistsCombined.addSource(dist);
        }
      });
    });

    const harmNorm = harmDistsCombined.pipe(rxjs.operators.map(Math.min));

    const inbounds = rxjs.combineLatest(
      harmNorm, streams.maxHarmNorm, xpos, ypos
    ).pipe(rxjs.operators.map(([hn, maxhn, inviewbox, x, y]) => {
      // TODO Add note radius, to check if the edge of a note fits, rather
      // than center?
      const inViewbox = isInViewbox(this.xpos, this.ypos);
      const harmClose = (hn <= maxhn);
      return harmClose && inViewbox;
    }));

    const relHarmNorm = rxjs.combineLatest(harmNorm, streams.maxHarmNorm).pipe(
      rxjs.operators.map(([hn, maxhn]) => {
        let relHn = Math.max(1.0 - hn/maxhn, 0.0);
        // TODO Should opacityHarmNorm really be checked here, and not in the
        // drawing function?
        if (!scaleFig.style['opacityHarmNorm'] && relHn > 0.0) {
          relHn = 1.0;
        }
        return relHn;
      })
    );

    rxjs.combineLatest(xpos, ypos).subscribe(
      ([x, y]) => this.svgTone.move(x, y)
    );
    xpos.subscribe((x) => this.svgPitchline.x(x));

    rxjs.combineLatest(relHarmNorm, inbounds).subscribe(([hn, ib]) => {
      const svgPitchline = this.svgPitchline;
      if (ib && hn > 0) {
        svgPitchline.attr('visibility', 'inherit');
      } else {
        svgPitchline.attr('visibility', 'hidden');
      }
    });
  }

  colorSvgPitchline() {
    const svgPitchline = this.svgPitchline;
    const relHn = this.relHarmNorm;
    const style = scaleFig.style;
    let pitchlineColor;
    if (this.isOn) {
      pitchlineColor = style['pitchlineColorActive'];
    } else {
      pitchlineColor = style['pitchlineColor'];
    }
    svgPitchline.attr({
      'stroke': pitchlineColor,
      'stroke-width': '1.0',
      'stroke-miterlimit': 4,
      'stroke-dasharray': '0.5, 0.5',
      'stroke-dashoffset': 0,
      'stroke-opacity': relHn,
    });
  }

  set isBase(value) {
    this._isBase_ = value;
    this.colorSvgTone();
    this.scaleSvgTone();
  }

  get isBase() {
    return this._isBase_;
  }

  get pitchFactor() {
    let pf = 1.0;
    this.coords.forEach(([p, c]) => {
      pf *= Math.pow(p, c);
    });
    return pf;
  }

  get xpos() {
    return scaleFig.horizontalZoom * Math.log2(this.pitchFactor);
  }

  get ypos() {
    let y = 0.0;
    this.coords.forEach(([p, c]) => {
      const pStr = p.toString();
      // TODO Is the check necessary?
      if (scaleFig.yShifts.hasOwnProperty(pStr)) {
        y += -scaleFig.yShifts[pStr] * c;
      }
    });
    y *= scaleFig.verticalZoom;
    return y;
  }

  get fraction() {
    return fraction(this.coords);
  }

  get frequency() {
    return scaleFig.originFreq * this.pitchFactor;
  }

  get harmDists() {
    const harmDists = [];
    for (let i = 0; i < scaleFig.baseTones.length; i += 1) {
      const bt = scaleFig.baseTones[i];
      // TODO Remove explicit argument scaleFig?
      const dist = harmDist(scaleFig, this.coords, bt);
      harmDists.push(dist);
    }
    return harmDists;
  }

  get harmNorm() {
    return Math.min(...this.harmDists);
  }

  get relHarmNorm() {
    const hn = this.harmNorm;
    let relHn = Math.max(1.0 - hn/scaleFig.maxHarmNorm, 0.0);
    if (!scaleFig.style['opacityHarmNorm'] && relHn > 0.0) {
      relHn = 1.0;
    }
    return relHn;
  }

  get inbounds() {
    // TODO Add note radius, to check if the edge of a note fits, rather
    // than center?
    const harmClose = (this.harmNorm <= scaleFig.maxHarmNorm);
    // Remove explicit scaleFig reference?
    const inViewbox = isInViewbox(scaleFig, this.xpos, this.ypos);
    return harmClose && inViewbox;
  }

  get inclosure() {
    const harmClose = (this.harmNorm <= scaleFig.maxHarmNorm);
    const viewboxLeft = scaleFig.canvas.viewbox().x;
    const viewboxRight = viewboxLeft + scaleFig.canvas.viewbox().width;
    const viewboxTop = scaleFig.canvas.viewbox().y;
    const viewboxBottom = viewboxTop + scaleFig.canvas.viewbox().height;
    const maxPrime = Math.max(...scaleFig.primes);
    const maxXjump = scaleFig.horizontalZoom * Math.log2(maxPrime);
    const maxYshift = Math.max(...Object.values(scaleFig.yShifts));
    const maxYjump = scaleFig.verticalZoom * maxYshift;
    const closureLeft = viewboxLeft - maxXjump;
    const closureRight = viewboxRight + maxXjump;
    const closureTop = viewboxTop - maxYjump;
    const closureBottom = viewboxBottom + maxYjump;
    const inClosureHor = (closureLeft < this.xpos && this.xpos < closureRight);
    const inClosureVer = (closureTop < this.ypos && this.ypos < closureBottom);
    const inViewClosure = inClosureHor && inClosureVer;
    return harmClose && inViewClosure;
  }

  setLabelText() {
    let labelText;
    const frequency = this.frequency;
    if (scaleFig.toneLabelTextStyle == 'EDO') {
      let i = 0;
      // Note that we rely on EDOTones being in rising order of pitch.
      while (i < EDOTones.length - 2) {
        if (EDOTones[i+1].frequency > frequency) break;
        i++;
      }
      const lowerNeighbor = EDOTones[i].frequency;
      const heigherNeighbor = EDOTones[i+1].frequency;
      const lowerDistance = Math.abs(lowerNeighbor - frequency);
      const heigherDistance = Math.abs(heigherNeighbor - frequency);
      let neighbor;
      if (lowerDistance < heigherDistance) {
        neighbor = EDOTones[i];
      } else {
        neighbor = EDOTones[i+1];
      }
      // These are just constant, figured out by trial and error, that seem to
      // do the job.
      const subShift = 2;
      const subFontSize = 12;
      labelText = (add) => {
        add.tspan(`${neighbor.letter}`);
        add.tspan(`${neighbor.octave}`).attr({
          'dy': subShift,
          'font-size': subFontSize,
        });
      };
    } else if (scaleFig.toneLabelTextStyle == 'fractions') {
      const [num, denom] = this.fraction;
      // These are just constant, figured out by trial and error, that seem to
      // do the job.
      const solidusShift = 3;
      const denomShift = 3;
      const numFontSize = 15;
      const solidusFontSize = 15;
      labelText = (add) => {
        add.tspan(num).attr({
          'font-size': numFontSize,
        });
        add.tspan('\u002F').attr({
          'dy': solidusShift,
          'font-size': solidusFontSize,
        });
        add.tspan(denom).attr({
          'dy': denomShift,
          'font-size': numFontSize,
        });
      };
    } else if (scaleFig.toneLabelTextStyle == 'none') {
      labelText = '';
    } else {
      labelText = '';
    }
    this.svgLabel.text(labelText);
    this.scaleSvgTone();
  }

  addSteps() {
    Object.entries(scaleFig.stepIntervals).forEach(([label, stepInterval]) => {
      if (label in this.steps) return;
      this.steps[label] = new Step(label, this);
    });
  }

  positionSvg() {
    this.setSvgPitchlineVisibility();
    Object.entries(this.steps).forEach(([label, step]) => {
      step.position();
    });
  }

  colorSvg() {
    this.colorSvgTone();
    this.colorSvgPitchline();
    this.setSvgPitchlineVisibility();
  }

  positionSvgTone() {
    // this.svgTone.move(this.xpos, this.ypos); replaced by reactions
  }

  scaleSvgTone() {
    const svgCircle = this.svgCircle;
    const svgLabel = this.svgLabel;
    const style = scaleFig.style;
    const toneRadius = style['toneRadius'];
    if (this.isBase) {
      const borderSize = style['baseToneBorderSize'];
      svgCircle.radius(toneRadius + borderSize/2);
    } else {
      svgCircle.radius(toneRadius);
    }
    Object.entries(this.steps).forEach(([label, step]) => {
      step.position();
    });
    // Compute the right scaling factor for the text, so that it fits in the
    // circle.
    const bbox = svgLabel.bbox();
    // Note that bbox dimensions do not account for the currenc scaleY and
    // scaleX. And that's what we want.
    const halfDiagLength = Math.sqrt(bbox.w*bbox.w + bbox.h*bbox.h)/2;
    // The 0.95 is to give a bit of buffer around the edges.
    const targetFactor = 0.95*toneRadius/halfDiagLength;
    // If we can comfortably fit within the tone, we won't scale larger than
    // maxFactor. This makes most labels be of the same size, and have the size
    // decrease from maxFactor only when necessary.
    const maxFactor = toneRadius/16;
    const scaleFactor = Math.min(maxFactor, targetFactor);
    // TODO Why on earth do we need to call center before scale? I would have
    // thought that either it doesn't matter, or it needs to be done the other
    // way around, but that doesn't work.
    svgLabel.center(0, 0);
    svgLabel.scale(scaleFactor);
  }

  colorSvgTone() {
    const svgTone = this.svgTone;
    const svgCircle = this.svgCircle;
    const relHn = this.relHarmNorm;
    const style = scaleFig.style;
    if (relHn <= 0.0) {
      svgTone.attr('visibility', 'hidden');
      // The other stuff doesn't matter if its hidden, so may as well return.
      return;
    } else {
      svgTone.attr('visibility', 'inherit');
    }
    let toneColor;
    if (this.isOn) {
      toneColor = style['toneColorActive'];
    } else {
      toneColor = style['toneColor'];
    }
    if (this.isBase) {
      const borderColor = style['baseToneBorderColor'];
      const borderSize = style['baseToneBorderSize'];
      svgCircle.attr({
        'stroke': borderColor,
        'stroke-width': borderSize,
      });
    } else {
      svgCircle.attr({
        'stroke-width': 0.0,
      });
    }
    svgCircle.attr({
      'fill': toneColor,
    });
    svgTone.attr({
      'fill-opacity': relHn,
    });
  }

  positionSvgPitchline() {
    // this.svgPitchline.x(this.xpos); replaced by reacions.
  }

  setSvgPitchlineVisibility() {
    // replaced by reactive stuff
  }

  destroy() {
    this.svgTone.remove();
    this.svgPitchline.remove();
    Object.entries(this.steps).forEach(([label, step]) => {
      step.destroy();
      delete this.steps[label];
    });
    Object.entries(this.incomingSteps).forEach(([label, step]) => {
      step.endpoint = undefined;
      step.position();
      step.color();
      step.opacitate();
    });
  }
}

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

  scaleFig.svgGroups.steps.each((i, stepGroups) => {
    stepGroups[i].children().forEach((svgStep) => {
      const hasParent = svgSteps.includes(svgStep);
      if (!hasParent) {
        const msg = `Error: svgStep ${svgStep.id()} is not the \
step of any tone.`;
        console.log(msg);
      }
    });
  });
}

function generateTones() {
  // TODO This doesn't work if a baseTone is outside of the viewbox closure.
  // Starting from the current boundary tones, i.e. tones that are not
  // inbounds (drawable) but are within the closure (close enough to
  // being drawable that they may be necessary to reach all drawable tones),
  // check whether any of them have actually come within the closure since we
  // last checked. If yes, generate all their neighbors (that don't already
  // exist), and recursively check whether they are within the closure.  At
  // the end, all possible tones within the closure, and all their neighbors,
  // should exist, but the neighbors that are outside the closure should not
  // further have their neighbors generated.
  const stepIntervals = Object.entries(scaleFig.stepIntervals);
  let roots = Object.entries(scaleFig.boundaryTones);
  while (roots.length > 0) {
    const [rootStr, rootTone] = roots.pop();
    const inclosure = rootTone.inclosure;
    if (inclosure) {
      // The tone in question is close enough to the drawable tones, that
      // we generate more tones starting from it. After this, it will no
      // longer be a boundary tone.
      const added = addNeighbors(rootTone);
      roots = roots.concat(added);
      delete scaleFig.boundaryTones[rootStr];
      // Check whether any endpointless steps would have an endpoint in one
      // of the new tones.
      added.forEach(([newStr, newTone]) => {
        stepIntervals.forEach(([label, stepInterval]) => {
          const interval = stepInterval.interval;
          const originCoords = subtractTone(newTone.coords, interval);
          const originStr = toneToString(originCoords);
          if (!(originStr in scaleFig.tones)) return;
          const originTone = scaleFig.tones[originStr];
          const step = originTone.steps[label];
          step.updateEndpoint();
          step.position();
          step.color();
          step.opacitate();
        });
      });
    }
  }
}

function deleteTones() {
  // TODO This doesn't work if a baseTone is outside of the viewbox closure.
  // The complement of generateTones: Start from the boundary tones, working
  // inwards, deleting all tones that are two or more ste removed from the
  // closure zone.
  let leaves = Object.entries(scaleFig.boundaryTones);
  while (leaves.length > 0) {
    const [leafStr, leafTone] = leaves.pop();
    // TODO We actually know that at least all the tones we added during
    // this lop are inclosure. So this could be optimized by running the
    // inclosure filter before the main while loop, avoiding rechecking
    // inclosure. Then again, a storage system within Tone for
    // inclosure would do the same and more.
    const inclosure = leafTone.inclosure;
    if (!inclosure) {
      const [stillBoundary, marked] = markNeighbors(leafTone);
      leaves = leaves.concat(marked);
      if (!stillBoundary) {
        leafTone.destroy();
        delete scaleFig.boundaryTones[leafStr];
        delete scaleFig.tones[leafStr];
      }
    }
  }
}

function markNeighbors(tone) {
  const marked = [];
  let stillBoundary = false;
  for (let i = 0; i < scaleFig.primes.length; i += 1) {
    [-1, +1].forEach(function(increment) {
      const neighCoords = sumTones(tone.coords, new Map([i, increment]));
      const neighStr = toneToString(neighCoords);
      if (!(neighStr in scaleFig.tones)) {
        // This tone doesn't exist, moving on.
        return;
      }
      const neighTone = scaleFig.tones[neighStr];
      if (neighTone.inclosure) {
        stillBoundary = true;
      } else if (!(neighStr in scaleFig.boundaryTones)) {
        scaleFig.boundaryTones[neighStr] = neighTone;
        marked.push([neighStr, neighTone]);
      }
    });
  }
  return [stillBoundary, marked];
}

function addNeighbors(tone) {
  const added = [];
  for (let i = 0; i < scaleFig.primes.length; i += 1) {
    [-1, +1].forEach(function(increment) {
      const neighCoords = sumTones(tone.coords, new Map([i, increment]));
      const neighStr = toneToString(neighCoords);
      if (neighStr in scaleFig.tones) {
        // This tone exists already, moving on.
        return;
      }
      const neighTone = addTone(neighCoords, false);
      added.push([neighStr, neighTone]);
      scaleFig.boundaryTones[neighStr] = neighTone;
    });
  }
  return added;
}

function addTone(tone, isBase) {
  const toneStr = toneToString(tone);
  const newTone = new ToneObject(tone, isBase);
  scaleFig.tones[toneStr] = newTone;
  return newTone;
}

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

function deleteStepInterval(label) {
  Object.entries(scaleFig.tones).forEach(([coords, tone]) => {
    if (label in tone.steps) tone.steps[label].destroy();
  });
  const stepInterval = scaleFig.stepIntervals[label];
  const divStepIntervals = document.getElementById('divGeneratedStepIntervals');
  divStepIntervals.removeChild(stepInterval.div);
  stepInterval.svgGroup.remove();
  delete scaleFig.stepIntervals[label];
  updateURL();
}

function addStepInterval(interval, color, show) {
  const existingLabels = Object.keys(scaleFig.stepIntervals);
  let labelInt = 1;
  while (existingLabels.includes(labelInt.toString())) {
    labelInt++;
  }
  const label = labelInt.toString();
  const stepInterval = new StepInterval(label, interval, color, show);
  scaleFig.stepIntervals[label] = stepInterval;
  const divStepIntervals = document.getElementById('divGeneratedStepIntervals');
  divStepIntervals.appendChild(stepInterval.div);

  Object.entries(scaleFig.tones).forEach(([coords, tone]) => {
    tone.addSteps();
  });
}

function addAxis() {
  const prime = ALLPRIMES[scaleFig.primes.length];

  const inNumYshift = document.createElement('input');
  inNumYshift.id = `inNumYshift_${prime}`;
  inNumYshift.type = 'number';
  inNumYshift.min = -500;
  inNumYshift.max = 500;
  inNumYshift.step = 0.01;
  inNumYshift.style.width = '80px';

  const inRangeYshift = document.createElement('input');
  inRangeYshift.id = `inRangeYshift_${prime}`;
  inRangeYshift.type = 'range';
  inRangeYshift.step = 0.01;
  inRangeYshift.max = 500.0;
  inRangeYshift.min = -500.0;

  const inNumHarmdiststep = document.createElement('input');
  inNumHarmdiststep.id = `inNumHarmdiststep_${prime}`;
  inNumHarmdiststep.type = 'number';
  inNumHarmdiststep.min = -500;
  inNumHarmdiststep.max = 500;
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

  inNumYshift.onchange = function() {
    // TODO Check input to be a number
    yShiftOnchange(prime, this.value);
  };
  inRangeYshift.oninput = function() {
    yShiftOnchange(prime, this.value);
  };

  const numStepStream = rxjs.fromEvent(inNumHarmdiststep, 'change');
  const rangeStepStream = rxjs.fromEvent(inRangeHarmdiststep, 'change');
  harmDistStep = rxjs.operators.merge(numStepStream, rangeStepStream).pipe(
    rxjs.operators.pluck('target', 'value'),
    rxjs.operators.startWith() // TODO This should be the latest maxHarmNorm.
  );
  streams.harmDistSteps.set(prime, harmDistStep);
  harmDistStep.subscribe((value) => {
    inNumHarmdiststep.value = value;
    inRangeHarmdiststep.value = value;
  });
  rxjs.operators.pairwise(harmDistStep).subscribe(
    ([oldValue, value]) => {
      if (oldValue > value) {
        generateTones();
      } else {
        deleteTones();
      }
      updateURL();
    }
  );

  yShiftOnchange(prime, 0.0);

  scaleFig.primes.push(prime);

  Object.entries(scaleFig.tones).forEach(([coordsStr, tone]) => {
    // Now that there's a new axis, but every tone has coordinate 0 on it, all
    // of them are boundary.
    scaleFig.boundaryTones[newCoordsStr] = tone;
  });

  // TODO Should we also call generateTones here? That harmDistStep is infinity
  // means that none would be visible, but we are breaking the rule of having
  // all the neighbours of all inbounds tones exist. Then again, maybe that
  // rule should be given up, if we give up drawing dangling steps.
}

function removeAxis() {
  const primes = scaleFig.primes;
  const numPrimes = primes.length;
  const prime = primes[numPrimes-1];
  scaleFig.primes = primes.slice(0, numPrimes-1);
  const divAxis = document.getElementById(`divAxis_${prime}`);
  document.getElementById('contentAxes').removeChild(divAxis);

  // Remove any baseTones that have a non-zero component along this axis.
  let i = 0;
  while (i < scaleFig.baseTones.length) {
    if (scaleFig.baseTones[i].has(prime)) {
      scaleFig.baseTones.splice(i, 1);
    } else {
      i++;
    }
  }

  Object.entries(scaleFig.tones).forEach(([coordsStr, tone]) => {
    const coords = tone.coords;
    if (coords.has(prime)) {
      // TODO Turn this into a function removeTone?
      tone.destroy();
      delete scaleFig.tones[coordsStr];
      if (coordsStr in scaleFig.boundaryTones) {
        delete scaleFig.boundaryTones[coordsStr];
      }
    }
  });
}

class Key {
  constructor(frequency, type) {
    this.isOn = false;
    this.isBeingClicked = false;
    this.frequency = frequency;
    this.type = type;
    this.createSvg();
    this.setListeners();
    this.scaleSvg();
    this.positionSvg();
  }

  createSvg() {
    const container = scaleFig.keyCanvas;
    // TODO Make this a global constant, or at least set elsewhere.
    const ef = edofactorlog;
    const ht = ef/2;
    const bh = 2/3;
    let str;
    if (this.type == 'C') {
      const prot = 2/3;
      str = `${-ht},0, ${ht},0\
             ${ht},${bh} ${ht+ef*prot},${bh}\
             ${ht+ef*prot},1 ${-ht},1`;
    } else if (this.type == 'D') {
      const protl = 1/3;
      const protr = 1/3;
      str = `${-ht},0, ${ht},0\
             ${ht},${bh} ${ht+ef*protr},${bh}\
             ${ht+ef*protr},1 ${-ht-ef*protl},1\
             ${-ht-ef*protl},${bh} ${-ht},${bh}`;
    } else if (this.type == 'E') {
      const prot = 2/3;
      str = `${-ht},0, ${ht},0\
             ${ht},1 ${-ht-ef*prot},1\
             ${-ht-ef*prot},${bh} ${-ht},${bh}`;
    } else if (this.type == 'F') {
      const prot = 2/3;
      str = `${-ht},0, ${ht},0\
             ${ht},${bh} ${ht+ef*prot},${bh}\
             ${ht+ef*prot},1 ${-ht},1`;
    } else if (this.type == 'G') {
      const protl = 1/3;
      const protr = 1/2;
      str = `${-ht},0, ${ht},0\
             ${ht},${bh} ${ht+ef*protr},${bh}\
             ${ht+ef*protr},1 ${-ht-ef*protl},1\
             ${-ht-ef*protl},${bh} ${-ht},${bh}`;
    } else if (this.type == 'A') {
      const protl = 1/2;
      const protr = 1/3;
      str = `${-ht},0, ${ht},0\
             ${ht},${bh} ${ht+ef*protr},${bh}\
             ${ht+ef*protr},1 ${-ht-ef*protl},1\
             ${-ht-ef*protl},${bh} ${-ht},${bh}`;
    } else if (this.type == 'B') {
      const prot = 2/3;
      str = `${-ht},0, ${ht},0\
             ${ht},1 ${-ht-ef*prot},1\
             ${-ht-ef*prot},${bh} ${-ht},${bh}`;
    } else if (this.type == 'black') {
      str = `${-ht},0, ${ht},0\
             ${ht},${bh} ${-ht},${bh}`;
    }
    const group = container.group();
    const svgKey = group.polygon(str);
    const mx = ef*0.01;
    const my = 0.1;
    const markerStr = `${-mx},0 ${mx},0 ${mx},${my} ${-mx},${my}`;
    const svgMarker = group.polygon(markerStr);

    const keyColor = (this.type == 'black') ? '#000000' : '#FFFFFF';
    svgKey.attr({
      'fill': keyColor,
      'stroke-width': '0.001',
    });

    const markerColor = '#888888';
    svgMarker.attr({
      'fill': markerColor,
    });

    this.svg = group;
    this.svgMarker = svgMarker;
    this.svgKey = svgKey;
  }

  toneOn() {
    if (!this.isOn) {
      this.isOn = true;
      const toneColorActive = scaleFig.style['toneColorActive'];
      this.svgKey.attr('fill', toneColorActive);
      startTone(this.frequency);
    }
  }

  toneOff() {
    if (scaleFig.shiftDown) {
      scaleFig.sustainedTones.push(this);
    } else if (!this.isBeingClicked) {
      this.isOn = false;
      const keyColor = (this.type == 'black') ? '#000000' : '#FFFFFF';
      this.svgKey.attr('fill', keyColor);
      stopTone(this.frequency);
    }
  }

  setListeners() {
    // TODO We fire a lot of events, mouse, touch and pointer ones. Depending
    // on the browser, the same click or touch may fire several, e.g. both
    // touch and mouse or both pointer and mouse. This ensures maximum
    // compatibility with different browsers, but probably costs something in
    // performance. Note though that the same tone isn't played twice. Come
    // back to this later and check whether we could switch for instance using
    // only PointerEvents, once they have widespread support.
    const t = this;
    function eventOn(ev) {
      // preventDefault tries to avoid duplicating touch events as mouse or
      // pointer events.
      ev.preventDefault();
      t.isBeingClicked = true;
      t.toneOn();
    };
    function eventOff(ev) {
      // preventDefault tries to avoid duplicating touch events as mouse or
      // pointer events.
      ev.preventDefault();
      t.isBeingClicked = false;
      t.toneOff();
    };
    function eventOnMouse(ev) {
      if (ev.buttons == 1) {
        eventOn(ev);
      }
    };
    function eventOffMouse(ev) {
      eventOff(ev);
    };
    function eventOnTouch(ev) {
      eventOn(ev);
    };
    function eventOffTouch(ev) {
      eventOff(ev);
    };
    function eventOnPointer(ev) {
      // Allow pointer event target to jump between objects when pointer is
      // moved.
      ev.target.releasePointerCapture(ev.pointerId);
      if (ev.buttons == 1) {
        eventOn(ev);
      }
    };
    function eventOffPointer(ev) {
      // Allow pointer event target to jump between objects when pointer is
      // moved.
      ev.target.releasePointerCapture(ev.pointerId);
      eventOff(ev);
    };
    // TODO Could switch to PointerEvents once they have a bit more support
    // across different browsers: https://caniuse.com/#feat=pointer
    const svg = this.svg;
    svg.mousedown(eventOnMouse);
    svg.mouseup(eventOffMouse);
    svg.mouseleave(eventOffMouse);
    svg.mouseenter(eventOnMouse);
    svg.touchstart(eventOnTouch);
    svg.touchend(eventOffTouch);
    svg.touchcancel(eventOffTouch);
    svg.on('pointerdown', eventOnPointer);
    svg.on('pointerup', eventOffPointer);
    svg.on('pointerleave', eventOffPointer);
    svg.on('pointerenter', eventOnPointer);
  }

  get pos() {
    const frequencyRatio = this.frequency/scaleFig.originFreq;
    return scaleFig.horizontalZoom * Math.log2(frequencyRatio);
  }

  positionSvg() {
    this.svg.translate(this.pos, 0);
  }

  scaleSvg() {
    const svg = this.svg;
    const xscale = scaleFig.horizontalZoom;
    svg.scale(xscale, 1);
  }
}

function addKeys() {
  EDOTones.forEach((EDOTone) => {
    const key = new Key(EDOTone.frequency, EDOTone.keytype);
    scaleFig.keys.push(key);
  });
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function setSettingsExpanded(expanded) {
  scaleFig.style['settingsExpanded'] = expanded;
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
  resizeCanvas();
  resizeKeyCanvas();
  updateURL();
}

const buttToggleSettings = document.getElementById('buttToggleSettings');
buttToggleSettings.onclick = function() {
  setSettingsExpanded(!scaleFig.style['settingsExpanded']);
};

// TODO Isn't there a better way to generate these, rather than copy paste code
// and replace General -> Axes, etc.
function setGeneralExpanded(expanded) {
  scaleFig.style['generalExpanded'] = expanded;
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
};

const headGeneral = document.getElementById('headGeneral');
headGeneral.onclick = function() {
  setGeneralExpanded(!scaleFig.style['generalExpanded']);
};

function setTonesExpanded(expanded) {
  scaleFig.style['tonesExpanded'] = expanded;
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
};

const headTones = document.getElementById('headTones');
headTones.onclick = function() {
  setTonesExpanded(!scaleFig.style['tonesExpanded']);
};

function setStepIntervalsExpanded(expanded) {
  scaleFig.style['stepIntervalsExpanded'] = expanded;
  const contentStepIntervals = document.getElementById('contentStepIntervals');
  const iconStepIntervals = document.getElementById('iconStepIntervals');
  if (expanded) {
    iconStepIntervals.style.transform = 'rotate(-90deg)';
    contentStepIntervals.style.display = 'block';
  } else {
    iconStepIntervals.style.transform = 'rotate(90deg)';
    contentStepIntervals.style.display = 'none';
  }
  updateURL();
};

const headStepIntervals = document.getElementById('headStepIntervals');
headStepIntervals.onclick = function() {
  setStepIntervalsExpanded(!scaleFig.style['stepIntervalsExpanded']);
};

function setStyleExpanded(expanded) {
  scaleFig.style['styleExpanded'] = expanded;
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
};

const headStyle = document.getElementById('headStyle');
headStyle.onclick = function() {
  setStyleExpanded(!scaleFig.style['styleExpanded']);
};
streams.baseTones = rxjs.from([startingParams['baseTones']]);

streams.baseTones.subscribe(
  (tones) => {
    // TODO This should soon be unnecessary.
    scaleFig.baseTones = tones;
    // TODO How does a tone get market as being base if it already exists?
    tones.forEach((baseTone) => {
      const toneObj = addTone(baseTone, true);
      scaleFig.boundaryTones[toneToString(baseTone)] = toneObj;
    });
    // TODO Only run these based on whether we have new tones or tones have
    // been deleted.
    generateTones();
    deleteTones();
  }
);


resizeCanvas();
resizeKeyCanvas();
resizeSettings();
addKeys();

readURL();
updateURL();

streams.horizontalZoom.subscribe((value) => updateURL());
streams.verticalZoom.subscribe((value) => updateURL());


checkTones(); // TODO Only here for testing during development.
*/
