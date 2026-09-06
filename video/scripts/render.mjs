import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {checkAssets, projectRoot} from './check-assets.mjs';

const mode = process.argv[2] ?? 'preview';
if (!['preview', 'silent', 'cues', 'voice'].includes(mode)) throw new Error(`Unknown mode: ${mode}`);
checkAssets(mode === 'preview' ? ['comparison'] : undefined);
const cueMode = mode === 'cues';
const args = ['remotion', 'render', 'src/index.ts', cueMode ? 'BuyHardCues' : 'BuyHardSilent', `out/buy-hard-${mode}.mp4`, '--codec=h264', '--crf=18', '--pixel-format=yuv420p'];
if (mode === 'preview') args.push('--frames=0-359');
if (mode === 'voice') {
  const propsPath = process.argv[3] ?? 'voice-props.json';
  if (!existsSync(path.resolve(projectRoot, propsPath))) throw new Error('Provide voice-props.json with voiceover or voiceClips before rendering the voiced cut.');
  args.push(`--props=${propsPath}`);
}
args.push(...process.argv.slice(mode === 'voice' && process.argv[3] ? 4 : 3));
const result = spawnSync('npx', args, {cwd: projectRoot, stdio: 'inherit'});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
