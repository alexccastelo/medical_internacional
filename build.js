const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');

// Create dist directory
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

// Folders and files to copy to dist
const itemsToCopy = [
  'index.html',
  'app.js',
  'styles.css',
  'pdfs.json',
  'Cartões de embarque',
  'Documentos',
  'Receitas e docs médicos'
];

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    fs.readdirSync(src).forEach(function(childItemName) {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else if (exists) {
    fs.copyFileSync(src, dest);
  }
}

itemsToCopy.forEach(item => {
  const src = path.join(rootDir, item);
  const dest = path.join(distDir, item);
  if (fs.existsSync(src)) {
    console.log(`Copying ${item} to dist/`);
    copyRecursiveSync(src, dest);
  } else {
    console.warn(`Warning: ${item} not found in root directory.`);
  }
});

console.log('Build complete. Files copied to dist/ directory.');
