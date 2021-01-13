'use strict';
import {edofactorlog} from './edo.js';
export {EDOKey};

class EDOKey {
  constructor(frequency, type, container, streams, synth) {
    this.frequency = frequency;
    this.type = type;

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
    const svg = container.group();
    const svgKey = svg.polygon(str);
    const mx = ef*0.01;
    const my = 0.1;
    const markerStr = `${-mx},0 ${mx},0 ${mx},${my} ${-mx},${my}`;
    const svgMarker = svg.polygon(markerStr);

    const keyColor = (this.type == 'black') ? '#000000' : '#FFFFFF';
    svgKey.attr({
      'fill': keyColor,
      'stroke-width': '0.001',
    });

    const markerColor = '#888888';
    svgMarker.attr({
      'fill': markerColor,
    });

    // TODO We fire a lot of events, mouse, touch and pointer ones. Depending
    // on the browser, the same click or touch may fire several, e.g. both
    // touch and mouse or both pointer and mouse. This ensures maximum
    // compatibility with different browsers, but probably costs something in
    // performance, and wonder if it might make a mess in some other way, e.g.
    // causing a tone to play twice. Come back to this later and check whether
    // we could switch for instance using only PointerEvents, once they have
    // widespread support. See https://caniuse.com/#feat=pointer
    const trueOnClickDown = rxjs.merge(
      //rxjs.fromEvent(svg, 'mousedown').pipe(
      //  rxjs.operators.filter((ev) => ev.buttons == 1),
      //),
      //rxjs.fromEvent(svg, 'touchstart'),
      rxjs.fromEvent(svg, 'pointerenter').pipe(
        rxjs.operators.filter((ev) => ev.pressure > 0.0),
        rxjs.operators.map((ev) => {
          // Allow pointer event target to jump between objects when pointer is
          // moved.
          ev.target.releasePointerCapture(ev.pointerId);
          return ev;
        })),
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
      //rxjs.fromEvent(svg, 'mouseup'),
      //rxjs.fromEvent(svg, 'mouseleave'),
      //rxjs.fromEvent(svg, 'touchend'),
      //rxjs.fromEvent(svg, 'touchcancel'),
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
        synth.startTone(this.frequency);
      } else {
        synth.stopTone(this.frequency);
      }
    });

    // TODO This could probably be somehow filtered better, to avoid
    // unnecessary observations.
    rxjs.combineLatest(this.isOn, streams.toneColorActive).subscribe(
      ([val, color]) => {
        if (val) {
          svgKey.attr('fill', color);
        } else {
          const keyColor = (this.type == 'black') ? '#000000' : '#FFFFFF';
          svgKey.attr('fill', keyColor);
        }
      });

    const frequencyRatio = streams.originFreq.pipe(
      rxjs.operators.map((of) => this.frequency/of),
    );
    const pos = rxjs.combineLatest(
      frequencyRatio,
      streams.horizontalZoom
    ).pipe(rxjs.operators.map(([fr, hz]) => hz * Math.log2(fr)));
    streams.horizontalZoom.subscribe((hz) => svg.scale(hz, 1));
    pos.subscribe((p) => {
      if (isFinite(p)) svg.translate(p, 0);
    });
  }
}
