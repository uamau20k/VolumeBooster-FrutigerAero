# 🔊 Volume Booster - Frutiger Aero

> A beautiful **Frutiger Aero inspired** Chrome Extension that boosts the volume of any website from **0% to 300%** using a floating in-page control panel.

<p align="center">

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?style=for-the-badge&logo=googlechrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green?style=for-the-badge)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow?style=for-the-badge&logo=javascript)
![License](https://img.shields.io/badge/License-MIT-red?style=for-the-badge)

</p>

---

## ✨ Features

- 🎵 Boost page volume from **0% to 300%**
- 🪟 Floating draggable control panel
- 🎚️ Volume slider with real-time updates
- 🎬 Works with both **audio** and **video** elements
- 💾 Saves volume settings using Chrome Extension Storage
- 🌐 Automatically injects into HTTP/HTTPS pages
- 🔘 Global ON/OFF switch
- 📍 Activation modes:
  - All websites
  - YouTube only
  - Current website only
- ⚡ Quick presets:
  - 0%
  - 100%
  - 150%
  - 200%
  - 300%
- 🌙 Light / Dark mode
- 💡 Automatic suggestion when low audio is detected
- 🔄 Per-site volume memory

---

# 📸 Screenshots

### Popup

<img src="assets/popup.png" width="350">

### Floating Panel

<img src="assets/panel.png" width="700">

---

# 🚀 Installation

### Install in Developer Mode

1. Open Chrome.
2. Go to:

```
chrome://extensions
```

3. Enable **Developer Mode**.
4. Click **Load unpacked**.
5. Select the extension folder.
6. If updating an existing installation, press **Reload**.

---

# 🎮 Usage

1. Open any website containing audio or video.
2. Click the extension icon.
3. The floating control panel will appear.
4. Adjust the volume between **0%** and **300%**.
5. Hide the panel using the **X** button.
6. Reopen it anytime by clicking the extension icon.

---

# ⚙️ Settings

## Activation Mode

Choose where the booster should work:

- 🌍 All Websites
- ▶️ YouTube Only
- 🌐 Current Website

---

## Quick Profiles

Instant volume presets:

| Profile | Volume |
|---------|--------|
| Mute | 0% |
| Normal | 100% |
| Boost | 150% |
| Loud | 200% |
| Maximum | 300% |

---

## Theme

Switch between:

- ☀️ Light Mode
- 🌙 Dark Mode

---

# 📁 Project Structure

```
VolumeBooster-FrutigerAero/
│
├── icons/
├── popup/
├── scripts/
├── styles/
├── manifest.json
└── README.md
```

---

# ⚠️ Limitations

- Chrome internal pages (`chrome://`) do not allow content scripts.
- Some websites with DRM protection may prevent audio manipulation.
- Boosting above **100%** may introduce clipping or distortion depending on the source audio.

---

# 🛠️ Built With

- JavaScript
- HTML5
- CSS3
- Chrome Extension API
- Web Audio API

---

# 💡 Future Ideas

- Keyboard shortcuts
- Audio compressor
- Bass Boost
- Equalizer
- Custom presets
- Keyboard media controls

---

# 🤝 Contributing

Contributions, issues, and feature requests are welcome!

Feel free to fork the project and submit a Pull Request.

---

# 📄 License

This project is licensed under the MIT License.

---

<p align="center">
Made with ❤️ for Chrome users who need a little more volume.
</p>
