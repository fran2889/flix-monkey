export class PlatformAdapter {
    async storageGet(_key) {
        throw new Error('Not implemented');
    }
    async storageSet(_key, _value) {
        throw new Error('Not implemented');
    }
    async httpFetch(_url, _options) {
        throw new Error('Not implemented');
    }
    registerMenuCommand(_label, _fn) {}
}
