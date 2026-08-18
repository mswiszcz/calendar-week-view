import { build, context } from 'esbuild';

const watch = process.argv.includes('--watch');
const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: 'dist/calendar-week-view.js',
  minify: !watch,
  sourcemap: watch,
  legalComments: 'none',
  loader: { '.svg': 'text' },
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('watching…');
} else {
  await build(options);
  console.log('built dist/calendar-week-view.js');
}
