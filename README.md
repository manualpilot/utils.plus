# utils+

A collection of handy developer tools, hosted at [https://utils.plus](https://utils.plus).

Everything runs locally in the browser: no server-side processing, no third-party requests, and no invasive tracking.
Fonts, the editors, the key generators and the Python and JavaScript engines are bundled or served from this site
rather than fetched from anyone else, so content blockers have nothing to break — a private key is built in the tab and
never leaves it. Each utility keeps its state in the URL fragment, so copying the address bar shares exactly what you
see.

## Development

Requires the Node version in [.node-version](.node-version), and `xz` on the path — the regional internet registries
publish the route origin data `npm run data` reads in that format and no other.

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
npm run playwright # end-to-end tests, against `npm run dev` (started for you unless it is already up)
```

`npm test` does not run the Playwright specs — run those separately. CI runs both, and installs Chromium for the
specs with `npx playwright install --with-deps chromium`.

## Project layout

- [src/utilities/](src/utilities/) — a directory per utility: the page named after it holds the components, and the
  modules beside it hold the parsing, formatting and generating the page reads
- [src/utility-registry.ts](src/utility-registry.ts) — the list the router, navbar and welcome page all read; adding a
  utility is one entry here, its words in `page-meta.ts` and its article in `page-content/`
- [src/page-meta.ts](src/page-meta.ts) — the label, title, description and keywords of every page and the groups the
  utilities are listed under, read by the browser and by the build that writes a document per address and the sitemap
- [src/page-content/](src/page-content/) — the article under each utility: how it works, examples, common problems,
  questions, related tools and references, written into the document the build emits and drawn under the tool
- [src/page-document.ts](src/page-document.ts) — the markup written from those two: each document's head, its
  structured data, and the body a reader with no script is handed
- [src/common/](src/common/) — shared hooks and helpers
- [src/global.css](src/global.css) — layout classes shared across utilities
- [tests/](tests/) — `*.test.ts` are Vitest, `*.spec.ts` are Playwright
- [conf/](conf/) — the tool configuration the npm scripts point at: dprint, Playwright, PostCSS and the
  Vitest setup file

## License

[Apache License 2.0](LICENSE)
