import React, { ReactNode } from "react";
export type PdfHighlighterContextType = {
    onHighlightLayerRender: (page: number) => void;
    onTextLayerRender: (page: number) => void;
};
interface PdfHighlighterProps {
    children: React.ReactNode;
    tooltipContent?: ReactNode;
    tooltipClassName?: string;
}
export declare const PdfHighlighterProvider: React.FC<PdfHighlighterProps>;
export declare const usePdfHighlighter: () => PdfHighlighterContextType;
export {};
