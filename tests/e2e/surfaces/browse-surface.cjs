class BrowseSurface {
  constructor(adapter) { this.adapter = adapter; }
  async clickPlay() { await this.adapter.click('.play-button'); }
}
module.exports = BrowseSurface;
