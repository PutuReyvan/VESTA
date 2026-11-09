// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Deterministic local-only token used by foundation tests.
/// @dev Member 5 may add separate adversarial mocks. Do not use this token for Sepolia.
contract MockERC20 is ERC20 {
    constructor() ERC20("VESTA Demo Token", "VESTA") {}

    /// @notice Mints test tokens without access control on the local chain.
    /// @dev This is intentionally unsafe for tests and must not be treated as production token code.
    function mint(address recipient, uint256 amount) external {
        _mint(recipient, amount);
    }
}
