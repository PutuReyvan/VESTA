// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Local-only adversarial token that reports a failed transfer.
contract FalseReturnToken is ERC20 {
    constructor() ERC20("False Return Token", "FRT") {}

    function transferFrom(
        address,
        address,
        uint256
    ) public pure override returns (bool) {
        return false;
    }
}
