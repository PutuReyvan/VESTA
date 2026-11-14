// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Local-only adversarial token that attempts to re-enter claim.
contract ReentrantClaimToken is ERC20 {
    address public manager;
    uint256 public scheduleId;
    bool public attackEnabled;
    bool public attackAttempted;
    bool public reentrySucceeded;

    constructor() ERC20("Reentrant Claim Token", "RCT") {}

    function configure(address manager_, uint256 scheduleId_) external {
        manager = manager_;
        scheduleId = scheduleId_;
    }

    function mint(address recipient, uint256 amount) external {
        _mint(recipient, amount);
    }

    function enableAttack() external {
        attackEnabled = true;
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (
            attackEnabled &&
            !attackAttempted &&
            from == manager &&
            to != address(0)
        ) {
            attackAttempted = true;
            // solhint-disable-next-line avoid-low-level-calls
            (reentrySucceeded, ) = manager.call(
                abi.encodeWithSignature("claim(uint256)", scheduleId)
            );
        }

        super._update(from, to, amount);
    }
}
