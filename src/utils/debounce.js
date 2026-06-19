/**
 * Debounce, throttle, and idle-callback utilities for CarbonLens.
 * Provides performance-critical timing functions to limit the rate
 * of expensive operations like DOM updates and storage writes.
 *
 * @module debounce
 */

/**
 * Creates a debounced version of a function that delays invocation
 * until after `delay` milliseconds have elapsed since the last call.
 * The debounced function includes a `cancel` method to abort pending calls
 * and a `flush` method to immediately invoke the pending call.
 *
 * @param {Function} fn - The function to debounce.
 * @param {number} [delay=300] - Delay in milliseconds.
 * @returns {Function & { cancel: Function, flush: Function }} The debounced function.
 * @throws {TypeError} If fn is not a function.
 *
 * @example
 * const saveDebounced = debounce(saveToStorage, 500);
 * input.addEventListener('input', saveDebounced);
 *
 * // Cancel pending execution
 * saveDebounced.cancel();
 *
 * // Immediately execute pending call
 * saveDebounced.flush();
 */
export function debounce(fn, delay = 300) {
  if (typeof fn !== 'function') {
    throw new TypeError('[debounce] First argument must be a function');
  }

  const ms = typeof delay === 'number' && Number.isFinite(delay) && delay >= 0
    ? delay
    : 300;

  /** @type {ReturnType<typeof setTimeout>|null} */
  let timeoutId = null;

  /** @type {Array|null} */
  let pendingArgs = null;

  /** @type {*} */
  let pendingThis = null;

  /**
   * The debounced wrapper function.
   * @param {...*} args - Arguments to forward to the original function.
   */
  function debounced(...args) {
    pendingArgs = args;
    // eslint-disable-next-line no-invalid-this
    pendingThis = this;

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn.apply(pendingThis, pendingArgs);
      pendingArgs = null;
      pendingThis = null;
    }, ms);
  }

  /**
   * Cancels any pending debounced invocation.
   */
  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    pendingArgs = null;
    pendingThis = null;
  };

  /**
   * Immediately invokes the pending debounced call, if any.
   */
  debounced.flush = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
      fn.apply(pendingThis, pendingArgs);
      pendingArgs = null;
      pendingThis = null;
    }
  };

  return debounced;
}

/**
 * Creates a throttled version of a function that invokes at most
 * once per `limit` milliseconds. Uses the trailing-edge pattern:
 * the function runs immediately on the first call, then at most
 * once per interval afterward.
 *
 * @param {Function} fn - The function to throttle.
 * @param {number} [limit=300] - Minimum interval in milliseconds between invocations.
 * @returns {Function} The throttled function.
 * @throws {TypeError} If fn is not a function.
 *
 * @example
 * const throttledScroll = throttle(handleScroll, 100);
 * window.addEventListener('scroll', throttledScroll);
 */
export function throttle(fn, limit = 300) {
  if (typeof fn !== 'function') {
    throw new TypeError('[throttle] First argument must be a function');
  }

  const ms = typeof limit === 'number' && Number.isFinite(limit) && limit >= 0
    ? limit
    : 300;

  /** @type {boolean} */
  let waiting = false;

  /** @type {Array|null} */
  let lastArgs = null;

  /** @type {*} */
  let lastThis = null;

  /**
   * The throttled wrapper function.
   * @param {...*} args - Arguments to forward to the original function.
   */
  function throttled(...args) {
    if (waiting) {
      lastArgs = args;
      // eslint-disable-next-line no-invalid-this
      lastThis = this;
      return;
    }

    // eslint-disable-next-line no-invalid-this
    fn.apply(this, args);
    waiting = true;

    setTimeout(() => {
      waiting = false;
      if (lastArgs !== null) {
        fn.apply(lastThis, lastArgs);
        lastArgs = null;
        lastThis = null;
      }
    }, ms);
  }

  return throttled;
}

/**
 * Polyfilled requestIdleCallback.
 * Uses the native API when available, falling back to setTimeout
 * with a simulated IdleDeadline object.
 *
 * @param {function(IdleDeadline): void} fn - Callback to run during idle time.
 * @returns {number} An ID that can be used to cancel the callback.
 * @throws {TypeError} If fn is not a function.
 *
 * @example
 * const id = requestIdleCallback((deadline) => {
 *   while (deadline.timeRemaining() > 0) {
 *     processNextItem();
 *   }
 * });
 *
 * // Cancel if needed
 * cancelIdleCallback(id);
 */
export function requestIdleCallbackPolyfill(fn) {
  if (typeof fn !== 'function') {
    throw new TypeError('[requestIdleCallback] Argument must be a function');
  }

  // Use native if available
  if (typeof globalThis.requestIdleCallback === 'function') {
    return globalThis.requestIdleCallback(fn);
  }

  // Polyfill using setTimeout
  const start = Date.now();
  return /** @type {number} */ (setTimeout(() => {
    fn({
      didTimeout: false,
      timeRemaining() {
        // Simulate 50ms frame budget
        return Math.max(0, 50 - (Date.now() - start));
      },
    });
  }, 1));
}

export { requestIdleCallbackPolyfill as requestIdleCallback };
