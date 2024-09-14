import React from "react";
import { PDFDocumentProxy } from "pdfjs-dist";
import "./style.css";
interface PageProps {
    pdfDocument: PDFDocumentProxy;
    pageNumber: number;
    scale: number;
    onHighlightLayerRender?: (pageNum: number) => void;
}
declare const TestPage: React.FC<PageProps>;
export default TestPage;
