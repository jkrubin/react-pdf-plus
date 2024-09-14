import React from 'react';
import { PDFDocumentProxy } from 'pdfjs-dist';
import './style.css';
interface PageProps {
    pdfDocument: PDFDocumentProxy;
    pageNumber: number;
    scale: number;
}
declare const Page: React.FC<PageProps>;
export default Page;
