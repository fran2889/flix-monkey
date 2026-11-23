/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

/** Result a background listener may return: synchronous for Chrome, a promise for Firefox. */
export type BackgroundListenerResult = Promise<unknown> | boolean | void;

/** Listener registered by a background entry module. */
export type BackgroundListener = (..._args: unknown[]) => BackgroundListenerResult;

interface BackgroundNamespace {
    runtime: {
        id?: unknown;
        onInstalled: { addListener: (_callback: BackgroundListener) => void };
        onMessage: { addListener: (_callback: BackgroundListener) => void };
        openOptionsPage: () => Promise<void>;
    };
    action: {
        onClicked: { addListener: (_callback: BackgroundListener) => void };
    };
}

/** Listeners captured from a background entry module at import time. */
export interface BackgroundHarness {
    actionListener: BackgroundListener;
    installedListener: BackgroundListener;
    messageListener: BackgroundListener;
}

function missingListener(name: string): BackgroundListener {
    return (): never => {
        throw new Error(`Background listener ${name} was not registered`);
    };
}

/**
 * Installs a browser namespace mock on `global`, captures the listeners the
 * entry module registers, and stubs the timer, fetch, and abort globals the
 * background context expects.
 *
 * The returned listeners throw until the entry module registers them, so a
 * test cannot pass against an unregistered listener.
 *
 * @param namespace - Chrome or WebExtension namespace mock to install.
 * @param globalName - Global name the namespace is defined under.
 * @param runtimeId - Runtime ID the sender check compares against.
 * @returns Captured listeners for message, install, and action events.
 */
export function installBackgroundHarness(
    namespace: BackgroundNamespace,
    globalName: 'chrome' | 'browser',
    runtimeId: string | undefined
): BackgroundHarness {
    vi.useFakeTimers();
    namespace.runtime.id = runtimeId;
    namespace.runtime.openOptionsPage = vi.fn().mockResolvedValue(undefined);

    let installedListener: BackgroundListener | undefined;
    let messageListener: BackgroundListener | undefined;
    let actionListener: BackgroundListener | undefined;

    namespace.runtime.onInstalled.addListener = vi.fn((listener: BackgroundListener): void => {
        installedListener = listener;
    });
    namespace.runtime.onMessage.addListener = vi.fn((listener: BackgroundListener): void => {
        messageListener = listener;
    });
    namespace.action.onClicked.addListener = vi.fn((listener: BackgroundListener): void => {
        actionListener = listener;
    });

    Object.defineProperty(global, globalName, {
        value: namespace,
        writable: true,
        configurable: true,
    });

    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));
    global.AbortController = class {
        signal: { aborted: boolean };
        constructor() {
            this.signal = { aborted: false };
        }
        abort() {
            this.signal.aborted = true;
        }
    } as unknown as { prototype: AbortController; new (): AbortController };

    return {
        actionListener: (...args: unknown[]): BackgroundListenerResult =>
            (actionListener ?? missingListener('onClicked'))(...args),
        installedListener: (...args: unknown[]): BackgroundListenerResult =>
            (installedListener ?? missingListener('onInstalled'))(...args),
        messageListener: (...args: unknown[]): BackgroundListenerResult =>
            (messageListener ?? missingListener('onMessage'))(...args),
    };
}
