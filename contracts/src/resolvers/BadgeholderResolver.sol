// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "eas-contracts/IEAS.sol";
import "eas-contracts/Common.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./ICustomResolver.sol";

contract BadgeholderResolver is ICustomResolver, Ownable {
    IEAS immutable eas;

    mapping(address => bool) public approvedAttesters;
    bytes32 public immutable schema;

    uint256 public currentRound;

    event RoundChanged(uint256 round);

    constructor(
        IEAS _eas,
        bytes32 _schema,
        address[] memory _approved
    ) Ownable(msg.sender) {
        eas = _eas;
        schema = _schema;
        for (uint256 i = 0; i < _approved.length; i++) {
            approvedAttesters[_approved[i]] = true;
        }
    }

    function changeRound(uint256 round) external onlyOwner {
        currentRound = round;
        emit RoundChanged(round);
    }

    function check(
        address addr,
        bytes calldata ref
    ) external view override returns (bool) {
        bytes32 id = abi.decode(ref, (bytes32));
        Attestation memory attestation = eas.getAttestation(id);

        // check if attestation exists
        if (attestation.uid == 0x0) {
            return false;
        }

        // check if attestation is for the schema
        if (attestation.schema != schema) {
            return false;
        }

        // check if attester is approved
        if (!approvedAttesters[attestation.attester]) {
            return false;
        }

        // check if attestation is for the address
        if (attestation.recipient != addr) {
            return false;
        }

        // check if attestation is not revoked
        if (attestation.revocationTime > 0) {
            return false;
        }

        (string memory round, , ) = abi.decode(
            attestation.data,
            (string, address, string)
        );

        // check for latest rpgf round
        if (!Strings.equal(Strings.toString(currentRound), round)) {
            return false;
        }

        return true;
    }
}
