/* eslint-disable local/code-import-patterns */
/* eslint-disable header/header */
/* eslint-disable @typescript-eslint/no-explicit-any */


export const _performance = {
	mark: (arg1: any) => {
		// это затычка ничего не делаем
	},

	measure: (arg1: any, arg2: any, arg3: any) => {
		// это затычка ничего не делаем
	},

	getEntriesByName: (arg1: any) => {
		return [{
			duration: 0
		}];
	},

	clearMarks: (arg1: any) => {
		// это затычка ничего не делаем
	},

	clearMeasures: (arg1: any) => {
		// это затычка ничего не делаем
	}
}
