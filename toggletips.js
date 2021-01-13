'use strict';
import * as rxjs from 'rxjs';
import * as operators from 'rxjs/operators';
export {setupToggletips};

function setupToggletips() {
  const toggletips = document.querySelectorAll('.toggletipButton');

  // Make an Observable that emits something (doesn't matter what) everytime
  // there's either a mouse click somewhere, or a keydown of the ESC key.
  const allClicks = rxjs.fromEvent(document, 'click');
  const allEscs = rxjs.fromEvent(window, 'keydown').pipe(
    operators.filter((e) => (e.keyCode == 27)),
  );
  const clicksAndEscs = rxjs.merge(allClicks, allEscs);

  for (const toggletip of toggletips) {
    const bubble = toggletip.nextElementSibling;

    // Every time the toggleTip is clicked, make the bubble visible, and start
    // listening for any future clicks or ESCs. When that happens, make the
    // bubble invisible again.
    toggletip.addEventListener('click', (e1) => {
      // If the bubble is already visible, just return.
      if (bubble.classList.contains('toggletipBubbleVisible')) return;
      // Ohtherwise, make it visible.
      bubble.classList.add('toggletipBubbleVisible');
      toggletip.classList.add('toggletipButtonActive');
      // The next time the user clicks anything, or hits ESC, hide the bubble.
      clicksAndEscs.pipe(
        // Ignore the original event that triggered this listener.
        operators.first((e2) => e1 != e2),
      ).subscribe((e) => {
        bubble.classList.remove('toggletipBubbleVisible');
        toggletip.classList.remove('toggletipButtonActive');
      });
    });
  }
}
