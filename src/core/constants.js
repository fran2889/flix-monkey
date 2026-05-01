export const DAYS_TO_MS = 24 * 60 * 60 * 1000;
export const NAVIGATION_DEBOUNCE_MS = 800;
export const HTTP_TIMEOUT = 8000;
export const CLIENT_DISABLE_DURATION = 3600000;

export const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
];

export const ApiSource = Object.freeze({
    XMDB: 'xmdb',
    OMDB: 'omdb',
    IMDBAPI: 'imdbapi',
});

export const RATE_LIMITS = {
    [ApiSource.XMDB]: 1500,
    [ApiSource.OMDB]: 0,
    [ApiSource.IMDBAPI]: 1000,
};
