# BAB Orbit (ORBT) - No Node.js Setup

This setup is made for devices where you cannot install Node.js.
You can compile and deploy using Remix in your web browser.

## 1. Open Remix

- Go to: <https://remix.ethereum.org>

## 2. Create the contract file

- In Remix File Explorer, create folder `contracts`.
- Create file `contracts/BABOrbitToken.sol`.
- Copy contents from local file:
  - `bab-orbit-token/contracts/BABOrbitToken.sol`

## 3. Install OpenZeppelin in Remix

Use one of these methods:

- Method A (recommended):
  - In Remix, open Plugin Manager.
  - Enable "Solidity Compiler" and "Deploy & Run Transactions" (usually enabled).
  - In file imports, Remix should auto-fetch `@openzeppelin/...` imports from npm gateway.
- Method B (if auto-fetch fails):
  - Replace imports with GitHub raw import paths for OpenZeppelin v5.

## 4. Compile

- Compiler version: `0.8.24`.
- Turn on auto-compile or click Compile.

## 5. Deploy on testnet first

- In Deploy & Run, Environment: `Injected Provider - MetaMask`.
- Connect MetaMask to Polygon Amoy testnet.
- Constructor args:
  - `admin`: your multisig or your wallet address for testing.
  - `treasury`: treasury wallet address.
- Deploy.

## 6. Basic post-deploy checks

- Confirm token name/symbol: `BAB Orbit`, `ORBT`.
- Confirm initial treasury balance has mint amount.
- Try `mint` from admin account.
- Try mint beyond max supply and confirm revert.
- Revoke minter when ready for stricter control.

## 7. Mainnet safety before launch

- Use multisig for admin.
- Freeze mint policy if you want a hard cap in practice.
- Publish token utility terms and risk disclosures.
- Run independent audit before public launch.

## Contract notes

- Max supply is capped at 1,000,000,000 ORBT.
- Initial mint is 300,000,000 ORBT to treasury.
- Admin gets DEFAULT_ADMIN_ROLE and MINTER_ROLE.
- Burn is enabled for token holders.

## Added files

- `contracts/BABOrbitToken.sol`:
  - Capped-supply token with role-based minting and burn support.
- `contracts/BABOrbitFixedSupply.sol`:
  - Non-mintable fixed-supply token (full supply minted at deployment).
- `contracts/BABOrbitTeamVesting.sol`:
  - Team vesting wallet using OpenZeppelin VestingWallet.
- `docs/legal-risk-disclosure-template.md`:
  - Plain-language legal and risk disclosure template for counsel review.
- `deployment/runbook.md`:
  - End-to-end operator checklist for testnet and mainnet launch.
- `deployment/deployment-record-template.md`:
  - Fillable record for addresses, tx hashes, and sign-offs.
- `remix/BABOrbitTokenRemix.sol`:
  - Capped-supply token with direct GitHub imports for Remix.
- `remix/BABOrbitFixedSupplyRemix.sol`:
  - Fixed-supply token with direct GitHub imports for Remix.
- `remix/BABOrbitTeamVestingRemix.sol`:
  - Vesting contract with direct GitHub imports for Remix.

## Fastest path (recommended)

1. Use the files in `remix/` for browser compilation.
2. Follow `deployment/runbook.md` exactly.
3. Log all results in `deployment/deployment-record-template.md`.
4. Finalize and publish `docs/legal-risk-disclosure-template.md` after counsel review.

## Deploy options in Remix

1. Capped mintable model:
   - Deploy `BABOrbitToken.sol` with `admin` and `treasury` constructor args.
2. Fixed supply model:
   - Deploy `BABOrbitFixedSupply.sol` with `treasury` constructor arg.
3. Team vesting wallet:
   - Deploy `BABOrbitTeamVesting.sol` with:
     - `beneficiary`
     - `startTimestamp` (unix seconds)
     - `durationSeconds`
     - `tokenAddress` (deployed ORBT token contract)
   - Transfer team allocation tokens to vesting contract address.
   - Beneficiary can call `releaseToken()` over time.
