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
    error InvalidTokenAddress(address tokenAddress);
    error EmptyBatch();
    error BatchTooLarge(uint256 count, uint256 maximum);
    error ArrayLengthMismatch();
    error InvalidBeneficiary();
    error InvalidAllocation();
    error InvalidScheduleTerms(uint64 cliff, uint64 duration);
    error InvalidClaimTransfer(uint256 expected, uint256 received);
    // Events
    event BatchCreated(
        address indexed admin,
        uint256 indexed firstScheduleId,
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
