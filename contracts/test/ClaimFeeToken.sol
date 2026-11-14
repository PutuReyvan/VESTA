// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Adversarial fixture: funding is fee-free, claims underpay recipients.
contract ClaimFeeToken is ERC20 {
    // solhint-disable-next-line immutable-vars-naming
    address public immutable feeExemptSender;
    address public constant FEE_RECEIVER = address(0xFEE);

    constructor(address feeExemptSender_) ERC20("Claim Fee Token", "CFT") {
        feeExemptSender = feeExemptSender_;
    }

    function mint(address recipient, uint256 amount) external {
        _mint(recipient, amount);
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (from != address(0) && from != feeExemptSender && to != address(0)) {
            uint256 fee = amount / 100;
            super._update(from, to, amount - fee);
            super._update(from, FEE_RECEIVER, fee);
            return;
        }
        super._update(from, to, amount);
    }
}
