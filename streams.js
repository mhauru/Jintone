'use strict';
import {VariableSourceSubject} from './variablesourcesubject.js';
export {readURL, setupStreams};

function JSONReplacer(key, value) {
  const originalObject = this[key];
  if (originalObject instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(originalObject.entries()),
    };
  } else {
    return value;
  }
}

function JSONReviver(key, value) {
  if (typeof value === 'object' && value !== null) {
    if (value.dataType === 'Map') {
      return new Map(value.value);
    }
  }
  return value;
}

function readURL(defaults) {
  const startingParams = {};
  const params = new URLSearchParams(decodeURIComponent(location.search));
  for (let [key, value] of defaults) {
    if (params.has(key) && params.get(key) != 'undefined') {
      value = JSON.parse(params.get(key), JSONReviver);
    }
    startingParams[key] = value;
  }
  return startingParams;
}

function setURL(strs) {
  let queryStr = '?' + encodeURIComponent(strs.join(''));
  if (queryStr == '?') queryStr = '';
  const newURL = window.location.pathname + queryStr;
  window.history.replaceState(null, '', newURL);
}

function urlStringOperator(paramName, DEFAULT_URLPARAMS_STRS) {
  return rxjs.operators.map((x) => {
    const xstr = JSON.stringify(x, JSONReplacer);
    // If the string representation of x matches the default values string
    // representation we don't need to store this parameter in the URL.
    if (xstr == DEFAULT_URLPARAMS_STRS.get(paramName)) {
      return '';
    } else {
      return `${paramName}=${xstr}&`;
    }
  });
}

