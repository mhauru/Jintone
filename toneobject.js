'use strict';
import {VariableSourceSubject} from './variablesourcesubject.js';
export {toneToString, ToneObject};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Generic utility functions

const ALLPRIMES = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
  73, 79, 83, 89, 97,
];

function iteratorUnion(it1, it2) {
  return new Set([...it1, ...it2]);
}

function opacityFromRelHn(hn) {
  const minopacity = 0.15
  return (1.0 - minopacity) * hn + minopacity
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Functions for arithmetic with coordinate representations of tones.
//
function toneToString(tone) {
  return [...tone.entries()].sort().toString();
}

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
  constructor(coordinates, isBase, svgGroups, streams, allTones, synth) {
    this.coords = coordinates;
    this.isBase = new rxjs.BehaviorSubject(isBase);
    this.allTones = allTones;
    this.subscriptions = [];

    this.svgTone = svgGroups['tones'].group();
    this.svgCircle = this.svgTone.circle(1.0);
    this.svgLabel = this.svgTone.text('');
    // TODO Where do these numbers come from?
    const pitchlineGroup = svgGroups['pitchlines'];
    this.svgPitchline = pitchlineGroup.path('M 0,-1000 V 2000');

    // TODO We fire a lot of events, mouse, touch and pointer ones. Depending
    // on the browser, the same click or touch may fire several, e.g. both
    // touch and mouse or both pointer and mouse. This ensures maximum
    // compatibility with different browsers, but probably costs something in
    // performance. Note though that the same tone isn't played twice. Come
    // back to this later and check whether we could switch for instance using
    // only PointerEvents, once they have widespread support.

    this.subscriptions.push(streams.baseTones.subscribe((baseTones) => {
      const coordsStr = toneToString(this.coords);
      const inBaseTones = baseTones.has(coordsStr);
      if (inBaseTones && !this.isBase.getValue()) {
        this.isBase.next(true);
      } else if (!inBaseTones && this.isBase.getValue()) {
        this.isBase.next(false);
      }
    }));

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
    // already. Whenever this key is released, either turn the tone off if
    // sustain is not down, or start listening for when sustain is released.
    this.isOn = new rxjs.BehaviorSubject(false);
    this.subscriptions.push(trueOnClickDown.subscribe(this.isOn));
    this.subscriptions.push(falseOnClickUp.subscribe((f) => {
      if (!streams.sustainDown.getValue()) {
        this.isOn.next(false);
      } else {
        streams.sustainDown.pipe(
          rxjs.operators.first((x) => !x)
        ).subscribe((x) => {
          this.isOn.next(false);
        });
      }
    }));

    const pf = pitchFactor(this.coords);
    const fraction = toneToFraction(this.coords);
    const frequency = new rxjs.BehaviorSubject(
      streams.originFreq.getValue()*pf
    );
    this.subscriptions.push(
      streams.originFreq.pipe(rxjs.operators.map((x) => pf*x)).subscribe(
        (x) => frequency.next(x)
      )
    );

    this.subscriptions.push(
      this.isOn.subscribe((val) => {
        if (val) {
          synth.triggerAttack(frequency.getValue());
        } else {
          synth.triggerRelease(frequency.getValue());
        }
      })
    );

    const xpos = new rxjs.BehaviorSubject();
    this.subscriptions.push(
      streams.horizontalZoom.subscribe(
        (zoom) => {
          xpos.next(zoom * Math.log2(pf));
        }
      )
    );

    const ypos = new rxjs.BehaviorSubject();
    this.subscriptions.push(
      rxjs.combineLatest(
        streams.verticalZoom,
        streams.yShifts
      ).subscribe(([zoom, yShifts]) => {
        let y = 0.0;
        this.coords.forEach((c, p) => {
          // TODO Is the check necessary?
          if (yShifts.has(p)) {
            y += -yShifts.get(p) * c;
          }
        });
        y *= zoom;
        ypos.next(y);
      })
    );

    const harmDistsCombined = new VariableSourceSubject(
      rxjs.combineLatest, []
    );
    const harmDists = new Map();

    this.subscriptions.push(streams.baseTones.subscribe((baseTones) => {
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
                let s;
                // If there is no harmonic distance defined for this prime,
                // assume it's infinite.
                if (!hds.has(p)) {
                  s = Infinity;
                } else {
                  s = hds.get(p);
                }
                if (c != 0.0) d += s*c;
              }
              return d;
            }));
          harmDists.set(btStr, dist);
          harmDistsCombined.addSource(dist);
        }
      });
    }));

    const harmNorm = new rxjs.BehaviorSubject(0.0);
    this.subscriptions.push(
      harmDistsCombined.subscribe((x) => harmNorm.next(Math.min(...x)))
    );

    const inbounds = new rxjs.BehaviorSubject(false);
    this.subscriptions.push(rxjs.combineLatest(
      harmNorm, streams.maxHarmNorm, xpos, ypos, streams.canvasViewbox
    ).subscribe(([hn, maxhn, x, y, viewbox]) => {
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
      inbounds.next(harmClose && inViewbox);
    }));

    this.inclosure = new rxjs.BehaviorSubject(false);
    this.subscriptions.push(rxjs.combineLatest(
      harmNorm,
      streams.maxHarmNorm,
      xpos,
      ypos,
      streams.horizontalZoom,
      streams.verticalZoom,
      streams.yShifts,
      streams.canvasViewbox,
    ).subscribe(([
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
      this.inclosure.next(harmClose && inViewClosure);
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

    this.subscriptions.push(rxjs.combineLatest(xpos, ypos).subscribe(
      ([x, y]) => this.svgTone.move(x, y)
    ));
    this.subscriptions.push(xpos.subscribe((x) => this.svgPitchline.x(x)));
    
    this.subscriptions.push(
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
      })
    );

    // This one is just manually made to emit every time the tone labels have
    // been redrawn. The reason for using this, instead of making the below
    // subscribe take toneLabelTextStyle as an argument, is to ensure that the
    // text has been changed before the rescaling occurs.
    const toneLabelRedrawTrigger = new rxjs.Subject();

    // TODO This doesn't actually depend on the value of toneLabelTextStyle,
    // it just should be redone every time that changes.
    this.subscriptions.push(rxjs.combineLatest(
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
    }));

    // TODO Should split this into smaller, independent parts.
    this.subscriptions.push(rxjs.combineLatest(
      this.isOn,
      this.isBase,
      relHarmNorm,
      streams.toneColorActive,
      streams.toneColor,
      streams.baseToneBorderColor,
      streams.baseToneBorderSize,
    ).subscribe(([
      isOn,
      ib,
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
      if (ib) {
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
    }));

    // TODO Should split this into subparts
    this.subscriptions.push(rxjs.combineLatest(
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
    }));

    this.subscriptions.push(rxjs.combineLatest(
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
    }));

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

    // TODO Maybe write a function that loops over all neighbours, to avoid
    // code duplication.
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
    this.subscriptions.push(
      rxjs.combineLatest(this.inclosure, streams.primes).subscribe(
        ([inclsr, primes]) => {
          if (inclsr) {
            for (let i = 0; i < primes.length; i += 1) {
              [-1, +1].forEach(function(increment) {
                const step = new Map([[primes[i], increment]]);
                const neighCoords = sumTones(coords, step);
                if (!me.neighbours.has(toneToString(neighCoords))) {
                  new ToneObject(
                    neighCoords,
                    false,
                    svgGroups,
                    streams,
                    allTones,
                    synth,
                  );
                }
              });
            }
          }
        }
      )
    );

    this.subscriptions.push(streams.primes.subscribe((primes) => {
      for (const p of coords.keys()) {
        if (!primes.includes(p)) {
          me.destroy();
          break;
        }
      }
    }));

    // TODO Could just create anyNeighborInclosure directly as
    // VariableSourceSubject.
    const anyNeighborInclosure = this.neighboursInclosure.pipe(
      rxjs.operators.map((arr) => {
        return arr.some((x) => x);
      })
    );
    // TODO Should we also check for isOn, to make sure we don't leave some
    // note ringing after it's destroyed? At least test what happens if a note
    // that is playing is destroyed.
    this.subscriptions.push(rxjs.combineLatest(
      this.inclosure,
      anyNeighborInclosure,
      this.isBase
    ).subscribe(
      ([incls, neighIncls, ib]) => {
        if (!incls && !neighIncls && !ib) me.destroy();
      }
    ));
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

  // TODO Should we destroy some subscriptions as well, and send death-notices
  // on all the streams we've created?
  destroy() {
    for (const s of this.subscriptions) {
      s.unsubscribe();
    }
    this.neighbours.forEach((neighbour, neigCoords) => {
      neighbour.neighbourDestroyed(this.coords);
    });
    this.allTones.delete(toneToString(this.coords));
    this.svgTone.remove();
    this.svgPitchline.remove();
  }
}
