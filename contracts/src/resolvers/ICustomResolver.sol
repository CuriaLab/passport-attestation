// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface ICustomResolver {
    function check(address addr) external view returns (bool);
}
