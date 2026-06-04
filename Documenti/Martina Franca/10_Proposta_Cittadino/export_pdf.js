const WebSocket = globalThis.WebSocket;
const http = require('http');
const fs = require('fs');
const path = require('path');

const CDP_HOST = '127.0.0.1:9223';
const DOCS_DIR = '/home/rufusdark/Documenti/Martina Franca/10_Proposta_Cittadino';

async function getTargets() {
  return new Promise((resolve, reject) => {
    http.get(`http://${CDP_HOST}/json`, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function printToPdf(htmlFile, outputPdf) {
  const url = `file://${htmlFile}`;
  const targets = await getTargets();
  
  // Use any available page target
  let target = targets.find(t => !t.url.includes('opencode'));
  if (!target) target = targets[0];
  
  const wsUrl = target.webSocketDebuggerUrl;
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let msgId = 1;
    let resolved = false;
    
    function send(method, params = {}) {
      ws.send(JSON.stringify({ id: msgId++, method, params }));
    }
    
    function done(err, result) {
      if (resolved) return;
      resolved = true;
      try { if (ws.readyState === WebSocket.OPEN) ws.close(); } catch(e) {}
      if (err) reject(err);
      else resolve(result);
    }
    
    ws.addEventListener('open', () => {
      send('Page.enable');
      send('Page.navigate', { url });
    });
    
    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        if (msg.method === 'Page.frameNavigated') {
          setTimeout(() => {
            send('Page.printToPDF', {
              landscape: false,
              displayHeaderFooter: false,
              printBackground: true,
              preferCSSPageSize: true,
              paperWidth: 210 / 25.4,
              paperHeight: 297 / 25.4,
              marginTop: 0,
              marginBottom: 0,
              marginLeft: 0,
              marginRight: 0,
            });
          }, 2000);
        }
        
        if (msg.id && msg.result && msg.result.data) {
          const buf = Buffer.from(msg.result.data, 'base64');
          fs.writeFileSync(outputPdf, buf);
          console.log(`  ✓ PDF: ${path.basename(outputPdf)} (${(buf.length/1024).toFixed(0)}KB)`);
          done(null, outputPdf);
        }
        
        if (msg.error) {
          if (msg.id > 5) console.error('  Error:', msg.error);
        }
      } catch(e) {}
    });
    
    ws.addEventListener('error', () => done(new Error('WS error'), null));
    ws.addEventListener('close', () => {
      if (!resolved) done(new Error('Closed without PDF'), null);
    });
    
    setTimeout(() => done(new Error('Timeout'), null), 45000);
  });
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
      console.log(`  ✗ ${f.html} not found`);
      continue;
    }
    
    console.log(`📄 ${f.html} → ${f.pdf}`);
    try {
      await printToPdf(htmlPath, pdfPath);
    } catch (err) {
      console.log(`  ✗ Failed: ${err.message}`);
    }
  }
  
  console.log('\nDone!');
}

main().catch(console.error);
