// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Registry of EDDSA public keys
contract KeyRegistry {
    struct Key {
        bytes32 x;
        bytes32 y;
    }
    // address -> [x, y]
    mapping(address => Key) keys;

    event KeyRegistered(address indexed addr, bytes32 x, bytes32 y);

    function key(address addr) external view returns (Key memory) {
        return keys[addr];
    }

    // Register a public key associated with the caller's address
    function registerKey(Key memory k) external {
        keys[msg.sender] = k;
        emit KeyRegistered(msg.sender, k.x, k.y);
    }
}
