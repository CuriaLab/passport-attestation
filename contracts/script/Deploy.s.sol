// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "eas-contracts/IEAS.sol";
import "eas-contracts/ISchemaRegistry.sol";

import "../src/resolvers/BadgeholderResolver.sol";
import "../src/resolvers/DelegateResolver.sol";
import "../src/resolvers/DelegatorResolver.sol";
import "../src/AttestationResolver.sol";
import "../src/AnonymousAttester.sol";
import "../src/Schema.sol";
import "../src/UltraPlonkVerifier.sol";

contract DeployTestnet is Script {
    IEAS immutable eas = IEAS(0x4200000000000000000000000000000000000021);
    ISchemaRegistry immutable schemaRegistry =
        ISchemaRegistry(0x4200000000000000000000000000000000000020);

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.createWallet(deployerPrivateKey).addr;

        console.log("Deployer address: ", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // create attestation resolver
        AttestationResolver resolver = new AttestationResolver(eas);

        // setup badgeholder resolver
        address[] memory addresses = new address[](2);
        addresses[0] = 0x621477dBA416E12df7FF0d48E14c4D20DC85D7D9; // op foundation 1
        addresses[1] = 0xE4553b743E74dA3424Ac51f8C1E586fd43aE226F; // op foundation 2
        BadgeholderResolver badgeholderResolver = new BadgeholderResolver(
            eas,
            0xfdcfdad2dbe7489e0ce56b260348b7f14e8365a8a325aef9834818c00d46b31b,
            addresses
        );
        badgeholderResolver.changeRound(4);

        // add badgeholder resolver to attestation resolver
        resolver.setCustomResolver(1, badgeholderResolver);
        // add delegate resolver to attestation resolver
        resolver.setCustomResolver(2, new DelegateResolver());
        // add delegator resolver to attestation resolver
        resolver.setCustomResolver(3, new DelegatorResolver());

        // register schema with resolver
        bytes32 schema = schemaRegistry.register(SCHEMA_STRING, resolver, true);

        // create anonymous attester
        AnonymousAttester anonymousAttester = new AnonymousAttester(eas);
        anonymousAttester.addSchema(schema);
        anonymousAttester.changeVerifier(new UltraPlonkVerifier());
        anonymousAttester.changePubkey(
            [
                bytes32(
                    hex"26b7fcabdd999eb3259d397bc660e0fec848b73e99dca8755dadc3f47e54adde"
                ),
                hex"234de9f873dce1536cb1a86ae5db8a588b973b17546db327f6170205f2f0bf71"
            ]
        );

        // add anonymous attester to authorized attesters
        resolver.addAuthorizedAttester(address(anonymousAttester));

        console.log("Schema ID: ", uint256(schema));
        console.log("AnonymousAttester address: ", address(anonymousAttester));

        vm.stopBroadcast();
    }
}
