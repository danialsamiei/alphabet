# create-awaf

Zero-dependency scaffolder for new AWAF apps.

> **Status: planned/early.** A working `vite-react` template is included.
> `next-app-router` and `astro-islands` templates are tracked but not yet
> shipped — for those, copy the snippets from `examples/next-app-router-basic`
> and `examples/astro-islands-basic` until the template is ready.

## Usage (once published)

```bash
npm create awaf@latest my-app
# or
pnpm create awaf my-app
# or
yarn create awaf my-app
```

Options:

```
-t, --template <name>   vite-react (default) | next-app-router (planned) | astro-islands (planned)
-h, --help              show help
```

## Local usage from the workspace

```bash
pnpm --filter create-awaf build
node packages/create-awaf/dist/cli.js my-app --template vite-react
```

## Template anatomy

Each template is a plain directory under `templates/<name>` and is copied
verbatim with two renames:

* `_gitignore` → `.gitignore` (npm strips files starting with `.` from
  package tarballs by default; the rename works around that).

The CLI itself uses only Node built-ins: `fs/promises`, `path`, `url`,
`readline/promises`. No bundler, no third-party deps.

## Roadmap

- [x] vite-react template
- [ ] next-app-router template
- [ ] astro-islands template
- [ ] interactive prompts (template / framework / install command)
- [ ] post-scaffold install runner (`npm install` / `pnpm install`)
