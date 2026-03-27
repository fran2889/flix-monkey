# FlixMonkey

A Tampermonkey/Greasemonkey userscript that enhances the Netflix experience.

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) (Chrome/Edge) or [Greasemonkey](https://www.greasespot.net/) (Firefox) browser extension.
2. Open `FlixMonkey.user.js` and click **Raw**, or navigate directly to the raw file URL.
3. The extension will detect the `.user.js` file and prompt you to install it.

Alternatively, copy the contents of `FlixMonkey.user.js` into a new script via the extension dashboard.

## Development

Edit `FlixMonkey.user.js` directly. After saving:

- **Tampermonkey**: Go to the dashboard, open the script, paste the updated source and save, or enable the file-system access option to load directly from disk.
- **Greasemonkey**: Re-install from the local file each time, or use the editor in the extension dashboard.

To reload the script on Netflix, refresh the page.

## Adding GM APIs

When you need Tampermonkey-specific functionality, update `@grant` in the header and add the relevant calls:

```js
// @grant GM_setValue
// @grant GM_getValue
// @grant GM_addStyle
// @grant GM_xmlhttpRequest
// @connect api.example.com
```

Remove `@grant none` once any other `@grant` is present.

## License

MIT
