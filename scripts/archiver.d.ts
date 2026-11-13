/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

declare module 'archiver' {
    interface ZipArchiveOptions {
        zlib?: { level?: number };
    }

    interface EntryData {
        name: string;
    }

    /**
     * Minimal typing for the parts of archiver used by scripts/package.js.
     * archiver ships without declarations and @types/archiver is not a dependency.
     */
    class ZipArchive {
        constructor(options?: ZipArchiveOptions);
        pointer(): number;
        on(event: 'error' | 'warning', listener: (error: Error) => void): this;
        pipe(destination: NodeJS.WritableStream): this;
        directory(dirpath: string, destpath: string | false, data?: (entry: EntryData) => EntryData | false): this;
        finalize(): Promise<void>;
    }

    export { ZipArchive };
}
