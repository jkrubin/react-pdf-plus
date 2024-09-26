export type HighlightEnd = {
  element: Element | null;
  page: number;
  offset: number;
  offsetPxStartLetter: number;
  offsetPxEndLetter: number;
};

export type HighlightBox = {
  top: number;
  left: number;
  width: number;
  height: number;
  startOffset?: number;
  endOffset?: number;
};

export type Box = {
  top: number;
  left: number;
  right: number;
  bottom: number;
};
