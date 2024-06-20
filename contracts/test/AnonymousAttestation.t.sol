// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "eas-contracts/IEAS.sol";
import "eas-contracts/Common.sol";
import "eas-contracts/ISchemaRegistry.sol";
import "forge-std/Test.sol";

import "../src/AttestationResolver.sol";
import "../src/AnonymousAttester.sol";
import "../src/Schema.sol";
import "../src/UltraPlonkVerifier.sol";

contract AttestationTest is Test {
    uint256 optimismFork = vm.createFork("https://mainnet.optimism.io");

    IEAS immutable eas = IEAS(0x4200000000000000000000000000000000000021);
    ISchemaRegistry immutable schemaRegistry =
        ISchemaRegistry(0x4200000000000000000000000000000000000020);

    address immutable target = 0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF;

    AnonymousAttester anonymousAttester;
    bytes32 schema;

    function setUp() public {
        vm.selectFork(optimismFork);

        // create attestation resolver
        AttestationResolver resolver = new AttestationResolver(eas);

        // register schema with resolver
        schema = schemaRegistry.register(SCHEMA_STRING, resolver, true);

        // create anonymous attester
        anonymousAttester = new AnonymousAttester(eas);
        anonymousAttester.addSchema(schema);
        anonymousAttester.changeVerifier(new UltraPlonkVerifier());
        anonymousAttester.changePubkey(
            [
                bytes32(
                    hex"1fc12a4421a52b9485cd696b8cfe29c1c3fcaf77f9fadccce0d47593301ad232"
                ),
                hex"0dd32faaef5273e1fe22189585be98493fd3d2c2c6e61728dda32ec5335f3ce3"
            ]
        );

        // add anonymous attester to authorized attesters
        resolver.addAuthorizedAttester(address(anonymousAttester));
    }

    function test_AnonymousAttestation() public {
        uint256 role = 1;
        bytes32 id = anonymousAttester.attest(
            schema,
            target,
            role,
            "Hello, world!",
            AttestationProof({
                revokerHash: bytes32(
                    uint256(
                        4916179360654529033703385338351006789068467821670893077446447393102117697567
                    )
                ),
                nonce: bytes32(uint256(123456789)),
                timestamp: bytes32(uint256(1718875852)),
                proof: hex"22be7705a7801c0d264f626d75ddca3f4f55160f0b8748100b09500971c6bc8c1442933eb1437567972ace3c2965a5172b9fd657b927261636fcb2e3cce56a2e0ec182d8238536c1878124a527533ea01dffe8ad364b8ddde15106c946c5158001d30dedaf65ece7a892ab15fdf2901c1b39204b06d07cd3450b8b9415682171143b45b2789d5980c703d9286b9dc1882bf7f7c7f9b91c9400e0f1769c8b3a5f27509f36b7d08f91db6e0c5390aae0753df2044322919d1a7631684d2a3966751bfb48d0da8df7993f71ec15d39f5c62068544ae858c5607b458b5772a88fbdf10e56869be23fd55b46b80510740c01ca038e88e82086f5f08b5026be6bf0fa22426ee5ebd358ab2976b2467ff6a832253024b6b3179e2aff8b8bfa3a8a82d5e018a1e9130600787d8b40cabc1cfead90224cea9f359e1c942c83a272c6c14902a1e289c97cf757e5343748b546b19cc4a5db274a88805ec8955920391867a0322fc562142e7ef61da26e50bf99b80874c14d105e1642073ae80742c104dc88029b007c73fe49bb50d36000f2dbe832dad1b746452d1dd37b161f28a105392e302fc7e033665b3cb45f84348ded0132e67ea01a467eb0e1a011ee8569963bc2e1f3113a8b9f5d9d8142538e564b8b025407fbe67e880c20fb5a52d8b3f0bdee52a6baceb85b30a556d4519b7f0c89c476a06f103b23d5f65f140dba3c27bef2e30412b3546ca51ca80bdb7a83d78139772cf003873c2838f300b616b0e1c99f5143b6542b342760bd44d6ba57cff8dfac1d6c83b9371fb9491f921a46b39bc421e0a6fada8dba1a87eedcaded7ac02ad71e1cd3fc31f274a46543403acf8272f114ba0ba5c70bbfca334e802070a088a33a9e68b41e249f794f67757c5f454e010530fbb572afdcbe25e3a9416b713cf4160d1f1ef33907832571f1d2a361b161cd1afb29069e48d85c38b880b60486d52e36c35210d4dccc1f07dfcf4471cbc2726a6fa59e7ae2bd3a22bf0cd03871390d3194127882ae9423b957e61b490d32b9f30815f5e1c039dd94bc7702c93c242b5407175092636b3bf4cd3c28810c90d2d9a4d534cea84bd66c9375717aed3e7690c023cab6225790460a323e692632041f756209d884b3c74f204046f4b32b857a902269711854b0b1198b9b40e830619f4e86009972fdfdc5fb206b671578b10c018ef7cd15ad3d1b86cf897cf5e28ce297b1a248102f5e22491c049fe471f4424233d02352c626995bbcef4e5320136ee9edfe64f6e9fb5854c17d46f8689da6f1110773206c2b8718aa9b45945093a009987e41d90d6e4ac3a11ddacc63f670d8ac41e2cd0fc0f07d4a86538e70a8f4355e38301d5f48ed94a6ff7d23a8effe6e12b0b36003465583201b5d73604014e83eaef38b849e23e7375441f928b57b16e81e707eea97ee5843a552d0b1108069845aa707fd6148e17d27e8eb1e649514cd58fe7dd8761daff37d8521a00d2ca41a8612c4811b792d2d319fd2ec9ff88070d5c8be081759a738ca9abc80da02eee5858eee3bd55b2d11bd71852d089da6f77cb5577c43dcc7d9f7d750212bef77fe32d7484db62a0234cf35cf29db5ef6037607dd9c7f6c368fc19897c1956396a26b78d54d4d4abc66f73dbf69c8bf17b6d86d7fa3d7b915ccd989e330fe482c322b0ea90a5ab41e89eee3ba70c6c061b181b06eb9ff8efa787d8fea41a8299b0be62524b020a5dce81b6243bc090e5fa7a23b3e7a5c8abb7d2e91ece0975ce3139f99c1fd59aa5df77bbbd0aadb0547f0165ce8e48dc0527855fa0ac0070c509d6405c421113a7966e443690e7b8bdb2117111477ec56117d59aa9212a8f45fdfa816045e7ce25e672b6461e3a19a662b92a6a081de6bba273e832b8276221e7d6dffb365cbbf3f2a2ca1b878d6e9331361d456521416996c85d1b6d2152b369623c63f08ac218ce731a35e95ac497c2881b428e66d3daf1659cabb02527bd0ca982dc796a73d1d1c0437878bc21953732ca73331f213a3139c4f2591d06282cd9919f0f4d3b8f41bd7c85a6677159511d979cc245bc837249de0f63286c09d279d9431ddd311bb6f59b773eab6db3e16473cf11ab90eb2d5a72709e1a8ef4d8103fdad45247588a22fa85e6389c0b1e0812744c91dd3f4f87971a1923a8c5ff2c36e42d5ca0fa2d31d696e35402b7fe0d9925689fe813d93c7bf92923d726a1d5afdd95809bf1da309635aebeb962a4f0bbd00abcde7e5a31f8e3df1296350f6e397df41a2ff72dca6558d379fbcf0e49433ada5b6b397d505c23e801d71f266769645ae556b0f660f99b92ed037dbb82d3e84b7c9e2a1fb70e2790073f88a32dca9bdff0bfb039cd8a00d9973e6fa38fe7a275eef88b73e88e21a4206673f2e827ec66f286dac441c731e4c06318d41eaa313c56a942e0a3512a3f004c85378023a5a4bc93f00dc1d5e7c09b4143fd177a987938139e95ea7906f312aa332fb826e7338336ac2d4f956ab8fa54c65b68ea5f541fddf64242414ed22b1d4d5c0ea44b3cb42d1c03e7d63e881f59167637dad4041d97990362c95ff005b2f9c6351f963eacf27051d70a9ceb30eaa6b30c4b5a6bcb644a23b2a2ab980e44992e21fd5fe74c20a940ba9c187f04f1b42f05f20862293fc388ea4954f20d6252179eedd51a45ca5ae03ad97a31cd50f5d2fa7ba64f01671b0b2b00d58e29e2f46c97f67ccf60c86b6b57f7e3c4e5e36762c79389259caa29e720bd4ead2738dba32d4c6dbc7937b04b63f18e0eacc6c527b598961cadb9c85ed28bfc2b1072ec8745274a762ca540acc945b16078bb612fd5f251cffdcffdf2a62b2125168fd08b78cc691d6160f69653aae14328f11e638fa1d32ed0cd0617361b4fad2116ced57406039153902f50cdfcc09d1b6fb98ce16c848e668aa771e4934212137d5868e4cf26938448540381261d447db5c965aa94ece082776eaba0b9a9230aaae54a199b7d14212f12c6d32abf873d98c10f1831397e39dd5f3d470d4b0c"
            })
        );

        // verify attestation
        Attestation memory attestation = eas.getAttestation(id);
        assertEq(attestation.schema, schema);
        assertEq(attestation.recipient, target);
        assertEq(attestation.attester, address(anonymousAttester));
        assertEq(attestation.expirationTime, 0);
        assertEq(attestation.revocable, true);
        assertEq(attestation.refUID, 0x0);
        assertEq(
            attestation.data,
            abi.encode(
                Schema({
                    role: role,
                    message: "Hello, world!",
                    ref: bytes.concat(bytes32(uint256(1718875852)))
                })
            )
        );
        assertEq(attestation.revocationTime, 0, "Revocation time should be 0");

        // Revoke attestation
        anonymousAttester.revoke(
            schema,
            id,
            bytes32(
                uint256(
                    20691954179437343774039634464675588586596654474238876532387957803351776546670
                )
            )
        );

        // Verify revocation
        Attestation memory revokedAttestation = eas.getAttestation(id);
        assertGt(
            revokedAttestation.revocationTime,
            0,
            "Revocation time should be greater than 0"
        );
    }
}
