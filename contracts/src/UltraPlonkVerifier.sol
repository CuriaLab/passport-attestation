// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./Verifier.sol";

contract UltraPlonkVerifier is BaseUltraVerifier {
    function getVerificationKeyHash()
        public
        pure
        virtual
        override
        returns (bytes32)
    {
        return UltraVerificationKey.verificationKeyHash();
    }

    function loadVerificationKey(
        uint256 _vk,
        uint256 _omegaInverseLoc
    ) internal pure virtual override {
        return UltraVerificationKey.loadVerificationKey(_vk, _omegaInverseLoc);
    }
}
