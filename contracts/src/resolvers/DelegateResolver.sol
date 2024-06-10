// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./ICustomResolver.sol";

contract DelegateResolver is ICustomResolver {
    function check(address addr) external pure override returns (bool) {
        return true;
    }
}
