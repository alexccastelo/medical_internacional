const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const rootDir = __dirname;
const outputJson = path.join(rootDir, 'pdfs.json');

const ignoreFolders = ['node_modules', '.git', '.vercel'];

async function scanDirectory(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      if (!ignoreFolders.includes(file)) {
        const subResults = await scanDirectory(filePath);
        results = results.concat(subResults);
      }
    } else {
      if (file.toLowerCase().endsWith('.pdf')) {
        const relativePath = path.relative(rootDir, filePath);
        const parts = relativePath.split(path.sep);
        let category = 'Outros';
        
        if (parts.length > 1) {
          category = parts[0];
        }

        let textContent = '';
        try {
          const dataBuffer = fs.readFileSync(filePath);
          // Parse the PDF text. Limit parsing to make it faster if needed, but we try all.
          const data = await pdfParse(dataBuffer);
          // Clean up the text: remove excess whitespace and newlines for a compact JSON
          textContent = (data.text || '').replace(/\s+/g, ' ').trim();
        } catch (err) {
          console.warn(`Could not parse text for ${file}:`, err.message);
        }

        results.push({
          name: file,
          path: '/' + relativePath.split(path.sep).join('/'),
          category: category,
          size: stat.size,
          lastModified: stat.mtime,
          content: textContent
        });
      }
    }
  }

  return results;
}

async function run() {
  try {
    console.log('Scanning for PDFs and extracting text content...');
    const pdfs = await scanDirectory(rootDir);
    
    const data = {
      generatedAt: new Date().toISOString(),
      total: pdfs.length,
      files: pdfs
    };

    fs.writeFileSync(outputJson, JSON.stringify(data, null, 2));
    console.log(`Successfully indexed ${pdfs.length} PDF files into pdfs.json`);
  } catch (error) {
    console.error('Error generating PDF index:', error);
    process.exit(1);
  }
}

run();
