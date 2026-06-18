/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useSettingsStore } from '@/store/useSettingsStore';

class BarcodeService {
  generateCode(productName?: string): string {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    if (productName && productName.trim()) {
      const initials = productName.trim().split(/\s+/).map(word => word.charAt(0).toUpperCase()).filter(char => /[A-Z]/.test(char)).join('').substring(0, 3);
      if (initials.length > 0) return `GEN-${initials}-${randomNum}`;
    }
    return `GEN-${randomNum}`;
  }

  async generateBarcodeHtml(code: string, productName?: string, price?: number): Promise<string> {
    if (!code || !code.trim()) throw new Error('Kode barcode tidak boleh kosong');
    const JsBarcode = (await import('jsbarcode')).default;
    const settings = useSettingsStore.getState();
    const renderMode = settings.printer?.barcodeRenderMode ?? 'svg';

    // ✅ UKURAN KOMPAK UNTUK THERMAL 58MM
    const CONTAINER_WIDTH = 130;
    const BAR_WIDTH = 0.8;
    const BAR_HEIGHT = 22;
    const FONT_SIZE = 8;

    const wrapperStyle = `display:flex;flex-direction:column;align-items:center;justify-content:flex-start;background:white;padding:1px;width:100%;max-width:${CONTAINER_WIDTH}px;margin:0 auto;overflow:hidden;`;
    const nameDisplay = productName ? `<div style="font-size:6px;font-weight:bold;text-align:center;margin-top:1px;padding:0 1px;word-break:break-word;max-width:${CONTAINER_WIDTH}px;line-height:1.1;">${productName.toUpperCase()}</div>` : '';
    const priceDisplay = price && price > 0 ? `<div style="font-size:7px;font-weight:900;text-align:center;margin-top:0;color:#059669;">Rp ${price.toLocaleString('id-ID')}</div>` : '';

    if (renderMode === 'png') {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas tidak didukung');
      canvas.width = CONTAINER_WIDTH;
      canvas.height = 45;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      JsBarcode(canvas, code, { format: 'CODE128', width: BAR_WIDTH, height: BAR_HEIGHT, displayValue: true, fontSize: FONT_SIZE, font: 'monospace', textMargin: 0, margin: 2, background: '#FFFFFF', lineColor: '#000000' });
      const barcodeDataUrl = canvas.toDataURL('image/png');
      return `<div style="${wrapperStyle}"><img src="${barcodeDataUrl}" alt="Barcode ${code}" style="display:block;max-width:100%;height:auto;background-color:white;" />${nameDisplay}${priceDisplay}</div>`;
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, code, { format: 'CODE128', width: BAR_WIDTH, height: BAR_HEIGHT, displayValue: true, fontSize: FONT_SIZE, font: 'monospace', textMargin: 0, margin: 2, background: '#FFFFFF', lineColor: '#000000' });
    const svgEl = svg as unknown as SVGSVGElement;
    const vb = svgEl.getAttribute('viewBox') || `0 0 ${CONTAINER_WIDTH} 40`;
    const svgMarkup = svg.outerHTML.replace(/width="[^"]*"/, '').replace(/height="[^"]*"/, '').replace('<svg', `<svg viewBox="${vb}" style="width:100%;height:auto;max-width:${CONTAINER_WIDTH}px;display:block;"`);
    return `<div style="${wrapperStyle}"><div style="width:100%;overflow:hidden;text-align:center;">${svgMarkup}</div>${nameDisplay}${priceDisplay}</div>`;
  }

  async generateBarcodePrintHtml(code: string, productName?: string, price?: number): Promise<string> {
    const barcodeHtml = await this.generateBarcodeHtml(code, productName, price);
    return `<!DOCTYPE html><html><head><title>Cetak Barcode</title><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box;}@page{margin:0;size:58mm auto;}html,body{margin:0;padding:0;width:58mm;background:white;}body{font-family:'Courier New',monospace;}svg{width:100% !important;height:auto !important;shape-rendering:crispEdges;}.label{padding:1mm 2mm;}@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}body{padding:0;}}</style></head><body><div class="label">${barcodeHtml}</div><script>(function(){function doPrint(){try{window.focus();window.print();}catch(e){}}window.onload=function(){setTimeout(doPrint,50);};var mq=window.matchMedia('print');mq.addListener(function(mql){if(!mql.matches){setTimeout(function(){window.close();},50);}});})();<\/script></body></html>`;
  }

  async generateMultiBarcodePrintHtml(items: Array<{ code: string; productName?: string; price?: number }>): Promise<string> {
    const labelsHtml = await Promise.all(items.map(async (item) => {
      const barcodeHtml = await this.generateBarcodeHtml(item.code, item.productName, item.price);
      return `<div class="label">${barcodeHtml}</div>`;
    }));
    return `<!DOCTYPE html><html><head><title>Cetak Barcode Massal</title><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box;}@page{margin:0;size:58mm auto;}html,body{margin:0;padding:0;width:58mm;background:white;}body{font-family:'Courier New',monospace;}svg{width:100% !important;height:auto !important;shape-rendering:crispEdges;}.label{padding:1mm 2mm;page-break-after:always;}.label:last-child{page-break-after:avoid;}@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}body{padding:0;}}</style></head><body>${labelsHtml.join('\n')}<script>(function(){function doPrint(){try{window.focus();window.print();}catch(e){}}window.onload=function(){setTimeout(doPrint,80);};var mq=window.matchMedia('print');mq.addListener(function(mql){if(!mql.matches){setTimeout(function(){window.close();},50);}});})();<\/script></body></html>`;
  }

  async printSingleBarcode(code: string, productName?: string, price?: number): Promise<void> {
    const htmlContent = await this.generateBarcodePrintHtml(code, productName, price);
    this._openPrintWindow(htmlContent);
  }

  async printMultipleBarcodes(items: Array<{ code: string; productName?: string; price?: number }>): Promise<void> {
    const htmlContent = await this.generateMultiBarcodePrintHtml(items);
    this._openPrintWindow(htmlContent);
  }

  private _openPrintWindow(htmlContent: string): void {
    var popup = window.open('', '_blank', 'width=380,height=500,menubar=no,toolbar=no,location=no,status=no,scrollbars=no,resizable=no');
    if (!popup) { console.warn('Popup diblokir, fallback ke iframe...'); this._printViaIframe(htmlContent); return; }
    try { popup.document.open(); popup.document.write(htmlContent); popup.document.close(); }
    catch (e) { console.warn('Gagal nulis ke popup, fallback ke iframe...', e); popup.close(); this._printViaIframe(htmlContent); }
  }

  private _printViaIframe(htmlContent: string): void {
    var iframe = document.createElement('iframe');
    iframe.style.position = 'absolute'; iframe.style.width = '58mm'; iframe.style.height = '0';
    iframe.style.border = '0'; iframe.style.left = '-9999px'; iframe.style.top = '-9999px';
    document.body.appendChild(iframe);
    var doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open(); doc.write(htmlContent); doc.close();
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 45000);
  }

  async previewBarcode(code: string, productName?: string, price?: number): Promise<string> {
    return this.generateBarcodeHtml(code, productName, price);
  }
}

export const barcodeService = new BarcodeService();