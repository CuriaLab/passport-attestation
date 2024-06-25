// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "eas-contracts/IEAS.sol";
import "eas-contracts/ISchemaRegistry.sol";
import "forge-std/Test.sol";

import "../src/resolvers/BadgeholderResolver.sol";
import "../src/resolvers/DelegateResolver.sol";
import "../src/resolvers/DelegatorResolver.sol";
import "../src/AttestationResolver.sol";
import "../src/Schema.sol";

contract AttestationTest is Test {
    uint256 optimismFork = vm.createFork("https://mainnet.optimism.io");

    IEAS immutable eas = IEAS(0x4200000000000000000000000000000000000021);
    ISchemaRegistry immutable schemaRegistry =
        ISchemaRegistry(0x4200000000000000000000000000000000000020);

    address immutable target = 0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF;

    bytes32 schema;

    function setUp() public {
        vm.selectFork(optimismFork);

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
        schema = schemaRegistry.register(SCHEMA_STRING, resolver, true);
    }

    function test_AttestationAny() public {
        vm.startPrank(0xBBbB00000000000000000000000000000000aaaa);

        // Attestation
        bytes32 id = eas.attest(
            AttestationRequest({
                schema: schema,
                data: AttestationRequestData({
                    recipient: target,
                    expirationTime: 0,
                    revocable: true,
                    refUID: 0x0,
                    data: schemaEncode(
                        Schema({
                            role: 0,
                            title: "Hi",
                            message: "Hello, World!",
                            ref: ""
                        })
                    ),
                    value: 0
                })
            })
        );

        // Verify attestation
        Attestation memory attestation = eas.getAttestation(id);
        assertEq(attestation.schema, schema);
        assertEq(attestation.recipient, target);
        assertEq(attestation.expirationTime, 0);
        assertEq(attestation.revocable, true);
        assertEq(attestation.refUID, 0x0);
        assertEq(
            attestation.data,
            schemaEncode(
                Schema({
                    role: 0,
                    title: "Hi",
                    message: "Hello, World!",
                    ref: ""
                })
            )
        );
    }

    function test_AttestationBadgeholder() public {
        vm.startPrank(0x07Fda67513EC0897866098a11dC3858089D4A505); // v3naru.eth

        // Attestation
        bytes32 id = eas.attest(
            AttestationRequest({
                schema: schema,
                data: AttestationRequestData({
                    recipient: target,
                    expirationTime: 0,
                    revocable: true,
                    refUID: 0x0,
                    data: schemaEncode(
                        Schema({
                            role: 1,
                            title: "",
                            message: "Hello, World!",
                            ref: abi.encode(
                                0x1cdc950166e76ba5a9cc46aed8f09b5611b309843d411500201ddd8574c148c2
                            )
                        })
                    ),
                    value: 0
                })
            })
        );

        // Verify attestation
        Attestation memory attestation = eas.getAttestation(id);
        assertEq(attestation.schema, schema);
        assertEq(attestation.recipient, target);
        assertEq(attestation.expirationTime, 0);
        assertEq(attestation.revocable, true);
        assertEq(attestation.refUID, 0x0);
        assertEq(
            attestation.data,
            schemaEncode(
                Schema({
                    role: 1,
                    title: "",
                    message: "Hello, World!",
                    ref: abi.encode(
                        0x1cdc950166e76ba5a9cc46aed8f09b5611b309843d411500201ddd8574c148c2
                    )
                })
            )
        );

        // Non-badgeholder should revert
        vm.startPrank(0x17296956b4E07Ff8931E4ff4eA06709FaB70b879); // curia-delegates.eth

        // Should revert
        vm.expectRevert();
        eas.attest(
            AttestationRequest({
                schema: schema,
                data: AttestationRequestData({
                    recipient: target,
                    expirationTime: 0,
                    revocable: true,
                    refUID: 0x0,
                    data: schemaEncode(
                        Schema({
                            role: 1,
                            title: "",
                            message: "Hello, World!",
                            ref: abi.encode(
                                0x1cdc950166e76ba5a9cc46aed8f09b5611b309843d411500201ddd8574c148c2
                            )
                        })
                    ),
                    value: 0
                })
            })
        );
    }

    function test_AttestationDelegate() public {
        vm.startPrank(0x17296956b4E07Ff8931E4ff4eA06709FaB70b879); // curia-delegates.eth

        // Attestation
        bytes32 id = eas.attest(
            AttestationRequest({
                schema: schema,
                data: AttestationRequestData({
                    recipient: target,
                    expirationTime: 0,
                    revocable: true,
                    refUID: 0x0,
                    data: schemaEncode(
                        Schema({
                            role: 2,
                            title: "",
                            message: "Hello, World!",
                            ref: ""
                        })
                    ),
                    value: 0
                })
            })
        );

        // Verify attestation
        Attestation memory attestation = eas.getAttestation(id);
        assertEq(attestation.schema, schema);
        assertEq(attestation.recipient, target);
        assertEq(attestation.expirationTime, 0);
        assertEq(attestation.revocable, true);
        assertEq(attestation.refUID, 0x0);
        assertEq(
            attestation.data,
            schemaEncode(
                Schema({role: 2, title: "", message: "Hello, World!", ref: ""})
            )
        );
    }

    function test_AttestationDelegator() public {
        vm.startPrank(0xE74B1b7d78c180Ff937B464e544D0701038ACBF0); // anticapture, op foundation

        // Attestation
        bytes32 id = eas.attest(
            AttestationRequest({
                schema: schema,
                data: AttestationRequestData({
                    recipient: target,
                    expirationTime: 0,
                    revocable: true,
                    refUID: 0x0,
                    data: schemaEncode(
                        Schema({
                            role: 3,
                            title: "",
                            message: "Hello, World!",
                            ref: ""
                        })
                    ),
                    value: 0
                })
            })
        );

        // Verify attestation
        Attestation memory attestation = eas.getAttestation(id);
        assertEq(attestation.schema, schema);
        assertEq(attestation.recipient, target);
        assertEq(attestation.expirationTime, 0);
        assertEq(attestation.revocable, true);
        assertEq(attestation.refUID, 0x0);
        assertEq(
            attestation.data,
            schemaEncode(
                Schema({role: 3, title: "", message: "Hello, World!", ref: ""})
            )
        );
    }

    function test_AttestationInvalidRole() public {
        vm.startPrank(0x07Fda67513EC0897866098a11dC3858089D4A505); // v3naru.eth

        // Should revert
        vm.expectRevert();
        eas.attest(
            AttestationRequest({
                schema: schema,
                data: AttestationRequestData({
                    recipient: target,
                    expirationTime: 0,
                    revocable: true,
                    refUID: 0x0,
                    data: schemaEncode(
                        Schema({
                            role: 4,
                            title: "",
                            message: "Hello, World!",
                            ref: ""
                        })
                    ),
                    value: 0
                })
            })
        );
    }
}
