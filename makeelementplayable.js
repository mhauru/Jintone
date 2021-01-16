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
    operators.distinctUntilChanged(),
  ).subscribe(isBeingClicked));

  // state codes:
  // 0 = off
  // 1 = being clicked on
  // 2 = sustaining
  // 3 = droning
  // 4 = being click off
  const state = new rxjs.BehaviorSubject(0);
  const sustainDown = streams.sustainDown;
  const droneDown = streams.droneDown;
  subscriptions.push(isBeingClicked.pipe(
    operators.withLatestFrom(state, droneDown),
  ).subscribe(([clickedOn, s, drone]) => {
    if (clickedOn) {
      if (s == 0) {
        state.next(1);
      } else if (s == 2) {
        state.next(4);
      } else if (s == 3 && drone) {
        state.next(4);
      }
    } else {
      if (s == 1) {
        if (droneDown.getValue()) {
          state.next(3);
        } else if (sustainDown.getValue()) {
          state.next(2);
          // Setup the listener that turns the tone off when sustain is
          // released.
          rxjs.combineLatest(sustainDown, state).pipe(
            operators.takeWhile(([sus, s]) => (s == 2)),
            operators.filter(([sus, s]) => !sus),
            operators.take(1),
          ).subscribe((x) => {
            state.next(0);
          });
        } else {
          state.next(0);
        }
      } else if (s == 4) {
        state.next(0);
      }
    }
  }));

  const isOn = new rxjs.BehaviorSubject(false);
  subscriptions.push(state.pipe(
    operators.map((s) => !(s == 0)),
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
