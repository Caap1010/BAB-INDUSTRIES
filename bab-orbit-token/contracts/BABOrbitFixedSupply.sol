// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract BABOrbitFixedSupply is ERC20, ERC20Burnable {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10 ** 18;

    constructor(address treasury) ERC20("BAB Orbit", "ORBT") {
        require(treasury != address(0), "treasury is zero");
        _mint(treasury, TOTAL_SUPPLY);
    }
}
