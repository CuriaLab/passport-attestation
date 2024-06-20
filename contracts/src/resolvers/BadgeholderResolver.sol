// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "eas-contracts/IEAS.sol";
import "eas-contracts/Common.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./ICustomResolver.sol";

contract DelegateResolver is ICustomResolver, Ownable {
    IEAS immutable eas;
    uint256 public currentRound;
    mapping(address => bool) public approvedAttesters;

    error InvalidAttestation();
    error InvalidAddress();

    event RoundChanged(uint256 round);
    event AttesterAdded(address indexed attester);
    event AttesterRemoved(address indexed attester);

    constructor(IEAS _eas) Ownable(msg.sender) {
        eas = _eas;
    }

    function addApprovedAttester(address attester) external onlyOwner {
        approvedAttesters[attester] = true;
        emit AttesterAdded(attester);
    }

    function removeApprovedAttester(address attester) external onlyOwner {
        approvedAttesters[attester] = false;
        emit AttesterRemoved(attester);
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

        // check if attester is approved
        if (!approvedAttesters[attestation.attester]) {
            return false;
        }

        // check if attestation is for the address
        if (attestation.recipient != addr) {
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
