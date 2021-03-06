'use strict';
import * as rxjs from 'rxjs';
import * as operators from 'rxjs/operators';
import {luqr} from 'luqr';
import {VariableSourceSubject} from './variablesourcesubject.js';
import {EDOTones} from './edo.js';
import {makeElementPlayable} from './makeelementplayable.js';
export {
  toneToString,
  toneToFraction,
  primeDecompose,
  linearlyIndependent,
  JITone,
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Generic utility functions

const ALLPRIMES = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
  73, 79, 83, 89, 97,
];

function iteratorUnion(it1, it2) {
  return new Set([...it1, ...it2]);
}

function opacityFromRelHn(hn, minOpacity) {
  let opacity = (1.0 - minOpacity) * hn + minOpacity;
  if (opacity < 0.0) opacity = 0.0;
  return opacity;
}

function reduceFraction(num, denom) {
  while (num/denom >= 2) {
    if (num % 2 == 0) {
      num = num / 2;
    } else {
      denom = denom * 2;
    }
  }
  while (num/denom < 1) {
    if (denom % 2 == 0) {
      denom = denom / 2;
    } else {
      num = num * 2;
    }
  }
  return [num, denom];
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Functions for arithmetic with coordinate representations of tones.
//
function toneToString(tone) {
  return [...tone.entries()].sort().toString();
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

// Scale a tone by a scalar a * tone
function scaleTone(a, tone) {
  // TODO The Array trick is ugly
  return new Map([...tone.entries()].map(([k, v]) => [k, a*v]));
}

// Given an interval, compute the fraction representation as [num, denom].
function toneToFraction(interval) {
  let num = 1.0;
  let denom = 1.0;
  for (const [p, c] of interval) {
    // TODO Could we rely on always assuming that c != 0?
    if (c > 0) num *= Math.pow(p, c);
    else denom *= Math.pow(p, -c);
  }
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
    const p = ALLPRIMES[i];
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

// Return a matrix, with columns representing the intervals. Rows with
// only zeros are omitted.
function intervalsToMatrix(intervals) {
  const primeSet = new Set();
  for (const i of intervals) {
    for (const p of i.keys()) {
      primeSet.add(p);
    }
  }
  const primeArray = Array.from(primeSet).sort();
  const columns = intervals.map((i) => {
    return primeArray.map((p) => (i.get(p) || 0));
  });
  return columns;
}

// Return whether a set of intervals is linearlyIndependent or not.
function linearlyIndependent(intervals) {
  const mat = intervalsToMatrix(intervals);
  const n = mat.length;
  if (n < 2) return true;
  const m = mat[0].length;
  if (n > m) return false;
  const r = luqr.decomposeQR(mat).R;
  for (let i = 0; i < n; i++) {
    if (Math.abs(r[i][i]) < 1e-6) return false;
  }
  return true;
}

class JITone {
  constructor(genIntCoords, isRoot, svgGroups, streams, allTones, synth) {
    this.genIntCoords = genIntCoords;
    this.isRoot = isRoot;
    this.allTones = allTones;
    this.subscriptions = [];

    this.svgTone = svgGroups['tones'].group();
    this.svgCircle = this.svgTone.circle(1.0);
    this.svgLabel = this.svgTone.text('');
    // TODO Where do these numbers come from?
    const pitchlineGroup = svgGroups['pitchlines'];
    this.svgPitchline = pitchlineGroup.path('M 0,-1000 V 2000');

    this.primeCoords = new Map();
    for (const [genIntStr, c] of genIntCoords.entries()) {
      // TODO A bit wasteful doing getValue() repeatedly
      const genInt = streams.generatingIntervals.getValue().get(genIntStr);
      this.primeCoords = sumTones(this.primeCoords, scaleTone(c, genInt));
    }

    const pf = pitchFactor(this.primeCoords);
    const fraction = toneToFraction(this.primeCoords);
    const frequency = new rxjs.BehaviorSubject(
      streams.originFreq.getValue()*pf,
    );
    this.subscriptions.push(
      streams.originFreq.pipe(operators.map((x) => pf*x)).subscribe(
        (x) => frequency.next(x),
      ),
    );

    const mepRetval = makeElementPlayable(
      this.svgTone.node, frequency, streams, synth,
    );
    const isOn = mepRetval[0];
    this.subscriptions.push(...mepRetval[2]);

    const xpos = new rxjs.BehaviorSubject();
    this.subscriptions.push(
      streams.horizontalZoom.subscribe(
        (zoom) => {
          xpos.next(zoom * Math.log2(pf));
        },
      ),
    );

    const ypos = new rxjs.BehaviorSubject();
    this.subscriptions.push(
      rxjs.combineLatest(
        streams.verticalZoom,
        streams.yShifts,
      ).subscribe(([zoom, yShifts]) => {
        let y = 0.0;
        this.genIntCoords.forEach((c, genIntStr) => {
          // TODO Is the check necessary?
          if (yShifts.has(genIntStr)) {
            y += -yShifts.get(genIntStr) * c;
          }
        });
        y *= zoom;
        ypos.next(y);
      }),
    );

    const harmNorm = new rxjs.BehaviorSubject(0.0);
    this.subscriptions.push(streams.harmDistSteps.pipe(
      operators.map(
        (hds) => {
          let d = 0;
          for (const [genIntStr, c] of genIntCoords) {
            // If there is no harmonic distance defined for this generating
            // interval assume it's infinite.
            let s;
            if (!hds.has(genIntStr)) {
              s = Infinity;
            } else {
              s = hds.get(genIntStr);
            }
            if (c != 0.0) d += s * Math.abs(c);
          }
          return d;
        }),
      operators.distinctUntilChanged(),
    ).subscribe(harmNorm));

    const harmClose = rxjs.combineLatest(
      harmNorm, streams.maxHarmNorm,
    ).pipe(
      operators.map(([hn, maxhn]) => hn <= maxhn),
      operators.distinctUntilChanged(),
    );

    const inboundsHor = rxjs.combineLatest(xpos, streams.canvasViewbox).pipe(
      operators.map(([x, viewbox]) => {
        const viewboxLeft = viewbox.x;
        const viewboxRight = viewboxLeft + viewbox.width;
        return viewboxLeft < x && x < viewboxRight;
      }),
      operators.distinctUntilChanged(),
    );

    const inboundsVer = rxjs.combineLatest(ypos, streams.canvasViewbox).pipe(
      operators.map(([y, viewbox]) => {
        const viewboxTop = viewbox.y;
        const viewboxBottom = viewboxTop + viewbox.height;
        return viewboxTop < y && y < viewboxBottom;
      }),
      operators.distinctUntilChanged(),
    );

    const inbounds = new rxjs.BehaviorSubject(false);
    this.subscriptions.push(rxjs.combineLatest(
      harmClose, inboundsHor, inboundsVer,
    ).pipe(
      operators.map(([hc, inHor, inVer]) => hc && inHor && inVer),
      operators.distinctUntilChanged(),
    ).subscribe(inbounds));

    const inclosureHorizontal = rxjs.combineLatest(
      xpos,
      streams.horizontalZoom,
      streams.canvasViewbox,
      streams.generatingIntervals,
    ).pipe(
      operators.map(([
        x,
        horizontalZoom,
        viewbox,
        genInts,
      ]) => {
        const viewboxLeft = viewbox.x;
        const viewboxRight = viewboxLeft + viewbox.width;
        // TODO This line is ugly
        const maxPitchFactor = Math.max(
          ...[...genInts.values()].map(pitchFactor),
        );
        const maxXjump = horizontalZoom * Math.log2(maxPitchFactor);
        const closureLeft = viewboxLeft - maxXjump;
        const closureRight = viewboxRight + maxXjump;
        return closureLeft < x && x < closureRight;
      }),
      operators.distinctUntilChanged(),
    );

    const inclosureVertical = rxjs.combineLatest(
      ypos,
      streams.verticalZoom,
      streams.yShifts,
      streams.canvasViewbox,
    ).pipe(
      operators.map(([
        y,
        verticalZoom,
        yShifts,
        viewbox,
      ]) => {
        const viewboxTop = viewbox.y;
        const viewboxBottom = viewboxTop + viewbox.height;
        const maxYshift = Math.max(...yShifts.values());
        const maxYjump = verticalZoom * maxYshift;
        const closureTop = viewboxTop - maxYjump;
        const closureBottom = viewboxBottom + maxYjump;
        return closureTop < y && y < closureBottom;
      }),
      operators.distinctUntilChanged(),
    );

    this.inclosure = new rxjs.BehaviorSubject(false);
    this.subscriptions.push(
      rxjs.combineLatest(
        harmClose,
        inclosureHorizontal,
        inclosureVertical,
      ).pipe(
        operators.map(([hc, incHor, incVer]) => hc && incHor && incVer),
        operators.distinctUntilChanged(),
      ).subscribe(this.inclosure),
    );

    const relHarmNorm = rxjs.combineLatest(harmNorm, streams.maxHarmNorm).pipe(
      operators.map(([hn, maxhn]) => Math.max(1.0 - hn/maxhn, 0.0)),
    );

    this.subscriptions.push(rxjs.combineLatest(xpos, ypos).subscribe(
      ([x, y]) => this.svgTone.transform({translateX: x, translateY: y}),
    ));
    this.subscriptions.push(xpos.subscribe((x) => this.svgPitchline.x(x)));

    this.subscriptions.push(
      rxjs.combineLatest(relHarmNorm, inbounds).subscribe(([hn, ib]) => {
        const svgPitchline = this.svgPitchline;
        const svgTone = this.svgTone;
        if (ib && hn > 0) {
          // TODO Should we use 'visible' instead of 'inherit'? 'inherit' may
          // not be a thing for SVG.
          svgPitchline.attr('visibility', 'inherit');
          svgTone.attr('visibility', 'inherit');
        } else {
          svgPitchline.attr('visibility', 'hidden');
          svgTone.attr('visibility', 'hidden');
        }
      }),
    );

    // This one is just manually made to emit every time the tone labels have
    // been redrawn. The reason for using this, instead of making the below
    // subscribe take toneLabelTextStyle as an argument, is to ensure that the
    // text has been changed before the rescaling occurs.
    const toneLabelRedrawTrigger = new rxjs.Subject();

    // TODO This doesn't actually depend on the value of toneLabelTextStyle,
    // it just should be redone every time that changes.
    this.subscriptions.push(rxjs.combineLatest(
      streams.toneRadius,
      streams.rootToneBorderSize,
      toneLabelRedrawTrigger,
    ).subscribe(([toneRadius, borderSize, _]) => {
      const svgCircle = this.svgCircle;
      const svgLabel = this.svgLabel;
      if (isRoot) {
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
      if (isFinite(scaleFactor)) svgLabel.transform({scale: scaleFactor});
    }));

    // TODO Should split this into smaller, independent parts.
    this.subscriptions.push(rxjs.combineLatest(
      isOn,
      relHarmNorm,
      streams.toneColorActive,
      streams.toneColor,
      streams.rootToneBorderColor,
      streams.rootToneBorderSize,
      streams.minToneOpacity,
    ).subscribe(([
      isOn,
      relHn,
      toneColorActive,
      toneColorNonActive,
      rootToneBorderColor,
      rootToneBorderSize,
      minOpacity,
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
      if (isRoot) {
        const borderColor = rootToneBorderColor;
        const borderSize = rootToneBorderSize;
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
        'fill-opacity': opacityFromRelHn(relHn, minOpacity),
      });
    }));

    // TODO Should split this into subparts
    this.subscriptions.push(rxjs.combineLatest(
      isOn,
      relHarmNorm,
      streams.pitchlineColor,
      streams.pitchlineColorActive,
      streams.minToneOpacity,
    ).subscribe(([
      isOn,
      relHn,
      pitchlineColorNonActive,
      pitchlineColorActive,
      minOpacity,
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
        'stroke-opacity': opacityFromRelHn(relHn, minOpacity),
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
      } else if (
        labelStyle == 'fractions' || labelStyle == 'reducedfractions'
      ) {
        let [num, denom] = fraction;
        if (labelStyle == 'reducedfractions') {
          [num, denom] = reduceFraction(num, denom);
        }
        // These are just constant, figured out by trial and error, that seem
        // to do the job.
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
      rxjs.combineLatest, [],
    );

    // Report our birth to the global register of all tones.
    allTones.set(toneToString(this.genIntCoords), this);

    const me = this;

    const prospectiveNeighbors = new rxjs.BehaviorSubject([]);
    this.subscriptions.push(streams.generatingIntervals.subscribe(
      (genInts) => {
        const neighs = [];
        for (const giStr of genInts.keys()) {
          [-1, +1].forEach(function(increment) {
            const step = new Map([[giStr, increment]]);
            const neighCoords = sumTones(genIntCoords, step);
            const neighCoordsStr = toneToString(neighCoords);
            neighs.push([neighCoordsStr, neighCoords]);
          });
        }
        prospectiveNeighbors.next(neighs);
      },
    ));

    // Add any already existing neighbours, and report to them that they have a
    // new neighbour.
    prospectiveNeighbors.getValue().forEach(
      ([neighCoordsStr, neighCoords]) => {
        if (allTones.has(neighCoordsStr)) {
          const neighbour = allTones.get(neighCoordsStr);
          me.neighbourCreated(neighCoords, neighbour);
          neighbour.neighbourCreated(genIntCoords, me);
        }
      },
    );

    // TODO I think this one, and probably many others, could benefit from a
    // filter that only sends out new values if they are different than the
    // previous ones, to avoid recomputing stuff.
    this.subscriptions.push(
      rxjs.combineLatest(this.inclosure, prospectiveNeighbors).subscribe(
        ([inclsr, prospNeighs]) => {
          if (inclsr) {
            prospNeighs.forEach(([neighCoordsStr, neighCoords]) => {
              if (!me.neighbours.has(neighCoordsStr)) {
                new JITone(
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
        },
      ),
    );

    // The root tone should not be destroyed.
    if (!this.isRoot) {
      this.subscriptions.push(streams.generatingIntervals.subscribe(
        (genInts) => {
          for (const giStr of genIntCoords.keys()) {
            if (!genInts.has(giStr)) {
              me.destroy();
              break;
            }
          }
        },
      ));
    }

    // TODO Could just create anyNeighborInclosure directly as
    // VariableSourceSubject.
    const anyNeighborInclosure = this.neighboursInclosure.pipe(
      operators.map((arr) => {
        return arr.some((x) => x);
      }),
    );
    // TODO Should we also check for isOn, to make sure we don't leave some
    // note ringing after it's destroyed? At least test what happens if a note
    // that is playing is destroyed.
    if (!this.isRoot) {
      this.subscriptions.push(rxjs.combineLatest(
        this.inclosure,
        anyNeighborInclosure,
      ).subscribe(
        ([incls, neighIncls]) => {
          if (!incls && !neighIncls) me.destroy();
        },
      ));
    }
  }

  neighbourCreated(genIntCoords, tone) {
    const coordsStr = toneToString(genIntCoords);
    if (!this.neighbours.has(coordsStr)) {
      this.neighbours.set(coordsStr, tone);
      this.neighboursInclosure.addSource(tone.inclosure);
    }
  }

  neighbourDestroyed(genIntCoords) {
    const coordsStr = toneToString(genIntCoords);
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
      neighbour.neighbourDestroyed(this.genIntCoords);
    });
    this.allTones.delete(toneToString(this.genIntCoords));
    this.svgTone.remove();
    this.svgPitchline.remove();
  }
}
