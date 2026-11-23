// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title PayrollBatcher
 * @notice Pays a whole team in one transaction. The employer funds the run
 * first (stablecoins must already be in this contract, or approved for it
 * to pull), then calls `runPayroll` once with the full list. Either every
 * person in the list is paid, or the whole run fails and nothing moves —
 * there is no half-paid team. Each run gets a number and a short note, so
 * the public record can point at it.
 */
contract PayrollBatcher {
    IERC20 public immutable token;

    uint256 public runCount;
    mapping(uint256 => bytes32) public runNotes;

    event PayRun(uint256 indexed runId, address indexed employer, uint256 total, uint256 people, bytes32 note);
    event Paid(address indexed to, uint256 amount);

    error LengthMismatch();
    error EmptyRun();
    error ZeroAmount();
    error ZeroAddress();
    error DuplicatePayee();
    error InsufficientBalance();
    error TransferFailed();
    error Locked();

    bool private locked;

    modifier nonReentrant() {
        if (locked) revert Locked();
        locked = true;
        _;
        locked = false;
    }

    constructor(address token_) {
        if (token_ == address(0)) revert ZeroAddress();
        token = IERC20(token_);
    }

    /**
     * @notice Pay everyone in `recipients` the matching amount in `amounts`.
     * The caller must have approved this contract for the total first, or
     * funded it already. `note` is a short label for the run, e.g. "Nov pay".
     */
    function runPayroll(address[] calldata recipients, uint256[] calldata amounts, bytes32 note)
        external
        nonReentrant
        returns (uint256 runId)
    {
        if (recipients.length == 0) revert EmptyRun();
        if (recipients.length != amounts.length) revert LengthMismatch();

        uint256 total;
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            if (amounts[i] == 0) revert ZeroAmount();
            for (uint256 j = 0; j < i; j++) {
                if (recipients[j] == recipients[i]) revert DuplicatePayee();
            }
            total += amounts[i];
        }
        if (token.balanceOf(address(this)) < total) {
            // Pull the shortfall from the employer in one go.
            uint256 shortfall = total - token.balanceOf(address(this));
            if (!token.transferFrom(msg.sender, address(this), shortfall)) revert TransferFailed();
        }
        runId = runCount++;
        runNotes[runId] = note;
        for (uint256 i = 0; i < recipients.length; i++) {
            if (!token.transfer(recipients[i], amounts[i])) revert TransferFailed();
            emit Paid(recipients[i], amounts[i]);
        }
        emit PayRun(runId, msg.sender, total, recipients.length, note);
    }
}
