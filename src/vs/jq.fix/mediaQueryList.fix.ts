/* eslint-disable local/code-import-patterns */
/* eslint-disable header/header */

export function _addEventListener(obj: EventTarget, type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void {
	// @ts-ignore
	if (obj.addEventListener) {
		obj.addEventListener(type, callback, options);
	}
	else {
		// @ts-ignore
		obj.addListener(callback);
	}
}

export function _removeEventListener(obj: EventTarget, type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void {
	// @ts-ignore
	if (obj.removeEventListener) {
		obj.removeEventListener(type, callback, options);
	}
	else {
		// @ts-ignore
		obj.removeListener(callback);
	}
}
