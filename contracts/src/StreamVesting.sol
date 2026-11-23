// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title StreamVesting
 * @notice Pay that flows while work happens, instead of landing once a
 * month. The employer locks the full amount up front, then the pay grows
 * in a straight line from `start` to `end`. Nothing can be claimed before
 * the cliff has passed. The worker claims what they have earned so far,
 * whenever they like; the employer can stop the stream, which pays the
 * worker what they earned and returns the rest.
 */
contract StreamVesting {
    IERC20 public immutable token;

    struct Stream {
        address employer;
        address worker;
        uint256 ratePerSecond;
        uint256 start;
        uint256 cliff;
        uint256 end;
        uint256 claimed;
        bool cancelled;
    }

    uint256 public streamCount;
    mapping(uint256 => Stream) public streams;

    event StreamStarted(uint256 indexed streamId, address indexed employer, address indexed worker, uint256 total, uint256 end);
    event Claimed(uint256 indexed streamId, address indexed worker, uint256 amount);
    event Cancelled(uint256 indexed streamId, uint256 paidToWorker, uint256 returnedToEmployer);

    error NotWorker();
    error NotEmployer();
    error ZeroAddress();
    error BadDates();
    error BadRate();
    error AlreadyCancelled();
    error NothingToClaim();
    error TransferFailed();

    constructor(address token_) {
        if (token_ == address(0)) revert ZeroAddress();
        token = IERC20(token_);
    }

    /// @notice Lock `ratePerSecond * (end - start)` and start a stream.
    function createStream(address worker, uint256 ratePerSecond, uint256 start, uint256 cliffSeconds, uint256 end)
        external
        returns (uint256 streamId)
    {
        if (worker == address(0)) revert ZeroAddress();
        if (ratePerSecond == 0) revert BadRate();
        if (end <= start || start + cliffSeconds > end) revert BadDates();
        uint256 total = ratePerSecond * (end - start);
        if (!token.transferFrom(msg.sender, address(this), total)) revert TransferFailed();
        streamId = streamCount++;
        streams[streamId] = Stream({
            employer: msg.sender,
            worker: worker,
            ratePerSecond: ratePerSecond,
            start: start,
            cliff: start + cliffSeconds,
            end: end,
            claimed: 0,
            cancelled: false
        });
        emit StreamStarted(streamId, msg.sender, worker, total, end);
    }

    /// @notice What a stream has earned by now, minus what was already claimed.
    function claimable(uint256 streamId) public view returns (uint256) {
        Stream memory s = streams[streamId];
        if (s.cancelled || block.timestamp < s.cliff) return 0;
        uint256 paidUntil = block.timestamp > s.end ? s.end : block.timestamp;
        uint256 earned = s.ratePerSecond * (paidUntil - s.start);
        return earned > s.claimed ? earned - s.claimed : 0;
    }

    /// @notice Claim everything earned so far. Worker only.
    function claim(uint256 streamId) external returns (uint256 amount) {
        Stream storage s = streams[streamId];
        if (msg.sender != s.worker) revert NotWorker();
        if (s.cancelled) revert AlreadyCancelled();
        amount = claimable(streamId);
        if (amount == 0) revert NothingToClaim();
        s.claimed += amount;
        if (!token.transfer(s.worker, amount)) revert TransferFailed();
        emit Claimed(streamId, s.worker, amount);
    }

    /// @notice Stop a stream. Worker keeps what they earned; the rest goes back.
    function cancel(uint256 streamId) external returns (uint256 paidToWorker, uint256 returnedToEmployer) {
        Stream storage s = streams[streamId];
        if (msg.sender != s.employer) revert NotEmployer();
        if (s.cancelled) revert AlreadyCancelled();
        // Work out what the worker earned BEFORE marking the stream
        // cancelled: claimable() pays nothing on a cancelled stream.
        paidToWorker = claimable(streamId);
        s.cancelled = true;
        uint256 total = s.ratePerSecond * (s.end - s.start);
        returnedToEmployer = total - s.claimed - paidToWorker;
        if (paidToWorker > 0) {
            s.claimed += paidToWorker;
            if (!token.transfer(s.worker, paidToWorker)) revert TransferFailed();
        }
        if (returnedToEmployer > 0) {
            if (!token.transfer(s.employer, returnedToEmployer)) revert TransferFailed();
        }
        emit Cancelled(streamId, paidToWorker, returnedToEmployer);
    }
}
