// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Registry of EDDSA public keys
contract KeyRegistry {
    // address -> [x, y]
    mapping(address => bytes32[2]) public keys;

    // Register a public key associated with the caller's address
    function registerKey(bytes32[2] memory key) public {
        keys[msg.sender] = key;
    }
}
