// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVestingManager {
    struct Schedule {
        uint256 scheduleId;
        address beneficiary;
        uint256 allocation;
        uint64 start;
        uint64 cliff;
        uint64 duration;
        uint256 released;
    }

    // =========================================================================
    // SHARED ERRORS & EVENTS
    // =========================================================================

    // Shared
    error NotImplemented();
    error Unauthorized();
    error InvalidScheduleId(uint256 scheduleId);
    error NothingToClaim();

    // Anggota 3 Errors
    error InvalidToken(address provided, address expected);
    error EmptyBatch();
    error ArrayLengthMismatch();
    error InvalidBeneficiary();
    error InvalidAllocation();
    error InvalidScheduleTerms(uint64 cliff, uint64 duration);
    error ScheduleNotFound(uint256 scheduleId);
    error ScheduleAlreadyStarted(
        uint256 scheduleId,
        uint64 start,
        uint256 currentTimestamp
    );
    error ScheduleAlreadyCancelled(uint256 scheduleId);

    // Events
    event BatchCreated(
        address indexed admin,
        uint256 scheduleCount,
        uint256 totalAllocation
    );
    event ScheduleCreated(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 allocation,
        uint64 start,
        uint64 cliff,
        uint64 duration
    );
    event ScheduleTermsUpdated(
        uint256 indexed scheduleId,
        uint64 newCliff,
        uint64 newDuration
    );
    event ScheduleCancelled(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 refundedAllocation
    );
    event Claimed(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 amount
    );

    // =========================================================================
    // FUNCTIONS
    // =========================================================================

    function token() external view returns (address);
    function admin() external view returns (address);
    function nextScheduleId() external view returns (uint256);

    // Anggota 3  Batch Lifecycle
    function createBatch(
        address tokenAddress,
        address[] calldata beneficiaries,
        uint256[] calldata allocations,
        uint64[] calldata starts,
        uint64[] calldata cliffs,
        uint64[] calldata durations
    ) external;
    function updateScheduleTerms(
        uint256 scheduleId,
        uint64 newCliff,
        uint64 newDuration
    ) external;
    function cancelSchedule(uint256 scheduleId) external;

    function getSchedule(
        uint256 scheduleId
    ) external view returns (Schedule memory);
    function getBeneficiarySchedules(
        address beneficiary
    ) external view returns (uint256[] memory);
    function vestedAmount(uint256 scheduleId) external view returns (uint256);
    function claimableAmount(
        uint256 scheduleId
    ) external view returns (uint256);
    function claim(uint256 scheduleId) external;
}
