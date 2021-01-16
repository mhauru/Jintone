'use strict';
import * as rxjs from 'rxjs';
import * as operators from 'rxjs/operators';
import {VariableSourceSubject} from './variablesourcesubject.js';
import {createResizeObserverSubject} from './resizeobserversubject.js';
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
  return operators.map((x) => {
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

  const divDroneMod = document.getElementById('divDroneMod');
  const divSustainMod = document.getElementById('divSustainMod');
  const divPanMod = document.getElementById('divPanMod');

  const trueOnDroneDown = rxjs.merge(
    rxjs.fromEvent(divDroneMod, 'pointerdown').pipe(
      operators.filter((ev) => ev.buttons == 1),
      operators.map((ev) => {
      // Allow pointer event target to jump between objects when pointer is
      // moved.
        ev.target.releasePointerCapture(ev.pointerId);
        return ev;
      }),
    ),
    rxjs.fromEvent(window, 'keydown').pipe(
      operators.filter((ev) => ev.key == 'Alt'),
    ),
  ).pipe(operators.map((ev) => true));

  const falseOnDroneUp = rxjs.merge(
    rxjs.fromEvent(divDroneMod, 'pointerup'),
    rxjs.fromEvent(divDroneMod, 'pointerleave'),
    rxjs.fromEvent(window, 'keyup').pipe(
      operators.filter((ev) => ev.key == 'Alt'),
    ),
  ).pipe(operators.map((ev) => false));

  streams.droneDown = new rxjs.BehaviorSubject(false);
  rxjs.merge(trueOnDroneDown, falseOnDroneUp).subscribe(
    streams.droneDown,
  );

  const trueOnSustainDown = rxjs.merge(
    rxjs.fromEvent(divSustainMod, 'pointerdown').pipe(
      operators.filter((ev) => ev.buttons == 1),
      operators.map((ev) => {
      // Allow pointer event target to jump between objects when pointer is
      // moved.
        ev.target.releasePointerCapture(ev.pointerId);
        return ev;
      }),
    ),
    rxjs.fromEvent(window, 'keydown').pipe(
      operators.filter((ev) => ev.key == 'Shift'),
    ),
  ).pipe(operators.map((ev) => true));

  const falseOnSustainUp = rxjs.merge(
    rxjs.fromEvent(divSustainMod, 'pointerup'),
    rxjs.fromEvent(divSustainMod, 'pointerleave'),
    rxjs.fromEvent(window, 'keyup').pipe(
      operators.filter((ev) => ev.key == 'Shift'),
    ),
  ).pipe(operators.map((ev) => false));

  streams.sustainDown = new rxjs.BehaviorSubject(false);
  rxjs.merge(trueOnSustainDown, falseOnSustainUp).subscribe(
    streams.sustainDown,
  );

  const trueOnPanDown = rxjs.merge(
    rxjs.fromEvent(divPanMod, 'pointerdown').pipe(
      operators.filter((ev) => ev.buttons == 1),
      operators.map((ev) => {
      // Allow pointer event target to jump between objects when pointer is
      // moved.
        ev.target.releasePointerCapture(ev.pointerId);
        return ev;
      }),
    ),
    rxjs.fromEvent(window, 'keydown').pipe(
      operators.filter((ev) => ev.key == 'Control'),
    ),
  ).pipe(operators.map((ev) => true));

  const falseOnPanUp = rxjs.merge(
    rxjs.fromEvent(divPanMod, 'pointerup'),
    rxjs.fromEvent(divPanMod, 'pointerleave'),
    rxjs.fromEvent(window, 'keyup').pipe(
      operators.filter((ev) => ev.key == 'Control'),
    ),
  ).pipe(operators.map((ev) => false));

  streams.panDown = rxjs.merge(trueOnPanDown, falseOnPanUp).pipe(
    operators.startWith(false),
  );

  streams.droneDown.subscribe((value) => {
    if (value) {
      divDroneMod.classList.remove('divDroneModOff');
      divDroneMod.classList.add('divDroneModOn');
    } else {
      divDroneMod.classList.remove('divDroneModOn');
      divDroneMod.classList.add('divDroneModOff');
    }
  });

  streams.sustainDown.subscribe((value) => {
    if (value) {
      divSustainMod.classList.remove('divSustainModOff');
      divSustainMod.classList.add('divSustainModOn');
    } else {
      divSustainMod.classList.remove('divSustainModOn');
      divSustainMod.classList.add('divSustainModOff');
    }
  });

  streams.panDown.subscribe((value) => {
    if (value) {
      divPanMod.classList.remove('divPanModOff');
      divPanMod.classList.add('divPanModOn');
    } else {
      divPanMod.classList.remove('divPanModOn');
      divPanMod.classList.add('divPanModOff');
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
      operators.filter((ev) => ev.buttons == 1),
    ),
    rxjs.fromEvent(scaleFig.canvas.node, 'touchstart'),
    rxjs.fromEvent(scaleFig.canvas.node, 'pointerdown').pipe(
      operators.filter((ev) => ev.buttons == 1),
    ),
  ).pipe(
    operators.map(eventClientCoords),
    operators.filter(([x, y]) => !isNaN(x) && !isNaN(y)),
  );

  // Streams that return true/false when the canvas is down-clicked or released.
  const trueOnCanvasOn = streams.clientCoordsOnClick.pipe(
    operators.map((ev) => true),
  );
  const falseOnCanvasOff = rxjs.merge(
    rxjs.fromEvent(scaleFig.canvas.node, 'mouseup'),
    rxjs.fromEvent(scaleFig.canvas.node, 'mouseleave'),
    rxjs.fromEvent(scaleFig.canvas.node, 'touchend'),
    rxjs.fromEvent(scaleFig.canvas.node, 'touchcancel'),
    rxjs.fromEvent(scaleFig.canvas.node, 'pointerup'),
    rxjs.fromEvent(scaleFig.canvas.node, 'pointerleave'),
  ).pipe(operators.map((ev) => false));
  const canvasOn = rxjs.merge(falseOnCanvasOff, trueOnCanvasOn).pipe(
    operators.startWith(false),
  );

  // A stream that returns whether we are in canvas-panning mode.
  streams.panning = rxjs.combineLatest(streams.panDown, canvasOn).pipe(
    operators.map(([v1, v2]) => v1 && v2),
  );

  // Streams for the latest coordinates for the mid-point of the canvas.
  // midCoords returns this whenever it changes, midCoordOnClick returns the
  // latest value whenever the canvas is clicked. midCoords is here only
  // initialized with a starting value.
  streams.midCoords = new rxjs.BehaviorSubject();
  streams.midCoords.next(startingParams['midCoords']);
  streams.midCoordsOnClick = streams.midCoords.pipe(
    operators.sample(streams.clientCoordsOnClick),
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
    operators.map((ev) => {
      // To not duplicate events as touch/pointer/mouse.
      ev.preventDefault();
      return eventClientCoords(ev);
    }),
    operators.filter(([x, y]) => !isNaN(x) && !isNaN(y)),
  );

  // Make midCoords emit a new value every time the pointer is moved on the
  // canvas, and we are in panning mode.
  streams.clientCoordsOnMove.pipe(
    operators.withLatestFrom(
      rxjs.combineLatest(streams.panning, streams.clientCoordsOnClick,
        streams.midCoordsOnClick),
    ),
    operators.filter((arg) => arg[1][0]), // Filter out panning=false.
    operators.map((x) => {
      const ccOnMove = x[0];
      const ccOnClick= x[1][1];
      const mcOnClick = x[1][2];
      const midX = mcOnClick[0] - ccOnMove[0] + ccOnClick[0];
      const midY = mcOnClick[1] - ccOnMove[1] + ccOnClick[1];
      return [midX, midY];
    }),
  ).subscribe((x) => streams.midCoords.next(x));

  streams.canvasSize = createResizeObserverSubject(
    document.getElementById('divCanvas'),
  );
  streams.keyCanvasSize = createResizeObserverSubject(
    document.getElementById('divKeyCanvas'),
  );
  streams.settingsSize = createResizeObserverSubject(
    document.getElementById('divSettings'),
  );

  streams.canvasSize.subscribe(([w, h]) => {
    const divSettings = document.getElementById('divSettings');
    const width = Math.min(w*0.8, 500);
    divSettings.style.width = `${width}px`;
  });

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
      'eventName': 'change',
      'observableProperty': 'value',
      'parser': parseFloat,
    },
    {
      'paramName': 'toneRadius',
      'elemName': 'numToneRadius',
      'eventName': 'change',
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
      'elemName': 'numMinToneOpacity',
      'eventName': 'change',
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
      'elemName': 'numHorzZoom',
      'eventName': 'change',
      'observableProperty': 'value',
    },
    {
      'paramName': 'verticalZoom',
      'elemName': 'numVertZoom',
      'eventName': 'change',
      'observableProperty': 'value',
    },
    {
      'paramName': 'maxHarmNorm',
      'elemName': 'numMaxHarmNorm',
      'eventName': 'change',
      'observableProperty': 'value',
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
      valueStream = eventStream.pipe(operators.map(
        (x) => {
          return e.parser(x.target[e.observableProperty]);
        },
      ));
    } else {
      valueStream = eventStream.pipe(
        operators.pluck('target', e.observableProperty),
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
    operators.pluck('target', 'value'),
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
      operators.map((ms) => {
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
    if (expanded) {
      button.innerHTML = '✖';
      button.classList.remove('buttonInactive');
      button.classList.add('buttonActive');
      divSettings.style.display = 'block';
    } else {
      button.innerHTML = '⚙';
      button.classList.remove('buttonActive');
      button.classList.add('buttonInactive');
      divSettings.style.display = 'none';
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
