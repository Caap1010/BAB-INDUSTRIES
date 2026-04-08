// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/finance/VestingWallet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract BABOrbitTeamVesting is VestingWallet {
    IERC20 public immutable token;

    constructor(
        address beneficiary,
        uint64 startTimestamp,
        uint64 durationSeconds,
        address tokenAddress
    ) VestingWallet(beneficiary, startTimestamp, durationSeconds) {
        require(tokenAddress != address(0), "token is zero");
        token = IERC20(tokenAddress);
    }

    function releasableTokenAmount() external view returns (uint256) {
        return releasable(address(token));
    }

    function releaseToken() external {
        release(address(token));
    }
}
