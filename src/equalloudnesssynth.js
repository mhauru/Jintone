'use strict';
import {PolySynth, Synth} from 'tone';
export {EqualLoudnessSynth};

// My very own equal loudness function: Given a frequency, return the velocity
// that it should be played at, to achieve a standard level of loudness.
// The formula is loosely inspired by
// https://www.cs.cmu.edu/~rbd/papers/velocity-icmc2006.pdf
// and
// https://www.wikiaudio.org/wp-content/uploads/2020/05/is-01e.pdf
// but not rigorously based on anything.
const minfreq = 3500;
const veloAtMin = 0.2;
const veloAt20 = 0.8;
const logMinfreqRatio = Math.log10(20/minfreq);
const d = (veloAt20 - veloAtMin)/(logMinfreqRatio * logMinfreqRatio);

function velocity(freq) {
  const logratio = Math.log10(freq/minfreq);
  const v = d * logratio * logratio + veloAtMin;
  // The ifs should not get triggered except for extreme frequencies.
  if (v > 1) return 1;
  if (v < 0) return 0;
  return v;
}

// Relative amplitudes of overtones. These define the timbre. The choice here
// is only slightly different from sine.
const defaultTimbrePartials = [];
for (let i = 1; i < 6; i++) {
  defaultTimbrePartials.push(Math.exp(2*(-i+1)));
}

class EqualLoudnessSynth {
  constructor() {
    this.synth = new PolySynth(Synth, {}).toDestination();
    this.setTimbre('default');
  }

  startTone(freq) {
    this.synth.triggerAttack(freq, undefined, velocity(freq));
  }

  stopTone(freq) {
    this.synth.triggerRelease(freq);
  }

  setTimbre(timbre) {
    if (this.timbre != undefined && this.timbre == timbre) {
      // Nothing to do, we are already using this timbre.
      return;
    }

    let oscillator;
    if (['sawtooth', 'sine', 'square', 'triangle'].includes(timbre)) {
      oscillator = {'type': timbre};
    } else {
      // The custom default timbre.
      oscillator = {
        'type': 'custom',
        'partials': defaultTimbrePartials,
      };
    }

    this.synth.set({
      oscillator: oscillator,
    });
    this.timbre = timbre;
  }
}


