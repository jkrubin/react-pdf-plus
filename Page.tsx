import React, { useEffect, useMemo, useRef } from 'react';
import { PDFDocumentProxy, PDFPageProxy, TextLayer } from 'pdfjs-dist';
import './style.css';

interface PageProps {
  pdfDocument: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
}

const Page: React.FC<PageProps> = ({ pdfDocument, pageNumber, scale }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<any | null>(null); // To track the ongoing render task

  useEffect(() => {
    const renderPage = async () => {
      const page: PDFPageProxy = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      // Render the page to the canvas
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (canvas && context) {
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport,
        };

        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }
        try{
          renderTaskRef.current = page.render(renderContext);
          await renderTaskRef.current.promise; // Await the completion of the render task
        }catch(err){
          //The task was cancelled by a rerender
          //do nothing
        }
      }

      // Render the text layer
      const textLayerDiv = textLayerRef.current;
      if (textLayerDiv) {
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;
        textLayerDiv.style.setProperty('--scale-factor', scale.toString());

        const textContent = await page.getTextContent();
        const textLayer = new TextLayer({
          container: textLayerDiv,
          textContentSource: textContent,
          viewport,
        });

        await textLayer.render();
      }
    };

    renderPage();

    // Cleanup function to cancel the render task if the component unmounts
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDocument, pageNumber, scale]);

  return (
    <div style={{ position: 'relative',}}>
      <canvas ref={canvasRef} />
      <div ref={textLayerRef} className="textLayer" />
    </div>
  );
};

export default Page;
