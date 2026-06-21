import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tempDir } from './extensionHarness';

export async function writeJsonFixture(
  fileName: string,
  contents: string
): Promise<string> {
  const filePath = path.join(tempDir, fileName);
  await fs.writeFile(filePath, contents, 'utf8');
  return filePath;
}
