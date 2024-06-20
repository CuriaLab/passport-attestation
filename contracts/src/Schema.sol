// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Attestation data structure
struct Schema {
    uint256 role;
    string message;
    bytes ref;
}

string constant SCHEMA_STRING = "uint256 role, string message, bytes ref";
