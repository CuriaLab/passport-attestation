// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";

import "../src/KeyRegistry.sol";

contract DeployTestnet is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.createWallet(deployerPrivateKey).addr;

        console.log("Deployer address: ", deployer);

        vm.startBroadcast(deployerPrivateKey);

        KeyRegistry keyRegistry = new KeyRegistry();
        console.log("KeyRegistry address: ", address(keyRegistry));

        vm.stopBroadcast();
    }
}
