/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { ICodeEditor } from '../../../browser/editorBrowser.js';
import { IModelDecorationOptions, IModelDecorationsChangeAccessor, InjectedTextCursorStops, MinimapPosition, InjectedTextOptions, TrackedRangeStickiness } from '../../../common/model.js';
import { ModelDecorationOptions } from '../../../common/model/textModel.js';
import { IDecorationProvider } from './foldingModel.js';
import { localize } from '../../../../nls.js';
import { editorSelectionBackground, iconForeground, registerColor, transparent } from '../../../../platform/theme/common/colorRegistry.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { themeColorFromId } from '../../../../platform/theme/common/themeService.js';
import { ThemeIcon } from '../../../../base/common/themables.js';

const foldBackground = registerColor('editor.foldBackground', { light: transparent(editorSelectionBackground, 0.3), dark: transparent(editorSelectionBackground, 0.3), hcDark: null, hcLight: null }, localize('foldBackgroundBackground', "Background color behind folded ranges. The color must not be opaque so as not to hide underlying decorations."), true);
registerColor('editor.foldPlaceholderForeground', { light: '#808080', dark: '#808080', hcDark: null, hcLight: null }, localize('collapsedTextColor', "Color of the collapsed text after the first line of a folded range."));
registerColor('editorGutter.foldingControlForeground', iconForeground, localize('editorGutter.foldingControlForeground', 'Color of the folding control in the editor gutter.'));

export const foldingExpandedIcon = registerIcon('folding-expanded', Codicon.chevronDown, localize('foldingExpandedIcon', 'Icon for expanded ranges in the editor glyph margin.'));
export const foldingCollapsedIcon = registerIcon('folding-collapsed', Codicon.chevronRight, localize('foldingCollapsedIcon', 'Icon for collapsed ranges in the editor glyph margin.'));
export const foldingManualCollapsedIcon = registerIcon('folding-manual-collapsed', foldingCollapsedIcon, localize('foldingManualCollapedIcon', 'Icon for manually collapsed ranges in the editor glyph margin.'));
export const foldingManualExpandedIcon = registerIcon('folding-manual-expanded', foldingExpandedIcon, localize('foldingManualExpandedIcon', 'Icon for manually expanded ranges in the editor glyph margin.'));

const foldedBackgroundMinimap = { color: themeColorFromId(foldBackground), position: MinimapPosition.Inline };

const collapsed = localize('linesCollapsed', "Click to expand the range.");
const expanded = localize('linesExpanded', "Click to collapse the range.");

export class FoldingDecorationProvider implements IDecorationProvider {

	private static readonly DEFAULT_COLLAPSED_TEXT = '\u22EF'; /* ellipses unicode character */

	//To always keep decoration in injectedTextTree between toggles, otherwise would crash
	private static EMPTY_INJECTED_TEXT: InjectedTextOptions = { content: '' };

	private static readonly COLLAPSED_VISUAL_DECORATION: IModelDecorationOptions = {
		description: 'folding-collapsed-visual-decoration',
		stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
		isWholeLine: true,
		linesDecorationsTooltip: collapsed,
		firstLineDecorationClassName: ThemeIcon.asClassName(foldingCollapsedIcon),
		hideContent: true
	};

	private static readonly COLLAPSED_HIGHLIGHTED_VISUAL_DECORATION: IModelDecorationOptions = {
		description: 'folding-collapsed-highlighted-visual-decoration',
		stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
		className: 'folded-background',
		minimap: foldedBackgroundMinimap,
		isWholeLine: true,
		linesDecorationsTooltip: collapsed,
		firstLineDecorationClassName: ThemeIcon.asClassName(foldingCollapsedIcon),
		hideContent: true
	};

	private static readonly MANUALLY_COLLAPSED_VISUAL_DECORATION: IModelDecorationOptions = {
		description: 'folding-manually-collapsed-visual-decoration',
		stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
		isWholeLine: true,
		linesDecorationsTooltip: collapsed,
		firstLineDecorationClassName: ThemeIcon.asClassName(foldingManualCollapsedIcon),
		hideContent: true
	};

	private static readonly MANUALLY_COLLAPSED_HIGHLIGHTED_VISUAL_DECORATION: IModelDecorationOptions = {
		description: 'folding-manually-collapsed-highlighted-visual-decoration',
		stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
		className: 'folded-background',
		minimap: foldedBackgroundMinimap,
		isWholeLine: true,
		linesDecorationsTooltip: collapsed,
		firstLineDecorationClassName: ThemeIcon.asClassName(foldingManualCollapsedIcon),
		hideContent: true
	};

	private static readonly NO_CONTROLS_COLLAPSED_RANGE_DECORATION: IModelDecorationOptions = {
		description: 'folding-no-controls-range-decoration',
		stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
		isWholeLine: true,
		linesDecorationsTooltip: collapsed,
		hideContent: true
	};

	private static readonly NO_CONTROLS_COLLAPSED_HIGHLIGHTED_RANGE_DECORATION: IModelDecorationOptions = {
		description: 'folding-no-controls-range-decoration',
		stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
		className: 'folded-background',
		minimap: foldedBackgroundMinimap,
		isWholeLine: true,
		linesDecorationsTooltip: collapsed,
		hideContent: true
	};

