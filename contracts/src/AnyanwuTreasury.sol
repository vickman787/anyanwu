// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

/**
 * @title AnyanwuTreasury
 * @notice One employer's money box. The employer puts stablecoins in, and
 * only the employer can take them out or hand them to the pay-run contract.
 * The contract itself never decides who gets paid — it only holds the money
 * until the employer says so. That keeps the employer's control simple to
 * check: if you own the treasury, the money is yours.
 */
contract AnyanwuTreasury {
    IERC20 public immutable token;
    address public immutable owner;

    event Funded(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event SentToBatcher(address indexed batcher, uint256 amount);

    error NotOwner();
    error ZeroAmount();
    error ZeroAddress();
    error InsufficientBalance();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address token_, address owner_) {
        if (token_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        token = IERC20(token_);
        owner = owner_;
    }

    /// @notice Put stablecoins into the treasury. Caller must approve first.
    function fund(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (!token.transferFrom(msg.sender, address(this), amount)) revert InsufficientBalance();
        emit Funded(msg.sender, amount);
    }

    /// @notice Take stablecoins back out. Employer only.
    function withdraw(uint256 amount, address to) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        if (token.balanceOf(address(this)) < amount) revert InsufficientBalance();
        if (!token.transfer(to, amount)) revert InsufficientBalance();
        emit Withdrawn(to, amount);
    }

    /// @notice Hand money to a pay-run contract so it can pay the team.
    function sendToBatcher(address batcher, uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (batcher == address(0)) revert ZeroAddress();
        if (token.balanceOf(address(this)) < amount) revert InsufficientBalance();
        if (!token.transfer(batcher, amount)) revert InsufficientBalance();
        emit SentToBatcher(batcher, amount);
    }

    function balance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
