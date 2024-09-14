import { MutableRefObject, RefObject } from "react";
import { Box, HighlightBox, HighlightEnd } from "./types";
export declare const SAME_LINE_HEIGHT_ALLOWANCE: number;
export declare const isHighlightable: (element: Element) => boolean;
type CharOffset = {
    offsetNum: number;
    offsetPxStartLetter: number;
    offsetPxEndLetter: number;
};
export declare const getPxOffsetOfIndex: (span: HTMLElement, index: number) => CharOffset;
export declare const getCharIndexUnderMouse: (span: HTMLElement, event: MouseEvent) => CharOffset;
export declare const isCurrentBeforeAnchor: (anchor: HighlightEnd, current: HighlightEnd) => boolean;
export declare const printHighlights: (startHighlight: HighlightEnd | null, endHighlight: HighlightEnd | null) => void;
export declare const highlightStr: (highlight: HighlightEnd) => string;
export declare const applyOffsetToHighlight: (box: HighlightBox, startOffset: number, endOffset: number | false) => HighlightBox;
export declare const spanSorter: (a: Element, b: Element) => number;
export declare const sortSpansByHeight: (spans: HTMLSpanElement[]) => HTMLSpanElement[];
export declare const getSpansSortedByheight: (pageRef: HTMLDivElement) => {
    element: HTMLSpanElement;
    rect: DOMRect;
}[];
export declare const useMutationObserver: (refs: MutableRefObject<RefObject<HTMLDivElement>[]>, callback: MutationCallback, options: MutationObserverInit) => void;
export declare const createMaxBox: (highlightedElements: Map<number, HighlightBox[]>) => [number, Box];
export declare const getStartEndIndeciesOfRegex: (searchText: string, concatenatedText: string) => [number, number];
export {};
