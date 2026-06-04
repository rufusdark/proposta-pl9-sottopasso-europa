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

function cdpCall(wsUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let msgId = 1;
    let resolved = false;
    
    function send(m, p = {}) {
      ws.send(JSON.stringify({ id: msgId++, method: m, params: p }));
    }
    
    function done(err, result) {
      if (resolved) return;
      resolved = true;
      try { if (ws.readyState === WebSocket.OPEN) ws.close(); } catch(e) {}
      if (err) reject(err);
      else resolve(result);
    }
    
    ws.addEventListener('open', () => send(method, params));
    
    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id && msg.result) {
          done(null, msg.result);
        }
        if (msg.error) {
          done(new Error(msg.error.message), null);
        }
      } catch(e) {}
    });
    
    ws.addEventListener('error', () => done(new Error('WS error'), null));
    ws.addEventListener('close', () => {
      if (!resolved) done(new Error('Closed early'), null);
    });
    
    setTimeout(() => done(new Error('Timeout'), null), 15000);
  });
}

async function main() {
  // First: print already-loaded lettera
  const targets = await getTargets();
  console.log('Targets:');
  targets.forEach(t => console.log(`  ${t.id.substring(0,8)}... "${t.title}"`));
  
  // Find the lettera target
  const letterTarget = targets.find(t => t.title.includes('Lettera'));
  const relTarget = targets.find(t => t.title.includes('Relazione'));
  
  if (letterTarget) {
    console.log('\n📄 Printing lettera...');
    try {
      const result = await cdpCall(letterTarget.webSocketDebuggerUrl, 'Page.printToPDF', {
        printBackground: true,
        preferCSSPageSize: true,
        paperWidth: 210/25.4,
        paperHeight: 297/25.4,
        marginTop: 0,
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 0,
      });
      const buf = Buffer.from(result.data, 'base64');
      fs.writeFileSync(path.join(DOCS_DIR, '00_Lettera_accompagnamento.pdf'), buf);
      console.log(`  ✓ Saved (${(buf.length/1024).toFixed(0)}KB)`);
    } catch(e) {
      console.log(`  ✗ ${e.message}`);
    }
  }
  
  // Navigate to relazione and print
  if (relTarget) {
    console.log('\n📄 Printing relazione...');
    try {
      const result = await cdpCall(relTarget.webSocketDebuggerUrl, 'Page.printToPDF', {
        printBackground: true,
        preferCSSPageSize: true,
        paperWidth: 210/25.4,
        paperHeight: 297/25.4,
        marginTop: 0,
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 0,
      });
      const buf = Buffer.from(result.data, 'base64');
      fs.writeFileSync(path.join(DOCS_DIR, '01_Relazione_Tecnica.pdf'), buf);
      console.log(`  ✓ Saved (${(buf.length/1024).toFixed(0)}KB)`);
    } catch(e) {
      console.log(`  ✗ ${e.message}`);
    }
  }
  
  console.log('\nDone!');
}

main().catch(console.error);
