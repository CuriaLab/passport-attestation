// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "eas-contracts/IEAS.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./PoseidonHasher.sol";
import "./Schema.sol";

struct AttestationProof {
    bytes proof;
    bytes32 revokerHash;
    bytes32 nonce;
}

contract AnonymousAttester is Ownable {
    IEAS public immutable eas;

    // attestation uid -> revoker hash;
    mapping(bytes32 => bytes32) revokers;
    // schema -> allowed
    mapping(bytes32 => bool) schemas;
    // nonce -> used
    mapping(bytes32 => bool) nonce;

    error RevokerNotFound();
    error InvalidRevoker();
    error InvalidSchema();
    error NonceUsed();

    event SchemaAdded(bytes32 indexed schema);
    event SchemaRemoved(bytes32 indexed schema);

    constructor(IEAS _eas) Ownable(msg.sender) {
        eas = _eas;
    }

    function addSchema(bytes32 schema) external onlyOwner {
        schemas[schema] = true;
        emit SchemaAdded(schema);
    }

    function removeSchema(bytes32 schema) external onlyOwner {
        schemas[schema] = false;
        emit SchemaRemoved(schema);
    }

    function attest(
        bytes32 schema,
        address recipient,
        uint256 role,
        string calldata message,
        AttestationProof calldata proof
    ) external {
        if (!schemas[schema]) {
            revert InvalidSchema();
        }

        if (nonce[proof.nonce]) {
            revert NonceUsed();
        }

        bytes32 uid = eas.attest(
            AttestationRequest({
                schema: schema,
                data: AttestationRequestData({
                    recipient: recipient,
                    expirationTime: 0,
                    revocable: true,
                    refUID: 0x0,
                    value: 0,
                    data: abi.encode(Schema({role: role, message: message}))
                })
            })
        );
        nonce[proof.nonce] = true;
        revokers[uid] = proof.revokerHash;
    }

    function revoke(bytes32 schema, bytes32 uid, bytes32 revoker) external {
        if (!schemas[schema]) {
            revert InvalidSchema();
        }

        bytes32 revokerHash = revokers[uid];

        if (revokerHash == 0x0) {
            revert RevokerNotFound();
        }

        bytes32 calculatedRevokerHash = PoseidonHasher.hash([uid, revoker]);

        if (calculatedRevokerHash != revokerHash) {
            revert InvalidRevoker();
        }

        eas.revoke(
            RevocationRequest({
                schema: schema,
                data: RevocationRequestData({uid: uid, value: 0})
            })
        );
        revokers[uid] = 0x0;
    }
}
