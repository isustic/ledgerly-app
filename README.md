
# Ledgerly

Desktop app for importing Excel data, building reports, and exporting results.

## Development

Install Node.js, the Rust toolchain (including Cargo), and the platform's Tauri build prerequisites. On macOS, install the Xcode Command Line Tools with `xcode-select --install` if they are missing.

If Rust is already installed but Tauri reports that `cargo metadata` cannot be found, load Cargo's shell environment:

```sh
source "$HOME/.cargo/env"
cargo --version
```

To load it automatically in future zsh sessions, add `source "$HOME/.cargo/env"` to `~/.zshrc`.

Install dependencies and start Ledgerly:

```sh
npm install
npm run tauri dev
```

To build the desktop app:

```sh
npm run tauri:build
```

## App icons

The master artwork is `assets/branding/ledgerly-icon.png`. After replacing it, run `npm run icons:generate` to regenerate the desktop and mobile icon bundles, sidebar logo, and web favicons. Restart the development app to load the updated desktop icon.
