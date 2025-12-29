/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { onUnexpectedExternalError } from '../../../../base/common/errors.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { ITextModel } from '../../../common/model.js';
import { FoldingContext, FoldingRange, FoldingRangeProvider } from '../../../common/languages.js';
import { FoldingLimitReporter, RangeProvider } from './folding.js';
import { FoldingRegions, MAX_COLUMN_NUMBER, MAX_LINE_NUMBER } from './foldingRanges.js';

export interface IFoldingRangeData extends FoldingRange {
	rank: number;
}

const foldingContext: FoldingContext = {
};

const ID_SYNTAX_PROVIDER = 'syntax';

export class SyntaxRangeProvider implements RangeProvider {

	readonly id = ID_SYNTAX_PROVIDER;

	readonly disposables: DisposableStore;

	constructor(
		private readonly editorModel: ITextModel,
		private readonly providers: FoldingRangeProvider[],
		readonly handleFoldingRangesChange: () => void,
		private readonly foldingRangesLimit: FoldingLimitReporter,
		private readonly fallbackRangeProvider: RangeProvider | undefined // used when all providers return null
	) {
		this.disposables = new DisposableStore();
		if (fallbackRangeProvider) {
			this.disposables.add(fallbackRangeProvider);
		}

		for (const provider of providers) {
			if (typeof provider.onDidChange === 'function') {
				this.disposables.add(provider.onDidChange(handleFoldingRangesChange));
			}
		}
	}

	compute(cancellationToken: CancellationToken): Promise<FoldingRegions | null> {
		return collectSyntaxRanges(this.providers, this.editorModel, cancellationToken).then(ranges => {
			if (this.editorModel.isDisposed()) {
				return null;
			}
			if (ranges) {
				const res = sanitizeRanges(ranges, this.foldingRangesLimit);
				return res;
			}
			return this.fallbackRangeProvider?.compute(cancellationToken) ?? null;
		});
	}

	dispose() {
		this.disposables.dispose();
	}
}

function collectSyntaxRanges(providers: FoldingRangeProvider[], model: ITextModel, cancellationToken: CancellationToken): Promise<IFoldingRangeData[] | null> {
	let rangeData: IFoldingRangeData[] | null = null;
	const promises = providers.map((provider, i) => {
		return Promise.resolve(provider.provideFoldingRanges(model, foldingContext, cancellationToken)).then(ranges => {
			if (cancellationToken.isCancellationRequested) {
				return;
			}
			if (Array.isArray(ranges)) {
				if (!Array.isArray(rangeData)) {
					rangeData = [];
				}
				const nLines = model.getLineCount();
				for (const r of ranges) {
					if (r.start > 0 && r.end > r.start && r.end <= nLines) {
						rangeData.push({ start: r.start, end: r.end, startColumn: r.startColumn, rank: i, kind: r.kind, collapsedText: r.collapsedText });
					}
				}
			}
		}, onUnexpectedExternalError);
	});
	return Promise.all(promises).then(_ => {
		return rangeData;
	});
}

class RangesCollector {
	private readonly _startLineIndexes: number[];
	private readonly _endLineIndexes: number[];
	private readonly _startColumnIndexes: Array<number | undefined>;
	private readonly _nestingLevels: number[];
	private readonly _nestingLevelCounts: number[];
	private readonly _types: Array<string | undefined>;
	private readonly _collapsedTexts: Array<string | undefined>;
	private _length: number;
	private readonly _foldingRangesLimit: FoldingLimitReporter;

	constructor(foldingRangesLimit: FoldingLimitReporter) {
		this._startLineIndexes = [];
		this._endLineIndexes = [];
		this._startColumnIndexes = [];
		this._nestingLevels = [];
		this._nestingLevelCounts = [];
		this._types = [];
		this._collapsedTexts = [];
		this._length = 0;
		this._foldingRangesLimit = foldingRangesLimit;
	}

