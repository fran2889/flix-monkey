const TestAdapter = require('../adapter.cjs');
class UserscriptAdapter extends TestAdapter {
  async triggerExtensionCommand(command) { /* Logic to trigger GM command */ }
  async setExtensionSettings(settings) {
    await this.page.evaluate((s) => localStorage.setItem('flix-config', JSON.stringify(s)), settings);
  }
}
module.exports = UserscriptAdapter;
