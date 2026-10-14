/**
 * Monotonic time source.
 *
 * The engine must never mix wall-clock time with elapsed time: a user changing
 * the system clock, or NTP stepping the clock, would otherwise teleport the
 * lyrics. Everything inside the engine is driven by this interface, which the
 * tests replace with a manually advanced clock so timing is deterministic.
 */
export interface Clock {
  /** Monotonic milliseconds. Only differences between two readings are meaningful. */
  now(): number;
}

export const systemClock: Clock = {
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
};

/** Test clock: time only moves when a test moves it. */
export class ManualClock implements Clock {
  #current: number;

  constructor(start = 0) {
    this.#current = start;
  }

  now(): number {
    return this.#current;
  }

  advance(ms: number): this {
    this.#current += ms;
    return this;
  }

  set(ms: number): this {
    this.#current = ms;
    return this;
  }
}
