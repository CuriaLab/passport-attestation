// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "eas-contracts/resolver/SchemaResolver.sol";
import "eas-contracts/IEAS.sol";

contract AttestationResolver is SchemaResolver {
    constructor(IEAS eas) SchemaResolver(eas) {}

    function attest(
        Attestation calldata attestation
    ) external payable override returns (bool) {
        return false;
    }

    function revoke(
        Attestation calldata attestation
    ) external payable override returns (bool) {
        return true;
    }
}
