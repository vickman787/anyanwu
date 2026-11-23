// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AnyanwuTreasury} from "../src/AnyanwuTreasury.sol";
import {PayrollBatcher} from "../src/PayrollBatcher.sol";
import {StreamVesting} from "../src/StreamVesting.sol";
import {MockQUSDC} from "../src/MockQUSDC.sol";

/**
 * Deploy Anyanwu to QIE.
 *
 * Testnet (chain 1983):
 *   QIE_TESTNET_PRIVATE_KEY=0x... forge script script/Deploy.s.sol \
 *     --rpc-url qie_testnet --broadcast
 * Deploys the test token too — testnet has no published QUSDC yet.
 *
 * Mainnet (chain 1990): deploy with MAINNET=1. Uses the real QUSDC at
 * 0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5 and deploys NO test token.
 * Mainnet also needs I_REVIEWED_MAINNET=1 — set it only after an
 * independent review, and only with a small amount first. The test token
 * (MockQUSDC) is never deployed on mainnet.
 */
contract Deploy is Script {
    address constant QUSDC_MAINNET = 0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5;

    function run() public {
        bool mainnet = vm.envOr("MAINNET", false);
        if (mainnet && !vm.envOr("I_REVIEWED_MAINNET", false)) {
            revert("Mainnet deploy needs I_REVIEWED_MAINNET=1 - set it only after a review.");
        }
        address token = mainnet ? QUSDC_MAINNET : address(0);
        vm.startBroadcast();
        if (!mainnet) {
            MockQUSDC mock = new MockQUSDC();
            token = address(mock);
            console.log("MockQUSDC (testnet only):", token);
        }
        AnyanwuTreasury treasury = new AnyanwuTreasury(token, msg.sender);
        PayrollBatcher batcher = new PayrollBatcher(token);
        StreamVesting stream = new StreamVesting(token);
        vm.stopBroadcast();
        console.log("Token:", token);
        console.log("AnyanwuTreasury:", address(treasury));
        console.log("PayrollBatcher:", address(batcher));
        console.log("StreamVesting:", address(stream));
        console.log("Owner:", msg.sender);
    }
}
