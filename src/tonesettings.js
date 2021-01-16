'use strict';
import * as rxjs from 'rxjs';
import * as operators from 'rxjs/operators';
import {
  toneToString,
  toneToFraction,
  primeDecompose,
  linearlyIndependent,
} from './jitone.js';
export {
  addGeneratingInterval,
  removeGeneratingInterval,
  readNewGeneratingInterval,
  applyTonePreset,
  tonePresets,
};

const tonePresets = new Map();
tonePresets.set('basic5Limit', [
  [new Map([[2, 1]]), 1.2, 0.0],
  [new Map([[3, 1], [2, -1]]), 0.6, 1.6],
  [new Map([[5, 1], [2, -2]]), 2.0, 1.7],
]);
tonePresets.set('basic7Limit', [
  [new Map([[2, 1]]), 1.2, 0.0],
  [new Map([[3, 1], [2, -1]]), 0.6, 1.6],
  [new Map([[5, 1], [2, -2]]), 2.0, 1.7],
  [new Map([[7, 1], [2, -2]]), 1.75, 6.3],
]);
tonePresets.set('pythagorean', [
  [new Map([[2, 1]]), 0.0, 0.0],
  [new Map([[3, 1], [2, -1]]), 0.15, 0.7],
]);
tonePresets.set('alternative5Limit', [
  [new Map([[2, 1]]), 0.0, 0.0],
  [new Map([[3, 1], [2, -1]]), 0.1, 1.6],
  [new Map([[5, 1], [2, -2]]), 1.25, 1.7],
]);
tonePresets.set('alternative7Limit', [
  [new Map([[2, 1]]), 0.0, 0.0],
  [new Map([[3, 1], [2, -1]]), 0.1, 2.0],
  [new Map([[5, 1], [2, -2]]), 1.5, 2.2],
  [new Map([[7, 1], [2, -2]]), 0.87, 5.0],
]);

// Associate each prime to each it's streams, to make it possible to remove the
// right ones with removeSource.
const yShiftStreams = new Map();
const harmDistStepStreams = new Map();

// TODO add/remove axis access the global streams object. That's probably not
// good, but more generally, I'm not sure where these functions should be
// defined in the first place.
function addGeneratingInterval(
  genInt,
  streams,
  startingYyshift = 0.0,
  startingHarmStep = streams.maxHarmNorm.getValue(),
) {
  const [num, denom] = toneToFraction(genInt);

  if (denom == 0 || !Number.isInteger(denom) || !Number.isInteger(num)) {
    window.alert(`Invalid generating interval: ${num} / ${denom}`);
    return false;
  }

  const currentGenInts = streams.generatingIntervals.getValue();
  if (!linearlyIndependent([genInt, ...currentGenInts.values()])) {
    window.alert(
      `The proposed generating interval is not independent of the others: \
${num} / ${denom}`,
    );
    return false;
  }

  const genIntStr = toneToString(genInt);
  const inNumYshift = document.createElement('input');
  inNumYshift.id = `inNumYshift_${genIntStr}`;
  inNumYshift.type = 'number';
  inNumYshift.min = -10;
  inNumYshift.max = 10;
  inNumYshift.step = 0.01;
  inNumYshift.style.width = '80px';

  const inNumHarmdiststep = document.createElement('input');
  inNumHarmdiststep.id = `inNumHarmdiststep_${genIntStr}`;
  inNumHarmdiststep.type = 'number';
  inNumHarmdiststep.min = -20;
  inNumHarmdiststep.max = 20;
  inNumHarmdiststep.step = 0.01;
  inNumHarmdiststep.style.width = '80px';

  const parYShift = document.createElement('p');
  parYShift.innerHTML = 'y-shift: ';
  parYShift.appendChild(inNumYshift);

  const parHarmDistStep = document.createElement('p');
  parHarmDistStep.innerHTML = 'Harmonic distance: ';
  parHarmDistStep.appendChild(inNumHarmdiststep);

  const removeButt = document.createElement('button');
  removeButt.innerHTML = 'Remove';
  removeButt.classList.add('genIntButton');

  const divGenInt = document.createElement('div');
  divGenInt.id = `divGenInt${genIntStr}`;
  divGenInt.innerHTML = `Generating interval ${num}/${denom}`;
  divGenInt.appendChild(removeButt);
  divGenInt.appendChild(parYShift);
  divGenInt.appendChild(parHarmDistStep);
  divGenInt.classList.add('divGenInt');

  document.getElementById('contentAxes').appendChild(divGenInt);

  const yShiftStream = new rxjs.BehaviorSubject(
    new Map([[genIntStr, startingYyshift]]),
  );
  rxjs.fromEvent(inNumYshift, 'change').pipe(
    operators.pluck('target', 'value'),
    operators.map((value) => {
      return new Map([[genIntStr, value]]);
    }),
  ).subscribe(yShiftStream);
  yShiftStream.subscribe((m) => {
    const value = m.get(genIntStr);
    inNumYshift.value = value;
  });

  const harmStepStream = new rxjs.BehaviorSubject(
    new Map([[genIntStr, startingHarmStep]]),
  );
  rxjs.fromEvent(inNumHarmdiststep, 'change').pipe(
    operators.pluck('target', 'value'),
    operators.map((value) => {
      return new Map([[genIntStr, value]]);
    }),
  ).subscribe(harmStepStream);
  harmStepStream.subscribe((m) => {
    const value = m.get(genIntStr);
    inNumHarmdiststep.value = value;
  });

  streams.harmDistSteps.addSource(harmStepStream);
  streams.yShifts.addSource(yShiftStream);
  const genInts = streams.generatingIntervals.getValue();
  genInts.set(genIntStr, genInt);
  streams.generatingIntervals.next(genInts);
  yShiftStreams.set(genIntStr, yShiftStream);
  harmDistStepStreams.set(genIntStr, harmStepStream);

  removeButt.onclick = function remove() {
    removeGeneratingInterval(genIntStr, streams);
  };
}

function removeGeneratingInterval(genIntStr, streams) {
  const divGenInt = document.getElementById(`divGenInt${genIntStr}`);
  document.getElementById('contentAxes').removeChild(divGenInt);
  const yShiftStream = yShiftStreams.get(genIntStr);
  const harmStepStream = harmDistStepStreams.get(genIntStr);
  streams.yShifts.removeSource(yShiftStream);
  streams.harmDistSteps.removeSource(harmStepStream);
  yShiftStreams.delete(genIntStr);
  harmDistStepStreams.delete(genIntStr);
  const genInts = streams.generatingIntervals.getValue();
  genInts.delete(genIntStr);
  streams.generatingIntervals.next(genInts);
}

function readNewGeneratingInterval() {
  const inNumerator = document.getElementById('inNewGenIntNumerator');
  const inDenominator = document.getElementById('inNewGenIntDenominator');
  const num = inNumerator.valueAsNumber;
  const denom = inDenominator.valueAsNumber;
  const genInt = primeDecompose(num, denom);
  return genInt;
}

function applyTonePreset(presetName, streams) {
  const genInts = streams.generatingIntervals.getValue();
  for (const genIntStr of genInts.keys()) {
    removeGeneratingInterval(genIntStr, streams);
  }
  const preset = tonePresets.get(presetName);
  for (const genIntData of preset) {
    const [genInt, yShift, harmDistStep] = genIntData;
    addGeneratingInterval(genInt, streams, yShift, harmDistStep);
  }
}
