// SPDX-License-Identifier: MIT
// Sepolia demo token only. Do not use for real funds.
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract VestaDemoToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 ether;

    error MaxSupplyExceeded(uint256 amount, uint256 maxSupply);

    constructor() ERC20("VESTA Demo Token", "VESTA") Ownable(msg.sender) {}

    function mint(address recipient, uint256 amount) external onlyOwner {
        if (amount > MAX_SUPPLY - totalSupply()) {
            revert MaxSupplyExceeded(amount, MAX_SUPPLY);
        }
        _mint(recipient, amount);
    }
}
