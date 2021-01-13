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
const veloAt20 = 1.0;
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

class EqualLoudnessSynth {
  constructor() {
    this.synth = new PolySynth(16, Synth, {
      oscillator: {
        type: 'sine',
        // Relative amplitudes of overtones.
        partials: [1, 0.3, 0.2],
      },
    }).toMaster();
  }

  startTone(freq) {
    this.synth.triggerAttack(freq, undefined, velocity(freq));
  }

  stopTone(freq) {
    this.synth.triggerRelease(freq);
  }
}


