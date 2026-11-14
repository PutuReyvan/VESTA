// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVestingManager} from "./interfaces/IVestingManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title VESTA Vesting Manager
contract VestingManager is IVestingManager, ReentrancyGuard {
    using SafeERC20 for IERC20;

    mapping(uint256 => Schedule) internal schedules;
    mapping(address => uint256[]) internal beneficiaryScheduleIds;

    // Public names intentionally match the IVestingManager getter ABI.
    // solhint-disable-next-line immutable-vars-naming
    address public immutable override token;
    // solhint-disable-next-line immutable-vars-naming
    address public immutable override admin;
    uint256 public override nextScheduleId;

    constructor(address tokenAddress) {
        token = tokenAddress;
        admin = msg.sender;
    }

    // =========================================================================
    // ATOMIC BATCH & ON-CHAIN LIFECYCLE
    // =========================================================================

    function createBatch(
        address tokenAddress,
        address[] calldata beneficiaries,
        uint256[] calldata allocations,
        uint64[] calldata starts,
        uint64[] calldata cliffs,
        uint64[] calldata durations
    ) external override {
        if (msg.sender != admin) revert Unauthorized();
        if (tokenAddress != token) revert InvalidToken(tokenAddress, token);

        uint256 count = beneficiaries.length;
        if (count == 0) revert EmptyBatch();
        if (
            allocations.length != count ||
            starts.length != count ||
            cliffs.length != count ||
            durations.length != count
        ) {
            revert ArrayLengthMismatch();
        }

        uint256 totalAllocation = 0;
        uint256 currentId = nextScheduleId;

        for (uint256 i = 0; i < count; ++i) {
            address beneficiary = beneficiaries[i];
            uint256 allocation = allocations[i];
            uint64 start = starts[i];
            uint64 cliff = cliffs[i];
            uint64 duration = durations[i];

            if (beneficiary == address(0)) revert InvalidBeneficiary();
            if (allocation == 0) revert InvalidAllocation();
            if (duration == 0 || cliff > duration)
                revert InvalidScheduleTerms(cliff, duration);
            if (uint256(start) + uint256(duration) > type(uint64).max)
                revert InvalidScheduleTerms(cliff, duration);

            totalAllocation += allocation;
            uint256 scheduleId = currentId++;

            schedules[scheduleId] = Schedule({
                scheduleId: scheduleId,
                beneficiary: beneficiary,
                allocation: allocation,
                start: start,
                cliff: cliff,
                duration: duration,
                released: 0
            });
            beneficiaryScheduleIds[beneficiary].push(scheduleId);

            emit ScheduleCreated(
                scheduleId,
                beneficiary,
                allocation,
                start,
                cliff,
                duration
            );
        }

        nextScheduleId = currentId;

        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(
            msg.sender,
            address(this),
            totalAllocation
        );
        uint256 received = IERC20(token).balanceOf(address(this)) -
            balanceBefore;
        if (received != totalAllocation) revert InvalidAllocation();

        emit BatchCreated(msg.sender, count, totalAllocation);
    }

    function updateScheduleTerms(
        uint256 scheduleId,
        uint64 newCliff,
        uint64 newDuration
    ) external override {
        if (msg.sender != admin) revert Unauthorized();

        Schedule storage schedule = schedules[scheduleId];
        if (schedule.beneficiary == address(0))
            revert ScheduleNotFound(scheduleId);
        if (schedule.allocation == 0)
            revert ScheduleAlreadyCancelled(scheduleId);
        if (block.timestamp >= schedule.start)
            revert ScheduleAlreadyStarted(
                scheduleId,
                schedule.start,
                block.timestamp
            );
        if (newDuration == 0 || newCliff > newDuration)
            revert InvalidScheduleTerms(newCliff, newDuration);
        if (uint256(schedule.start) + uint256(newDuration) > type(uint64).max)
            revert InvalidScheduleTerms(newCliff, newDuration);

        schedule.cliff = newCliff;
        schedule.duration = newDuration;

        emit ScheduleTermsUpdated(scheduleId, newCliff, newDuration);
    }

    function cancelSchedule(uint256 scheduleId) external override {
        if (msg.sender != admin) revert Unauthorized();

        Schedule storage schedule = schedules[scheduleId];
        if (schedule.beneficiary == address(0))
            revert ScheduleNotFound(scheduleId);

        uint256 refundAmount = schedule.allocation;
        if (refundAmount == 0) revert ScheduleAlreadyCancelled(scheduleId);
        if (block.timestamp >= schedule.start)
            revert ScheduleAlreadyStarted(
                scheduleId,
                schedule.start,
                block.timestamp
            );

        schedule.allocation = 0;

        IERC20(token).safeTransfer(admin, refundAmount);

        emit ScheduleCancelled(scheduleId, schedule.beneficiary, refundAmount);
    }

    // =========================================================================
    // VESTING CORE MATH
    // =========================================================================

    function getSchedule(
        uint256 scheduleId
    ) external view override returns (Schedule memory) {
        return _getSchedule(scheduleId);
    }

    function _getSchedule(
        uint256 scheduleId
    ) internal view returns (Schedule storage schedule) {
        if (scheduleId >= nextScheduleId) {
            revert InvalidScheduleId(scheduleId);
        }
        schedule = schedules[scheduleId];
    }

    function getBeneficiarySchedules(
        address beneficiary
    ) external view override returns (uint256[] memory) {
        return beneficiaryScheduleIds[beneficiary];
    }

    function vestedAmount(
        uint256 scheduleId
    ) public view override returns (uint256) {
        return _vestedAmount(_getSchedule(scheduleId));
    }

    function _vestedAmount(
        Schedule storage schedule
    ) internal view returns (uint256) {
        uint256 start = uint256(schedule.start);
        uint256 cliffEnd = start + uint256(schedule.cliff);
        uint256 vestingEnd = start + uint256(schedule.duration);
        uint256 nowTime = block.timestamp;

        if (nowTime < start || nowTime < cliffEnd) {
            return 0;
        }

        if (nowTime >= vestingEnd) {
            return schedule.allocation;
        }

        uint256 elapsed = nowTime - start;
        return (schedule.allocation * elapsed) / uint256(schedule.duration);
    }

    function claimableAmount(
        uint256 scheduleId
    ) public view override returns (uint256) {
        Schedule storage schedule = _getSchedule(scheduleId);
        uint256 vested = _vestedAmount(schedule);

        if (vested <= schedule.released) {
            return 0;
        }
        return vested - schedule.released;
    }

    function claim(uint256 scheduleId) external override nonReentrant {
        Schedule storage schedule = _getSchedule(scheduleId);

        if (msg.sender != schedule.beneficiary) {
            revert Unauthorized();
        }

        uint256 amount = claimableAmount(scheduleId);

        if (amount == 0) {
            revert NothingToClaim();
        }

        schedule.released += amount;
        IERC20(token).safeTransfer(schedule.beneficiary, amount);
        emit Claimed(scheduleId, schedule.beneficiary, amount);
    }
}
