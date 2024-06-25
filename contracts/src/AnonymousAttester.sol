// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "eas-contracts/IEAS.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./PoseidonHasher.sol";
import "./Schema.sol";
import "./Verifier.sol";

struct AttestationProof {
    bytes proof;
    bytes32 revokerHash;
    bytes32 nonce;
    bytes32 timestamp;
}

contract AnonymousAttester is Ownable {
    IEAS public immutable eas;
    BaseUltraVerifier public verifier;

    bytes32[2] public curiaPubkey;

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
    error InvalidProof();
    error InvalidVerifier();

    event SchemaAdded(bytes32 indexed schema);
    event SchemaRemoved(bytes32 indexed schema);
    event PubkeyChanged(bytes32[2] indexed pubkey);
    event VerifierChanged(address indexed verifier);

    constructor(IEAS _eas) Ownable(msg.sender) {
        eas = _eas;
    }

    function changePubkey(bytes32[2] calldata pubkey) external onlyOwner {
        curiaPubkey = pubkey;
        emit PubkeyChanged(pubkey);
    }

    function changeVerifier(BaseUltraVerifier _verifier) external onlyOwner {
        verifier = _verifier;
        emit VerifierChanged(address(_verifier));
    }

    function addSchema(bytes32 schema) external onlyOwner {
        schemas[schema] = true;
        emit SchemaAdded(schema);
    }

    function removeSchema(bytes32 schema) external onlyOwner {
        schemas[schema] = false;
        emit SchemaRemoved(schema);
    }

    function _attest(
        bytes32 schema,
        address recipient,
        uint256 role,
        string memory title,
        string memory message,
        bytes32 timestamp
    ) internal returns (bytes32) {
        return
            eas.attest(
                AttestationRequest({
                    schema: schema,
                    data: AttestationRequestData({
                        recipient: recipient,
                        expirationTime: 0,
                        revocable: true,
                        refUID: 0x0,
                        value: 0,
                        data: schemaEncode(
                            Schema({
                                role: role,
                                title: title,
                                message: message,
                                ref: bytes.concat(timestamp)
                            })
                        )
                    })
                })
            );
    }

    function attest(
        bytes32 schema,
        address recipient,
        Schema calldata data,
        AttestationProof calldata proof
    ) external returns (bytes32) {
        if (address(verifier) == address(0x0)) {
            revert InvalidVerifier();
        }

        if (!schemas[schema]) {
            revert InvalidSchema();
        }

        if (nonce[proof.nonce]) {
            revert NonceUsed();
        }

        bytes32[] memory inputs = new bytes32[](7);
        inputs[0] = curiaPubkey[0];
        inputs[1] = curiaPubkey[1];
        inputs[2] = bytes32(data.role);
        inputs[3] = bytes32(
            uint256(keccak256(bytes(string.concat(data.title, data.message)))) %
                21888242871839275222246405745257275088548364400416034343698204186575808495617
        );
        inputs[4] = proof.nonce;
        inputs[5] = proof.timestamp;
        inputs[6] = proof.revokerHash;
        bool isVerified = verifier.verify(proof.proof, inputs);

        if (!isVerified) {
            revert InvalidProof();
        }

        bytes32 uid = _attest(
            schema,
            recipient,
            data.role,
            data.title,
            data.message,
            proof.timestamp
        );
        nonce[proof.nonce] = true;
        revokers[uid] = proof.revokerHash;

        return uid;
    }

    function revoke(bytes32 schema, bytes32 uid, bytes32 revoker) external {
        if (!schemas[schema]) {
            revert InvalidSchema();
        }

        bytes32 revokerHash = revokers[uid];

        if (revokerHash == 0x0) {
            revert RevokerNotFound();
        }

        bytes32 calculatedRevokerHash = PoseidonHasher.hash([revoker, revoker]);

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
