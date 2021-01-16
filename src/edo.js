'use strict';
export {EDOTones, edofactorlog};

const edofactorlog = 1/12;
const edofactor = Math.pow(2, edofactorlog);

const EDOTones = [];
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
