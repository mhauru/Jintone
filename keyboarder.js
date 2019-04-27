'use strict';

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Global constants.

// TODO Turn this into a generator that actually returns arbitrarily many
// primes.
const ALLPRIMES = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
  73, 79, 83, 89, 97,
];
const synth = new Tone.PolySynth(4, Tone.Synth).toMaster();

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Functions for arithmetic with coordinate representations of tones.

// TODO Remove if not used.
// function tonesEqual(tone1, tone2) {
//   // Ensure that if there's a length difference, tone1 is longer.
//   if (tone1.length < tone2.length) [tone1, tone2] = [tone2, tone1];
//   for (let i = 0; i < tone1.length; i++) {
//     const c1 = tone1[i];
//     // If tone2 has less values, assume it's padded with zeros at the end.
//     const c2 = (i < tone2.length ? tone2[i] : 0.0);
//     if (c1 !== c2) return false;
//   }
//   return true;
// }

// TODO Remove if not used.
// function negTone(tone) {
//   return tone.map((a) => -a);
// }

function subtractTone(tone1, tone2) {
  // Ensure that if there's a length difference, tone1 is longer.
  const flip = (tone1.length < tone2.length);
  if (flip) [tone1, tone2] = [tone2, tone1];
  const res = new Array(tone1.length);
  for (let i = 0; i < res.length; i++) {
    const c1 = tone1[i];
    // If tone2 has less values, assume it's padded with zeros at the end.
    const c2 = (i < tone2.length ? tone2[i] : 0.0);
    res[i] = c2 - c1;
    if (flip) res[i] = -res[i];
  }
  return res;
}

function sumTones(tone1, tone2) {
  // Ensure that if there's a length difference, tone1 is longer.
  if (tone1.length < tone2.length) [tone1, tone2] = [tone2, tone1];
  const res = new Array(tone1.length);
  for (let i = 0; i < res.length; i++) {
    const c1 = tone1[i];
    // If tone2 has less values, assume it's padded with zeros at the end.
    const c2 = (i < tone2.length ? tone2[i] : 0.0);
    res[i] = c1 + c2;
  }
  return res;
}

function fraction(interval) {
  let num = 1.0;
  let denom = 1.0;
  for (let i = 0; i < interval.length; i += 1) {
    const p = scaleFig.primes[i];
    const c = interval[i];
    if (c > 0) num *= Math.pow(p, c);
    else denom *= Math.pow(p, -c);
  }
  return [num, denom];
}

function primeDecompose(num, denom) {
  const tone = [0];
  let i = 0;
  while (i < scaleFig.primes.length) {
    const p = scaleFig.primes[i];
    const numDivisible = (num % p == 0);
    const denomDivisible = (denom % p == 0);
    if (numDivisible) {
      num = num / p;
      tone[tone.length-1] += 1;
    }
    if (denomDivisible) {
      denom = denom / p;
      tone[tone.length-1] -= 1;
    }
    if (num == 1 && denom == 1) return tone;
    if (!numDivisible && !denomDivisible) {
      i += 1;
      tone.push(0);
    }
  }
  // TODO We should actually raise an error or something, because too large
  // primes were involved.
  return tone;
}

function harmDist(scaleFig, tone1, tone2) {
  const interval = subtractTone(tone1, tone2);
  let d = 0.0;
  for (let i = 0; i < interval.length; i++) {
    const p = scaleFig.primes[i];
    const c = interval[i];
    const pStr = p.toString();
    let step;
    if (scaleFig.harmDistSteps.hasOwnProperty(pStr)) {
      step = scaleFig.harmDistSteps[pStr];
    } else {
      step = +Infinity;
    }
    if (c != 0.0) d += step * Math.abs(c);
  }
  return d;
}

