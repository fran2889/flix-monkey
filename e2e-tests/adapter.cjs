class TestAdapter {
  constructor(page) { this.page = page; }
  async navigate(url) { await this.page.goto(url); }
  async waitForElement(selector) { await this.page.waitForSelector(selector); }
  async click(selector) { await this.page.click(selector); }
  async evaluate(func) { return await this.page.evaluate(func); }
  async triggerExtensionCommand(command) { throw new Error('Not implemented'); }
  async setExtensionSettings(settings) { throw new Error('Not implemented'); }
}
module.exports = TestAdapter;
