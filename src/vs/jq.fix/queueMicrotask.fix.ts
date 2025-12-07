/* eslint-disable local/code-import-patterns */
/* eslint-disable header/header */

export function _queueMicrotask(arrowFunc: (value: unknown) => void) {
    return new Promise(arrowFunc);
}
