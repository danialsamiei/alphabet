/**
 * @file cli.ts
 * @description
 * `create-alphabet` — minimal scaffolder for a new Alphabet app.
 *
 * Usage:
 *   npm create alphabet@latest my-app
 *   npm create alphabet@latest my-app -- --template vite-react
 *
 * Currently supported templates:
 *   - vite-react (default)
 *
 * Planned:
 *   - next-app-router
 *   - astro-islands
 *
 * The CLI is intentionally zero-dependency: it uses only Node's built-in
 * `fs`/`path`/`readline` so the install footprint is one tarball.
 */

import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Templates shipped in the package tarball (relative to the dist/ dir). */
const TEMPLATES_DIR = resolve(__dirname, '..', 'templates');

const SUPPORTED_TEMPLATES = ['vite-react'] as const;
const PLANNED_TEMPLATES = ['next-app-router', 'astro-islands'] as const;

type SupportedTemplate = (typeof SUPPORTED_TEMPLATES)[number];

interface ParsedArgs {
  readonly target: string | null;
  readonly template: SupportedTemplate;
  readonly help: boolean;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const args = argv.slice(2);
  let target: string | null = null;
  let template: SupportedTemplate = 'vite-react';
  let help = false;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--help' || a === '-h') {
      help = true;
    } else if (a === '--template' || a === '-t') {
      const next = args[i + 1];
      if (next === undefined) {
        throw new Error('--template requires a value');
      }
      if (!isSupported(next)) {
        const planned = PLANNED_TEMPLATES.includes(next as (typeof PLANNED_TEMPLATES)[number])
          ? ` (planned, not yet implemented)`
          : '';
        throw new Error(
          `Unknown template "${next}"${planned}. Supported: ${SUPPORTED_TEMPLATES.join(', ')}.`
        );
      }
      template = next;
      i += 1;
    } else if (a !== undefined && !a.startsWith('-')) {
      target = a;
    }
  }
  return { target, template, help };
}

function isSupported(value: string): value is SupportedTemplate {
  return (SUPPORTED_TEMPLATES as readonly string[]).includes(value);
}

function printHelp(): void {
  console.log(`create-alphabet — scaffold a new Alphabet app

Usage:
  npm create alphabet@latest <project-name> [options]
  pnpm create alphabet <project-name> [options]

Options:
  -t, --template <name>   Template to use. Default: vite-react.
  -h, --help              Show this help.

Templates:
  vite-react              Vite + React + Alphabet (supported).
  next-app-router         Next.js App Router (planned).
  astro-islands           Astro Islands (planned).
`);
}

async function promptForTarget(): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question('Project directory: ');
    return answer.trim();
  } finally {
    rl.close();
  }
}

async function copyDir(src: string, dest: string): Promise<void> {
  const entries = await readdir(src, { withFileTypes: true });
  await mkdir(dest, { recursive: true });
  for (const entry of entries) {
    const s = join(src, entry.name);
    // Templates may rename files (e.g. _gitignore → .gitignore) to avoid
    // npm's habit of stripping leading dots from package contents.
    const renamed = entry.name === '_gitignore' ? '.gitignore' : entry.name;
    const d = join(dest, renamed);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else if (entry.isFile()) {
      const content = await readFile(s);
      await writeFile(d, content);
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  let target = args.target;
  if (target === null || target.length === 0) {
    target = await promptForTarget();
    if (target.length === 0) {
      console.error('Project directory is required.');
      process.exit(1);
    }
  }

  const dest = resolve(process.cwd(), target);
  if (existsSync(dest)) {
    const info = await stat(dest);
    if (info.isDirectory()) {
      const entries = await readdir(dest);
      if (entries.length > 0) {
        console.error(`Refusing to scaffold into non-empty directory: ${dest}`);
        process.exit(1);
      }
    } else {
      console.error(`A file already exists at ${dest}`);
      process.exit(1);
    }
  }

  const templateSrc = join(TEMPLATES_DIR, args.template);
  if (!existsSync(templateSrc)) {
    console.error(
      `Template "${args.template}" was not found at ${templateSrc}. ` +
        `This is a packaging bug in create-alphabet — please report it.`
    );
    process.exit(2);
  }

  console.log(`Scaffolding ${args.template} into ${relative(process.cwd(), dest) || '.'} …`);
  await copyDir(templateSrc, dest);

  console.log(`\nDone. Next steps:
  cd ${target}
  npm install
  npm run dev
`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`create-alphabet: ${message}`);
  process.exit(1);
});
