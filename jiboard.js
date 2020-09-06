'use strict';
// TODO I would like to ES6 module import also SVG.js and rxjs, and locally
// import ResizeObserver from a module folder rather than a .min.js I manually
// copied from a CDN. None of these things seem possible because the
// javascript module ecosystem is a massive mess that drives me nuts.
import './node_modules/tone/build/Tone.js';
import ResizeObserver from './resize-observer.min.js';

// TODO:
// - Should we change all the objects that really work only as dictonaries into
//   Maps?

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Global constants.

// TODO Turn this into a generator that actually returns arbitrarily many
// primes.
const ALLPRIMES = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
  73, 79, 83, 89, 97,
];
const edofactorlog = 1/12;
const edofactor = Math.pow(2, edofactorlog);
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
    'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B',
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

function opacityFromRelHn(hn) {
  const minopacity = 0.15
  return (1.0 - minopacity) * hn + minopacity
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

class VariableSourceSubject extends rxjs.BehaviorSubject {
  constructor(joinFunction, defaultValue) {
    super(defaultValue); // TODO Should this be null instead?
    this.defaultValue = defaultValue;
    this.joinFunction = joinFunction;
    this.sources = new Set();
    this.renewInnerSubscription();
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
    if (this.innerSubscription) {
      this.innerSubscription.unsubscribe();
    }
    if (this.sources && this.sources.size > 0) {
      const innerObservable = this.joinFunction(...this.sources);
      this.innerSubscription = innerObservable.subscribe(this);
    } else {
      this.next(this.defaultValue);
    }
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
function toneToFraction(interval) {
  let num = 1.0;
  let denom = 1.0;
  interval.forEach((c, p) => {
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
  interval.forEach((c, p) => {
    pf *= Math.pow(p, c);
  });
  return pf;
}

// TODO The 'Object' part of the name is to avoid a name collission with
// Tone.js. Think about namespace management.
class ToneObject {
  constructor(coordinates, isBase, streams, allTones) {
    // TODO Think about how base tones should be marked, but I think it
    // shouldn't be a field, but just another stream called isBase, that's
    // created in setListeners, and is based on a global stream of what are the
    // current baseTones.
    this.coords = coordinates;
    this.isBase = new rxjs.BehaviorSubject(isBase);
    this.allTones = allTones;
    // this.steps = {};
    // this.incomingSteps = {};

    this.svgTone = scaleFig.svgGroups['tones'].group();
    this.svgCircle = this.svgTone.circle(1.0);
    this.svgLabel = this.svgTone.text('');
    // TODO Where do these numbers come from?
    const pitchlineGroup = scaleFig.svgGroups['pitchlines'];
    this.svgPitchline = pitchlineGroup.path('M 0,-1000 V 2000');
    /*
    this.positionSvg();
    this.setLabelText();
    this.colorSvg();
    this.scaleSvgTone();
    this.addSteps();
    */

    // TODO We fire a lot of events, mouse, touch and pointer ones. Depending
    // on the browser, the same click or touch may fire several, e.g. both
    // touch and mouse or both pointer and mouse. This ensures maximum
    // compatibility with different browsers, but probably costs something in
    // performance. Note though that the same tone isn't played twice. Come
    // back to this later and check whether we could switch for instance using
    // only PointerEvents, once they have widespread support.
    //const t = this;
    //function eventOn(ev) {
    //  if (!scaleFig.ctrlDown) {
    //    t.isBeingClicked = true;
    //    t.toneOn();
    //  }
    //};
    //function eventOff(ev) {
    //  t.isBeingClicked = false;
    //  t.toneOff();
    //};

    // TODO Maybe baseTones should have strings as keys, like allTones, in
    // which case checking would be easy.
    streams.baseTones.subscribe((baseTones) => {
      const coordsStr = toneToString(this.coords);
      const inBaseTones = baseTones.has(coordsStr);
      if (inBaseTones && !this.isBase.getValue()) {
        this.isBase.next(true);
      } else if (!inBaseTones && this.isBase.getValue()) {
        this.isBase.next(false);
      }
    });

    const trueOnClickDown = rxjs.merge(
      rxjs.fromEvent(this.svgTone, 'mousedown').pipe(
        rxjs.operators.filter((ev) => ev.buttons == 1),
      ),
      rxjs.fromEvent(this.svgTone, 'touchstart'),
      rxjs.fromEvent(this.svgTone, 'pointerdown').pipe(
        rxjs.operators.filter((ev) => ev.buttons == 1),
        rxjs.operators.map((ev) => {
          // Allow pointer event target to jump between objects when pointer is
          // moved.
          ev.target.releasePointerCapture(ev.pointerId);
          return ev;
        })),
    ).pipe(rxjs.operators.map((ev) => {
      // TODO Why does on-click require this, but off-click doesn't?
      ev.preventDefault();
      return true;
    }));

    const falseOnClickUp = rxjs.merge(
      rxjs.fromEvent(this.svgTone, 'mouseup'),
      rxjs.fromEvent(this.svgTone, 'mouseleave'),
      rxjs.fromEvent(this.svgTone, 'touchend'),
      rxjs.fromEvent(this.svgTone, 'touchcancel'),
      rxjs.fromEvent(this.svgTone, 'pointerup').pipe(
        rxjs.operators.map((ev) => {
          // TODO Does this really do something when releasing?
          // Allow pointer event target to jump between objects when pointer is
          // moved.
          ev.target.releasePointerCapture(ev.pointerId);
          return ev;
        })),
      rxjs.fromEvent(this.svgTone, 'pointerleave'),
    ).pipe(rxjs.operators.map((ev) => false));

    // TODO Why are some of these this.isOn etc. and not just const isOn?
    this.isBeingClicked = rxjs.merge(trueOnClickDown, falseOnClickUp).pipe(
      rxjs.operators.startWith(false)
    );

    // Whenever this key is pressed, the tone is turned on, if it wasn't
    // already. Whenver either this key is released or sustain is released, and
    // the latest action on both this key and sustain is a release, then this
    // tone should be set to false, if it wasn't already.
    // TODO Note that, done this way, an emission happens for all keys every
    // time the sustain is released. Think about mitigating this performance
    // waste by either filtering out repeated isOn emissions before they reach
    // the observer, or by having isBeingClicked determine whether we listend
    // to sustainDown at all.
    this.isOn = new rxjs.BehaviorSubject(false);
    rxjs.merge(
      trueOnClickDown,
      rxjs.combineLatest(this.isBeingClicked, streams.sustainDown).pipe(
        rxjs.operators.filter(([click, sustain]) => {
          // Check that both the latest click and the latest sustain were
          // false.
          return !click && !sustain;
        }),
        rxjs.operators.map((click, sustain) => {
          return false;
        })
      )
    ).subscribe((x) => this.isOn.next(x));

    const pf = pitchFactor(this.coords);
    const fraction = toneToFraction(this.coords);
    const frequency = new rxjs.BehaviorSubject(
      streams.originFreq.getValue()*pf
    );
    streams.originFreq.pipe(rxjs.operators.map((x) => pf*x)).subscribe(
      (x) => frequency.next(x)
    );

    this.isOn.subscribe((val) => {
      if (val) {
        startTone(frequency.getValue());
      } else {
        stopTone(frequency.getValue());
      }
    });

    const xpos = streams.horizontalZoom.pipe(
      rxjs.operators.map((zoom) => {
        return zoom * Math.log2(pf);
      })
    );

    const ypos = rxjs.combineLatest(
      streams.verticalZoom,
      streams.yShifts
    ).pipe(rxjs.operators.map(([zoom, yShifts]) => {
      let y = 0.0;
      this.coords.forEach((c, p) => {
        // TODO Is the check necessary?
        if (yShifts.has(p)) {
          y += -yShifts.get(p) * c;
        }
      });
      y *= zoom;
      return y;
    }));

    const harmDistsCombined = new VariableSourceSubject(rxjs.combineLatest, []);
    const harmDists = new Map();

    streams.baseTones.subscribe((baseTones) => {
      // Remove harmDists if the corresponding baseTone is no longer a
      // baseTone.
      for (const btStr of harmDists.keys()) {
        if (!baseTones.has(btStr)) {
          harmDistsCombined.removeSource(harmDists.get(btStr));
          harmDists.delete(btStr);
        }
      }

      // Add new harmDists if new baseTones are present.
      baseTones.forEach((bt, btStr) => {
        if (!harmDists.has(btStr)) {
          const interval = subtractTone(this.coords, bt);
          const primes = Array.from(interval.keys());
          const facts = primes.map((p) => Math.abs(interval.get(p)));
          const dist = streams.harmDistSteps.pipe(rxjs.operators.map(
            (hds) => {
              let d = 0;
              for (let i = 0; i < primes.length; i++) {
                const p = primes[i];
                const c = facts[i];
                const s = hds.get(p);
                if (c != 0.0) d += s*c;
              }
              return d;
            }));
          harmDists.set(btStr, dist);
          harmDistsCombined.addSource(dist);
        }
      });
    });

    const harmNorm = harmDistsCombined.pipe(rxjs.operators.map(
      (x) => Math.min(...x))
    );

    const inbounds = rxjs.combineLatest(
      harmNorm, streams.maxHarmNorm, xpos, ypos, streams.canvasViewbox
    ).pipe(rxjs.operators.map(([hn, maxhn, x, y, viewbox]) => {
      // TODO Add note radius, to check if the edge of a note fits, rather
      // than center?
      const viewboxLeft = viewbox.x;
      const viewboxRight = viewboxLeft + viewbox.width;
      const viewboxTop = viewbox.y;
      const viewboxBottom = viewboxTop + viewbox.height;
      const inBoxHor = (viewboxLeft < x && x < viewboxRight);
      const inBoxVer = (viewboxTop < y && y < viewboxBottom);
      const inViewbox = inBoxHor && inBoxVer;
      const harmClose = (hn <= maxhn);
      return harmClose && inViewbox;
    }));

    this.inclosure = rxjs.combineLatest(
      harmNorm,
      streams.maxHarmNorm,
      xpos,
      ypos,
      streams.horizontalZoom,
      streams.verticalZoom,
      streams.yShifts,
      streams.canvasViewbox,
    ).pipe(rxjs.operators.map(([
      hn,
      maxhn,
      x,
      y,
      horizontalZoom,
      verticalZoom,
      yShifts,
      viewbox,
    ]) => {
      const harmClose = (hn <= maxhn);
      const viewboxLeft = viewbox.x;
      const viewboxRight = viewboxLeft + viewbox.width;
      const viewboxTop = viewbox.y;
      const viewboxBottom = viewboxTop + viewbox.height;
      const maxPrime = Math.max(...yShifts.keys());
      const maxXjump = horizontalZoom * Math.log2(maxPrime);
      const maxYshift = Math.max(...yShifts.values());
      const maxYjump = verticalZoom * maxYshift;
      const closureLeft = viewboxLeft - maxXjump;
      const closureRight = viewboxRight + maxXjump;
      const closureTop = viewboxTop - maxYjump;
      const closureBottom = viewboxBottom + maxYjump;
      const inClosureHor = (closureLeft < x && x < closureRight);
      const inClosureVer = (closureTop < y && y < closureBottom);
      const inViewClosure = inClosureHor && inClosureVer;
      return harmClose && inViewClosure;
    }));

    const relHarmNorm = rxjs.combineLatest(harmNorm, streams.maxHarmNorm).pipe(
      rxjs.operators.map(([hn, maxhn]) => {
        let relHn = Math.max(1.0 - hn/maxhn, 0.0);
        // TODO Should opacityHarmNorm really be checked here, and not in the
        // drawing function?
        if (!streams.opacityHarmNorm && relHn > 0.0) {
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
      const svgTone = this.svgTone;
      if (ib && hn > 0) {
        // TODO Should we use 'visible' instead of 'inherit'? 'inherit' may not
        // be a thing for SVG.
        svgPitchline.attr('visibility', 'inherit');
        svgTone.attr('visibility', 'inherit');
      } else {
        svgPitchline.attr('visibility', 'hidden');
        svgTone.attr('visibility', 'hidden');
      }
    });

    // This one is just manually made to emit every time the tone labels have
    // been redrawn. The reason for using this, instead of making the below
    // subscribe take toneLabelTextStyle as an argument, is to ensure that the
    // text has been changed before the rescaling occurs.
    const toneLabelRedrawTrigger = new rxjs.Subject();

    // TODO This doesn't actually depend on the value of toneLabelTextStyle,
    // it just should be redone every time that changes.
    rxjs.combineLatest(
      this.isBase,
      streams.toneRadius,
      streams.baseToneBorderSize,
      toneLabelRedrawTrigger,
    ).subscribe(([isBase, toneRadius, borderSize, _]) => {
      const svgCircle = this.svgCircle;
      const svgLabel = this.svgLabel;
      if (isBase) {
        svgCircle.radius(toneRadius + borderSize/2);
      } else {
        svgCircle.radius(toneRadius);
      }
      // Compute the right scaling factor for the text, so that it fits in the
      // circle.
      const bbox = this.svgLabel.bbox();
      // Note that bbox dimensions do not account for the currenc scaleY and
      // scaleX. And that's what we want.
      const halfDiagLength = Math.sqrt(bbox.w*bbox.w + bbox.h*bbox.h)/2;
      // The 0.95 is to give a bit of buffer around the edges.
      const targetFactor = 0.95*toneRadius/halfDiagLength;
      // If we can comfortably fit within the tone, we won't scale larger than
      // maxFactor. This makes most labels be of the same size, and have the
      // size decrease from maxFactor only when necessary.
      const maxFactor = toneRadius/16;
      const scaleFactor = Math.min(maxFactor, targetFactor);
      // TODO Why on earth do we need to call center before scale? I would have
      // thought that either it doesn't matter, or it needs to be done the
      // other way around, but that doesn't work.
      svgLabel.center(0, 0);
      if (isFinite(scaleFactor)) svgLabel.scale(scaleFactor);
    });

    // TODO Should split this into smaller, independent parts.
    rxjs.combineLatest(
      this.isOn,
      this.isBase,
      relHarmNorm,
      streams.toneColorActive,
      streams.toneColor,
      streams.baseToneBorderColor,
      streams.baseToneBorderSize,
    ).subscribe(([
      isOn,
      isBase,
      relHn,
      toneColorActive,
      toneColorNonActive,
      baseToneBorderColor,
      baseToneBorderSize,
    ]) => {
      const svgTone = this.svgTone;
      const svgCircle = this.svgCircle;
      if (relHn <= 0.0) {
        svgTone.attr('visibility', 'hidden');
        // The other stuff doesn't matter if its hidden, so may as well return.
        return;
      } else {
        svgTone.attr('visibility', 'inherit');
      }
      let toneColor;
      if (isOn) {
        toneColor = toneColorActive;
      } else {
        toneColor = toneColorNonActive;
      }
      if (isBase) {
        const borderColor = baseToneBorderColor;
        const borderSize = baseToneBorderSize;
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
        'fill-opacity': opacityFromRelHn(relHn),
      });
    });

    // TODO Should split this into subparts
    rxjs.combineLatest(
      this.isOn,
      relHarmNorm,
      streams.pitchlineColor,
      streams.pitchlineColorActive,
    ).subscribe(([
      isOn,
      relHn,
      pitchlineColorNonActive,
      pitchlineColorActive,
    ]) => {
      const svgPitchline = this.svgPitchline;
      let pitchlineColor;
      if (isOn) {
        pitchlineColor = pitchlineColorActive;
      } else {
        pitchlineColor = pitchlineColorNonActive;
      }
      svgPitchline.attr({
        'stroke': pitchlineColor,
        'stroke-width': '1.0',
        'stroke-miterlimit': 4.0,
        'stroke-dasharray': '0.5, 0.5',
        'stroke-dashoffset': 0.0,
        'stroke-opacity': opacityFromRelHn(relHn),
      });
    });

    rxjs.combineLatest(
      streams.toneLabelTextStyle,
      frequency,
    ).subscribe(([labelStyle, freq]) => {
      let labelText;
      if (labelStyle == 'EDO') {
        let i = 0;
        // Note that we rely on EDOTones being in rising order of pitch.
        while (i < EDOTones.length - 2) {
          if (EDOTones[i+1].frequency > freq) break;
          i++;
        }
        const lowerNeighbor = EDOTones[i].frequency;
        const heigherNeighbor = EDOTones[i+1].frequency;
        const lowerDistance = Math.abs(lowerNeighbor - freq);
        const heigherDistance = Math.abs(heigherNeighbor - freq);
        let neighbour;
        if (lowerDistance < heigherDistance) {
          neighbour = EDOTones[i];
        } else {
          neighbour = EDOTones[i+1];
        }
        // These are just constant, figured out by trial and error, that seem to
        // do the job.
        const subShift = 2;
        const subFontSize = 12;
        labelText = (add) => {
          add.tspan(`${neighbour.letter}`);
          add.tspan(`${neighbour.octave}`).attr({
            'dy': subShift,
            'font-size': subFontSize,
          });
        };
      } else if (labelStyle == 'fractions') {
        const [num, denom] = fraction;
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
      } else if (labelStyle == 'none') {
        labelText = '';
      } else {
        labelText = '';
      }
      this.svgLabel.text(labelText);
      toneLabelRedrawTrigger.next(true);
    });

    // The below is sets up the following system: Every Tone always keeps
    // tracks of its neighbours. If none of the neighbours are inclosure, nor
    // are we, then its time for this Tone to die. Whenever a Tone becomes
    // inclosure, it should generate all its neighbours. The end result should
    // be a system where all Tones that are inclosure, and all neighbours
    // thereof, always exist, and no others do. This is what the old system was
    // achieving as well. Tones themselves make sure that a) they are added and
    // deleted to/from the global allTones, and that when they are created,
    // they report to their new neighbours their existence, and conversely
    // report their death when necessary.
    this.neighbours = new Map();
    this.neighboursInclosure = new VariableSourceSubject(
      rxjs.combineLatest, []
    );

    // Report our birth to the global register of all tones.
    allTones.set(toneToString(this.coords), this);

    const me = this;
    const coords = this.coords;

    // Add any already existing neighbours, and report to them that they have a
    // new neighbour.
    const currentPrimes = streams.primes.getValue();
    for (let i = 0; i < currentPrimes.length; i += 1) {
      [-1, +1].forEach(function(increment) {
        const step = new Map([[currentPrimes[i], increment]]);
        const neighCoords = sumTones(coords, step);
        const neighCoordsStr = toneToString(neighCoords);
        if (allTones.has(neighCoordsStr)) {
          const neighbour = allTones.get(neighCoordsStr);
          me.neighbourCreated(neighCoords, neighbour);
          neighbour.neighbourCreated(coords, me);
        }
      });
    }

    // TODO I think this one, and probably many others, could benefit from a
    // filter that only sends out new values if they are different than the
    // previous ones, to avoid recomputing stuff.
    rxjs.combineLatest(this.inclosure, streams.primes).subscribe(
      ([inclsr, primes]) => {
        if (inclsr) {
          for (let i = 0; i < primes.length; i += 1) {
            [-1, +1].forEach(function(increment) {
              const step = new Map([[primes[i], increment]]);
              const neighCoords = sumTones(coords, step);
              if (!me.neighbours.has(toneToString(neighCoords))) {
                new ToneObject(neighCoords, false, streams, allTones);
              }
            });
          }
        }
      }
    );

    // TODO Could just create anyNeighborInclosure directly as
    // VariableSourceSubject.
    const anyNeighborInclosure = this.neighboursInclosure.pipe(
      rxjs.operators.map((arr) => {
        return arr.some((x) => { return x; });
      })
    );
    rxjs.combineLatest(this.inclosure, anyNeighborInclosure).subscribe(
      ([incls, neighIncls]) => {
        if (!incls && !neighIncls) me.destroy();
      }
    );
  }

  neighbourCreated(coords, tone) {
    const coordsStr = toneToString(coords);
    if (!this.neighbours.has(coordsStr)) {
      this.neighbours.set(coordsStr, tone);
      this.neighboursInclosure.addSource(tone.inclosure);
    }
  }

  neighbourDestroyed(coords) {
    const coordsStr = toneToString(coords);
    if (this.neighbours.has(coordsStr)) {
      const tone = this.neighbours.get(coordsStr);
      this.neighbours.delete(coordsStr);
      this.neighboursInclosure.removeSource(tone.inclosure);
    }
  }

  destroy() {
    this.svgTone.remove();
    this.svgPitchline.remove();
    this.neighbours.forEach((neighbour, neigCoords) => {
      neighbour.neighbourDestroyed(this.coords);
    });
    this.allTones.delete(toneToString(this.coords));
  }
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

streams.sustainDown = rxjs.merge(trueOnSustainDown, falseOnSustainUp).pipe(
  rxjs.operators.startWith(false)
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

// TODO Is this wrapping around a BehaviorSubject necessary/usefull? I
// originally added it to fix the fact that the EDO keys were in slightly wrong
// places at the start, but that turned out to be caused by other things.
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

streams.showSteps.subscribe((value) => {
  if (value) {
    scaleFig.svgGroups.steps.attr('visibility', 'inherit');
  } else {
    scaleFig.svgGroups.steps.attr('visibility', 'hidden');
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

// TODO Make default be read from URL and new values be registered.
const defaultAxes = new Map();
defaultAxes.set(2, {
  'harmDistStep': 0.0,
  'yShift': 1.2,
});
defaultAxes.set(3, {
  'harmDistStep': 1.5,
  'yShift': 1.8,
});
defaultAxes.set(5, {
  'harmDistStep': 1.7,
  'yShift': 1.0,
});
streams.axes = new rxjs.BehaviorSubject(defaultAxes);

function getPrimes(axes) {
  return Array.from(axes.keys());
}
streams.primes = new rxjs.BehaviorSubject(getPrimes(streams.axes.getValue()));
streams.axes.subscribe((axes) => streams.primes.next(getPrimes(axes)));

streams.harmDistSteps = streams.axes.pipe(rxjs.operators.map((axes) => {
  const harmDistSteps = new Map();
  axes.forEach((val, key) => harmDistSteps.set(key, val.harmDistStep));
  return harmDistSteps;
}));
streams.yShifts = streams.axes.pipe(rxjs.operators.map((axes) => {
  const yShifts = new Map();
  axes.forEach((val, key) => yShifts.set(key, val.yShift));
  return yShifts;
}));

// TODO What's the right place to have this bit?
const allTones = new Map();
streams.baseTones.subscribe((baseTones) => {
  // We only have to care about creating new Tones here. Each tone object
  // subscribes to baseTones to check if its own isBase should change.
  baseTones.forEach((bt, btStr) => {
    if (!allTones.has(btStr)) {
      new ToneObject(bt, true, streams, allTones);
    }
  });
});

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// The EDO keyboard

class Key {
  constructor(frequency, type) {
    this.frequency = frequency;
    this.type = type;
    this.createSvg();
    this.setListeners();
  }

  createSvg() {
    const container = scaleFig.keyCanvas;
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

  setListeners() {
    const svg = this.svg;
    // TODO We fire a lot of events, mouse, touch and pointer ones. Depending
    // on the browser, the same click or touch may fire several, e.g. both
    // touch and mouse or both pointer and mouse. This ensures maximum
    // compatibility with different browsers, but probably costs something in
    // performance, and wonder if it might make a mess in some other way, e.g.
    // causing a tone to play twice. Come back to this later and check whether
    // we could switch for instance using only PointerEvents, once they have
    // widespread support. See https://caniuse.com/#feat=pointer
    const trueOnClickDown = rxjs.merge(
      rxjs.fromEvent(svg, 'mousedown').pipe(
        rxjs.operators.filter((ev) => ev.buttons == 1),
      ),
      rxjs.fromEvent(svg, 'touchstart'),
      rxjs.fromEvent(svg, 'pointerdown').pipe(
        rxjs.operators.filter((ev) => ev.buttons == 1),
        rxjs.operators.map((ev) => {
          // Allow pointer event target to jump between objects when pointer is
          // moved.
          ev.target.releasePointerCapture(ev.pointerId);
          return ev;
        })),
    ).pipe(rxjs.operators.map((ev) => {
      // TODO Why does on-click require this, but off-click doesn't?
      ev.preventDefault();
      return true;
    }));

    const falseOnClickUp = rxjs.merge(
      rxjs.fromEvent(svg, 'mouseup'),
      rxjs.fromEvent(svg, 'mouseleave'),
      rxjs.fromEvent(svg, 'touchend'),
      rxjs.fromEvent(svg, 'touchcancel'),
      rxjs.fromEvent(svg, 'pointerup').pipe(
        rxjs.operators.map((ev) => {
          // TODO Does this really do something when releasing?
          // Allow pointer event target to jump between objects when pointer is
          // moved.
          ev.target.releasePointerCapture(ev.pointerId);
          return ev;
        })),
      rxjs.fromEvent(svg, 'pointerleave'),
    ).pipe(rxjs.operators.map((ev) => false));

    // TODO Does this need to have the "this." part?
    this.isBeingClicked = new rxjs.BehaviorSubject(false);
    rxjs.merge(trueOnClickDown, falseOnClickUp).pipe(
      rxjs.operators.startWith(false)
    ).subscribe((x) => this.isBeingClicked.next(x));

    // Whenever this key is pressed, the tone is turned on, if it wasn't
    // already. Whenver either this key is released or sustain is released, and
    // the latest action on both this key and sustain is a release, then this
    // tone should be set to false, if it wasn't already.
    // TODO Note that, done this way, an emission happens for all keys every
    // time the sustain is released. Think about mitigating this performance
    // waste by either filtering out repeated isOn emissions before they reach
    // the observer, or by having isBeingClicked determine whether we listend
    // to sustainDown at all.
    this.isOn = new rxjs.BehaviorSubject(false);
    rxjs.merge(
      trueOnClickDown,
      rxjs.combineLatest(this.isBeingClicked, streams.sustainDown).pipe(
        rxjs.operators.filter(([click, sustain]) => {
          // Check that both the latest click and the latest sustain were
          // false.
          return !click && !sustain;
        }),
        rxjs.operators.map((click, sustain) => {
          return false;
        })
      )
    ).subscribe((x) => this.isOn.next(x));

    this.isOn.subscribe((val) => {
      if (val) {
        startTone(this.frequency);
      } else {
        stopTone(this.frequency);
      }
    });

    // TODO This could probably be somehow filtered better, to avoid
    // unnecessary observations.
    rxjs.combineLatest(this.isOn, streams.toneColorActive).subscribe(
      ([val, color]) => {
        if (val) {
          this.svgKey.attr('fill', color);
        } else {
          const keyColor = (this.type == 'black') ? '#000000' : '#FFFFFF';
          this.svgKey.attr('fill', keyColor);
        }
      });

    const frequencyRatio = streams.originFreq.pipe(
      rxjs.operators.map((of) => this.frequency/of),
    );
    const pos = rxjs.combineLatest(
      frequencyRatio,
      streams.horizontalZoom
    ).pipe(rxjs.operators.map(([fr, hz]) => hz * Math.log2(fr)));
    streams.horizontalZoom.subscribe((hz) => this.svg.scale(hz, 1));
    pos.subscribe((p) => {
      if (isFinite(p)) this.svg.translate(p, 0);
    });
  }
}

function addKeys() {
  EDOTones.forEach((EDOTone) => {
    const key = new Key(EDOTone.frequency, EDOTone.keytype);
    // scaleFig.keys.push(key); // TODO Is this still a thing?
  });
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Event listeners for adding new intervals and axes.

/* TODO Come back to this interval and axis creation business once other things
 * are mostly in place and you have an idea of how intervals should be done
 * with Observables.
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
*/

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

/*
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
    grad.get(0).attr('stop-opacity', opacityFromRelHn(relHn1));
    grad.get(1).attr('stop-opacity', opacityFromRelHn(relHn2));
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
*/


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
*/

/*
function generateTones() {
  // TODO This doesn't work if a baseTone is outside of the viewbox closure.
  // Starting from the current boundary tones, i.e. tones that are not
  // inbounds (drawable) but are within the closure (close enough to
  // being drawable that they may be necessary to reach all drawable tones),
  // check whether any of them have actually come within the closure since we
  // last checked. If yes, generate all their neighbours (that don't already
  // exist), and recursively check whether they are within the closure.  At
  // the end, all possible tones within the closure, and all their neighbours,
  // should exist, but the neighbours that are outside the closure should not
  // further have their neighbours generated.
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
    // TODO How does a tone get marked as being base if it already exists?
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

readURL();
updateURL();

streams.horizontalZoom.subscribe((value) => updateURL());
streams.verticalZoom.subscribe((value) => updateURL());
checkTones(); // TODO Only here for testing during development.
*/

addKeys();

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
