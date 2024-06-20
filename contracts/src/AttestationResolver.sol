// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "eas-contracts/resolver/SchemaResolver.sol";
import "eas-contracts/IEAS.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./Schema.sol";
import "./resolvers/ICustomResolver.sol";

contract AttestationResolver is SchemaResolver, Ownable {
    mapping(address => bool) public authorizedAttesters;
    mapping(uint256 => ICustomResolver) public customResolvers;

    constructor(IEAS eas) SchemaResolver(eas) Ownable(msg.sender) {}

    error InvalidRole();

    event AuthoriedAttesterAdded(address indexed attester);
    event AuthoriedAttesterRemoved(address indexed attester);
    event CustomResolverSet(uint256 indexed role, ICustomResolver resolver);

    function addAuthorizedAttester(address attester) external onlyOwner {
        authorizedAttesters[attester] = true;
        emit AuthoriedAttesterAdded(attester);
    }

    function removeAuthorizedAttester(address attester) external onlyOwner {
        authorizedAttesters[attester] = false;
        emit AuthoriedAttesterRemoved(attester);
    }

    function setCustomResolver(
        uint256 role,
        ICustomResolver resolver
    ) external onlyOwner {
        customResolvers[role] = resolver;
        emit CustomResolverSet(role, resolver);
    }

    function onAttest(
        Attestation calldata attestation,
        uint256
    ) internal virtual override returns (bool) {
        Schema memory schema = abi.decode(attestation.data, (Schema));

        // Check if role is 0 -> no role is shown
        if (schema.role == 0) {
            return true;
        }

        // Check if the attester is authorized -> short circuit
        if (authorizedAttesters[attestation.attester]) {
            return true;
        }

        ICustomResolver resolver = customResolvers[schema.role];

        if (address(resolver) == address(0)) {
            revert InvalidRole();
        }

        return resolver.check(attestation.attester, schema.ref);
    }

    function onRevoke(
        Attestation calldata,
        uint256
    ) internal virtual override returns (bool) {
        return true;
    }
}
