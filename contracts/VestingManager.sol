// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVestingManager} from "./interfaces/IVestingManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title VESTA Vesting Manager
/// @notice Foundation contract for one-token, one-admin vesting deployments.
/// @dev This file intentionally contains seams and explicit stubs. Members 2 and 3
///      replace the stubs with tested behavior without changing the public interface casually.
contract VestingManager is IVestingManager, ReentrancyGuard {
    using SafeERC20 for IERC20;

    mapping(uint256 => Schedule) internal schedules;
    mapping(address => uint256[]) internal beneficiaryScheduleIds;

    /// @notice Temporary foundation error so unfinished paths fail visibly.
    error NotImplemented();
    error InvalidScheduleId(uint256 scheduleId);
    error Unauthorized();
    error NothingToClaim();

    event Claimed
    (
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 amount
    );

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
    function getSchedule(uint256 scheduleId) external view override returns (Schedule memory) {
        return _getSchedule(scheduleId);
    }

    function _getSchedule(uint256 scheduleId) internal view returns (Schedule storage schedule)
    {
        if(scheduleId >= nextScheduleId)
        {
            revert InvalidScheduleId(scheduleId);
        }

        schedule = schedules[scheduleId];
    }

    function getBeneficiarySchedules(address beneficiary) external view override returns (uint256[] memory) {
        return beneficiaryScheduleIds[beneficiary];
    }

    function vestedAmount(uint256 scheduleId) public view override returns (uint256) {
        return _vestedAmount(_getSchedule(scheduleId));
    }

    function _vestedAmount(Schedule storage schedule) internal view returns (uint256)
    {
        uint256 start = uint256(schedule.start);
        uint256 cliffEnd = start + uint256(schedule.cliff);
        uint vestingEnd = start + uint256(schedule.duration);
        uint256 nowTime = block.timestamp;

        if(nowTime < start || nowTime < cliffEnd)
        {
            return 0;
        }

        if(nowTime >= vestingEnd)
        {
            return schedule.allocation;
        }

        uint256 elapsed = nowTime - start;

        return (schedule.allocation * elapsed) / uint256(schedule.duration);
    }

    function claimableAmount(uint256 scheduleId) public view override returns (uint256) {
        Schedule storage schedule = _getSchedule(scheduleId);
        uint256 vested = _vestedAmount(schedule);

        if(vested <= schedule.released)
        {
            return 0;
        }

        return vested - schedule.released;
    }

    function claim(uint256 scheduleId) external override nonReentrant{
        Schedule storage schedule = _getSchedule(scheduleId);

        if(msg.sender != schedule.beneficiary)
        {
            revert Unauthorized();
        }

        uint256 amount = claimableAmount(scheduleId);

        if(amount == 0)
        {
            revert NothingToClaim();
        }

        schedule.released += amount;

        IERC20(token).safeTransfer(schedule.beneficiary, amount);

        emit Claimed(scheduleId, schedule.beneficiary, amount);
    }
}
