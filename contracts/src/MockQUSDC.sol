// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockQUSDC
 * @notice A test dollar for QIE testnet ONLY. It has 6 decimals, like the
 * real QUSDC on mainnet, and anyone can mint it for testing. It is worth
 * nothing, it is not the real QUSDC, and it must never be deployed to
 * mainnet. Mainnet uses the real QUSDC at
 * 0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5 instead.
 */
contract MockQUSDC {
    string public constant name = "Anyanwu Test Dollar";
    string public constant symbol = "aUSD";
    uint8 public constant decimals = 6;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    function mint(address to, uint256 amount) external {
        require(to != address(0), "zero address");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(to != address(0), "zero address");
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(to != address(0), "zero address");
        require(balanceOf[from] >= amount, "insufficient balance");
        require(allowance[from][msg.sender] >= amount, "insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
