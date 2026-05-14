const TestAdapter = require('../adapter.cjs');

/**
 * SettingsUIAdapter
 *
 * Wraps interactions with the FlixMonkey options page rendered inside a Chrome
 * or Firefox extension context.  It extends the base TestAdapter so all generic
 * helpers (navigate, click, evaluate …) are still available.
 *
 * Usage:
 *   const adapter = new SettingsUIAdapter(page, extensionId);
 *   await adapter.openOptionsPage();
 *   await adapter.setField('overlayCorner', 'bottom-right');
 *   await adapter.save();
 *   const stored = await adapter.readStorage(['overlayCorner']);
 */
class SettingsUIAdapter extends TestAdapter {
    /**
     * @param {import('@playwright/test').Page} page
     * @param {string} [extensionId]  Chrome extension ID (e.g. 'abcdef…').
     *   When omitted the adapter will attempt to detect it automatically from
     *   the first chrome-extension:// page that is already open.
     */
    constructor(page, extensionId = null) {
        super(page);
        this.extensionId = extensionId;
    }

    // -------------------------------------------------------------------------
    // Navigation
    // -------------------------------------------------------------------------

    /**
     * Returns the chrome-extension:// URL for the options page.
     * Falls back to trying to detect the extension ID if not provided.
     */
    async optionsUrl() {
        const id = this.extensionId ?? (await this._detectExtensionId());
        return `chrome-extension://${id}/options.html`;
    }

    /** Navigate directly to the extension options page. */
    async openOptionsPage() {
        const url = await this.optionsUrl();
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
        // Wait until at least one labelled field is rendered by options.js
        await this.page.waitForSelector('.field label', { timeout: 5000 });
    }

    // -------------------------------------------------------------------------
    // Field helpers
    // -------------------------------------------------------------------------

    /**
     * Read the current value of a settings field by its config key.
     * Works for text inputs, selects, and checkboxes.
     * @param {string} key  CONFIG_FIELDS key (e.g. 'overlayCorner')
     */
    async getField(key) {
        const selector = `#field_${key}`;
        await this.page.waitForSelector(selector);
        return this.page.evaluate(sel => {
            const el = document.querySelector(sel);
            if (!el) return null;
            if (el.type === 'checkbox') return el.checked;
            return el.value;
        }, selector);
    }

    /**
     * Set the value of a settings field by its config key.
     * Handles text inputs, selects, and checkboxes.
     * @param {string} key    CONFIG_FIELDS key
     * @param {string|boolean} value
     */
    async setField(key, value) {
        const selector = `#field_${key}`;
        await this.page.waitForSelector(selector);

        const type = await this.page.evaluate(sel => {
            const el = document.querySelector(sel);
            if (!el) return null;
            return el.dataset.type ?? el.type;
        }, selector);

        if (type === 'checkbox') {
            const current = await this.page.evaluate(
                sel => document.querySelector(sel).checked,
                selector,
            );
            if (current !== value) {
                await this.page.click(selector);
            }
        } else if (type === 'select') {
            await this.page.selectOption(selector, String(value));
        } else {
            await this.page.fill(selector, String(value));
        }
    }

    /**
     * Click the Save button and wait for the status message to appear.
     */
    async save() {
        await this.page.click('#saveBtn');
        // Wait for "Saved!" status text (disappears after 2 s)
        await this.page.waitForFunction(
            () => document.getElementById('status')?.textContent?.trim() !== '',
            { timeout: 3000 },
        );
    }

    // -------------------------------------------------------------------------
    // Storage access
    // -------------------------------------------------------------------------

    /**
     * Read values directly from chrome.storage.local (bypasses the UI).
     * @param {string[]} keys  Keys to retrieve, e.g. ['overlayCorner']
     * @returns {Promise<Record<string, unknown>>}
     */
    async readStorage(keys) {
        return this.page.evaluate(
            ks => new Promise(resolve => chrome.storage.local.get(ks, resolve)),
            keys,
        );
    }

    /**
     * Write values directly to chrome.storage.local (bypasses the UI).
     * Useful for pre-seeding state before a test.
     * @param {Record<string, unknown>} values
     */
    async writeStorage(values) {
        await this.page.evaluate(
            vals => new Promise(resolve => chrome.storage.local.set(vals, resolve)),
            values,
        );
    }

    // -------------------------------------------------------------------------
    // Extension command stubs (inherited from TestAdapter are sufficient for now)
    // -------------------------------------------------------------------------

    /** Not applicable for the settings page — override is intentionally a no-op. */
    async triggerExtensionCommand(_command) {
        // The options page does not respond to extension commands.
    }

    /**
     * Pre-seed extension settings without going through the UI.
     * Delegates to writeStorage for clarity.
     * @param {Record<string, unknown>} settings
     */
    async setExtensionSettings(settings) {
        await this.writeStorage(settings);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Attempt to derive the extension ID from a chrome-extension:// page that
     * is already open in the browser context.  Throws if none is found.
     */
    async _detectExtensionId() {
        const pages = this.page.context().pages();
        for (const p of pages) {
            const url = p.url();
            const m = url.match(/^chrome-extension:\/\/([^/]+)\//);
            if (m) return m[1];
        }
        throw new Error(
            'SettingsUIAdapter: extensionId not provided and could not be auto-detected. ' +
                'Pass the extension ID as the second constructor argument.',
        );
    }
}

module.exports = SettingsUIAdapter;