function pitchFactor(interval) {
  let pf = 1.0;
  for (let i = 0; i < interval.length; i += 1) {
    const p = scaleFig.primes[i];
    const c = interval[i];
    pf *= Math.pow(p, c);
  }
  return pf;
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// TODO Come up with a title.

// TODO Make all these adjustable.
const style = {
  'opacityHarmNorm': true,
  'baseToneBorderSize': 4.0,
  'baseToneBorderColor': '#000000',
};

const canvas = SVG('divCanvas');
// Note that the order in which we create these groups sets their draw order,
// i.e. z-index.
const gPitchlines = canvas.group();
const gSteps = canvas.group();
const gTones = canvas.group();
const svgGroups = {
  'pitchlines': gPitchlines,
  'steps': gSteps,
  'tones': gTones,
};

// TODO Make all these adjustable.
const scaleFig = {
  'canvas': canvas,
  'svgGroups': svgGroups,
  'horizontalZoom': 1,
  'yShifts': {},
  'style': style,
  'originFreq': 440,
  'baseTones': [],
  'stepIntervals': {},
  'harmDistSteps': {},
  'primes': [],

  'maxHarmNorm': 8,

  'tones': {},
  'boundaryTones': {},
  'steps': [],
};

function resizeCanvas() {
  const div = document.getElementById('divCanvas');
  const h = div.clientHeight;
  const w = div.clientWidth;
  const c = scaleFig.canvas;
  c.viewbox(-w/2, -h/2, w, h);
}

window.onresize = function(evt) {
  resizeCanvas();
};

resizeCanvas();

function isInViewbox(scaleFig, x, y) {
  const viewboxLeft = scaleFig.canvas.viewbox().x;
  const viewboxRight = viewboxLeft + scaleFig.canvas.viewbox().width;
  const viewboxTop = scaleFig.canvas.viewbox().y;
  const viewboxBottom = viewboxTop + scaleFig.canvas.viewbox().height;
  const inBoxHor = (viewboxLeft < x && x < viewboxRight);
  const inBoxVer = (viewboxTop < y && y < viewboxBottom);
  const inBox = inBoxHor && inBoxVer;
  return inBox;
}

function isInViewclosure(scaleFig, x, y) {
  const viewboxLeft = scaleFig.canvas.viewbox().x;
  const viewboxRight = viewboxLeft + scaleFig.canvas.viewbox().width;
  const viewboxTop = scaleFig.canvas.viewbox().y;
  const viewboxBottom = viewboxTop + scaleFig.canvas.viewbox().height;
  const maxPrime = Math.max(...scaleFig.primes);
  const maxXjump = scaleFig.horizontalZoom * Math.log2(maxPrime);
  const maxYjump = Math.max(...Object.values(scaleFig.yShifts));
  const closureLeft = viewboxLeft - maxXjump;
  const closureRight = viewboxRight + maxXjump;
  const closureTop = viewboxTop - maxYjump;
  const closureBottom = viewboxBottom + maxYjump;
  const inClosureHor = (closureLeft < x && x < closureRight);
  const inClosureVer = (closureTop < y && y < closureBottom);
  const inClosure = inClosureHor && inClosureVer;
  return inClosure;
}

function startTone(tone) {
  synth.triggerAttack(tone);
}

function stopTone(tone) {
  synth.triggerRelease(tone);
}

const rangeZoom = document.getElementById('rangeZoom');
function rangeZoomOninput(value) {
  // TODO Refer to global scope scaleFig like this?
  const oldValue = scaleFig.horizontalZoom;
  scaleFig.horizontalZoom = value;
  rangeZoom.value = value;
  repositionAll(scaleFig);
  // TODO We assume here that the viewbox is always centered at the origin.
  if (Math.abs(oldValue) > Math.abs(value)) {
    generateTones();
  } else {
    deleteTones();
  }
}
rangeZoom.oninput = function() {
  rangeZoomOninput(this.value);
};

const numOriginFreq = document.getElementById('numOriginFreq');
function numOriginFreqOninput(value) {
  // TODO Refer to global scope scaleFig like this?
  scaleFig.originFreq = value;
  numOriginFreq.value = value;
}
numOriginFreq.oninput = function() {
  numOriginFreqOninput(this.value);
};

const numToneRadius = document.getElementById('numToneRadius');
function numToneRadiusOninput(value) {
  // TODO Refer to global scope scaleFig like this?
  scaleFig.style['toneRadius'] = parseFloat(value);
  numToneRadius.value = value;
  rescaleTones(scaleFig);
}
numToneRadius.oninput = function() {
  numToneRadiusOninput(this.value);
};

const toneColor = document.getElementById('toneColor');
function toneColorOninput(value) {
  // TODO Refer to global scope scaleFig like this?
  scaleFig.style['toneColor'] = value;
  toneColor.value = value;
  recolorTones(scaleFig);
}
toneColor.oninput = function() {
  toneColorOninput(this.value);
};

function rescaleTones(scaleFig) {
  Object.entries(scaleFig.tones).forEach(([coords, tone]) => {
    tone.scaleSvgTone();
  });
}

function setPitchlinesVisibility(scaleFig) {
  Object.entries(scaleFig.tones).forEach(([coords, tone]) => {
    tone.setSvgPitchlineVisibility();
  });
}

const checkboxPitchlines = document.getElementById('checkboxPitchlines');
function checkboxPitchlinesOnclick(value) {
  scaleFig.style['drawPitchlines'] = value;
  checkboxPitchlines.checked = value;
  setPitchlinesVisibility(scaleFig);
}
checkboxPitchlines.onclick = function() {
  checkboxPitchlinesOnclick(this.checked);
};

const colorPitchlines = document.getElementById('colorPitchlines');
function colorPitchlinesOninput(value) {
  scaleFig.style['pitchlineColor'] = value;
  colorPitchlines.value = value;
  recolorPitchlines(scaleFig);
}
colorPitchlines.oninput = function() {
  colorPitchlinesOninput(this.value);
};

function yshiftOnchange(prime, shift) {
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
}

function harmDistStepOnchange(prime, dist) {
  const pStr = prime.toString();
  const oldDist = scaleFig.harmDistSteps[pStr];
  scaleFig.harmDistSteps[pStr] = dist;
  const inRange = document.getElementById(`inRangeHarmdiststep_${prime}`);
  const inNum = document.getElementById(`inNumHarmdiststep_${prime}`);
  if (inRange != null) inRange.value = dist;
  if (inNum != null) inNum.value = dist;
  recolorTones();
  reopacitateSteps();
  if (oldDist > dist) {
    generateTones();
  } else {
    deleteTones();
  }
}

function repositionAll(scaleFig) {
  Object.entries(scaleFig.tones).forEach(([coords, tone]) => {
    tone.positionSvg();
  });
}

function recolorSteps() {
  Object.entries(scaleFig.tones).forEach(([coords, tone]) => {
    Object.entries(tone.steps).forEach(([label, step]) => {
      step.color();
    });
  });
}

function reopacitateSteps() {
  Object.entries(scaleFig.tones).forEach(([coords, tone]) => {
    Object.entries(tone.steps).forEach(([label, step]) => {
      step.opacitate();
    });
  });
}

function recolorTones() {
  Object.entries(scaleFig.tones).forEach(([coords, tone]) => {
    tone.colorSvg();
  });
}

function recolorPitchlines() {
  Object.entries(scaleFig.tones).forEach(([coords, tone]) => {
    tone.colorSvgPitchline();
  });
}

// Generate default starting state.

rangeZoomOninput(200);
numOriginFreqOninput(440);
toneColorOninput('#ac0006');
numToneRadiusOninput(13.0);
checkboxPitchlinesOnclick(true);
colorPitchlinesOninput('#c7c7c7');

// Manually chosen yShifts for nice spacing.
// const verticalZoom = 250
// const yShifts = {
// '2': 0,
// '3': horizontalZoom*Math.log2(4/3),
// '5': horizontalZoom*Math.log2(5/4)},
// '3': horizontalZoom*Math.sqrt(Math.log2(4/3)*Math.log2(3/2)),
// '5': horizontalZoom*Math.sqrt(Math.log2(5/4)*Math.log2(8/5))},
// '3': verticalZoom*Math.log2(3/2)-125,
// '5': verticalZoom*Math.log2(5/4)+100,
// }

// Make y-distance match harmonic distance
// const s = 30  // Scale
// const yShifts = {
//   '2': s*harmDistSteps[2],
//   '3': s*harmDistSteps[3],
//   '5': s*harmDistSteps[5],
// }

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class StepInterval {
  constructor(label, interval, color) {
    this.label = label;
    this._interval_ = [];
    this._color_ = '';
    this.initializeHtml();
    this.setListeners();
    this.interval = interval;
    this.color = color;
  }

  initializeHtml() {
    const div = document.createElement('div');
    div.innerHTML = `Generating interval ${this.label}<br>`;
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
    // TODO Add buttons for de(activating), and for mirroring (including also
    // the negative of the same interval).
  }

  setListeners() {
    const t = this;
    this.inColor.oninput = function() {
      t.color = this.value;
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
    const [num, denom] = value.split('/');
    if (denom == undefined) denom = '1';
    num = Number(num); denom = Number(denom);
    const tone = primeDecompose(num, denom);
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
    // TODO recolorSteps();  // TODO Should this call happen here?
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
    // TODO repositionStep(scaleFig);  // TODO Should this call happen here?
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
    const svgStep = scaleFig.svgGroups['steps'].line(0, 0, 0, 0).attr({
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
    if (relHn1 > 0 || relHn2 > 0) {
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
    this.coords = coordinates;
    this.IsBase_ = isBase;
    this.steps = {};
    this.incomingSteps = {};

    this.svgTone = scaleFig.svgGroups['tones'].circle(1.0);
    // TODO Where do these numbers come from?
    const group = scaleFig.svgGroups['pitchlines'];
    this.svgPitchline = group.path('M 0,-1000 V 2000');
    this.positionSvg();
    this.colorSvg();
    this.scaleSvgTone();
    this.setListeners();
    this.addSteps();
  }

  setListeners() {
    const t = this;
    function toneOn(ev) {
      // Prevent a touch event from also generating a mouse event.
      ev.preventDefault();
      startTone(t.frequency);
    };
    function toneOff(ev) {
      // Prevent a touch event from also generating a mouse event.
      ev.preventDefault();
      stopTone(t.frequency);
    };
    const svgTone = this.svgTone;
    svgTone.mousedown(toneOn);
    svgTone.mouseup(toneOff);
    svgTone.mouseleave(toneOff);
    svgTone.touchstart(toneOn);
    svgTone.touchend(toneOff);
    svgTone.touchleave(toneOff);
    svgTone.touchcancel(toneOff);
  }

  set isBase(value) {
    this.IsBase_ = value;
    this.colorSvgTone();
    this.scaleSvgTone();
  }

  get isBase() {
    return this.IsBase_;
  }

  get pitchFactor() {
    let pf = 1.0;
    for (let i = 0; i < this.coords.length; i += 1) {
      const p = scaleFig.primes[i];
      const c = this.coords[i];
      pf *= Math.pow(p, c);
    }
    return pf;
  }

  get xpos() {
    return scaleFig.horizontalZoom * Math.log2(this.pitchFactor);
  }

  get ypos() {
    let y = 0.0;
    for (let i = 0; i < this.coords.length; i += 1) {
      const p = scaleFig.primes[i];
      const c = this.coords[i];
      const pStr = p.toString();
      // TODO Is the check necessary?
      if (scaleFig.yShifts.hasOwnProperty(pStr)) {
        y += -scaleFig.yShifts[pStr] * c;
      }
    }
    return y;
  }

  get frequency() {
    return scaleFig.originFreq * this.pitchFactor;
  }

  get harmDists() {
    const harmDists = [];
    for (let i = 0; i < scaleFig.baseTones.length; i += 1) {
      const bt = scaleFig.baseTones[i];
      // TODO Remove explicit argument scale?
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
    const relHn = Math.max(1.0 - hn/scaleFig.maxHarmNorm, 0.0);
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
    // Remove explicit scaleFig reference?
    const inViewclosure = isInViewclosure(scaleFig, this.xpos, this.ypos);
    return harmClose && inViewclosure;
  }

  addSteps() {
    Object.entries(scaleFig.stepIntervals).forEach(([label, stepInterval]) => {
      if (label in this.steps) return;
      this.steps[label] = new Step(label, this);
    });
  }

  positionSvg() {
    this.positionSvgTone();
    this.positionSvgPitchline();
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
    this.svgTone.attr({
      'cx': this.xpos,
      'cy': this.ypos,
    });
  }

  scaleSvgTone() {
    const svgTone = this.svgTone;
    let toneRadius = style['toneRadius'];
    if (this.isBase) {
      const borderSize = style['baseToneBorderSize'];
      toneRadius = toneRadius + borderSize/2;
    }
    svgTone.radius(toneRadius);
    Object.entries(this.steps).forEach(([label, step]) => {
      step.position();
    });
  }

  colorSvgTone() {
    const svgTone = this.svgTone;
    const relHn = this.relHarmNorm;
    const style = scaleFig.style;
    const toneColor = style['toneColor'];
    if (this.isBase) {
      const borderColor = style['baseToneBorderColor'];
      const borderSize = style['baseToneBorderSize'];
      svgTone.attr({
        'fill': toneColor,
        'fill-opacity': relHn,
        'stroke': borderColor,
        'stroke-width': borderSize,
      });
    } else {
      svgTone.attr({
        'fill': toneColor,
        'fill-opacity': relHn,
        'stroke-width': 0.0,
      });
    }
  }

  positionSvgPitchline() {
    this.svgPitchline.x(this.xpos);
  }

  setSvgPitchlineVisibility() {
    const svgPitchline = this.svgPitchline;
    const relHn = this.relHarmNorm;
    if (scaleFig.style['drawPitchlines'] && this.inbounds && relHn > 0) {
      svgPitchline.attr('visibility', 'inherit');
    } else {
      svgPitchline.attr('visibility', 'hidden');
    }
  }

  colorSvgPitchline() {
    const svgPitchline = this.svgPitchline;
    const relHn = this.relHarmNorm;
    const style = scaleFig.style;
    const pitchlineColor = style['pitchlineColor'];
    // TODO Make more of these settings adjustable from Settings, and
    // stored with scaleFig.
    svgPitchline.attr({
      'stroke': pitchlineColor,
      'stroke-width': '1.0',
      'stroke-miterlimit': 4,
      'stroke-dasharray': '0.5, 0.5',
      'stroke-dashoffset': 0,
      'stroke-opacity': relHn,
    });
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

function addBaseTone(baseTone) {
  scaleFig.baseTones.push(baseTone);
  const btStr = baseTone.toString();
  if (btStr in scaleFig.tones) {
    scaleFig.tones[btStr].isBase = true;
  } else {
    const toneObj = addTone(baseTone, true);
    scaleFig.boundaryTones[btStr] = toneObj;
  }

  // Since harmonic distances may have changed, recolor existing tones.
  Object.entries(scaleFig.tones).forEach(([coords, tone]) => {
    tone.colorSvg();
  });

  generateTones();
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
    }
    // Create steps, since root may now have new neighbors.
    Object.entries(rootTone.steps).forEach(([label, step]) => {
      if (step.hasEndpoint) return;
      step.updateEndpoint();
      step.position();
      step.color();
      step.opacitate();
    });
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
      // The tone in question is close enough to the drawable tones, that
      // we generate more tones starting from it. After this, it will no
      // longer be a boundary tone.
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
  for (let i = 0; i < tone.coords.length; i += 1) {
    [-1, +1].forEach(function(increment) {
      const neighCoords = tone.coords.slice();
      neighCoords[i] += increment;
      const neighStr = neighCoords.toString();
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
  for (let i = 0; i < tone.coords.length; i += 1) {
    [-1, +1].forEach(function(increment) {
      const neighCoords = tone.coords.slice();
      neighCoords[i] += increment;
      const neighStr = neighCoords.toString();
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
  const toneStr = tone.toString();
  const newTone = new ToneObject(tone, isBase);
  scaleFig.tones[toneStr] = newTone;
  return newTone;
}

function addStepInterval(interval, color) {
  const existingLabels = Object.keys(scaleFig.stepIntervals);
  let labelInt = 1;
  while (existingLabels.includes(labelInt.toString())) {
    labelInt++;
  }
  const label = labelInt.toString();
  const stepInterval = new StepInterval(label, interval, color);
  scaleFig.stepIntervals[label] = stepInterval;
  const divGis = document.getElementById('divGis');
  divGis.appendChild(stepInterval.div);

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

  document.getElementById('divAxes').appendChild(divAxis);

  inNumYshift.onchange = function() {
    // TODO Check input to be a number
    yshiftOnchange(prime, this.value);
  };
  inRangeYshift.oninput = function() {
    yshiftOnchange(prime, this.value);
  };
  inNumHarmdiststep.onchange = function() {
    // TODO Check input to be a number
    harmDistStepOnchange(prime, this.value);
  };
  inRangeHarmdiststep.oninput = function() {
    harmDistStepOnchange(prime, this.value);
  };

  yshiftOnchange(prime, 0.0);
  harmDistStepOnchange(prime, Infinity);

  scaleFig.primes.push(prime);

  Object.entries(scaleFig.tones).forEach(([coords, tone]) => {
    newCoords = coords.slice();
    newCoords.push(0);

    delete scaleFig.tones[coords];
    scaleFig.tones[newCoords] = tone;
    if (coords in scaleFig.boundaryTones) {
      delete scaleFig.boundaryTones[coords];
      scaleFig.boundaryTones[newCoords] = tone;
    }

    tone.coords = newCoords;
  });

  Object.entries(scaleFig.stepIntervals).forEach(([label, stepInterval]) => {
    interval = stepInterval.interval;
    newInterval = interval.slice();
    newInterval.push(0);
    stepInterval.interval = newInterval;
  });
}

// TODO Implement this
// function removeAxis() {
// }

addAxis();
addAxis();
addAxis();

// Rectilinear projection of 3D lattice.
const phi = 2.0*Math.PI*0.75; // Angle of the lattice against the projection
const spios = Math.sin(Math.PI/6.0);
const k = 1.0/(1.0 + spios);
const s = scaleFig.horizontalZoom*(1.0+1.0/spios); // Scale
const shift2 = Math.log2(2.0) * s*k * Math.cos(phi);
const shift3 = Math.log2(3.0/2.0) * s*k * Math.cos(phi+2*Math.PI/3.0);
const shift5 = Math.log2(5.0/4.0) * s*k * Math.cos(phi+4*Math.PI/3.0);
yshiftOnchange(2, shift2);
yshiftOnchange(3, shift3);
yshiftOnchange(5, shift5);


harmDistStepOnchange(2, 0.0);
harmDistStepOnchange(3, 0.2);
harmDistStepOnchange(5, 3.0);

addBaseTone([0, 0, 0]);

addStepInterval([1, 0, 0], '#000000');
addStepInterval([-1, 1, 0], '#001bac');
addStepInterval([-2, 0, 1], '#ac5f00');

