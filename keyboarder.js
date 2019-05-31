'use strict';

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Global constants.

const SQRT2 = Math.sqrt(2);
// TODO Turn this into a generator that actually returns arbitrarily many
// primes.
const ALLPRIMES = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
  73, 79, 83, 89, 97,
];
const edofactor = Math.pow(2, 1/12);
const edofactorlog = Math.log2(edofactor);
const synth = new Tone.PolySynth(4, Tone.Synth).toMaster();

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
    const baseFrequency = 440*Math.pow(2, octave-4);
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

function tonesEqual(tone1, tone2) {
  // Ensure that if there's a length difference, tone1 is longer.
  if (tone1.length < tone2.length) [tone1, tone2] = [tone2, tone1];
  for (let i = 0; i < tone1.length; i++) {
    const c1 = tone1[i];
    // If tone2 has less values, assume it's padded with zeros at the end.
    const c2 = (i < tone2.length ? tone2[i] : 0.0);
    if (c1 !== c2) return false;
  }
  return true;
}

function subtractTone(tone1, tone2) {
  // Ensure that if there's a length difference, tone1 is longer.
  const flip = (tone1.length < tone2.length);
  if (flip) [tone1, tone2] = [tone2, tone1];
  const res = new Array(tone1.length);
  for (let i = 0; i < res.length; i++) {
    const c1 = tone1[i];
    // If tone2 has less values, assume it's padded with zeros at the end.
    const c2 = (i < tone2.length ? tone2[i] : 0.0);
    res[i] = c1 - c2;
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

// TODO This stuff about creating the scaleFig is the only part that is not
// about constant, function or class declarations that is not at the very end
// of the file. Where do I want this stuff to happen? Relates to whether
// scaleFig should be a global constant.

const canvas = new SVG('divCanvas');
const keyCanvas = new SVG('divKeyCanvas');
keyCanvas.attr('preserveAspectRatio', 'none');
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

const scaleFig = {
  'canvas': canvas,
  'keyCanvas': keyCanvas,
  'keys': [],
  'svgGroups': svgGroups,
  'horizontalZoom': 1,
  'yShifts': {},
  'style': {},
  'originFreq': 1,
  'baseTones': [],
  'stepIntervals': {},
  'harmDistSteps': {},
  'primes': [],

  'maxHarmNorm': 1.0,

  'tones': {},
  'boundaryTones': {},
  'steps': [],
};

function resizeCanvas() {
  const divCanvas = document.getElementById('divCanvas');
  const h = divCanvas.clientHeight;
  const w = divCanvas.clientWidth;
  const canvas = scaleFig.canvas;
  canvas.viewbox(-w/2, -h/2, w, h);
}

function resizeKeyCanvas() {
  const divKeyCanvas = document.getElementById('divKeyCanvas');
  const w = divKeyCanvas.clientWidth;
  const keyCanvas = scaleFig.keyCanvas;
  keyCanvas.viewbox(-w/2, 0, w, 1);
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
  // const closureLeft = Math.min(viewboxLeft, viewboxRight - maxXjump);
  // const closureRight = Math.max(viewboxRight, viewboxLeft + maxXjump);
  // const closureTop = Math.min(viewboxTop, viewboxBottom - maxYjump);
  // const closureBottom = Math.max(viewboxBottom, viewboxTop + maxYjump);
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

  scaleFig.keys.forEach((key) => {
    key.scaleSvg();
    key.positionSvg();
  });

  writeURL();
}
rangeZoom.oninput = function() {
  rangeZoomOninput(this.value);
};

const numOriginFreq = document.getElementById('numOriginFreq');
function numOriginFreqOninput(value) {
  scaleFig.originFreq = value;
  numOriginFreq.value = value;
  writeURL();
}
numOriginFreq.oninput = function() {
  numOriginFreqOninput(parseFloat(this.value));
};

const numMaxHarmNorm = document.getElementById('numMaxHarmNorm');
function numMaxHarmNormOnchange(value) {
  const oldValue = scaleFig.maxHarmNorm;
  scaleFig.maxHarmNorm = value;
  numMaxHarmNorm.value = value;
  recolorTones();
  reopacitateSteps();
  if (value > oldValue) {
    generateTones();
  } else {
    deleteTones();
  }
  writeURL();
}
numMaxHarmNorm.onchange = function() {
  numMaxHarmNormOnchange(parseFloat(this.value));
};

const numToneRadius = document.getElementById('numToneRadius');
function numToneRadiusOninput(value) {
  scaleFig.style['toneRadius'] = value;
  numToneRadius.value = value;
  rescaleTones(scaleFig);
  writeURL();
}
numToneRadius.oninput = function() {
  numToneRadiusOninput(parseFloat(this.value));
};

const radioToneLabelNone = document.getElementById('radioToneLabelNone');
const radioToneLabelEDO = document.getElementById('radioToneLabelEDO');
function radioToneLabelOnclick(value) {
  scaleFig.labelTextStyle = value;
  if (value == 'EDO') {
    radioToneLabelEDO.checked = true;
  } else if (value == 'none') {
    radioToneLabelNone.checked = true;
  }
  relabelTones();
  writeURL();
}
radioToneLabelEDO.onclick = function() {
  radioToneLabelOnclick(this.value);
};
radioToneLabelNone.onclick = function() {
  radioToneLabelOnclick(this.value);
};

function relabelTones() {
  Object.entries(scaleFig.tones).forEach(([coords, tone]) => {
    tone.setLabelText();
  });
}

const toneColor = document.getElementById('toneColor');
function toneColorOninput(value) {
  scaleFig.style['toneColor'] = value;
  toneColor.value = value;
  recolorTones(scaleFig);
  writeURL();
}
toneColor.oninput = function() {
  toneColorOninput(this.value);
};

const baseToneBorderColor = document.getElementById('baseToneBorderColor');
function baseToneBorderColorOninput(value) {
  scaleFig.style['baseToneBorderColor'] = value;
  baseToneBorderColor.value = value;
  recolorTones(scaleFig);
  writeURL();
}
baseToneBorderColor.oninput = function() {
  baseToneBorderColorOninput(this.value);
};

const numBaseToneBorderSize = document.getElementById('numBaseToneBorderSize');
function numBaseToneBorderSizeOninput(value) {
  scaleFig.style['baseToneBorderSize'] = value;
  numBaseToneBorderSize.value = value;
  recolorTones(scaleFig); // TODO This is heavy-handed.
  writeURL();
}
numBaseToneBorderSize.oninput = function() {
  numBaseToneBorderSizeOninput(parseFloat(this.value));
};

const cboxOpacityHarmNorm = document.getElementById('cboxOpacityHarmNorm');
function cboxOpacityHarmNormOnclick(value) {
  scaleFig.style['opacityHarmNorm'] = value;
  cboxOpacityHarmNorm.checked = value;
  reopacitateAll(scaleFig);
  writeURL();
}
cboxOpacityHarmNorm.onclick = function() {
  cboxOpacityHarmNormOnclick(this.checked);
};

function rescaleTones(scaleFig) {
  Object.entries(scaleFig.tones).forEach(([coords, tone]) => {
    tone.scaleSvgTone();
  });
}

function setPitchlineGroupVisibility(scaleFig) {
  if (scaleFig.style['drawPitchlines']) {
    scaleFig.svgGroups.pitchlines.attr('visibility', 'inherit');
  } else {
    scaleFig.svgGroups.pitchlines.attr('visibility', 'hidden');
  }
}

function setStepGroupVisibility(scaleFig) {
  if (scaleFig.style['drawSteps']) {
    scaleFig.svgGroups.steps.attr('visibility', 'inherit');
  } else {
    scaleFig.svgGroups.steps.attr('visibility', 'hidden');
  }
}

const cboxPitchlines = document.getElementById('cboxPitchlines');
function cboxPitchlinesOnclick(value) {
  scaleFig.style['drawPitchlines'] = value;
  cboxPitchlines.checked = value;
  setPitchlineGroupVisibility(scaleFig);
  writeURL();
}
cboxPitchlines.onclick = function() {
  cboxPitchlinesOnclick(this.checked);
};

const cboxKeys = document.getElementById('cboxKeys');
function cboxKeysOnclick(value) {
  cboxKeys.checked = value;
  scaleFig['showKeys'] = value;
  setKeysExpanded();
  writeURL();
}
cboxKeys.onclick = function() {
  cboxKeysOnclick(this.checked);
};

function setKeysExpanded() {
  const show = scaleFig['showKeys'];
  const divCanvas = document.getElementById('divCanvas');
  const divKeyCanvas = document.getElementById('divKeyCanvas');
  if (show) {
    divCanvas.style.height = '80%';
    divKeyCanvas.style.height = '20%';
  } else {
    divCanvas.style.height = '100%';
    divKeyCanvas.style.height = '0%';
  }
  resizeCanvas();
  resizeKeyCanvas();
}

const cboxSteps = document.getElementById('cboxSteps');
function cboxStepsOnclick(value) {
  scaleFig.style['drawSteps'] = value;
  cboxSteps.checked = value;
  setStepGroupVisibility(scaleFig);
  writeURL();
}
cboxSteps.onclick = function() {
  cboxStepsOnclick(this.checked);
};


const buttAddInterval = document.getElementById('buttAddInterval');
function buttAddIntervalOnclick(value) {
  const interval = new Array(scaleFig.primes.length).fill(0);
  const color = '#000000';
  const show = true;
  addStepInterval(interval, color, show);
  writeURL();
}
buttAddInterval.onclick = function() {
  buttAddIntervalOnclick(this.checked);
};

const buttAddAxis = document.getElementById('buttAddAxis');
function buttAddAxisOnclick(value) {
  addAxis();
  writeURL();
}
buttAddAxis.onclick = function() {
  buttAddAxisOnclick(this.checked);
};

const buttRemoveAxis = document.getElementById('buttRemoveAxis');
function buttRemoveAxisOnclick(value) {
  removeAxis();
  writeURL();
}
buttRemoveAxis.onclick = function() {
  buttRemoveAxisOnclick(this.checked);
};

const colorPitchlines = document.getElementById('colorPitchlines');
function colorPitchlinesOninput(value) {
  scaleFig.style['pitchlineColor'] = value;
  colorPitchlines.value = value;
  recolorPitchlines(scaleFig);
  writeURL();
}
colorPitchlines.oninput = function() {
  colorPitchlinesOninput(this.value);
};

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
  writeURL();
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
  writeURL();
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

function updateStepEndpoints() {
  Object.entries(scaleFig.tones).forEach(([coords, tone]) => {
    Object.entries(tone.steps).forEach(([label, step]) => {
      step.updateEndpoint();
    });
  });
}

function repositionSteps() {
  Object.entries(scaleFig.tones).forEach(([coords, tone]) => {
    Object.entries(tone.steps).forEach(([label, step]) => {
      step.position();
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

function reopacitateAll() {
  reopacitateSteps();
  recolorTones();
  recolorPitchlines();
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

function deleteStepInterval(label) {
  Object.entries(scaleFig.tones).forEach(([coords, tone]) => {
    if (label in tone.steps) tone.steps[label].destroy();
  });
  const stepInterval = scaleFig.stepIntervals[label];
  const divStepIntervals = document.getElementById('divGeneratedStepIntervals');
  divStepIntervals.removeChild(stepInterval.div);
  stepInterval.svgGroup.remove();
  delete scaleFig.stepIntervals[label];
  writeURL();
}

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
    writeURL();
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
    writeURL();
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
    writeURL();
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
    this._isBase_ = value;
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
    // Remove explicit scaleFig reference?
    const inViewclosure = isInViewclosure(scaleFig, this.xpos, this.ypos);
    return harmClose && inViewclosure;
  }

  setLabelText() {
    let labelText;
    const frequency = this.frequency;
    if (scaleFig.labelTextStyle == 'EDO') {
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
      // TODO An experimental constant to position the subscript. Unfortunately
      // Firefox doesn't support baseline-shift.
      // TODO This should be a percentage of font-size, but it's not. I don't
      // know what it's a percentage of.
      const subShift = '1%';
      const subFontSize = '90%';
      labelText = (add) => {
        add.tspan(`${neighbor.letter}`);
        add.tspan(`${neighbor.octave}`).attr({
          'dy': subShift,
          'font-size': subFontSize,
        });
      };
    } else if (scaleFig.labelTextStyle == 'none') {
      labelText = '';
    } else {
      labelText = '';
    }
    this.svgLabel.text(labelText);
    this.svgLabel.center(0, 0);
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
    this.svgTone.move(this.xpos, this.ypos);
  }

  scaleSvgTone() {
    const svgCircle = this.svgCircle;
    const svgLabel = this.svgLabel;
    const style = scaleFig.style;
    let toneRadius = style['toneRadius'];
    if (this.isBase) {
      const borderSize = style['baseToneBorderSize'];
      toneRadius = toneRadius + borderSize/2;
    }
    svgCircle.radius(toneRadius);
    Object.entries(this.steps).forEach(([label, step]) => {
      step.position();
    });
    // TODO This is just an experimental numerical constant, figure out
    // something better.
    const fontSize = toneRadius;
    svgLabel.attr('font-size', fontSize);
    svgLabel.center(0, 0);
  }

  colorSvgTone() {
    const svgTone = this.svgTone;
    const svgCircle = this.svgCircle;
    const relHn = this.relHarmNorm;
    const style = scaleFig.style;
    const toneColor = style['toneColor'];
    if (this.isBase) {
      const borderColor = style['baseToneBorderColor'];
      const borderSize = style['baseToneBorderSize'];
      svgCircle.attr({
        'fill': toneColor,
        'stroke': borderColor,
        'stroke-width': borderSize,
      });
      svgTone.attr({
        'fill-opacity': relHn,
      });
    } else {
      svgCircle.attr({
        'fill': toneColor,
        'stroke-width': 0.0,
      });
      svgTone.attr({
        'fill-opacity': relHn,
      });
    }
  }

  positionSvgPitchline() {
    this.svgPitchline.x(this.xpos);
  }

  setSvgPitchlineVisibility() {
    const svgPitchline = this.svgPitchline;
    const relHn = this.relHarmNorm;
    if (this.inbounds && relHn > 0) {
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
  scaleFig.baseTones.push(baseTone.slice());
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
          const originStr = originCoords.toString();
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
  inNumHarmdiststep.onchange = function() {
    // TODO Check input to be a number
    harmDistStepOnchange(prime, this.value);
  };
  inRangeHarmdiststep.oninput = function() {
    harmDistStepOnchange(prime, this.value);
  };

  yShiftOnchange(prime, 0.0);
  harmDistStepOnchange(prime, scaleFig.maxHarmNorm);

  scaleFig.primes.push(prime);

  scaleFig.baseTones.forEach((baseTone) => {
    baseTone.push(0);
  });

  Object.entries(scaleFig.tones).forEach(([coordsStr, tone]) => {
    const coords = tone.coords;
    const newCoords = coords.slice();
    newCoords.push(0);
    const newCoordsStr = newCoords.toString();

    delete scaleFig.tones[coordsStr];
    scaleFig.tones[newCoordsStr] = tone;
    if (coordsStr in scaleFig.boundaryTones) {
      delete scaleFig.boundaryTones[coordsStr];
    }
    // Now that there's a new axis, but every tone has coordinate 0 on it, all
    // of them are boundary.
    scaleFig.boundaryTones[newCoordsStr] = tone;

    tone.coords = newCoords;
  });

  Object.entries(scaleFig.stepIntervals).forEach(([label, stepInterval]) => {
    const interval = stepInterval.interval;
    const newInterval = interval.slice();
    newInterval.push(0);
    stepInterval.interval = newInterval;
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

  let i = 0;
  while (i < scaleFig.baseTones.length) {
    if (scaleFig.baseTones[i][numPrimes-1] != 0) {
      scaleFig.baseTones.splice(i, 1);
    } else {
      scaleFig.baseTones[i].splice(numPrimes - 1, 1);
      i++;
    }
  }

  Object.entries(scaleFig.tones).forEach(([coordsStr, tone]) => {
    const coords = tone.coords;
    if (coords[numPrimes-1] != 0) {
      // TODO Turn this into a function removeTone?
      tone.destroy();
      delete scaleFig.tones[coordsStr];
      if (coordsStr in scaleFig.boundaryTones) {
        delete scaleFig.boundaryTones[coordsStr];
      }
    } else {
      const newCoords = coords.slice(0, numPrimes-1);
      const newCoordsStr = newCoords.toString();
      delete scaleFig.tones[coordsStr];
      scaleFig.tones[newCoordsStr] = tone;
      if (coordsStr in scaleFig.boundaryTones) {
        // TODO Is it an issue that after the removal of one axis a tone may no
        // longer be boundary, but we still keep it in boundaryTones?
        delete scaleFig.boundaryTones[coordsStr];
        scaleFig.boundaryTones[newCoordsStr] = tone;
      }
      tone.coords = newCoords;
    }
  });

  Object.entries(scaleFig.stepIntervals).forEach(([label, stepInterval]) => {
    const interval = stepInterval.interval;
    const newInterval = interval.slice(0, numPrimes-1);
    stepInterval.interval = newInterval;
  });
}

function readURL() {
  const params = new URLSearchParams(decodeURIComponent(location.search));
  Object.entries(DEFAULT_URLPARAMS).forEach(([key, value]) => {
    if (params.has(key)) {
      value = JSON.parse(params.get(key));
    }
    URLParamSetters[key](value);
  });
}

class Key {
  constructor(frequency, type) {
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
    const svg = this.svg;
    svg.mousedown(toneOn);
    svg.mouseup(toneOff);
    svg.mouseleave(toneOff);
    svg.touchstart(toneOn);
    svg.touchend(toneOff);
    svg.touchleave(toneOff);
    svg.touchcancel(toneOff);
  }

  get pos() {
    // TODO This assumes that the originTone is always in the middle of the SVG
    // drawing. I think this will change at some point.
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
  writeURL();
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
  writeURL();
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
  writeURL();
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
  writeURL();
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
  writeURL();
};

const headStyle = document.getElementById('headStyle');
headStyle.onclick = function() {
  setStyleExpanded(!scaleFig.style['styleExpanded']);
};

function writeURL() {
  let queryStr = '';
  Object.entries(URLParamGetters).forEach(([key, func]) => {
    const value = func();
    const valueStr = JSON.stringify(value);
    queryStr += `${key}=${valueStr}&`;
  });
  queryStr = encodeURIComponent(queryStr);
  const newURL = window.location.pathname + '?' + queryStr;
  window.history.replaceState(null, '', newURL);
}

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

// Rectilinear projection of 3D lattice.
// const phi = 2.0*Math.PI*0.75; // Angle of the lattice against the projection
// const spios = Math.sin(Math.PI/6.0);
// const k = 1.0/(1.0 + spios);
// // TODO This constant 200.0 is just the default horizontalZoom.
// const s = 200.0*(1.0+1.0/spios); // Scale
// const shift2 = Math.log2(2.0) * s*k * Math.cos(phi);
// const shift3 = Math.log2(3.0/2.0) * s*k * Math.cos(phi+2*Math.PI/3.0);
// const shift5 = Math.log2(5.0/4.0) * s*k * Math.cos(phi+4*Math.PI/3.0);

const DEFAULT_URLPARAMS = {
  'originFreq': 440,
  'maxHarmNorm': 8.0,
  'pitchlineColor': '#c7c7c7',
  'showPitchlines': true,
  'showKeys': true,
  'showSteps': true,
  'toneRadius': 22.0,
  'toneLabelTextStyle': 'EDO',
  'toneColor': '#D82A1E',
  'baseToneBorderColor': '#000000',
  'baseToneBorderSize': 5.0,
  'opacityHarmNorm': true,
  'horizontalZoom': 300,
  'axes': [
    {'yShift': 0, 'harmDistStep': 0.0},
    {'yShift': 151, 'harmDistStep': 1.5},
    {'yShift': 47, 'harmDistStep': 2.7},
  ],
  'baseTones': [[0, 0, 0]],
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

const URLParamSetters = {
  'originFreq': numOriginFreqOninput,
  'maxHarmNorm': numMaxHarmNormOnchange,
  'pitchlineColor': colorPitchlinesOninput,
  'showPitchlines': cboxPitchlinesOnclick,
  'showKeys': cboxKeysOnclick,
  'showSteps': cboxStepsOnclick,
  'toneRadius': numToneRadiusOninput,
  'toneLabelTextStyle': radioToneLabelOnclick,
  'toneColor': toneColorOninput,
  'baseToneBorderColor': baseToneBorderColorOninput,
  'baseToneBorderSize': numBaseToneBorderSizeOninput,
  'opacityHarmNorm': cboxOpacityHarmNormOnclick,
  'horizontalZoom': rangeZoomOninput,
  // TODO The way this is done with what are essentially "AxisObjects" is a
  // stylistically different from how scaleFig just stores a dictionary of
  // yShifts and hamrDistSteps. Don't know if this really is an issue.
  // stepIntervals does something similar, although its less avoidable there.
  'axes': (axes) => {
    for (let i = 0; i < axes.length; i++) {
      if (scaleFig.primes.length < i+1) addAxis();
      const yShift = axes[i].yShift;
      const harmDistStep = axes[i].harmDistStep;
      const p = scaleFig.primes[i];
      yShiftOnchange(p, yShift);
      harmDistStepOnchange(p, harmDistStep);
    }
  },
  'baseTones': (baseTones) => {
    baseTones.forEach((baseTone) => {
      addBaseTone(baseTone);
    });
  },
  'stepIntervals': (stepIntervals) => {
    for (let i = 0; i < stepIntervals.length; i++) {
      const interval = stepIntervals[i].interval;
      const color = stepIntervals[i].color;
      const show = stepIntervals[i].show;
      addStepInterval(interval, color, show);
    }
  },
  'settingsExpanded': setSettingsExpanded,
  'generalExpanded': setGeneralExpanded,
  'tonesExpanded': setTonesExpanded,
  'stepIntervalsExpanded': setStepIntervalsExpanded,
  'styleExpanded': setStyleExpanded,
};

const URLParamGetters = {
  'originFreq': () => {
    return scaleFig.originFreq;
  },
  'maxHarmNorm': () => {
    return scaleFig.maxHarmNorm;
  },
  'pitchlineColor': () => {
    return scaleFig.style['pitchlineColor'];
  },
  'showPitchlines': () => {
    return scaleFig.style['drawPitchlines'];
  },
  'showKeys': () => {
    return scaleFig['showKeys'];
  },
  'showSteps': () => {
    return scaleFig.style['drawSteps'];
  },
  'toneRadius': () => {
    return scaleFig.style['toneRadius'];
  },
  'toneLabelTextStyle': () => {
    return scaleFig.labelTextStyle;
  },
  'toneColor': () => {
    return scaleFig.style['toneColor'];
  },
  'baseToneBorderColor': () => {
    return scaleFig.style['baseToneBorderColor'];
  },
  'baseToneBorderSize': () => {
    return scaleFig.style['baseToneBorderSize'];
  },
  'opacityHarmNorm': () => {
    return scaleFig.style['opacityHarmNorm'];
  },
  'horizontalZoom': () => {
    return scaleFig.horizontalZoom;
  },
  'axes': () => {
    const axes = [];
    for (let i = 0; i < scaleFig.primes.length; i++) {
      const p = scaleFig.primes[i];
      const pStr = p.toString();
      const yShift = scaleFig.yShifts[pStr];
      const harmDistStep = scaleFig.harmDistSteps[pStr];
      axes.push({'yShift': yShift, 'harmDistStep': harmDistStep});
    }
    return axes;
  },
  'baseTones': () => {
    return scaleFig.baseTones;
  },
  'stepIntervals': () => {
    const stepIntervals = [];
    Object.values(scaleFig.stepIntervals).forEach((stepInterval) => {
      const interval = stepInterval.interval;
      const color = stepInterval.color;
      const show = stepInterval.show;
      stepIntervals.push({'interval': interval, 'color': color, 'show': show});
    });
    return stepIntervals;
  },
  'settingsExpanded': () => {
    return scaleFig.style['settingsExpanded'];
  },
  'generalExpanded': () => {
    return scaleFig.style['generalExpanded'];
  },
  'tonesExpanded': () => {
    return scaleFig.style['tonesExpanded'];
  },
  'stepIntervalsExpanded': () => {
    return scaleFig.style['stepIntervalsExpanded'];
  },
  'styleExpanded': () => {
    return scaleFig.style['styleExpanded'];
  },
};

resizeCanvas();
resizeKeyCanvas();
resizeSettings();
addKeys();

readURL();
writeURL();

checkTones(); // TODO Only here for testing during development.
