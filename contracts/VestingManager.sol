// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVestingManager} from "./interfaces/IVestingManager.sol";

/// @title VESTA Vesting Manager
/// @notice Foundation contract for one-token, one-admin vesting deployments.
/// @dev This file intentionally contains seams and explicit stubs. Members 2 and 3
///      replace the stubs with tested behavior without changing the public interface casually.
contract VestingManager is IVestingManager {
    /// @notice Temporary foundation error so unfinished paths fail visibly.
    error NotImplemented();

    /// @notice ERC-20 configured for this deployment; never changes after construction.
    address public immutable override token;

    /// @notice Organization/admin wallet for batch creation.
    address public immutable override admin;

    /// @notice Next schedule ID. Member 2/3 increment it when schedules are created.
    uint256 public override nextScheduleId;

    /// @param tokenAddress The one ERC-20 accepted by this deployment.
    constructor(address tokenAddress) {
        token = tokenAddress;
        admin = msg.sender;
    }

    // Member 3 owns batch creation and its validation, funding, events, and rollback tests.
    // Expected caller flow: token.approve(address(this), total) -> createBatch(...).
    function createBatch(
        address,
        address[] calldata,
        uint256[] calldata,
        uint64[] calldata,
        uint64[] calldata,
        uint64[] calldata
    ) external pure override {
        revert NotImplemented();
    }

    // Members 2 and 3 own schedule storage, vesting math, and claim behavior.
    // Frontend read flow: getBeneficiarySchedules(account) -> getSchedule(id)
    // -> vestedAmount(id) -> claimableAmount(id).
    function getSchedule(uint256) external pure override returns (Schedule memory) {
        revert NotImplemented();
    }

    function getBeneficiarySchedules(address) external pure override returns (uint256[] memory) {
        revert NotImplemented();
    }

    function vestedAmount(uint256) external pure override returns (uint256) {
        revert NotImplemented();
    }

    function claimableAmount(uint256) external pure override returns (uint256) {
        revert NotImplemented();
    }

    function claim(uint256) external pure override {
        revert NotImplemented();
    }
}
