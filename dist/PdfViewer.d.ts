import React, { ReactNode } from "react";
import "./style.css";
interface PdfViewerProps {
    url: string;
    fileOptions?: any;
    tooltipContent?: ReactNode;
    tooltipClassName?: string;
}
declare const PdfViewer: React.FC<PdfViewerProps>;
export default PdfViewer;
