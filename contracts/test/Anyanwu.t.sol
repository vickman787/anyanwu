// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AnyanwuTreasury} from "../src/AnyanwuTreasury.sol";
import {PayrollBatcher} from "../src/PayrollBatcher.sol";
import {StreamVesting} from "../src/StreamVesting.sol";
import {MockQUSDC} from "../src/MockQUSDC.sol";

contract AnyanwuTest is Test {
    MockQUSDC token;
    AnyanwuTreasury treasury;
    PayrollBatcher batcher;
    StreamVesting stream;

    address employer = address(0xE1);
    address ada = address(0xA1);
    address bola = address(0xB1);

    function setUp() public {
        token = new MockQUSDC();
        treasury = new AnyanwuTreasury(address(token), employer);
        batcher = new PayrollBatcher(address(token));
        stream = new StreamVesting(address(token));
        token.mint(employer, 1_000_000_000); // 1,000 test dollars, 6 decimals
    }

    // --- Treasury ---

    function testTreasuryFundAndWithdraw() public {
        vm.startPrank(employer);
        token.approve(address(treasury), 500_000_000);
        treasury.fund(500_000_000);
        assertEq(treasury.balance(), 500_000_000);
        treasury.withdraw(100_000_000, employer);
        assertEq(treasury.balance(), 400_000_000);
        assertEq(token.balanceOf(employer), 600_000_000);
        vm.stopPrank();
    }

    function testTreasuryOnlyOwnerCanWithdraw() public {
        vm.startPrank(employer);
        token.approve(address(treasury), 100_000_000);
        treasury.fund(100_000_000);
        vm.stopPrank();
        vm.prank(ada);
        vm.expectRevert(AnyanwuTreasury.NotOwner.selector);
        treasury.withdraw(1, ada);
    }

    function testTreasurySendsToBatcher() public {
        vm.startPrank(employer);
        token.approve(address(treasury), 300_000_000);
        treasury.fund(300_000_000);
        treasury.sendToBatcher(address(batcher), 300_000_000);
        assertEq(token.balanceOf(address(batcher)), 300_000_000);
        assertEq(treasury.balance(), 0);
        vm.stopPrank();
    }

    // --- Batcher ---

    function testPayrollPaysEveryoneOrNoOne() public {
        address[] memory people = new address[](2);
        people[0] = ada;
        people[1] = bola;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 250_000_000;
        amounts[1] = 120_500_000;
        vm.startPrank(employer);
        token.approve(address(batcher), 370_500_000);
        uint256 runId = batcher.runPayroll(people, amounts, bytes32("Nov pay"));
        assertEq(runId, 0);
        assertEq(batcher.runCount(), 1);
        assertEq(token.balanceOf(ada), 250_000_000);
        assertEq(token.balanceOf(bola), 120_500_000);
        vm.stopPrank();
    }

    function testPayrollUsesMoneyAlreadyInTheBatcher() public {
        vm.startPrank(employer);
        token.approve(address(treasury), 300_000_000);
        treasury.fund(300_000_000);
        treasury.sendToBatcher(address(batcher), 300_000_000);
        address[] memory people = new address[](1);
        people[0] = ada;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 300_000_000;
        batcher.runPayroll(people, amounts, bytes32("Nov pay"));
        assertEq(token.balanceOf(ada), 300_000_000);
        vm.stopPrank();
    }

    function testPayrollRefusesMismatchedLists() public {
        address[] memory people = new address[](2);
        people[0] = ada;
        people[1] = bola;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;
        vm.prank(employer);
        vm.expectRevert(PayrollBatcher.LengthMismatch.selector);
        batcher.runPayroll(people, amounts, bytes32("bad"));
    }

    function testPayrollRefusesDuplicatePayeeAndZeroAmount() public {
        address[] memory people = new address[](2);
        people[0] = ada;
        people[1] = ada;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1;
        amounts[1] = 1;
        vm.prank(employer);
        vm.expectRevert(PayrollBatcher.DuplicatePayee.selector);
        batcher.runPayroll(people, amounts, bytes32("bad"));

        people[1] = bola;
        amounts[1] = 0;
        vm.prank(employer);
        vm.expectRevert(PayrollBatcher.ZeroAmount.selector);
        batcher.runPayroll(people, amounts, bytes32("bad"));
    }

    function testPayrollRefusesMoreThanTheEmployerCanPay() public {
        // Employer only approves 10, but the run costs 250.
        address[] memory people = new address[](1);
        people[0] = ada;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 250_000_000;
        vm.startPrank(employer);
        token.approve(address(batcher), 10);
        vm.expectRevert();
        batcher.runPayroll(people, amounts, bytes32("too big"));
        vm.stopPrank();
        assertEq(token.balanceOf(ada), 0);
    }

    // --- Streams ---

    function testStreamPaysAsTimePasses() public {
        uint256 start = block.timestamp + 100;
        vm.startPrank(employer);
        token.approve(address(stream), 100_000);
        uint256 id = stream.createStream(ada, 100, start, 0, start + 1_000);
        vm.stopPrank();
        assertEq(stream.claimable(id), 0);
        vm.warp(start + 500);
        assertEq(stream.claimable(id), 50_000);
        vm.prank(ada);
        stream.claim(id);
        assertEq(token.balanceOf(ada), 50_000);
        vm.warp(start + 1_000);
        vm.prank(ada);
        stream.claim(id);
        assertEq(token.balanceOf(ada), 100_000);
    }

    function testStreamCliffBlocksEarlyClaims() public {
        uint256 start = block.timestamp + 100;
        vm.startPrank(employer);
        token.approve(address(stream), 100_000);
        uint256 id = stream.createStream(ada, 100, start, 200, start + 1_000);
        vm.stopPrank();
        vm.warp(start + 100);
        assertEq(stream.claimable(id), 0);
        vm.warp(start + 200);
        assertEq(stream.claimable(id), 20_000);
    }

    function testStreamCancelPaysEarnedAndReturnsTheRest() public {
        uint256 start = block.timestamp + 100;
        vm.startPrank(employer);
        token.approve(address(stream), 100_000);
        uint256 id = stream.createStream(ada, 100, start, 0, start + 1_000);
        vm.warp(start + 400);
        stream.cancel(id);
        vm.stopPrank();
        assertEq(token.balanceOf(ada), 40_000);
        assertEq(token.balanceOf(employer), 1_000_000_000 - 100_000 + 60_000);
    }

    function testStreamOnlyWorkerClaimsOnlyEmployerCancels() public {
        uint256 start = block.timestamp + 100;
        vm.startPrank(employer);
        token.approve(address(stream), 100_000);
        uint256 id = stream.createStream(ada, 100, start, 0, start + 1_000);
        vm.stopPrank();
        vm.warp(start + 10);
        vm.prank(bola);
        vm.expectRevert(StreamVesting.NotWorker.selector);
        stream.claim(id);
        vm.prank(bola);
        vm.expectRevert(StreamVesting.NotEmployer.selector);
        stream.cancel(id);
    }
}
