const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
];

const HTTP_TIMEOUT = 8000;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== 'FM_FETCH') return false;
    const { url, options = {} } = msg;
    const { responseType = 'json' } = options;
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT);
    fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': ua, 'Accept-Language': 'en-US,en;q=0.9' },
    })
        .then(async res => {
            clearTimeout(timeoutId);
            if (!res.ok) {
                sendResponse({ error: `HTTP ${res.status}`, status: res.status });
                return;
            }
            const data = responseType === 'json' ? await res.json() : await res.text();
            sendResponse({ data });
        })
        .catch(err => {
            clearTimeout(timeoutId);
            sendResponse({ error: err.message });
        });
    return true; // keep message channel open for async sendResponse
});

chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});
