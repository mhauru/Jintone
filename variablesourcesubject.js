'use strict';
export {VariableSourceSubject};

class VariableSourceSubject extends rxjs.BehaviorSubject {
  constructor(joinFunction, defaultValue) {
    super(defaultValue); // TODO Should this be null instead?
    this.defaultValue = defaultValue;
    this.joinFunction = joinFunction;
    this.sources = new Set();
    this.renewInnerSubscription();
  }

  addSource(source) {
    this.sources.add(source);
    this.renewInnerSubscription();
  }

  removeSource(source) {
    this.sources.delete(source);
    this.renewInnerSubscription();
  }

  hasSource(source) {
    return this.sources.has(source);
  }

  renewInnerSubscription() {
    if (this.innerSubscription) {
      this.innerSubscription.unsubscribe();
    }
    if (this.sources && this.sources.size > 0) {
      const innerObservable = this.joinFunction(...this.sources);
      this.innerSubscription = innerObservable.subscribe(this);
    } else {
      this.next(this.defaultValue);
    }
  }
}