function setupStreams(startingParams, DEFAULT_URLPARAMS, scaleFig) {
  const streams = {};
  const urlStreams = [];

  const DEFAULT_URLPARAMS_STRS = new Map();
  for (const [key, value] of DEFAULT_URLPARAMS) {
    DEFAULT_URLPARAMS_STRS.set(key, JSON.stringify(value, JSONReplacer));
  }

  const divPanMod = document.getElementById('divPanMod');
  const divSustainMod = document.getElementById('divSustainMod');

  const trueOnPanDown = rxjs.merge(
    rxjs.fromEvent(divPanMod, 'mousedown'),
    rxjs.fromEvent(divPanMod, 'touchstart'),
    rxjs.fromEvent(divPanMod, 'pointerdown').pipe(rxjs.operators.map((ev) => {
      // Allow pointer event target to jump between objects when pointer is
      // moved.
      ev.target.releasePointerCapture(ev.pointerId);
      return ev;
    })),
    rxjs.fromEvent(window, 'keydown').pipe(
      // TODO Define the keyCodes somewhere else.
      rxjs.operators.filter((ev) => ev.keyCode == 17),
    ),
  ).pipe(rxjs.operators.map((ev) => true));

  const falseOnPanUp = rxjs.merge(
    rxjs.fromEvent(divPanMod, 'mouseup'),
    rxjs.fromEvent(divPanMod, 'mouseleave'),
    rxjs.fromEvent(divPanMod, 'touchend'),
    rxjs.fromEvent(divPanMod, 'touchcancel'),
    rxjs.fromEvent(divPanMod, 'pointerup'),
    rxjs.fromEvent(divPanMod, 'pointerleave'),
    rxjs.fromEvent(window, 'keyup').pipe(
      // TODO Define the keyCodes somewhere else.
      rxjs.operators.filter((ev) => ev.keyCode == 17),
    ),
  ).pipe(rxjs.operators.map((ev) => false));

  streams.panDown = rxjs.merge(trueOnPanDown, falseOnPanUp).pipe(
    rxjs.operators.startWith(false),
  );

  const trueOnSustainDown = rxjs.merge(
    rxjs.fromEvent(divSustainMod, 'mousedown'),
    rxjs.fromEvent(divSustainMod, 'touchstart'),
    rxjs.fromEvent(divSustainMod, 'pointerdown').pipe(rxjs.operators.map(
      // Allow pointer event target to jump between objects when pointer is
      // moved.
      (ev) => {
        ev.target.releasePointerCapture(ev.pointerId);
        return ev;
      },
    )),
    rxjs.fromEvent(window, 'keydown').pipe(
      // TODO Define the keyCodes somewhere else.
      rxjs.operators.filter((ev) => ev.keyCode == 16),
    ),
  ).pipe(rxjs.operators.map((ev) => true));

  const falseOnSustainUp = rxjs.merge(
    rxjs.fromEvent(divSustainMod, 'mouseup'),
    rxjs.fromEvent(divSustainMod, 'mouseleave'),
    rxjs.fromEvent(divSustainMod, 'touchend'),
    rxjs.fromEvent(divSustainMod, 'touchcancel'),
    rxjs.fromEvent(divSustainMod, 'pointerup'),
    rxjs.fromEvent(divSustainMod, 'pointerleave'),
    // TODO Define the keyCodes somewhere else.
    rxjs.fromEvent(window, 'keyup').pipe(
      rxjs.operators.filter((ev) => ev.keyCode == 16),
    ),
  ).pipe(rxjs.operators.map((ev) => false));

  streams.sustainDown = new rxjs.BehaviorSubject(false);
  rxjs.merge(trueOnSustainDown, falseOnSustainUp).subscribe(
    streams.sustainDown,
  );

  // TODO Hard-coded color constants should be moved elsewhere. Maybe make it a
  // CSS class whether they are up or down?
  streams.panDown.subscribe((value) => {
    if (value) {
      divPanMod.style.background = '#FF3900';
    } else {
      divPanMod.style.background = '#FF9273';
    }
  });

  streams.sustainDown.subscribe((value) => {
    if (value) {
      divSustainMod.style.background = '#FFAA00';
    } else {
      divSustainMod.style.background = '#FFD073';
    }
  });

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // Create event streams for panning the canvas.

  // Check whether a given event has clientX and clientY coordinates.
  function eventHasCoords(ev) {
    return ('clientX' in ev && 'clientY' in ev &&
      !isNaN(ev.clientX) && !isNaN(ev.clientY));
  }

  // Get clientX and clientY from an event, if it has them, if not, return
  // [NaN, NaN]. The same function should work for mouse, touch and pointer
  // events, and in at least Firefox and Chrome.
  function eventClientCoords(ev) {
    if (eventHasCoords(ev)) {
      return [ev.clientX, ev.clientY];
    } else if ('touches' in ev) {
      // TODO This length-1 thing makes it pick the coordinates of the last
      // touch point. What we should really do is take the first touch point
      // that is not the one holding the pan modifier div down. This would be
      // either [0] or [1] depending on whether we are using touch or keyboard
      // to toggle panning.
      const touch = ev.touches[ev.touches.length-1];
      if (eventHasCoords(touch)) {
        return [touch.clientX, touch.clientY];
      }
    }
    return [NaN, NaN];
  }

  // A stream that returns a pair of x, y coordinates for a click of the canvas,
  // presuming that these coordinates exist for the type of click executed.
  // Events that don't have client coordinates well defined are filtered out.
  streams.clientCoordsOnClick = rxjs.merge(
    rxjs.fromEvent(scaleFig.canvas.node, 'mousedown').pipe(
      rxjs.operators.filter((ev) => ev.buttons == 1),
    ),
    rxjs.fromEvent(scaleFig.canvas.node, 'touchstart'),
    rxjs.fromEvent(scaleFig.canvas.node, 'pointerdown').pipe(
      rxjs.operators.filter((ev) => ev.buttons == 1),
    ),
  ).pipe(
    rxjs.operators.map(eventClientCoords),
    rxjs.operators.filter(([x, y]) => !isNaN(x) && !isNaN(y)),
  );

  // Streams that return true/false when the canvas is down-clicked or released.
  const trueOnCanvasOn = streams.clientCoordsOnClick.pipe(
    rxjs.operators.map((ev) => true),
  );
  const falseOnCanvasOff = rxjs.merge(
    rxjs.fromEvent(scaleFig.canvas.node, 'mouseup'),
    rxjs.fromEvent(scaleFig.canvas.node, 'mouseleave'),
    rxjs.fromEvent(scaleFig.canvas.node, 'touchend'),
    rxjs.fromEvent(scaleFig.canvas.node, 'touchcancel'),
    rxjs.fromEvent(scaleFig.canvas.node, 'pointerup'),
    rxjs.fromEvent(scaleFig.canvas.node, 'pointerleave'),
  ).pipe(rxjs.operators.map((ev) => false));
  const canvasOn = rxjs.merge(falseOnCanvasOff, trueOnCanvasOn).pipe(
    rxjs.operators.startWith(false),
  );

  // A stream that returns whether we are in canvas-panning mode.
  streams.panning = rxjs.combineLatest(streams.panDown, canvasOn).pipe(
    rxjs.operators.map(([v1, v2]) => v1 && v2),
  );

  // Streams for the latest coordinates for the mid-point of the canvas.
  // midCoords returns this whenever it changes, midCoordOnClick returns the
  // latest value whenever the canvas is clicked. midCoords is here only
  // initialized with a starting value.
  streams.midCoords = new rxjs.BehaviorSubject();
  streams.midCoords.next(startingParams['midCoords']);
  streams.midCoordsOnClick = streams.midCoords.pipe(
    rxjs.operators.sample(streams.clientCoordsOnClick),
  );
  urlStreams.push(streams.midCoords.pipe(
    urlStringOperator('midCoords', DEFAULT_URLPARAMS_STRS),
  ));

  // Return the client-coordinates of the pointer on the canvas every time the
  // pointer is moved.
  // TODO Instead of having this get called on every move, we could just create
  // the listener for this whenever panning is set to true, and remove it when
  // its set to false. Could be faster?
  streams.clientCoordsOnMove = rxjs.merge(
    rxjs.fromEvent(scaleFig.canvas.node, 'mousemove'),
    rxjs.fromEvent(scaleFig.canvas.node, 'touchmove'),
    rxjs.fromEvent(scaleFig.canvas.node, 'pointermove'),
  ).pipe(
    rxjs.operators.map((ev) => {
      // To not duplicate events as touch/pointer/mouse.
      ev.preventDefault();
      return eventClientCoords(ev);
    }),
    rxjs.operators.filter(([x, y]) => !isNaN(x) && !isNaN(y)),
  );

  // Make midCoords emit a new value every time the pointer is moved on the
  // canvas, and we are in panning mode.
  streams.clientCoordsOnMove.pipe(
    rxjs.operators.withLatestFrom(
      rxjs.combineLatest(streams.panning, streams.clientCoordsOnClick,
        streams.midCoordsOnClick),
    ),
    rxjs.operators.filter((arg) => arg[1][0]), // Filter out panning=false.
    rxjs.operators.map((x) => {
      const ccOnMove = x[0];
      const ccOnClick= x[1][1];
      const mcOnClick = x[1][2];
      const midX = mcOnClick[0] - ccOnMove[0] + ccOnClick[0];
      const midY = mcOnClick[1] - ccOnMove[1] + ccOnClick[1];
      return [midX, midY];
    }),
  ).subscribe((x) => streams.midCoords.next(x));

  // Use ResizeObserver to make Observables out of the sizes of elements.
  // TODO Turn this into a new subclass of Subject?
  streams.canvasSize = new rxjs.Subject();
  new ResizeObserver((entries, observer) => {
    for (const entry of entries) {
      // Different browsers return different objects, e.g. Chrome always
      // returns an array from entry.contentBoxSize. Accommodate those
      // differences.
      let width;
      let height;
      if (entry.contentBoxSize) {
        if (entry.contentBoxSize[0]) {
          const cbs = entry.contentBoxSize[0];
          width = cbs.inlineSize;
          height = cbs.blockSize;
        } else {
          const cbs = entry.contentBoxSize;
          width = cbs.inlineSize;
          height = cbs.blockSize;
        }
      } else {
        width = entry.contentRect.width;
        height = entry.contentRect.height;
      }
      streams.canvasSize.next([width, height]);
    }
  }).observe(document.getElementById('divCanvas'));

  streams.keyCanvasSize = new rxjs.Subject();
  new ResizeObserver((entries, observer) => {
    for (const entry of entries) {
      // Different browsers return different objects, e.g. Chrome always
      // returns an array from entry.contentBoxSize. Accommodate those
      // differences.
      let width;
      let height;
      if (entry.contentBoxSize) {
        if (entry.contentBoxSize[0]) {
          const cbs = entry.contentBoxSize[0];
          width = cbs.inlineSize;
          height = cbs.blockSize;
        } else {
          const cbs = entry.contentBoxSize;
          width = cbs.inlineSize;
          height = cbs.blockSize;
        }
      } else {
        width = entry.contentRect.width;
        height = entry.contentRect.height;
      }
      streams.keyCanvasSize.next([width, height]);
    }
  }).observe(document.getElementById('divKeyCanvas'));

  streams.settingsSize = new rxjs.Subject();
  new ResizeObserver((entries, observer) => {
    for (const entry of entries) {
      const cbs = entry.contentBoxSize;
      const width = cbs.inlineSize;
      const height = cbs.blockSize;
      streams.settingsSize.next([width, height]);
    }
  }).observe(document.getElementById('divSettings'));

  streams.canvasViewbox = new rxjs.BehaviorSubject(scaleFig.canvas.viewbox());
  // Adjust the canvas viewbox every time the canvas is resized or we pan to
  // change the mid-point.
  rxjs.combineLatest(streams.canvasSize, streams.midCoords).subscribe(
    ([boxSize, coords]) => {
      const canvas = scaleFig.canvas;
      const [w, h] = boxSize;
      const [x, y] = coords;
      canvas.viewbox(-w/2+x, -h/2+y, w, h);
      streams.canvasViewbox.next(canvas.viewbox());
    },
  );

  // Adjust the canvas viewbox for the EDO keyboard every time the key canvas is
  // resized or we pan to change the mid-point.
  rxjs.combineLatest(streams.keyCanvasSize, streams.midCoords).subscribe(
    ([boxSize, coords]) => {
      const w = boxSize[0];
      const x = coords[0];
      const keyCanvas = scaleFig.keyCanvas;
      keyCanvas.viewbox(-w/2+x, 0, w, 1);
    },
  );

  // Adjust divSettingsInner height every time the size of divSettings changes.
  streams.settingsSize.subscribe(
    (boxSize) => {
      // TODO This is a little ugly, since we listen to a stream of
      // contentBoxSize, but don't actually use those values for anything, but
      // get the offsetHeights in this function.
      const div = document.getElementById('divSettings');
      const header = document.getElementById('settingsHeader');
      const divInner = document.getElementById('divSettingsInner');
      const innerHeight = div.offsetHeight - header.offsetHeight;
      divInner.style.height = `${innerHeight}px`;
    },
  );

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // Create event streams for various variables and settings.

  // Each element of this array describes one UI element and a corresponding
  // parameter name, event, and proprety. Each UI element will then be turned
  // into an event stream of the given name, made to emit observablePropertyy of
  // the elements, and initialized with the appropriate value.
  const streamElements = [
    {
      'paramName': 'originFreq',
      'elemName': 'numOriginFreq',
      'eventName': 'input',
      'observableProperty': 'value',
      'parser': parseFloat,
    },
    {
      'paramName': 'toneRadius',
      'elemName': 'numToneRadius',
      'eventName': 'input',
      'observableProperty': 'value',
      'parser': parseFloat,
    },
    {
      'paramName': 'toneColor',
      'elemName': 'toneColor',
      'eventName': 'input',
      'observableProperty': 'value',
    },
    {
      'paramName': 'toneColorActive',
      'elemName': 'toneColorActive',
      'eventName': 'input',
      'observableProperty': 'value',
    },
    {
      'paramName': 'rootToneBorderColor',
      'elemName': 'rootToneBorderColor',
      'eventName': 'input',
      'observableProperty': 'value',
    },
    {
      'paramName': 'rootToneBorderSize',
      'elemName': 'numRootToneBorderSize',
      'eventName': 'input',
      'observableProperty': 'value',
      'parser': parseFloat,
    },
    {
      'paramName': 'minToneOpacity',
      'elemName': 'rangeMinToneOpacity',
      'eventName': 'input',
      'observableProperty': 'value',
      'parser': parseFloat,
    },
    {
      'paramName': 'showPitchlines',
      'elemName': 'cboxPitchlines',
      'eventName': 'click',
      'observableProperty': 'checked',
    },
    {
      'paramName': 'showKeys',
      'elemName': 'cboxKeys',
      'eventName': 'click',
      'observableProperty': 'checked',
    },
    {
      'paramName': 'pitchlineColor',
      'elemName': 'colorPitchlines',
      'eventName': 'input',
      'observableProperty': 'value',
    },
    {
      'paramName': 'pitchlineColorActive',
      'elemName': 'colorPitchlinesActive',
      'eventName': 'input',
      'observableProperty': 'value',
    },
    {
      'paramName': 'horizontalZoom',
      'elemName': 'rangeHorzZoom',
      'eventName': 'input',
      'observableProperty': 'value',
      'parser': parseFloat,
    },
    {
      'paramName': 'verticalZoom',
      'elemName': 'rangeVertZoom',
      'eventName': 'input',
      'observableProperty': 'value',
      'parser': parseFloat,
    },
    {
      'paramName': 'maxHarmNorm',
      'elemName': 'numMaxHarmNorm',
      'eventName': 'input',
      'observableProperty': 'value',
      'parser': parseFloat,
    },
  ];

  streamElements.forEach((e) => {
    const elem = document.getElementById(e.elemName);
    streams[e.paramName] = new rxjs.BehaviorSubject(
      startingParams[e.paramName],
    );
    const eventStream = rxjs.fromEvent(elem, e.eventName);
    let valueStream;
    if (e.hasOwnProperty('parser')) {
      valueStream = eventStream.pipe(rxjs.operators.map(
        (x) => {
          return e.parser(x.target[e.observableProperty]);
        },
      ));
    } else {
      valueStream = eventStream.pipe(
        rxjs.operators.pluck('target', e.observableProperty),
      );
    }
    valueStream.subscribe((x) => streams[e.paramName].next(x));
    streams[e.paramName].subscribe((value) => {
      // TODO Check that this works for checkboxes on Chrome (seems at the
      // moment it doesn't.)
      elem[e.observableProperty] = value;
    });
    urlStreams.push(streams[e.paramName].pipe(
      urlStringOperator(e.paramName, DEFAULT_URLPARAMS_STRS),
    ));
  });

  // We do the toneLabel one manually, since it requires merging three streams.
  streams.toneLabelTextStyle = new rxjs.BehaviorSubject(
    startingParams['toneLabelTextStyle'],
  );
  const radioToneLabelNone = document.getElementById('radioToneLabelNone');
  const radioToneLabelEDO = document.getElementById('radioToneLabelEDO');
  const radioToneLabelFrac = document.getElementById('radioToneLabelFrac');
  const radioToneLabelRedFrac =
    document.getElementById('radioToneLabelRedFrac');
  rxjs.merge(
    rxjs.fromEvent(radioToneLabelNone, 'click'),
    rxjs.fromEvent(radioToneLabelEDO, 'click'),
    rxjs.fromEvent(radioToneLabelFrac, 'click'),
    rxjs.fromEvent(radioToneLabelRedFrac, 'click'),
  ).pipe(
    rxjs.operators.pluck('target', 'value'),
  ).subscribe(streams.toneLabelTextStyle);
  streams.toneLabelTextStyle.subscribe((value) => {
    if (value == 'EDO') {
      radioToneLabelEDO.checked = true;
    } else if (value == 'none') {
      radioToneLabelNone.checked = true;
    } else if (value == 'fractions') {
      radioToneLabelFrac.checked = true;
    } else if (value == 'reducedfractions') {
      radioToneLabelRedFrac.checked = true;
    }
  });
  urlStreams.push(streams.toneLabelTextStyle.pipe(
    urlStringOperator('toneLabelTextStyle', DEFAULT_URLPARAMS_STRS),
  ));

  // Set up some extra subscriptions for a few parameters that have a global
  // impact.

  streams.showKeys.subscribe((value) => {
    const divCanvas = document.getElementById('divCanvas');
    const divKeyCanvas = document.getElementById('divKeyCanvas');
    // Note that these trigger further resizing events through ResizeObservers
    // defined earlier.
    if (value) {
      divCanvas.style.height = '80%';
      divKeyCanvas.style.height = '20%';
    } else {
      divCanvas.style.height = '100%';
      divKeyCanvas.style.height = '0%';
    }
  });

  streams.showPitchlines.subscribe((value) => {
    if (value) {
      scaleFig.svgGroups.pitchlines.attr('visibility', 'inherit');
    } else {
      scaleFig.svgGroups.pitchlines.attr('visibility', 'hidden');
    }
  });

  // Take Observables, each of which returns Maps, combineLatest on it merge the
  // Maps.
  function combineAndMerge(...x) {
    const combined = rxjs.combineLatest(...x).pipe(
      rxjs.operators.map((ms) => {
        // ms is an array of Maps, that we merge into a single map.
        const arrs = [];
        ms.forEach((m) => arrs.push(...m));
        return new Map(arrs);
      }));
    return combined;
  }

  streams.generatingIntervals = new rxjs.BehaviorSubject(new Map());
  streams.harmDistSteps = new VariableSourceSubject(combineAndMerge, new Map());
  streams.yShifts = new VariableSourceSubject(combineAndMerge, new Map());
  urlStreams.push(streams.generatingIntervals.pipe(
    urlStringOperator('generatingIntervals', DEFAULT_URLPARAMS_STRS),
  ));
  urlStreams.push(streams.harmDistSteps.pipe(
    urlStringOperator('harmDistSteps', DEFAULT_URLPARAMS_STRS),
  ));
  urlStreams.push(streams.yShifts.pipe(
    urlStringOperator('yShifts', DEFAULT_URLPARAMS_STRS),
  ));

  const buttToggleSettings = document.getElementById('buttToggleSettings');
  streams.settingsExpanded = new rxjs.BehaviorSubject(
    startingParams['settingsExpanded'],
  );
  rxjs.fromEvent(buttToggleSettings, 'click').subscribe((ev) => {
    const expanded = streams.settingsExpanded.getValue();
    streams.settingsExpanded.next(!expanded);
  });
  streams.settingsExpanded.subscribe((expanded) => {
    const divSettings = document.getElementById('divSettings');
    const button = document.getElementById('buttToggleSettings');
    const icon = document.getElementById('iconSettings');
    // TODO The widths, given in percentages, don't take into account the width
    // of divMods (sustain and pan), which is a constant 60px. Because of this
    // the canvas actually extends 60px too far to the right. Doesn't really
    // affect much, but not nice.
    if (expanded) {
      icon.style.transform = '';
      button.classList.remove('buttonInactive');
      button.classList.add('buttonActive');
      button.style.right = '20%';
      divSettings.style.right = '0';
    } else {
      icon.style.transform = 'rotate(180deg)';
      button.classList.remove('buttonActive');
      button.classList.add('buttonInactive');
      button.style.right = 0;
      divSettings.style.right = '-20%';
    }
  });
  urlStreams.push(streams.settingsExpanded.pipe(
    urlStringOperator('settingsExpanded', DEFAULT_URLPARAMS_STRS),
  ));

  const buttToggleHelp = document.getElementById('buttToggleHelp');
  streams.helpExpanded = new rxjs.BehaviorSubject(
    startingParams['helpExpanded'],
  );
  rxjs.fromEvent(buttToggleHelp, 'click').subscribe((ev) => {
    const expanded = streams.helpExpanded.getValue();
    streams.helpExpanded.next(!expanded);
  });
  streams.helpExpanded.subscribe((expanded) => {
    const buttToggleHelp = document.getElementById('buttToggleHelp');
    const divHelpOverlay = document.getElementById('divHelpOverlay');
    if (expanded) {
      buttToggleHelp.innerHTML = '✖';
      buttToggleHelp.classList.remove('buttonInactive');
      buttToggleHelp.classList.add('buttonActive');
      divHelpOverlay.style.display = 'block';
    } else {
      buttToggleHelp.innerHTML = '?';
      buttToggleHelp.classList.remove('buttonActive');
      buttToggleHelp.classList.add('buttonInactive');
      divHelpOverlay.style.display = 'none';
    }
  });
  urlStreams.push(streams.helpExpanded.pipe(
    urlStringOperator('helpExpanded', DEFAULT_URLPARAMS_STRS),
  ));

  // Update the URL everytime a parameter changes.
  rxjs.combineLatest(...urlStreams).subscribe(setURL);
  return streams;
}
