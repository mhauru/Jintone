'use strict';
import * as rxjs from 'rxjs';
export {createResizeObserverSubject};

// TODO This could be subclass of Subject.
function createResizeObserverSubject(element) {
  const subject = new rxjs.Subject();
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
      subject.next([width, height]);
    }
  }).observe(element);
  return subject;
}
