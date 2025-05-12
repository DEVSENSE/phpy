// build.js
const esbuild = require('esbuild');
const fs = require('fs');

const outfile = 'dist/index.js';

esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  outfile,
  platform: 'node',
  format: 'cjs', // or 'cjs' if you want CommonJS
  target: ['node18'],
}).then(() => {
  fs.chmodSync(outfile, '755'); // make executable
  console.log(`✅ Built and minified CLI: ${outfile}`);
}).catch(() => process.exit(1));
