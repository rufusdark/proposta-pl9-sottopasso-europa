const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DOCS_DIR = '/home/rufusdark/Documenti/Martina Franca/10_Proposta_Cittadino';

async function getWsEndpoint() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9223/json/version', res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          resolve(info.webSocketDebuggerUrl);
        } catch(e) { reject(e); }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function generatePdf(htmlFile, outputPdf) {
  const fileUrl = `file://${htmlFile}`;
  const wsEndpoint = await getWsEndpoint();
  
  console.log(`  Connecting to: ${wsEndpoint.substring(0, 50)}...`);
  
  const browser = await puppeteer.connect({
    browserWSEndpoint: wsEndpoint,
    defaultViewport: null
  });
  
  const pages = await browser.pages();
  const page = pages[0]; // Use the first page
  
  console.log(`  Loading: ${path.basename(htmlFile)}`);
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000)); // Wait for rendering
  
  console.log('  Generating PDF...');
  await page.pdf({
    path: outputPdf,
    format: 'A4',
    printBackground: true,
    margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    preferCSSPageSize: true,
  });
  
  const stats = fs.statSync(outputPdf);
  console.log(`  ✓ ${path.basename(outputPdf)} (${(stats.size/1024).toFixed(0)}KB)`);
  
  await browser.disconnect();
}

async function main() {
  const files = [
    { html: '00_Lettera_accompagnamento.html', pdf: '00_Lettera_accompagnamento.pdf' },
    { html: '01_Relazione_Tecnica.html', pdf: '01_Relazione_Tecnica.pdf' },
    { html: '02_Quadro_Economico.html', pdf: '02_Quadro_Economico.pdf' },
  ];
  
  for (const f of files) {
    const htmlPath = path.join(DOCS_DIR, f.html);
    const pdfPath = path.join(DOCS_DIR, f.pdf);
    
    if (!fs.existsSync(htmlPath)) {
      console.log(`✗ ${f.html} not found`);
      continue;
    }
    
    console.log(`\n📄 ${f.html} → ${f.pdf}`);
    try {
      await generatePdf(htmlPath, pdfPath);
    } catch (err) {
      console.log(`  ✗ ${err.message}`);
    }
  }
  
  console.log('\n✅ All PDFs generated!');
}

main().catch(console.error);
