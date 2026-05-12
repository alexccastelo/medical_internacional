const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const outputJson = path.join(rootDir, 'pdfs.json');

// Folders to ignore
const ignoreFolders = ['node_modules', '.git', '.vercel'];

function scanDirectory(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      if (!ignoreFolders.includes(file)) {
        // Recursively scan directories
        results = results.concat(scanDirectory(filePath));
      }
    } else {
      if (file.toLowerCase().endsWith('.pdf')) {
        // We need the relative path from the root directory for the web server to access it
        const relativePath = path.relative(rootDir, filePath);
        
        // Split path to find the category (first folder name)
        const parts = relativePath.split(path.sep);
        let category = 'Outros';
        
        if (parts.length > 1) {
          category = parts[0];
        }

        results.push({
          name: file,
          path: '/' + relativePath.split(path.sep).join('/'), // ensure web-friendly slashes
          category: category,
          size: stat.size,
          lastModified: stat.mtime
        });
      }
    }
  });

  return results;
}

try {
  console.log('Scanning for PDFs...');
  const pdfs = scanDirectory(rootDir);
  
  // Structure data for frontend
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
