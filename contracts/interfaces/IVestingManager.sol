// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVestingManager {
    /// @notice The complete on-chain record for one beneficiary schedule.
    /// @dev Member 2 owns the storage and the rules that update `released`.
    struct Schedule {
        uint256 scheduleId;
        address beneficiary;
        uint256 allocation;
        uint64 start;
        uint64 cliff;
        uint64 duration;
        uint256 released;
    }

    /// @notice The only ERC-20 accepted by this deployment.
    /// @dev Frontend reads this before preparing approval and createBatch calls.
    function token() external view returns (address);

    /// @notice The organization wallet allowed to create batches.
    /// @dev The completed implementation must enforce this in createBatch.
    function admin() external view returns (address);

    /// @notice The ID that will be assigned to the next created schedule.
    /// @dev Used by tests and the frontend to observe schedule count progress.
    function nextScheduleId() external view returns (uint256);

    /// @notice Creates and funds every schedule in one atomic transaction.
    /// @dev Member 3 implements validation, one transferFrom, events, and rollback.
    ///      All arrays must have equal length. The tokenAddress must equal token().
    function createBatch(
        address tokenAddress,
        address[] calldata beneficiaries,
        uint256[] calldata allocations,
        uint64[] calldata starts,
        uint64[] calldata cliffs,
        uint64[] calldata durations
    ) external;

    /// @notice Returns the immutable terms and current released amount for a schedule.
    /// @dev Frontend uses this to render beneficiary schedule cards.
    function getSchedule(uint256 scheduleId) external view returns (Schedule memory);

    /// @notice Returns schedule IDs belonging to one beneficiary.
    /// @dev Frontend uses this for the beneficiary dashboard; it is not a database query.
    function getBeneficiarySchedules(address beneficiary) external view returns (uint256[] memory);

    /// @notice Calculates total vested tokens at the current block timestamp.
    /// @dev Member 2 owns start/cliff/end semantics and boundary tests.
    function vestedAmount(uint256 scheduleId) external view returns (uint256);

    /// @notice Calculates vested tokens that have not yet been released.
    /// @dev Expected invariant: claimableAmount <= vestedAmount <= allocation.
    function claimableAmount(uint256 scheduleId) external view returns (uint256);

    /// @notice Sends newly claimable tokens directly to the recorded beneficiary.
    /// @dev Caller authorization, checks-effects-interactions, and accounting belong to Member 2.
    function claim(uint256 scheduleId) external;
}
