// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Attestation data structure
struct Schema {
    uint256 role;
    string title;
    string message;
    bytes ref;
}

string constant SCHEMA_STRING = "uint256 role, string title, string message, bytes ref";

function schemaEncode(Schema memory schema) pure returns (bytes memory) {
    return abi.encode(schema.role, schema.title, schema.message, schema.ref);
}

function schemaDecode(bytes memory data) pure returns (Schema memory) {
    (
        uint256 role,
        string memory title,
        string memory message,
        bytes memory ref
    ) = abi.decode(data, (uint256, string, string, bytes));
    return Schema(role, title, message, ref);
}