	public add(startLineNumber: number, endLineNumber: number, startColumn: number | undefined, type: string | undefined, collapsedText: string | undefined, nestingLevel: number) {
		if (startLineNumber > MAX_LINE_NUMBER || endLineNumber > MAX_LINE_NUMBER) {
			return;
		}
		const index = this._length;
		this._startLineIndexes[index] = startLineNumber;
		this._endLineIndexes[index] = endLineNumber;
		this._startColumnIndexes[index] = startColumn;
		this._nestingLevels[index] = nestingLevel;
		this._types[index] = type;
		this._collapsedTexts[index] = collapsedText;
		this._length++;
		if (nestingLevel < 30) {
			this._nestingLevelCounts[nestingLevel] = (this._nestingLevelCounts[nestingLevel] || 0) + 1;
		}
	}

	public toIndentRanges() {
		const limit = this._foldingRangesLimit.limit;
		if (this._length <= limit) {
			this._foldingRangesLimit.update(this._length, false);

			const startLineIndexes = new Uint32Array(this._length);
			const endLineIndexes = new Uint32Array(this._length);
			const startColumnIndexes: Array<number | undefined> = [];
			for (let i = 0; i < this._length; i++) {
				startLineIndexes[i] = this._startLineIndexes[i];
				endLineIndexes[i] = this._endLineIndexes[i];
				startColumnIndexes[i] = this._startColumnIndexes[i];
			}
			return new FoldingRegions(startLineIndexes, endLineIndexes, startColumnIndexes, this._types, this._collapsedTexts);
		} else {
			this._foldingRangesLimit.update(this._length, limit);

			let entries = 0;
			let maxLevel = this._nestingLevelCounts.length;
			for (let i = 0; i < this._nestingLevelCounts.length; i++) {
				const n = this._nestingLevelCounts[i];
				if (n) {
					if (n + entries > limit) {
						maxLevel = i;
						break;
					}
					entries += n;
				}
			}

			const startLineIndexes = new Uint32Array(limit);
			const endLineIndexes = new Uint32Array(limit);
			const startColumnIndexes: Array<number | undefined> = [];
			const types: Array<string | undefined> = [];
			const collapsedTexts: Array<string | undefined> = [];
			for (let i = 0, k = 0; i < this._length; i++) {
				const level = this._nestingLevels[i];
				if (level < maxLevel || (level === maxLevel && entries++ < limit)) {
					startLineIndexes[k] = this._startLineIndexes[i];
					endLineIndexes[k] = this._endLineIndexes[i];
					startColumnIndexes[k] = this._startColumnIndexes[i];
					types[k] = this._types[i];
					collapsedTexts[k] = this._collapsedTexts[i];
					k++;
				}
			}
			return new FoldingRegions(startLineIndexes, endLineIndexes, startColumnIndexes, types, collapsedTexts);
		}

	}

}

export function sanitizeRanges(rangeData: IFoldingRangeData[], foldingRangesLimit: FoldingLimitReporter): FoldingRegions {
	const sorted = rangeData.sort((d1, d2) => {
		const lineDiff = d1.start - d2.start;
		if (d1.start !== d2.start) {
			return lineDiff;
		}
		const columnDiff = (d1.startColumn ?? MAX_COLUMN_NUMBER) - (d2.startColumn ?? MAX_COLUMN_NUMBER);
		if (columnDiff !== 0) {
			return columnDiff;
		}
		return d1.rank - d2.rank;
	});
	const collector = new RangesCollector(foldingRangesLimit);

	let top: IFoldingRangeData | undefined = undefined;
	const previous: IFoldingRangeData[] = [];
	for (const entry of sorted) {
		if (!top) {
			top = entry;
			collector.add(entry.start, entry.end, entry.startColumn, entry.kind && entry.kind.value, entry.collapsedText, previous.length);
		} else {
			if (entry.start > top.start) {
				if (entry.end <= top.end) {
					previous.push(top);
					top = entry;
					collector.add(entry.start, entry.end, entry.startColumn, entry.kind && entry.kind.value, entry.collapsedText, previous.length);
				} else {
					if (entry.start > top.end) {
						do {
							top = previous.pop();
						} while (top && entry.start > top.end);
						if (top) {
							previous.push(top);
						}
						top = entry;
					}
					collector.add(entry.start, entry.end, entry.startColumn, entry.kind && entry.kind.value, entry.collapsedText, previous.length);
				}
			}
		}
	}
	return collector.toIndentRanges();
}
