import { promises as fs } from 'fs';
import path from 'path';
import packageJson from '../package.json' assert { type: 'json' };
import { exit } from 'process';

const distPath = path.resolve('dist');
const packageJsonPath = path.join(distPath, 'package.json');

(async () => {
    try {
        // Ensure the dist directory exists
        await fs.mkdir(distPath, { recursive: true });

        // Write the package.json file to the `dist` directory
        await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');

        console.log(`package.json has been copied to ${packageJsonPath}`);
    } catch (error) {
        console.error('Error copying package.json:', error);
        exit(1);
    }
})();