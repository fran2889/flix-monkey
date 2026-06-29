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
export const SETTINGS_STYLES = `
.fm-settings-container {
    box-sizing: border-box;
    background: #141414;
    color: #fff;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    margin: 0;
    padding: 10px 25px 20px;
    min-width: 480px;
}
.fm-settings-container * {
    box-sizing: border-box;
}
.fm-settings-container #fm-fields {
    width: fit-content;
    margin: 0 auto;
}
.fm-settings-container .field {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
}
.fm-settings-container .field label {
    flex: 0 0 200px;
    text-align: right;
    padding-right: 15px;
    color: #ccc;
    font-size: 14px;
}
.fm-settings-container .field label a {
    color: #6bf;
    text-decoration: none;
}
.fm-settings-container .field label a:hover {
    text-decoration: underline;
}
.fm-settings-container .field input[type='text'],
.fm-settings-container .field select {
    flex: 0 0 200px;
    background: #333;
    color: #fff;
    border: 1px solid #555;
    border-radius: 4px;
    padding: 6px 12px;
    font-size: 14px;
    outline: none;
}
.fm-settings-container .field input[type='text']:focus,
.fm-settings-container .field select:focus {
    border-color: #e50914;
    outline: 2px solid #e50914;
    outline-offset: 1px;
}
.fm-settings-container .field input[type='checkbox'] {
    width: 16px;
    height: 16px;
    cursor: pointer;
}
.fm-settings-container .field-row {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 20px;
    margin-bottom: 10px;
}
.fm-settings-container .field-row .field {
    margin-bottom: 0;
    flex: none;
    gap: 6px;
}
.fm-settings-container .field-row .field label {
    flex: none;
    text-align: left;
    padding: 0;
}
.fm-settings-container .field-row .field input[type='text'] {
    flex: none;
    width: 50px;
    text-align: center;
    padding: 6px 4px;
}
.fm-settings-container .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
    padding: 0;
}
.fm-settings-container .section-header {
    color: #888;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 12px 0 8px;
    text-align: center;
    border-bottom: 1px solid #333;
    padding-bottom: 4px;
}
.fm-settings-container .actions {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 15px;
    margin-top: 15px;
    flex-wrap: wrap;
    position: relative;
}
.fm-settings-container button {
    padding: 8px 20px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.2s;
}
.fm-settings-container #fm-saveBtn {
    background: #e50914;
    color: #fff;
}
.fm-settings-container #fm-saveBtn:hover {
    background: #f40612;
}
.fm-settings-container .secondary {
    background: #e1e1e1;
    color: #333;
    border: 1px solid #8f8f8f;
}
.fm-settings-container .secondary:hover {
    background: #d5d5d5;
    color: #000;
}
.fm-settings-container #fm-status {
    text-align: center;
    margin-top: 10px;
    font-size: 13px;
    color: #aaa;
    min-height: 18px;
    white-space: pre-line;
}
.fm-settings-container #fm-status.fm-status--error {
    color: #e05252;
}
.fm-settings-container #fm-status.fm-status--success {
    color: #4caf50;
}
.fm-settings-container .field input.error,
.fm-settings-container .field select.error {
    border-color: #e05252;
}
.fm-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 2147483647 !important;
}

.fm-modal-content {
    background: #141414;
    border: 1px solid #555;
    border-radius: 4px;
    padding: 20px;
    max-width: 500px;
    width: 100%;
    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
}

.fm-modal-header {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 20px;
    position: relative;
}
.fm-modal-title {
    color: #e50914;
    margin: 0;
    font-size: 20px;
    font-weight: bold;
}
.fm-modal-close {
    background: none;
    border: none;
    color: #ccc;
    font-size: 24px;
    cursor: pointer;
    position: absolute;
    right: 0;
}
.fm-modal-close:hover {
    color: #fff;
}
.fm-modal-body {
    padding: 0 4px;
}
`;
