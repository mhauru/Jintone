'use strict';
import * as rxjs from 'rxjs';
import * as operators from 'rxjs/operators';
export {makeElementPlayable};

function makeElementPlayable(element, frequency, streams, synth) {
  const subscriptions = [];
  const trueOnClickDown = rxjs.merge(
    rxjs.fromEvent(element, 'pointerenter').pipe(
      operators.filter((ev) => ev.pressure > 0.0),
      operators.map((ev) => {
        // Allow pointer event target to jump between objects when pointer is
        // moved.
        ev.target.releasePointerCapture(ev.pointerId);
        return ev;
      })),
    rxjs.fromEvent(element, 'pointerdown').pipe(
      operators.filter((ev) => ev.buttons == 1),
      operators.map((ev) => {
        // Allow pointer event target to jump between objects when pointer is
        // moved.
        ev.target.releasePointerCapture(ev.pointerId);
        return ev;
      })),
  ).pipe(
    operators.map((ev) => {
      // TODO Why does on-click require this, but off-click doesn't?
      ev.preventDefault();
      return true;
    }),
  );

  const falseOnClickUp = rxjs.merge(
    rxjs.fromEvent(element, 'pointerup').pipe(
      operators.map((ev) => {
        // TODO Does this really do something when releasing?
        // Allow pointer event target to jump between objects when pointer is
        // moved.
        ev.target.releasePointerCapture(ev.pointerId);
        return ev;
      })),
    rxjs.fromEvent(element, 'pointerleave'),
  ).pipe(
    operators.map((ev) => false),
  );

  const isBeingClicked = new rxjs.BehaviorSubject(false);
  subscriptions.push(rxjs.merge(trueOnClickDown, falseOnClickUp).pipe(
    operators.startWith(false),
    operators.distinctUntilChanged(),
  ).subscribe((x) => isBeingClicked.next(x)));

  // Whenever this key is pressed, the tone is turned on, if it wasn't
  // already. Whenver either this key is released or sustain is released, and
  // the latest action on both this key and sustain is a release, then this
  // tone should be set to false, if it wasn't already.
  // TODO Note that, done this way, an emission happens for all keys every
  // time the sustain is released. Think about mitigating this performance
  // waste by either filtering out repeated isOn emissions before they reach
  // the observer, or by having isBeingClicked determine whether we listend
  // to sustainDown at all.
  const isOn = new rxjs.BehaviorSubject(false);
  subscriptions.push(rxjs.merge(
    trueOnClickDown,
    rxjs.combineLatest(isBeingClicked, streams.sustainDown).pipe(
      operators.filter(([click, sustain]) => {
        // Check that both the latest click and the latest sustain were
        // false.
        return !click && !sustain;
      }),
      operators.map((click, sustain) => {
        return false;
      }),
    ),
  ).pipe(
    operators.distinctUntilChanged(),
  ).subscribe(isOn));

  subscriptions.push(isOn.subscribe((val) => {
    if (val) {
      synth.startTone(frequency.getValue());
    } else {
      synth.stopTone(frequency.getValue());
    }
  }));
  return [isOn, isBeingClicked, subscriptions];
}
