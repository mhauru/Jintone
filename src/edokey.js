'use strict';
import * as rxjs from 'rxjs';
import * as operators from 'rxjs/operators';
import {edofactorlog} from './edo.js';
import {makeElementPlayable} from './makeelementplayable.js';
export {EDOKey};

class EDOKey {
  constructor(frequency, type, container, streams, synth) {
    const ef = edofactorlog;
    const ht = ef/2;
    const bh = 2/3;
    let str;
    if (type == 'C') {
      const prot = 2/3;
      str = `${-ht},0, ${ht},0\
             ${ht},${bh} ${ht+ef*prot},${bh}\
             ${ht+ef*prot},1 ${-ht},1`;
    } else if (type == 'D') {
      const protl = 1/3;
      const protr = 1/3;
      str = `${-ht},0, ${ht},0\
             ${ht},${bh} ${ht+ef*protr},${bh}\
             ${ht+ef*protr},1 ${-ht-ef*protl},1\
             ${-ht-ef*protl},${bh} ${-ht},${bh}`;
    } else if (type == 'E') {
      const prot = 2/3;
      str = `${-ht},0, ${ht},0\
             ${ht},1 ${-ht-ef*prot},1\
             ${-ht-ef*prot},${bh} ${-ht},${bh}`;
    } else if (type == 'F') {
      const prot = 2/3;
      str = `${-ht},0, ${ht},0\
             ${ht},${bh} ${ht+ef*prot},${bh}\
             ${ht+ef*prot},1 ${-ht},1`;
    } else if (type == 'G') {
      const protl = 1/3;
      const protr = 1/2;
      str = `${-ht},0, ${ht},0\
             ${ht},${bh} ${ht+ef*protr},${bh}\
             ${ht+ef*protr},1 ${-ht-ef*protl},1\
             ${-ht-ef*protl},${bh} ${-ht},${bh}`;
    } else if (type == 'A') {
      const protl = 1/2;
      const protr = 1/3;
      str = `${-ht},0, ${ht},0\
             ${ht},${bh} ${ht+ef*protr},${bh}\
             ${ht+ef*protr},1 ${-ht-ef*protl},1\
             ${-ht-ef*protl},${bh} ${-ht},${bh}`;
    } else if (type == 'B') {
      const prot = 2/3;
      str = `${-ht},0, ${ht},0\
             ${ht},1 ${-ht-ef*prot},1\
             ${-ht-ef*prot},${bh} ${-ht},${bh}`;
    } else if (type == 'black') {
      str = `${-ht},0, ${ht},0\
             ${ht},${bh} ${-ht},${bh}`;
    }
    const svg = container.group();
    const svgKey = svg.polygon(str);
    const mx = ef*0.01;
    const my = 0.1;
    const markerStr = `${-mx},0 ${mx},0 ${mx},${my} ${-mx},${my}`;
    const svgMarker = svg.polygon(markerStr);

    const keyColor = (type == 'black') ? '#000000' : '#FFFFFF';
    svgKey.attr({
      'fill': keyColor,
      'stroke': '#000000',
      'stroke-width': '0.001',
    });

    const markerColor = '#888888';
    svgMarker.attr({
      'fill': markerColor,
    });

    const frequencyObservable = new rxjs.BehaviorSubject(frequency);
    const mepRetval = makeElementPlayable(
      svg.node, frequencyObservable, streams, synth,
    );
    const isOn = mepRetval[0];

    rxjs.combineLatest(isOn, streams.toneColorActive).subscribe(
      ([val, color]) => {
        if (val) {
          svgKey.attr('fill', color);
        } else {
          const keyColor = (type == 'black') ? '#000000' : '#FFFFFF';
          svgKey.attr('fill', keyColor);
        }
      });

    const frequencyRatio = streams.originFreq.pipe(
      operators.map((of) => frequency/of),
    );
    const pos = rxjs.combineLatest(
      frequencyRatio,
      streams.horizontalZoom,
    ).pipe(operators.map(([fr, hz]) => hz * Math.log2(fr)));
    streams.horizontalZoom.subscribe((hz) => {
      const old = svg.transform();
      svg.transform(
        {a: hz, b: 0, c: 0, d: 1, e: old.e, f: old.f},
      );
    });
    pos.subscribe((p) => {
      if (isFinite(p)) {
        const old = svg.transform();
        svg.transform(
          {a: old.a, b: old.b, c: old.c, d: old.d, e: p, f: 0},
        );
      }
    });
  }
}
