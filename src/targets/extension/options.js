import browser from 'webextension-polyfill';
import { CONFIG_FIELDS, CONFIG_DEFAULTS } from '../../core/config-fields.js';
import { ApiSource } from '../../core/constants.js';

const fieldsContainer = document.getElementById('fields');
const statusEl = document.getElementById('status');

function showStatus(msg) {
    statusEl.textContent = msg;
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
}

CONFIG_FIELDS.forEach(f => {
    const div = document.createElement('div');
    div.className = 'field';

    const label = document.createElement('label');
    label.textContent = f.label;
    label.title = f.title ?? '';
    label.htmlFor = `field_${f.key}`;
    div.appendChild(label);

    let input;
    if (f.type === 'select') {
        input = document.createElement('select');
        f.options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            input.appendChild(option);
        });
    } else if (f.type === 'checkbox') {
        input = document.createElement('input');
        input.type = 'checkbox';
    } else {
        input = document.createElement('input');
        input.type = 'text';
    }
    input.id = `field_${f.key}`;
    input.dataset.key = f.key;
    input.dataset.type = f.type;
    div.appendChild(input);
    fieldsContainer.appendChild(div);
});

async function loadValues() {
    const stored = await browser.storage.local.get(null);
    CONFIG_FIELDS.forEach(f => {
        const input = document.getElementById(`field_${f.key}`);
        const val = stored[f.key] ?? CONFIG_DEFAULTS[f.key];
        if (f.type === 'checkbox') {
            input.checked = val === true || val === 'true';
        } else {
            input.value = String(val);
        }
    });
}

document.getElementById('saveBtn').addEventListener('click', async () => {
    const values = {};
    CONFIG_FIELDS.forEach(f => {
        const input = document.getElementById(`field_${f.key}`);
        values[f.key] = f.type === 'checkbox' ? input.checked : input.value;
    });
    await browser.storage.local.set(values);
    showStatus('Saved!');
});

document.getElementById('clearCacheBtn').addEventListener('click', async () => {
    if (!confirm('Clear all cached ratings?')) return;
    await browser.storage.local.set({ fm_cache: '{}' });
    showStatus('Cache cleared.');
});

document.getElementById('resetClientsBtn').addEventListener('click', async () => {
    if (!confirm('Re-enable all failing API endpoints?')) return;
    const resets = Object.fromEntries(
        Object.values(ApiSource).map(s => [`fm_disabled_${s}`, '0'])
    );
    await browser.storage.local.set(resets);
    showStatus('API clients re-enabled.');
});

loadValues();
