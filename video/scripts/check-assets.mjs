import {existsSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const requiredCaptures = ['overview', 'risk', 'risk-detail', 'sources', 'rfqs', 'followup1', 'email', 'followup2', 'comparison', 'approval', 'approval-detail', 'delivery', 'confirmation', 'order', 'recent'];

export function checkAssets(names = requiredCaptures) {
  const missing = names.filter((name) => {
    const file = path.join(projectRoot, 'public', 'captures', `${name}.png`);
    return !existsSync(file) || statSync(file).size < 100;
  });
  if (missing.length > 0) throw new Error(`Missing genuine app captures: ${missing.join(', ')}. Supply video/public/captures/<name>.png; the renderer never invents UI.`);
  return names;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    console.log(`Ready: ${checkAssets().length} genuine app captures.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
