# BAB Orbit Deployment Runbook (No Node.js)

This runbook is designed so you can deploy using only browser tools.

## What is already done

- Token contracts are prepared.
- Team vesting contract is prepared.
- Legal/risk template is prepared.

## What still requires you (cannot be automated by me)

- Connecting your wallet in MetaMask.
- Signing deployment transactions.
- Paying testnet/mainnet gas fees.
- Final legal sign-off by counsel.

## Pre-Deployment Inputs

- Network for testing: Polygon Amoy
- Network for launch: Polygon Mainnet
- Admin wallet: [YOUR_METAMASK_ADDRESS] ← paste your MetaMask address here
- Treasury wallet: [YOUR_METAMASK_ADDRESS] ← same address as admin for now
- Team beneficiary wallet: [YOUR_METAMASK_ADDRESS] ← same address (you receive all tokens)
- Vesting start timestamp (unix): 1743120000 (March 28, 2026 — today)
- Vesting duration (seconds): 86400 (1 day — upgrade to 2592000 for 30 days when ready)

How to get your MetaMask address:

  1. Install MetaMask from <https://metamask.io>
  2. Create wallet and store seed phrase offline on paper
  3. Copy address shown at top of MetaMask (starts with 0x)
  4. Paste it above in all three wallet fields

## A. Testnet Deployment Steps

1. Open <https://remix.ethereum.org>
2. Create folder `contracts` and paste one contract at a time from local files.
3. Compile with Solidity `0.8.24`.
4. In Deploy & Run:
   - Environment: Injected Provider - MetaMask
   - Network: Polygon Amoy
5. Deploy chosen token model (SELECTED: Capped mintable):
   - File: `remix/BABOrbitTokenRemix.sol`
   - Constructor arg 1 — admin: [YOUR_METAMASK_ADDRESS]
   - Constructor arg 2 — treasury: [YOUR_METAMASK_ADDRESS]
6. Copy token contract address into your records.
7. Deploy vesting:
   - File: `remix/BABOrbitTeamVestingRemix.sol`
   - beneficiary: [YOUR_METAMASK_ADDRESS]
   - startTimestamp: 1743120000
   - durationSeconds: 86400
   - tokenAddress: [PASTE token contract address from step 6]
8. Transfer team allocation from treasury to vesting contract.
   - Recommended team allocation: 150,000,000 ORBT (15% of total supply)

## B. Testnet Validation Checklist

- Name and symbol are correct: BAB Orbit / ORBT
- Decimals is 18
- Total supply expectations match model
- Mint control works (if using capped mintable)
- Mint cap enforcement reverts correctly
- Vesting contract receives tokens
- `releasableTokenAmount()` behaves as expected over time
- `releaseToken()` releases only vested amount

## C. Mainnet Readiness Gate

- Legal counsel signed off disclosure
- No unresolved critical security findings
- Admin set to multisig (not personal wallet)
- Treasury controls documented
- Incident response contacts prepared

## D. Mainnet Launch Steps

1. Switch MetaMask to Polygon Mainnet.
2. Repeat deployment steps from testnet with final addresses.
3. Record contract addresses in deployment record template.
4. Update public docs with live addresses.
5. Announce only utility use-cases (no return promises).

## E. Post-Launch Ops (Weekly)

- Review token transfer activity
- Monitor abuse/fraud patterns
- Reconcile treasury movements
- Track retention and redemption KPIs
- Update risk disclosures when policy changes
