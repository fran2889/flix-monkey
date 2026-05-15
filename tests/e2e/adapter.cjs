/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */
class TestAdapter {
    constructor(page) {
        this.page = page;
    }
    async navigate(url) {
        await this.page.goto(url);
    }
    async waitForElement(selector) {
        await this.page.waitForSelector(selector);
    }
    async click(selector) {
        await this.page.click(selector);
    }
    async evaluate(func) {
        return await this.page.evaluate(func);
    }
    async triggerExtensionCommand(command) {
        throw new Error('Not implemented');
    }
    async setExtensionSettings(settings) {
        throw new Error('Not implemented');
    }
}
module.exports = TestAdapter;
