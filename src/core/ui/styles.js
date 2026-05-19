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
}
.fm-settings-container * {
    box-sizing: border-box;
}
.fm-settings-container {
    background: #141414;
    color: #fff;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    margin: 0;
    padding: 25px;
    min-width: 480px;
}
.fm-settings-container h1 {
    color: #e50914;
    font-size: 24px;
    margin: 0 0 25px;
    text-align: center;
    font-weight: bold;
}
.fm-settings-container .field {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
}
.fm-settings-container .field label {
    flex: 0 0 200px;
    text-align: right;
    padding-right: 15px;
    color: #ccc;
    font-size: 14px;
    cursor: default;
}
.fm-settings-container .field input[type='text'],
.fm-settings-container .field select {
    flex: 0 0 220px;
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
}
.fm-settings-container .field input[type='checkbox'] {
    width: 16px;
    height: 16px;
    cursor: pointer;
}
.fm-settings-container .actions {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 15px;
    margin-top: 20px;
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
    background: transparent;
    color: #ccc;
    border: 1px solid #555;
}
.fm-settings-container .secondary:hover {
    background: #333;
    color: #fff;
}
.fm-settings-container #fm-status {
    text-align: center;
    margin-top: 10px;
    font-size: 13px;
    color: #aaa;
    min-height: 18px;
}
.fm-settings-container .fm-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
}

.fm-settings-container .fm-modal-content {
    background: #141414;
    border: 1px solid #555;
    border-radius: 5px;
    padding: 20px;
    max-width: 500px;
    width: 100%;
}

.fm-settings-container .fm-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}
`;
