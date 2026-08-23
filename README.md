# utils+

A collection of handy developer tools, hosted at [https://utils.plus](https://utils.plus).

Everything runs locally in the browser: no server-side processing, no third-party requests, and no invasive tracking.
Fonts, the editors, the key generators and the Python and JavaScript engines are bundled or served from this site
rather than fetched from anyone else, so content blockers have nothing to break — a private key is built in the tab and
never leaves it. Each utility keeps its state in the URL fragment, so copying the address bar shares exactly what you
see.

## Development

Requires the Node version in [.node-version](.node-version).

```sh
npm install
npm run dev        # start the dev server
npm run build      # typecheck and build to dist/
npm run preview    # serve the production build
```

## Testing

```sh
npm test           # format check, typecheck, unit tests, build
npm run vitest     # unit tests only
npm run playwright # end-to-end tests, requires `npm run dev` running
```

`npm test` does not run the Playwright specs — run those separately.

## Project layout

- [src/utilities/](src/utilities/) — a directory per utility: the page named after it holds the components, and the
  modules beside it hold the parsing, formatting and generating the page reads
- [src/utility-registry.ts](src/utility-registry.ts) — the list the router, navbar and random picker all read; adding a
  utility is one entry here
- [src/page-meta.ts](src/page-meta.ts) — the title, description and keywords of every page, read by the browser and by
  the build that writes a document per address, the sitemap and the robots.txt
- [src/common/](src/common/) — shared hooks and helpers
- [src/global.css](src/global.css) — layout classes shared across utilities
- [tests/](tests/) — `*.test.ts` are Vitest, `*.spec.ts` are Playwright
- [conf/](conf/) — the tool configuration the npm scripts point at: dprint, Playwright, PostCSS and the
  Vitest setup file

## License

[Apache License 2.0](LICENSE)
