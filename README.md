# KwesPay SDK Console (Testnet)

A developer-only web app for running real testnet payments through `@kwespay/client` on **every chain KwesPay supports: EVM, Sui and Stellar**. The developer picks a network, gets test tokens, runs a payment, watches every SDK call and status change, and exports evidence that matches the backend's records.

The console treats all chains the same. No chain is the default or "main" one. Switching from Base Sepolia to Stellar Testnet to Sui Testnet changes the wallet, assets and explorer, but the layout, the steps and the evidence format stay the same.

This document is the build spec. It's written so that a developer or another AI agent can build the console from it without guessing. Where the current code or config disagrees with this spec, the [Known issues](#known-issues) section says so.

---

## Contents

1. [Who it's for and what it must do](#who-its-for-and-what-it-must-do)
2. [Ground rules](#ground-rules)
3. [Supported networks and tokens](#supported-networks-and-tokens)
4. [UI specification](#ui-specification)
5. [KwesPay UI guidelines](#kwespay-ui-guidelines)
6. [Test tokens (faucet panel)](#test-tokens-faucet-panel)
7. [SDK call sequence](#sdk-call-sequence)
8. [Chain differences the UI must handle](#chain-differences-the-ui-must-handle)
9. [Evidence and logs](#evidence-and-logs)
10. [Failure presets](#failure-presets)
11. [Tech stack, project structure and deploy](#tech-stack-project-structure-and-deploy)
12. [Keeping network config in sync](#keeping-network-config-in-sync)
13. [Known issues](#known-issues)
14. [Instawards SOW mapping](#instawards-sow-mapping)
15. [Done when](#done-when)

---

## Who it's for and what it must do

**User:** a developer integrating `@kwespay/client` who already has a KwesPay testnet API key and vendor ID (from the dashboard).

**Jobs, in order of importance:**

1. Get test tokens for any supported testnet without leaving the console.
2. Run a full payment on any testnet network and see it reach `completed`.
3. When something fails, see exactly which SDK call failed, with what input, and what to fix.
4. Switch network or asset and run again in one or two clicks, keeping everything else.
5. Export proof that the on-chain transaction matches the backend record.

---

## Ground rules

- **Testnet only.** Only testnet networks can be selected. The console refuses to start if the endpoint looks like a mainnet host, and it refuses to build a payment if the selected network isn't in the testnet list.
- **Payments only go through the public SDK.** Every payment step goes through `KwesPayClient`, exactly as an integrator would use it. There are no direct GraphQL calls and no imports from `@kwespay/client/internal`. That way the console also tests the published package.
- **Faucet calls are console tooling, not SDK calls.** Minting test tokens, adding Stellar trustlines and asking friendbot for XLM are done by the console's own `faucet/` module, using `viem` / `@stellar/stellar-sdk` directly. They're visually separate from the payment run and never show up in the payment's evidence.
- **Never holds secrets.** Users sign every transaction in their own wallet. The API key lives in `sessionStorage` only and is masked everywhere. The console never asks for a private key or seed phrase.
- **Not a merchant dashboard.** No vendor creation, no account settings, no analytics.

---

## Supported networks and tokens

The console's network list is the backend's `TESTNET_NETWORKS`, in this order:

| Ecosystem | Network key         | Display name     | Native gas  | Payment tokens (backend`SUPPORTED_CURRENCIES`) | Explorer tx URL                                 |
| --------- | ------------------- | ---------------- | ----------- | ------------------------------------------------ | ----------------------------------------------- |
| EVM       | `sepolia`         | Ethereum Sepolia | ETH         | ETH, USDT, MUSD                                  | `https://sepolia.etherscan.io/tx/`            |
| EVM       | `baseSepolia`     | Base Sepolia     | ETH         | ETH, USDC, USDT                                  | `https://sepolia.basescan.org/tx/`            |
| EVM       | `polygonAmoy`     | Polygon Amoy     | POL (MATIC) | MATIC, USDT, USDC                                | `https://amoy.polygonscan.com/tx/`            |
| EVM       | `liskTestnet`     | Lisk Sepolia     | ETH         | ETH, LSK                                         | `https://sepolia-blockscout.lisk.com/tx/`     |
| EVM       | `mezoTestnet`     | Mezo Testnet     | BTC         | BTC, MEZO, MUSD, USDT                            | `https://explorer.test.mezo.org/tx/`          |
| EVM       | `arbitrumSepolia` | Arbitrum Sepolia | ETH         | ETH, USDC, ARB, USDT                             | `https://sepolia.arbiscan.io/tx/`             |
| Sui       | `suiTestnet`      | Sui Testnet      | SUI         | SUI, USDC                                        | `https://suiscan.xyz/testnet/tx/`             |
| Stellar   | `stellarTestnet`  | Stellar Testnet  | XLM         | XLM, USDC                                        | `https://stellar.expert/explorer/testnet/tx/` |

The console never needs a payment contract address. Since 2026-10-12 the backend returns the contract it signed for in every `createTransaction` response (`contractAddress`, plus `registryObjectId` on Sui), and the SDK uses it ahead of its own local table. Display metadata (names, logos, explorer URLs, chain IDs for `wallet_switchEthereumChain`) lives in one console module, `src/networks.ts`, and must pass the drift check described in [Keeping network config in sync](#keeping-network-config-in-sync).

Which tokens a given vendor can actually use comes from `client.getMerchantConfig(vendorId).networkTokenMap`, never from the table above. The table is the upper bound.

---

## UI specification

### Visual style

- **Developer tool, not marketing.** Dense, quiet, monospace for data (addresses, hashes, JSON, logs) and a sans-serif for labels.
- **Light and dark themes**, following the system setting by default, with a toggle in the header. All colours are CSS variables on `:root`.
- **One accent colour for "action".** Status uses semantic colours: green ok, amber waiting, red failed, grey skipped. Never use colour alone; every state also has an icon (`✓ ● ○ ✗ –`).
- **Ecosystem marks** (EVM / Sui / Stellar) appear as small badges next to network names, so the user always knows which wallet family is active.
- Copy buttons next to every address, hash, reference and JSON block. Long values are shortened in the middle (`0x6200…3D17`), with the full value in a tooltip and on copy.

### Desktop layout (≥ 1100 px)

```
┌ KwesPay SDK Console · TESTNET ─────────── @kwespay/client 0.1.27 (npm) ▾ ── ● API ok ── ☾ ┐
│ ┌ Network bar ─────────────────────────────────────────────────────────────────────────┐ │
│ │ [EVM] Sepolia  Base Sep.  Amoy  Lisk Sep.  Mezo  Arb Sep.  │ [SUI] Sui  │ [XLM] Stellar │ │
│ │                    ▔▔▔▔▔▔▔▔ selected                                                   │ │
│ └──────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ 1 Setup ───────────────────────┐ ┌ 4 Run timeline ─────────────────────────────────────┐ │
│ │ Endpoint  api.kwespay.xyz/gr…  │ │ ✓ validateKey             182 ms                     │ │
│ │ API key   pk_9zm••••••lcTQ  ✎  │ │ ✓ getMerchantConfig       140 ms   6 networks         │ │
│ │ Vendor    0276c40a…  ✓ Acme    │ │ ✓ quote                   611 ms   ref 7f3c…          │ │
│ ├ 2 Wallet ──────────────────────┤ │ ● pay                     approve USDC… (wallet)      │ │
│ │ EVM     0x51a…9C2  MetaMask  ✓ │ │ ○ pollTransactionStatus                               │ │
│ │ Sui     not connected  [Conn.] │ ├ 5 Inspector ─────── [Request] [Response] [Error] ────┤ │
│ │ Stellar GDX4…Q7MA  Freighter ✓ │ │ {                                                     │ │
│ │ Gas  0.42 ETH ✓  USDC 1,000 ✓  │ │   "paymentIdBytes32": "0xa91c…",                      │ │
│ │ [Get test tokens]              │ │   "amountBaseUnits": "10000000", …                    │ │
│ ├ 3 Payment ─────────────────────┤ │ }                                                     │ │
│ │ Asset   (•) USDC  ( ) ETH      │ │                                                       │ │
│ │ Amount  10.00 [USD ▾]          │ │                                                       │ │
│ │ Preset  Happy path          ▾  │ │                                                       │ │
│ │ [ Run payment on Base Sepolia ]│ │                                                       │ │
│ └────────────────────────────────┘ └───────────────────────────────────────────────────────┘ │
│ ┌ 6 Status ──────────────────────────────┐ ┌ 7 Evidence ─────────────────────────────────┐ │
│ │ pending → processing → completed ✓     │ │ SDK vs backend  8/8 match       [Export]    │ │
│ │ deadline 14:46:02 (in 13m 40s)         │ │ tx 0x4be2…  basescan ↗                      │ │
│ └────────────────────────────────────────┘ └─────────────────────────────────────────────┘ │
│ ┌ Session history ── Base Sep. USDC ✓ · Stellar XLM ✓ · Sui SUI ✗ CONTRACT_ERROR ───────┐ │
│ ┌ Log ─────────────────────────────────────────────────────────── [Filter ▾] [Copy JSONL] ┐ │
│ │ 14:31:02.118 baseSepolia quote ok 611ms ref=7f3c… asset=USDC total=10050000             │ │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Tablet and phone

- **700–1100 px:** two columns. Setup, Wallet and Payment on the left. Timeline and Inspector on the right. Status, Evidence and Log go full width below.
- **< 700 px:** a single column in numbered order. The network bar becomes a horizontal scroll strip with the selected network pinned on the left. The Inspector opens as a bottom sheet when a timeline row is tapped. There's a 16 px side gutter and no horizontal page scroll.

### Header

- Product name and a fixed **TESTNET** pill. The pill isn't clickable; there's no mainnet mode.
- **SDK version selector:** `npm 0.1.27` or `local build`. It shows exactly which `@kwespay/client` is loaded and switches between them on reload.
- **API health dot:** pings the endpoint's `/health` every 30 s. Green means ok, amber means slow (> 2 s), red means unreachable. Hovering shows the last response.
- Theme toggle.

### Network bar (the chain switcher)

The most important control. It's always visible at the top.

- Networks are grouped by ecosystem with a small header badge (`EVM`, `SUI`, `XLM`), in the order of the table above.
- Each chip shows: network name, a small logo, and a state dot.
  - **Enabled:** the vendor has this network in `getMerchantConfig().enabledNetworks`.
  - **Disabled (greyed, still clickable):** not enabled for this vendor. Selecting it shows why in the Payment panel ("Vendor hasn't enabled Polygon Amoy" or "Vendor has no Sui wallet").
  - **Unknown:** before a vendor is validated, every chip is neutral.
- **Switching network:**
  - **Keeps:** endpoint, API key, vendor, fiat amount, fiat currency, preset.
  - **Changes:**
    - the asset list, rebuilt from `networkTokenMap` for that network
    - the active wallet row, which is highlighted in the Wallet panel
    - balances, which are refetched
    - the explorer base URL and the label on the Run button
  - **Asset choice:** kept if the new network has the same symbol (USDC → USDC). Otherwise it falls back to the first stablecoin, then to the native token.
  - **During a run:** the bar is locked while a payment is running, so the user can't change network halfway through. A tooltip says "Finish or cancel the current run".
- Keyboard: `←/→` moves between chips, `Enter` selects. The URL updates to `?network=baseSepolia&asset=USDC`, so a setup can be shared as a link.

### 1. Setup panel

| Field     | Behaviour                                                                                                                                                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint  | Defaults to `https://api.testnet.kwespay.xyz/graphql`, the public testnet backend. (`https://api.kwespay.xyz/graphql`, the SDK's default `ENDPOINT`, is mainnet.) Editable, so it can point at a local testnet backend (`http://localhost:8002/graphql`). A mainnet-looking host is rejected with an inline error.   |
| API key   | Masked input stored in`sessionStorage`. Shown as `pk_xxx••••xxxx` with an edit pencil.                                                                                                                                |
| Vendor ID | Free text. On blur, the console calls`validateKey(vendorId)` and then `getMerchantConfig(vendorId)`. If valid, it shows the business name with a ✓.                                                                      |
| Key scope | Shown under the vendor after validation, as chips listing the key's`allowedNetworks` / `allowedTokens`. A network or token that the vendor enables but the key doesn't cover is marked with an amber "key scope" warning. |

### 2. Wallet panel

There's one row per ecosystem. **All three can be connected at the same time.** The row for the selected network's ecosystem is highlighted, and only that row is used for the run.

| Ecosystem | Connect with                                                                | SDK parameter                    |
| --------- | --------------------------------------------------------------------------- | -------------------------------- |
| EVM       | Any injected EIP-1193 provider (MetaMask, Rabby, Coinbase) or WalletConnect | `provider: EIP1193Provider`    |
| Sui       | Wallet Standard (Sui Wallet, Suiet, Slush)                                  | `wallet: SuiWalletAdapter`     |
| Stellar   | Freighter (via`@stellar/freighter-api`), or any `StellarWalletAdapter`  | `wallet: StellarWalletAdapter` |

Each row shows:

- the address (shortened, copyable) and the wallet name
- **Gas balance** in the network's native token, with an amber warning if it's below a safe minimum (EVM 0.001 ETH-equivalent, Sui 0.1 SUI, Stellar 5 XLM)
- **Token balance** for the selected asset
- for EVM, the wallet's current chain ID. If it differs from the selected network, the row shows **Switch to Base Sepolia**, which calls `wallet_switchEthereumChain`, falling back to `wallet_addEthereumChain` with the network's RPC and explorer.
- for Stellar USDC, whether the wallet has a USDC trustline. If it doesn't, the row shows **Add USDC trustline**, a one-click `changeTrust` operation signed in Freighter.

The **Get test tokens** button opens the [faucet panel](#test-tokens-faucet-panel) for the selected network and asset.

### 3. Payment panel

- **Network:** read-only. It mirrors the network bar and shows the ecosystem badge.
- **Asset:** radio list built from `networkTokenMap` for this network. Each option shows the symbol, whether it's native or a token (short contract address), and the user's balance. Options the vendor or key doesn't allow are disabled, and a tooltip gives the reason.
- **Amount:** a fiat amount in `USD` or `GHS`. The backend sets the crypto amount; the console never computes it.
- **Preset:** Happy path, or one of the [failure presets](#failure-presets).
- **Pre-flight checklist**, shown right above the button. Each line is ✓ or ✗ with a fix-it link:
  - Vendor validated
  - Network enabled for vendor
  - Key scope covers network and token
  - Wallet connected and on the right chain
  - Enough gas
  - Enough token balance. This is estimated as fiat amount ÷ the last quote price, and confirmed after `quote()` against `totalBaseUnits`.
  - Stellar only: the payer has a USDC trustline, and so does the vendor's wallet (checked through Horizon). Without the vendor's trustline, the transfer fails on-chain.
- **Run payment on {Network}:** disabled until the checklist passes, unless a failure preset is chosen, because presets are meant to fail. During a run it turns into **Cancel run**, which stops polling but can't undo anything already submitted.

### 4. Run timeline

There's one row per SDK call. Each row shows its state icon, the method name, how long it took and a one-line summary. The `onStatus(title, detail)` messages from `pay()` stream in as indented sub-lines (for example "Approving USDC…", "Waiting for wallet signature…", "Submitted 0x4be2…"). Clicking a row opens it in the Inspector. Rows of a finished run stay until the next run starts.

### 5. Inspector

Three tabs for the selected step: **Request** (the arguments), **Response** (the returned object as formatted, collapsible JSON) and **Error**.

For a `KwesPayError`, the Error tab shows `code`, `message`, `cause` and a *What to check* hint:

| Code                                                     | What to check                                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `INVALID_KEY`                                          | The key is revoked or expired, or it doesn't cover this vendor/network/token                     |
| `MERCHANT_NOT_FOUND`                                   | The vendor ID is wrong or the vendor is inactive                                                 |
| `NETWORK_NOT_ENABLED`                                  | The vendor hasn't enabled this network, or has no wallet for this ecosystem                      |
| `TOKEN_NOT_SUPPORTED`                                  | The token isn't configured on the backend or allowed by the contract on this network             |
| `QUOTE_EXPIRED` / `QUOTE_USED` / `QUOTE_NOT_FOUND` | The quote is past its 10-minute TTL, was already used, or the ID is wrong. Request a new one     |
| `WRONG_NETWORK`                                        | The EVM wallet is on a different chain ID than the selected network. Use**Switch network** |
| `APPROVAL_REJECTED`                                    | EVM ERC-20 approval was declined in the wallet                                                   |
| `WALLET_REJECTED`                                      | The user declined the payment signature                                                          |
| `INSUFFICIENT_BALANCE`                                 | The payer can't cover`totalBaseUnits` plus gas. Use **Get test tokens**                  |
| `CONTRACT_ERROR`                                       | The contract rejected the signature, deadline, contract address or token                         |
| `NETWORK_ERROR`                                        | The backend or the chain RPC is unreachable                                                      |
| `TRANSACTION_FAILED`                                   | Simulation or submission failed. Check the inner`cause`                                        |
| `UNKNOWN`                                              | A non-`KwesPayError` was thrown. The stack trace is shown                                      |

Redaction: the API key is always masked, and `backendSignature` is cut to its first and last 6 characters. The **Show raw** toggle shows the full signature, but never the API key.

### 6. Status tracker

- A list of status changes with timestamps, from `pollTransactionStatus`: `pending → processing → completed | failed | expired | underpaid | overpaid`.
- A deadline countdown whose units depend on the chain (see [Chain differences](#chain-differences-the-ui-must-handle)). It turns amber under 2 minutes and red once expired.
- An explorer link once the hash is known.
- If the status stays at `processing` for more than 3 minutes after an on-chain success, it shows "Backend hasn't matched this transaction yet. The listener may be behind." It also shows the raw on-chain status, so the developer can tell a backend problem from a chain problem.

### 7. Evidence card

Appears once a run reaches a final status. See [Evidence and logs](#evidence-and-logs).

### Session history

A horizontal strip of every run in this browser session, labelled network + asset + result. Clicking one restores its timeline, Inspector data and evidence. It's kept in `sessionStorage`, and a **Clear** button empties it. This is what makes it quick to switch chains and compare results.

### Empty, loading and error states

| Situation                   | What the user sees                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| No API key yet              | Setup panel focused. Other panels dimmed with "Add your API key and vendor ID to start"                                     |
| Key invalid                 | Inline red error under the key field with the`INVALID_KEY` hint. Network chips stay neutral                               |
| Endpoint unreachable        | Red health dot. A banner says "Can't reach {endpoint}", with a Retry button                                                 |
| Mainnet endpoint entered    | Blocking inline error. Nothing else loads                                                                                   |
| Wallet extension missing    | The row shows "Install Freighter ↗" / "Install a Sui wallet ↗" / "No EVM wallet found. Use WalletConnect"                 |
| Network disabled for vendor | The Payment panel replaces the asset list with the reason and a link to the dashboard                                       |
| Chain RPC down              | Wallet balances show "—" with a tooltip giving the RPC error. Runs are still allowed, and the SDK reports`NETWORK_ERROR` |

---

## KwesPay UI guidelines

These come from the merchant dashboard (`kwepapp/my-app`), so the console looks like the same product. Any AI or developer working on the console UI should follow them. If a rule here and the dashboard disagree, the dashboard wins, and this section should be updated.

### Brand and colour

| Token (CSS variable → Tailwind class) | Light | Dark | Use |
|---|---|---|---|
| `--kp-brand` → `bg-brand`, `text-brand` | `#2563eb` | `#2563eb` | Primary actions, links, the selected network chip, focus rings |
| `--kp-brand-hover` → `hover:bg-brand-hover` | `#1d4ed8` | `#1d4ed8` | Hover and pressed state of primary actions |
| `--kp-bg` → `bg-bg` | `#ffffff` | `#02040a` (obsidian) | Page background |
| `--kp-surface` → `bg-surface` | `#f8fafc` | `#020617` (navy-deep) | Panels, cards, sidebar |
| `--kp-surface-2` → `bg-surface-2` | `#f1f5f9` | `#0f172a` | Inputs, code blocks, hovered rows |
| `--kp-border` → `border-border` | `#e2e8f0` | `#1e293b` | All borders and dividers. Dashboard equivalents are `slate-100` and `slate-800/60` |
| `--kp-text` → `text-text` | `#0f172a` | `#e2e8f0` | Body text |
| `--kp-text-muted` → `text-muted` | `#64748b` | `#94a3b8` | Labels, hints, timestamps |
| `--kp-ok` / `--kp-warn` / `--kp-error` | `#16a34a` / `#d97706` / `#dc2626` | same | Status only: completed, waiting/low, failed |

- The tokens are already defined in `console/app/globals.css` (`:root`, a dark override, and a `@theme inline` block for Tailwind v4). Use the token classes, never raw hex values in components.
- Blue is the only accent. Don't introduce new brand colours. The dashboard's `neon-cyan` and `elite-violet` are for marketing visuals only, never for console UI.
- Dark mode follows the system setting, and the header toggle sets `data-theme="light|dark"` on `<html>`. Every component must look right in both.

### Typography

- **Inter** for all UI text (loaded with `next/font`, the `font-sans` class). **Geist Mono** (`font-mono`) for addresses, hashes, amounts in base units, JSON and logs.
- **Section labels:** `text-[10px] font-semibold uppercase tracking-widest text-muted`, like the dashboard sidebar group labels.
- **Body:** `text-sm` (13–14 px). **Panel titles:** `text-sm font-semibold tracking-tight`. Never larger than `text-lg` inside the console; this is a tool, not a landing page.
- Numbers that line up (amounts, durations) use `tabular-nums`.

### Character

The console is a developer workbench, not a marketing dashboard. Aim for precise, dense, quiet and technical, in the spirit of Stripe's developer tools, GitHub Actions, Vercel deployment details and browser devtools, without copying any of them. Information hierarchy is the main visual idea, not decoration. When choosing between a visual flourish and clearer data, always choose clearer data.

### Shape, spacing and elevation

- **One continuous shell:** sections are separated by 1 px rules (`border-border`), not floated as cards. Section headers are 36 px tall with a subtle number (`1  Setup`), a title and optional muted metadata.
- **Radius is small and practical:** 3–4 px on controls (`--radius-sm` / `--radius-md`). No large rounded cards, no rounded icon containers, no pills unless there's a real reason.
- **No shadows** in the workspace. The only raised surface is the faucet drawer, marked by a border.
- **Selection is shown with surface contrast** (`bg-selected`), type weight, or a 2 px bottom rule (network bar, tabs). Never use a coloured left edge.
- **Desktop grid:** left column 35–38 % (setup, wallet, payment), right column 62–65 % (timeline, inspector). Status and Evidence follow in the same proportions, then Session and Log run full width.
- **Gutters:** 16 px on phones. No horizontal page scroll at 360 px. Long hashes, JSON and logs scroll inside their own region.

### Buttons

- Rectangular and compact: `h-7 px-2.5 text-[12px]` (`md`: `h-8 px-3.5 text-[13px]`), `rounded-[var(--radius-sm)]`, sentence case, `font-medium`.
- **Primary:** `bg-brand text-white hover:bg-brand-hover`. Use one per area (Run payment, Mint).
- **Secondary:** `border border-border-strong bg-surface hover:bg-hover`.
- **Ghost / text actions:** muted text that turns `text-text` on hover. Use these for Copy, Edit, Clear and Close.
- No gradients, no glow, and no scale or spring animation. Transitions are 100–160 ms colour changes only.

### Status and fiat conversion

- Status marks are glyphs plus colour, never colour alone: `✓` ok, `●` running, `○` waiting, `✕` failed, `—` skipped.
- **Fiat conversion is a first-class element, not a footnote.** The Payment panel shows a *Fiat conversion* block before the Run button: the fiat amount → total charged, the rate with its source and snapshot time, merchant amount, platform fee (with %), customer pays (each with base units), and the USD/GHS equivalent. Every crypto amount elsewhere (asset balances, timeline quote summary, Evidence, faucet drawer) carries its fiat equivalent next to it.

### Inputs

- Labels sit in a fixed 88 px column to the left of the field (`text-[12px] text-muted`), so forms read like a settings table.
- Field: `h-7 w-full rounded-[var(--radius-sm)] border border-border-strong bg-bg px-2 text-[12.5px]`, `font-mono` for addresses, keys and amounts, `focus:border-brand focus:outline-none`. These are compact developer-tool controls, not 44–48 px consumer form fields.
- Inline error or warning under the field: `mt-1 text-[12px] text-error` / `text-warn`.
- Leading icons sit at `left-4` inside the field, as in the dashboard `Input`.

### Icons

- Material Symbols Outlined, the same icon font as the dashboard (`<span className="material-symbols-outlined">`). Use outlined icons by default; use filled only for an active state.
- Network and token logos come from the shared logo URLs in the widget config, not from new assets.

### Callouts

- A warning is one line of `text-warn` next to the thing it's about (key scope, low gas, wrong chain). Don't use a coloured panel.
- The TESTNET label in the header is an environment marker: `border border-warn/45 text-warn font-mono text-[10px] uppercase`.

### Interaction and motion

- Anything clickable gets `cursor: pointer`, and disabled controls get `not-allowed` (the base rule is in `globals.css`, copied from the dashboard).
- Motion is short and functional: 150–200 ms, using the dashboard's `slide-in-from-top` / `slide-out-to-bottom` for toasts and drawers. Respect `prefers-reduced-motion`.
- Keyboard: every control is reachable by Tab, with a visible `focus-visible:ring-2 ring-brand/40`. The network bar supports arrow keys.

### Writing style

- Plain, short labels in sentence case: "Get test tokens", "Run payment on Base Sepolia". Use uppercase only where the button style applies it.
- Errors say what happened and what to do: "Wallet is on Ethereum Sepolia. Switch to Base Sepolia." Never show a raw stack trace outside the Inspector.
- Use the network's display name, never its key, in visible text (`Base Sepolia`, not `baseSepolia`). Keys appear only in JSON, logs and URLs.

### Don'ts

- No gradients, glows, glassmorphism, blur, gradient borders, neon crypto styling, sparkle or "AI" iconography, KPI cards, decorative charts, illustrations, or fake terminal chrome (the dashboard's `command-center` and `circuit-pattern` styles are for its login screen only).
- No new component library. Build from Tailwind plus small local components in `console/components/`, mirroring the dashboard's `Button`, `Input` and `Table`.
- No colour-only meaning, no text below 10 px, and no horizontal page scroll at 360 px wide.

---

## Test tokens (faucet panel)

Developers need gas plus the payment token on whichever network they pick. The panel opens as a side drawer from **Get test tokens** and always targets the selected network and the connected wallet for that ecosystem.

### What it offers per network

| Network             | Token                                                                                             | Source                            | What the console does                                                                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sepolia`         | **USDT (KwesPay Mock USDT)** `0x01aA0fA6F8Ce7a836b802BAEEBD527e459525f25`, 6 decimals | **KwesPay faucet** | Calls `faucet(amount)` from the dev's wallet. One click, the dev pays gas |
| `baseSepolia`     | **USDT (KwesPay Mock USDT)** `0x08d6367e9d07B5C9fD5F58E8B29228E7b48fb703`, 6 decimals | **KwesPay faucet** | Same |
| `polygonAmoy`     | **USDT (KwesPay Mock USDT)** `0x771040C8bd22C826f9e46a6375888F32FA884739`, 6 decimals | **KwesPay faucet** | Same |
| `arbitrumSepolia` | **USDT (KwesPay Mock USDT)** `0xEEBfE4Bb1C0D4b691424f5ef5197b080D3E4639c`, 6 decimals | **KwesPay faucet** | Same |
| `arbitrumSepolia` | **ARB (KwesPay Mock Arbitrum)** `0x15dd68a7a37d7edBf284b93Bc25d6b286d33fCc3`, 18 decimals | **KwesPay faucet** | Same |
| `mezoTestnet`     | **USDT (KwesPay Mock USDT)** `0xd16c9c341Bc15B5db7E25881893CA5a3117bB9A5`, 6 decimals | **KwesPay faucet** | Same |
| `liskTestnet`     | USDT (KwesPay Mock USDT) | **Pending** | Not deployed yet: the Lisk Sepolia RPC was down on 2026-10-12. Run `scripts/deploy-faucet-token.js --network liskTestnet` once it's back. Until then the drawer shows "No faucet available" |
| `baseSepolia`, `arbitrumSepolia` | USDC (Circle) | External | Link to `https://faucet.circle.com` with the address copied |
| `polygonAmoy`     | USDC `0x8B0180…94B4` ("Mock USDC (PoS)", third-party) | None | No faucet. Shown as "No faucet available" |
| `liskTestnet`     | LSK `0x8a21CF…FF6D` (bridged Lisk) | External | Link to the Lisk Sepolia faucet |
| `suiTestnet`      | USDC (Circle) | External | Link to Circle faucet |
| `stellarTestnet`  | XLM | Friendbot | One click: `GET https://friendbot.stellar.org?addr=<G…>`. No wallet signature needed |
| `stellarTestnet`  | USDC `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` (Circle SAC, 7 decimals) | Testnet DEX swap or Circle faucet | 1) **Add USDC trustline** if it's missing. 2) **Swap XLM → USDC**: a `pathPaymentStrictReceive` from the wallet to itself, signed in Freighter. Tested live on 2026-10-12: 5 USDC cost about 5.4 XLM. The Circle faucet link is offered as an alternative |
| every network       | Native gas (ETH / POL / BTC / SUI)                                                                | External                          | Link to the chain's official faucet. Sui uses`requestSuiFromFaucetV2` from `@mysten/sui/faucet` in one click                                                                                                                                                                       |

### KwesPay faucet tokens

The KwesPay test tokens use `MockUSDT` (source: `~/Downloads/newContract/contracts/MockUSDT.sol`), owned by deployer `0x6200cb821Fa0895ce7389a622A30eE3CE6D03D17`:

```solidity
function faucet(uint256 amount) external;          // anyone; amount in base units; max 10_000 × 10^decimals per call
function mint(address to, uint256 amount) external; // owner or approved minters only
function decimals() external view returns (uint8);
function balanceOf(address) external view returns (uint256);
```

Its constructor reverts on any chain ID outside the testnet allowlist (31337, 11155111, 84532, 80002, 421614, 4202, 31611), so it can never exist on a mainnet.

Every KwesPay Mock USDT above was deployed or checked on 2026-10-12. On each one, `faucet()` is open to any address, and the token is allowlisted on that network's payment contract (`supportedTokens(token) == true`), so a minted token can be used to pay straight away. The deploy script is `~/Downloads/newContract/scripts/deploy-faucet-token.js`. It's idempotent: it reuses an existing faucet token, allowlists it if needed, checks `faucet()`, and records the address in `deployments/<network>.json`. It must run with the payment contracts' owner key (`0x6200…3D17`, the backend's `TESTNET_BLOCKCHAIN_ADMIN_PRIVATE_KEY`).

**Faucet drawer UI for a KwesPay token:**

```
┌ Get test tokens · Mezo Testnet ──────────────────── ✕ ┐
│ To: 0x51a…9C2 (MetaMask)                               │
│                                                        │
│ BTC (gas)   0.0003   ⚠ low     [Open Mezo faucet ↗]    │
│ USDT        0.00               KwesPay faucet          │
│   Amount   [ 1,000 ] USDT   (max 10,000 per request)   │
│   [ Mint 1,000 USDT ]                                  │
│                                                        │
│ ✓ Minted 1,000 USDT · tx 0x9e1…  explorer ↗           │
└────────────────────────────────────────────────────────┘
```

Behaviour:

1. Read `decimals()` from the token. Never assume it. Default the amount to 1,000 and cap the input at 10,000.
2. Check the wallet is on the right chain (offer **Switch network**) and has gas. If gas is too low, disable **Mint** and point to the gas faucet first.
3. Send `faucet(amount × 10^decimals)` through the connected EIP-1193 wallet with `viem`'s `writeContract`. Show pending, then confirmed with the tx link, then refresh the balance.
4. Log a `faucet` line in the [log](#evidence-and-logs) with `"kind":"faucet"`, kept separate from payment runs.

### Faucet manifest

Faucet sources live in a single file, `src/faucet/manifest.ts`, keyed by `network + token address`:

```ts
type FaucetSource =
  | { kind: "kwespay-mock"; address: `0x${string}`; maxPerCall: number }
  | { kind: "stellar-friendbot" }
  | { kind: "stellar-dex"; asset: "USDC"; issuer: string; sac: string }
  | { kind: "sui-faucet" }
  | { kind: "external"; url: string; note?: string }
  | { kind: "none"; reason: string };
```

At startup the console compares the manifest's token addresses against what the backend reports for the vendor (`networkTokenMap`). If they differ, the drawer shows "Faucet token doesn't match the backend's token for this network", and **Mint** stays disabled. This stops developers minting a token the backend won't accept.

### Possible later addition: backend-assisted gas drip

Some developers won't have testnet gas. A later version could add `POST /faucet/drip` on the testnet backend, rate-limited per API key and per address, which sends a small amount of gas plus KwesPay mock tokens from a funded hot wallet. It isn't part of this spec: it needs a funded key on the server, abuse limits, and a decision from the team.

---

## SDK call sequence

The happy path is the same on every chain. Only the `pay()` parameter changes.

```ts
import { KwesPayClient, KwesPayError } from "@kwespay/client";

const client = new KwesPayClient({ apiKey, graphqlEndpoint });

await client.validateKey(vendorId);
const merchant = await client.getMerchantConfig(vendorId);

const payload = await client.quote({
  vendorIdentifier: vendorId,
  fiatAmount,
  fiatCurrency,
  cryptoCurrency: asset,
  network,
  payerWalletAddress: payer,
});

const result = await client.pay(payParamsFor(network, payload, timeline.push));

const final = await client.pollTransactionStatus(payload.transactionReference, {
  onStatus: tracker.push,
});
```

`payParamsFor` is the only chain-specific code in the run:

```ts
function payParamsFor(network: NetworkKey, payload: TransactionPayload, onStatus: OnStatus): PayParams {
  switch (ecosystemOf(network)) {
    case "evm":     return { provider: wallets.evm!,     payload, onStatus };
    case "sui":     return { wallet:   wallets.sui!,     payload, onStatus };
    case "stellar": return { wallet:   wallets.stellar!, payload, onStatus };
  }
}
```

`pay()` already reports the hash with `submitTransactionHash`. The timeline shows that as a sub-line of `pay` and doesn't call it a second time.

---

## Chain differences the UI must handle

|                          | EVM                                                                                           | Sui                                   | Stellar                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| Payer address            | `0x…` (20 bytes)                                                                           | `0x…` (32 bytes)                   | `G…` StrKey                                            |
| Wallet steps in`pay()` | ERC-20`approve` (skipped for native), then `createPayment`                                | One`signAndExecuteTransactionBlock` | One`signTransaction` (Soroban `create_payment`)       |
| `payload.deadline`     | Unix seconds                                                                                  | Unix seconds                          | **Ledger sequence number** (~5 s per ledger)        |
| Countdown shows          | `mm:ss` until the timestamp                                                                 | `mm:ss` until the timestamp         | ledgers left, plus an estimated time (`ledgers × 5 s`) |
| `result.blockNumber`   | Block number                                                                                  | Checkpoint                            | Ledger sequence                                           |
| Token decimals           | Per token (6 or 18)                                                                           | 9 (SUI), 6 (USDC)                     | 7 (XLM and USDC SAC)                                      |
| Platform fee             | 0.5% (50 bps)                                                                                 | 0.5% (50 bps)                         | **1% (100 bps)**                                    |
| Fee shown as             | `totalBaseUnits − amountBaseUnits` from the backend. Never computed from a local bps table | same                                  | same                                                      |
| Extra pre-flight checks  | Right chain ID                                                                                | —                                    | USDC trustline on both payer and vendor wallets           |

The fee is always taken from the backend's response. The rates in this table are only there to explain the numbers to the developer.

---

## Evidence and logs

### Evidence card

When a run reaches a final status, the console compares the SDK's values with the backend's record:

| Field                 | From the SDK (`quote` / `pay`) | From the backend (`getTransactionStatus`) |
| --------------------- | ---------------------------------- | ------------------------------------------- |
| Network               | `network`                        | `blockchainNetwork`                       |
| Transaction reference | `payload.transactionReference`   | `transactionReference`                    |
| Payment ID            | `payload.paymentIdBytes32`       | needs the backend to expose it (gap 1)      |
| Asset                 | `payload.tokenAddress` / symbol  | `cryptoCurrency`                          |
| Merchant amount       | `payload.amountBaseUnits`        | needs the backend to expose it (gap 1)      |
| Total paid            | `payload.totalBaseUnits`         | needs the backend to expose it (gap 1)      |
| Fee                   | `total − amount`                | needs the backend to expose it (gap 1)      |
| Tx hash               | `result.txHash`                  | `blockchainHash`                          |
| Final status          | —                                 | `transactionStatus` = `completed`       |

Each row shows ✓, ✗ (values differ, both shown) or `n/a` (field not exposed yet). **Export** downloads a redacted `evidence-<network>-<asset>-<ref>.json` and copies a Markdown summary to the clipboard.

### Log format

Each step writes one JSON line to the Log panel and to `console.info`, redacted the same way as the Inspector:

```json
{"ts":"2026-10-14T14:31:02.118Z","run":"r_01J…","kind":"payment","network":"baseSepolia","ecosystem":"evm","step":"quote","ok":true,"ms":611,"asset":"USDC","ref":"7f3c…","amountBaseUnits":"10000000","totalBaseUnits":"10050000"}
{"ts":"2026-10-14T14:31:19.402Z","run":"r_01J…","kind":"payment","network":"stellarTestnet","ecosystem":"stellar","step":"pay","ok":false,"ms":17284,"code":"WALLET_REJECTED","message":"User declined"}
{"ts":"2026-10-14T14:29:40.010Z","kind":"faucet","network":"mezoTestnet","token":"USDT","amount":"1000000000","tx":"0x9e1…","ok":true}
```

The log can be filtered by network, kind and status. **Copy JSONL** copies whatever is shown.

---

## Failure presets

Each preset sets up a known failure on **the currently selected network** and checks for the expected error code. **Run all presets** runs them on the selected network. **Run all presets on all enabled networks** builds a pass/fail grid (network × preset) and offers it for export.

| Preset               | How it's triggered                               | Expected                                     | Applies to   |
| -------------------- | ------------------------------------------------ | -------------------------------------------- | ------------ |
| Invalid key          | Random`pk_` key                                | `INVALID_KEY`                              | all          |
| Unknown vendor       | Random UUID as the vendor                        | `MERCHANT_NOT_FOUND`                       | all          |
| Network not enabled  | A network missing from`enabledNetworks`        | `NETWORK_NOT_ENABLED`                      | all          |
| Unsupported asset    | A token not in the vendor's map for this network | `TOKEN_NOT_SUPPORTED`                      | all          |
| Reused quote         | `pay()` twice with one payload                 | `QUOTE_USED`                               | all          |
| Expired quote        | Waits past the TTL before`pay()`               | `QUOTE_EXPIRED` or `CONTRACT_ERROR`      | all          |
| Wrong chain          | Wallet left on another chain ID                  | `WRONG_NETWORK`                            | EVM          |
| Approval rejected    | User rejects the ERC-20 approve                  | `APPROVAL_REJECTED`                        | EVM tokens   |
| Wallet rejects       | User rejects the payment signature               | `WALLET_REJECTED`                          | all          |
| Insufficient balance | Amount above the payer's balance                 | `INSUFFICIENT_BALANCE`                     | all          |
| Missing trustline    | Payer without a USDC trustline                   | `TRANSACTION_FAILED` or `CONTRACT_ERROR` | Stellar USDC |

Presets that need a user action (rejecting in the wallet) show a prompt telling the user what to click.

---

## Tech stack, project structure and deploy

### Stack

- **Next.js 16 (App Router) + React 19 + TypeScript**, the same versions as the dashboard.
- **Tailwind CSS v4** via `@tailwindcss/postcss`, configured CSS-first in `app/globals.css` (`@theme inline`). There's no `tailwind.config.ts`.
- **Static export only** (`output: "export"`). No API routes, no server actions, no middleware, no `next/image` optimisation. Everything runs in the browser, so it can be hosted on GitHub Pages.
- Wallet and chain libraries: `viem` (EVM), `@mysten/sui` + `@mysten/dapp-kit` or Wallet Standard (Sui), `@stellar/stellar-sdk` + `@stellar/freighter-api` (Stellar).
- State: one small store (`zustand`, as in the dashboard) for setup, wallets, selection, runs and history.
- `@kwespay/client` comes from `file:../kwespay-ts` (the local SDK build). A later `NEXT_PUBLIC_SDK_SOURCE=npm` build can switch it to the published package.

### Structure

The UI shell is in the repo with realistic mock data (`src/mock.ts`). It shows a running Base Sepolia USDC payment across every panel and builds to `console/out/` with `pnpm install && pnpm build`. The real SDK and wallets aren't wired up yet.

```
kwespay-ts/console/
├── package.json             # next, react, @kwespay/client (file:../kwespay-ts), tailwindcss v4
├── next.config.ts           # output: "export", basePath from NEXT_PUBLIC_BASE_PATH, trailingSlash
├── postcss.config.mjs
├── tsconfig.json            # "@/*" path alias
├── app/
│   ├── layout.tsx           # fonts (Inter, Geist Mono), <html data-theme>, providers
│   ├── page.tsx             # renders <Console />
│   └── globals.css          # KwesPay tokens + Tailwind v4 theme
├── components/              # primitives.tsx (Section, Button, StatusMark, CopyValue, FieldRow, Tag, KV), AppHeader, NetworkSelector,
│                            # SetupSection, WalletSection, PaymentSection, RunTimeline, Inspector (+JsonViewer), StatusSection,
│                            # EvidenceTable, SessionHistory, LogViewer, FaucetDrawer, Console (page composition)
└── src/
    ├── networks.ts          # display metadata per testnet
    ├── mock.ts              # mock session data (replace with live state)
    ├── store.ts             # zustand store
    ├── sdk/
    │   ├── client.ts        # builds KwesPayClient from setup state
    │   └── run.ts           # SDK call sequence + payParamsFor
    ├── wallets/
    │   ├── evm.ts           # EIP-1193 + WalletConnect, chain switching
    │   ├── sui.ts           # Wallet Standard
    │   └── stellar.ts       # Freighter adapter, trustline helper
    ├── faucet/
    │   ├── manifest.ts
    │   ├── kwespayMock.ts   # faucet(amount) via viem
    │   ├── stellar.ts       # friendbot, trustline, XLM→USDC path payment
    │   └── sui.ts
    └── log.ts               # JSONL logger + redaction
```

Rules for the static build:
- Every component that touches `window`, wallets or `sessionStorage` is a client component (`"use client"`), and anything wallet-related is loaded with `next/dynamic` and `ssr: false`, because export pre-renders pages at build time.
- Internal links and assets must work under a sub-path. Use `next/link` and relative asset paths, never hard-coded `/…` URLs, because the site is served from `/<repo>/` until a custom domain is set.
- Shareable state goes in the query string (`?network=baseSepolia&asset=USDT`) read on the client, not in dynamic routes.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_BASE_PATH` | empty | Sub-path the site is served from. The workflow sets it from GitHub Pages (`/Kwespay-sdk`). Leave empty for local dev and for a custom domain |
| `NEXT_PUBLIC_KWESPAY_ENDPOINT` | `https://api.testnet.kwespay.xyz/graphql` | Default endpoint shown in Setup. The endpoint guard still rejects mainnet hosts |

### Local development

```bash
cd kwespay-ts/kwespay-ts && pnpm install && pnpm build   # build the local SDK first
cd ../console && pnpm install && pnpm dev                # http://localhost:3000
pnpm build                                               # static export to console/out/
```

After changing the SDK, run `pnpm build` in `kwespay-ts/kwespay-ts` again. The console picks up the new `dist/` without reinstalling.

### Deploy to GitHub Pages

The workflow is `kwespay-ts/.github/workflows/console-pages.yml`. It runs on pushes to `main` that touch `console/**` or the SDK source, and it can be started by hand (**Actions → Deploy SDK Console → Run workflow**). It:

1. builds the SDK (`kwespay-ts/kwespay-ts`, `pnpm install --frozen-lockfile && pnpm build`)
2. builds the console with `NEXT_PUBLIC_BASE_PATH` taken from `actions/configure-pages`
3. uploads `console/out` and deploys it with `actions/deploy-pages`

One-time setup in the `ArthurEmma2/Kwespay-sdk` repo:
1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Merge to `main`, or run the workflow by hand. The site appears at `https://arthuremma2.github.io/Kwespay-sdk/`.
3. Optional custom domain (e.g. `console.kwespay.xyz`): add a `CNAME` DNS record pointing to `arthuremma2.github.io`, set the domain under **Settings → Pages**, and add `console/public/CNAME` containing the domain. With a custom domain, `configure-pages` returns an empty base path, so no code change is needed.

Note: a GitHub repo can only publish one Pages site. If the SDK repo already publishes something else to Pages, this workflow replaces it.

---

---

## Keeping network config in sync

Network and token config used to be copied by hand into the backend, SDK, widget and dashboard. Since 2026-10-12:

1. **The backend is the only source of payment terms.** `createTransaction` returns `contractAddress` (EVM contract, Sui package ID or Stellar contract ID) and `registryObjectId` (Sui) together with the signature. The SDK uses those values first and falls back to its local table only for an older backend. This was proven on Stellar Testnet by deliberately configuring a wrong local contract ID: both an XLM and a USDC payment still went to the backend's contract and completed. Token addresses and amounts were already backend-supplied. So a contract redeploy or a new token now only needs a backend config change for payments to work.
2. **Everything else is checked automatically.** `Backend/scripts/check_config_drift.py` compares the SDK's `src/internal/config.ts`, the widget's `src/config/constants.js` and the dashboard's token maps with the backend's `settings.py` (contract addresses, chain IDs, Sui objects, Stellar contract IDs, token addresses and decimals, mainnet and testnet). With `--onchain`, it also checks that every token the backend offers is allowlisted on that network's payment contract. It exits non-zero on any mismatch. Mezo is skipped by default (`DRIFT_SKIP`).

```bash
cd Backend && venv/bin/python scripts/check_config_drift.py --onchain
```

The console follows the same rule: it never stores payment contract addresses, and its display metadata (`src/networks.ts`) is display-only.

---

## Known issues

Checked against live chains and code on 2026-10-12.

**Fixed on 2026-10-12**
- **Token decimals were taken by symbol only.** The backend now resolves decimals per network (`CRYPTO_ONCHAIN_DECIMALS_BY_NETWORK`, `app_config.onchain_decimals(symbol, network)`). Stellar USDC (7 decimals) had been priced as 6, so every Stellar USDC payment charged 10 times too little. A live $1 payment now charges 1 USDC. `scripts/test.py` has a live test that compares every EVM testnet token's on-chain `decimals()` with the backend.
- **Third-party and missing testnet tokens.** Sepolia USDT (third-party, 18 decimals) and Polygon Amoy USDT (`0x2c85…`, no contract at all) were replaced with KwesPay Mock USDT. Mock USDT was also added on Base Sepolia and Arbitrum Sepolia. The backend, widget and dashboard all point at the new addresses.
- **The widget's Sepolia list** had a "USDC" entry pointing at the MUSD contract. It now lists ETH, MUSD and USDT, matching the backend.
- **The backend's Polygon Amoy RPC** (`rpc-amoy.polygon.technology`) no longer resolves. The backend now uses `polygon-amoy-bor-rpc.publicnode.com`.
- **Contract IDs came from the SDK's local config.** They now come from the backend (see above).

**Open**
1. **Four mainnet tokens are offered by the backend but not allowlisted on-chain:** DAI on Ethereum, USDC and USDC.e on Polygon, and USDbC on Base. A merchant who accepts one gets a valid quote, and the customer's payment then reverts with "Token unsupported". Decide whether to allowlist them on the mainnet contracts or remove them from the backend's `SUPPORTED_CURRENCIES`. `check_config_drift.py --onchain` reports them until then.
2. **Lisk Sepolia faucet token not deployed yet.** The official Lisk Sepolia RPC was down, so there's no Lisk Mock USDT yet. Re-run the deploy script, then add the address to the backend, widget and dashboard (the drift checker will flag any copy you miss).
3. **Mezo testnet** (left for later): the backend's MUSD address there has no contract, and there are two Mock USDT deployments (`0xd16c…` used by the backend, `0xbA5e…` in the deploy record).
4. **`getTransactionStatus` doesn't return base-unit amounts or `paymentIdBytes32`.** The backend stores them already. Expose them on GraphQL `TransactionType` and the SDK's `TransactionStatusResult`, so the Evidence card can show ✓ instead of `n/a`.
5. **Stellar USDC needs trustlines on three accounts:** payer, vendor wallet and the contract's `fee_recipient`. The testnet fee recipient's trustline was added on 2026-10-12. The console checks payer and vendor in pre-flight.
6. **Deploy order for the payment-target change:** the SDK now requests `contractAddress` and `registryObjectId`. Deploy the backend change to `api.kwespay.xyz` **before** publishing the next SDK version, or the SDK's `createTransaction` query will fail against the old backend.

---

## Instawards SOW mapping

The console works on every chain. The sprint's evidence is the Stellar Testnet run.

| SOW requirement                                                                               | Where the console covers it                                                   |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Initiate SDK payments on Testnet                                                              | Network bar → Payment panel → Run timeline, with`stellarTestnet` selected |
| Inspect responses and errors                                                                  | Inspector                                                                     |
| Trace transaction status                                                                      | Status tracker                                                                |
| One confirmed payment per asset (XLM, USDC) matched against backend IDs, amounts and statuses | Evidence card, one export per asset                                           |
| Test successful and failed flows                                                              | Failure presets on`stellarTestnet`                                          |
| Structured logs                                                                               | JSONL log                                                                     |

---

## Done when

- [ ] A payment reaches `completed` from the console on **at least one network in each ecosystem** (one EVM, Sui Testnet and Stellar Testnet). Each Evidence card is all ✓ once gap 5 is closed.
- [ ] Switching between those networks takes no more than selecting a chip and connecting the matching wallet once. Key, vendor and amount are kept.
- [ ] A developer with only testnet gas can mint KwesPay Mock USDT on every EVM testnet (and Mock ARB on Arbitrum Sepolia) from the faucet drawer, plus get XLM and USDC on Stellar Testnet, without leaving the console.
- [ ] `check_config_drift.py --onchain` passes, apart from items listed under Known issues.
- [ ] Every failure preset returns its expected code on the networks it applies to.
- [ ] The console runs against the **published** `@kwespay/client`, not just the local build.
- [ ] It's deployed at a public URL, and mainnet can't be reached from the UI.
- [ ] Stellar XLM and USDC evidence JSON and JSONL logs are exported for the SOW.
