// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./ICustomResolver.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract DelegateResolver is ICustomResolver {
    ERC20Votes immutable opToken =
        ERC20Votes(0x4200000000000000000000000000000000000042);

    function check(
        address addr,
        bytes calldata
    ) external view override returns (bool) {
        return opToken.getVotes(addr) > 0;
    }
}
