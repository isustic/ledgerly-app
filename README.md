
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

## Interface languages

Settings → Language switches between English and Romanian immediately and saves the choice locally. Language changes preserve loaded data and form state. Imported column names, cell values, saved report names, and SQL/formula syntax remain unchanged.

App-owned copy uses `translate(source, params)` from `lib/i18n`. Add Romanian copy to `lib/i18n/ro.json`; English uses the source text, with overrides in `lib/i18n/en.json` for legacy Romanian labels. Subscribe React components with `useLanguage()` so they update when the setting changes. Include the language in memo dependencies when memoizing translated content.

Keep status/error messages in their source form in state, then call `translateMessage()` when displaying them. Use `{0}` or named placeholders for dynamic values rather than translating assembled sentences. Native export labels share the same catalogs.

Run `npm run test:i18n` to check preference persistence, switching, interpolation, locale formatting, and translation coverage.
