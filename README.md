# Page Volume Booster (Chrome Extension)

Floating in-page window to control page audio from 0% to 300%.

## Installation

### Option 1: Download ZIP

1. Click the green **Code** button on this repository.
2. Select **Download ZIP**.
3. Extract the ZIP file on your computer.
4. 
git clone https://github.com/uamau20k/Volume-Booster---Fritiger-aero.git

## Features
- In-page floating panel.
- Slider from 0 to 300.
- Works with audio and video elements.
- Stores your last selected value using extension storage.
- Automatically injects in all open HTTP/HTTPS tabs.
- Global ON/OFF button.
- Activation mode: all pages, YouTube only, or current host only.
- Quick profiles: 0%, 100%, 150%, 200%, 300%.
- Volume is saved per site.
- Automatic low-audio suggestion (offers 150% boost).
- Light/Dark theme toggle.

## Install (Developer Mode)
1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder.
5. If it was already loaded, click **Reload** so it applies to all open tabs.

## Usage
1. Open any website with audio/video.
2. Click the extension icon in Chrome to open the panel.
3. Use the floating **Volume Booster** panel.
4. Close it with the X if you want to hide it.
5. Click the extension icon again to reopen it.
6. Move the slider between 0% and 300%.
7. Use **ON/OFF** to disable/enable boost globally.
8. Use the selector to control where the booster is active.
9. Use profile buttons for quick volume presets.

## Notes
- Increasing above 100% can introduce distortion depending on the source.
- Chrome internal pages (like `chrome://`) do not allow content scripts.
