import React, { PropsWithChildren } from "react";
import { Box } from "./types";
type HighlightToolTipProps = {
    isVisible: boolean;
    highlightBox: Box;
    pageNum?: number;
    toolTipClass?: string;
    activeModalRef?: React.MutableRefObject<Element>;
};
export declare const HighlightTooltip: React.FC<PropsWithChildren & HighlightToolTipProps>;
export {};