	private static readonly EXPANDED_VISUAL_DECORATION = ModelDecorationOptions.register({
		description: 'folding-expanded-visual-decoration',
		stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
		isWholeLine: true,
		firstLineDecorationClassName: 'alwaysShowFoldIcons ' + ThemeIcon.asClassName(foldingExpandedIcon),
		before: FoldingDecorationProvider.EMPTY_INJECTED_TEXT
	});

	private static readonly EXPANDED_AUTO_HIDE_VISUAL_DECORATION = ModelDecorationOptions.register({
		description: 'folding-expanded-auto-hide-visual-decoration',
		stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
		isWholeLine: true,
		firstLineDecorationClassName: ThemeIcon.asClassName(foldingExpandedIcon),
		linesDecorationsTooltip: expanded,
		before: FoldingDecorationProvider.EMPTY_INJECTED_TEXT
	});

	private static readonly MANUALLY_EXPANDED_VISUAL_DECORATION = ModelDecorationOptions.register({
		description: 'folding-manually-expanded-visual-decoration',
		stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
		isWholeLine: true,
		firstLineDecorationClassName: 'alwaysShowFoldIcons ' + ThemeIcon.asClassName(foldingManualExpandedIcon),
		linesDecorationsTooltip: expanded,
		before: FoldingDecorationProvider.EMPTY_INJECTED_TEXT
	});

	private static readonly MANUALLY_EXPANDED_AUTO_HIDE_VISUAL_DECORATION = ModelDecorationOptions.register({
		description: 'folding-manually-expanded-auto-hide-visual-decoration',
		stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
		isWholeLine: true,
		firstLineDecorationClassName: ThemeIcon.asClassName(foldingManualExpandedIcon),
		linesDecorationsTooltip: expanded,
		before: FoldingDecorationProvider.EMPTY_INJECTED_TEXT
	});

	private static readonly NO_CONTROLS_EXPANDED_RANGE_DECORATION = ModelDecorationOptions.register({
		description: 'folding-no-controls-range-decoration',
		stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
		isWholeLine: true,
		before: FoldingDecorationProvider.EMPTY_INJECTED_TEXT
	});

	private static readonly HIDDEN_RANGE_DECORATION = ModelDecorationOptions.register({
		description: 'folding-hidden-range-decoration',
		stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
		before: FoldingDecorationProvider.EMPTY_INJECTED_TEXT
	});

	public showFoldingControls: 'always' | 'never' | 'mouseover' = 'mouseover';

	public showFoldingHighlights: boolean = true;

	constructor(private readonly editor: ICodeEditor) {
	}

	getDecorationOption(isCollapsed: boolean, isHidden: boolean, isManual: boolean, collapsedText = FoldingDecorationProvider.DEFAULT_COLLAPSED_TEXT): IModelDecorationOptions {
		if (isHidden) { // is inside another collapsed region
			return FoldingDecorationProvider.HIDDEN_RANGE_DECORATION;
		}
		if (this.showFoldingControls === 'never') {
			if (isCollapsed) {
				return this.addCollapsedText(
					collapsedText,
					this.showFoldingHighlights ? FoldingDecorationProvider.NO_CONTROLS_COLLAPSED_HIGHLIGHTED_RANGE_DECORATION : FoldingDecorationProvider.NO_CONTROLS_COLLAPSED_RANGE_DECORATION
				);
			}
			return FoldingDecorationProvider.NO_CONTROLS_EXPANDED_RANGE_DECORATION;
		}
		if (isCollapsed) {
			return this.addCollapsedText(collapsedText, isManual ?
				(this.showFoldingHighlights ? FoldingDecorationProvider.MANUALLY_COLLAPSED_HIGHLIGHTED_VISUAL_DECORATION : FoldingDecorationProvider.MANUALLY_COLLAPSED_VISUAL_DECORATION)
				: (this.showFoldingHighlights ? FoldingDecorationProvider.COLLAPSED_HIGHLIGHTED_VISUAL_DECORATION : FoldingDecorationProvider.COLLAPSED_VISUAL_DECORATION));
		} else if (this.showFoldingControls === 'mouseover') {
			return isManual ? FoldingDecorationProvider.MANUALLY_EXPANDED_AUTO_HIDE_VISUAL_DECORATION : FoldingDecorationProvider.EXPANDED_AUTO_HIDE_VISUAL_DECORATION;
		} else {
			return isManual ? FoldingDecorationProvider.MANUALLY_EXPANDED_VISUAL_DECORATION : FoldingDecorationProvider.EXPANDED_VISUAL_DECORATION;
		}
	}

	private addCollapsedText(collapsedText: string, decorationOption: IModelDecorationOptions): IModelDecorationOptions {
		const before: InjectedTextOptions = {
			content: this.fixSpace(collapsedText),
			inlineClassName: 'collapsed-text',
			inlineClassNameAffectsLetterSpacing: true,
			cursorStops: InjectedTextCursorStops.None
		};
		return ModelDecorationOptions.register({ ...decorationOption, before });
	}

	// Prevents the view from potentially visible whitespace
	private fixSpace(str: string): string {
		const noBreakWhitespace = '\xa0';
		return str.replace(/[ \t]/g, noBreakWhitespace);
	}

	changeDecorations<T>(callback: (changeAccessor: IModelDecorationsChangeAccessor) => T): T | null {
		return this.editor.changeDecorations(callback);
	}

	removeDecorations(decorationIds: string[]): void {
		this.editor.removeDecorations(decorationIds);
	}
}
