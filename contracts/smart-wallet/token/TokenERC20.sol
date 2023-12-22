// contracts/GLDToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TokenERC20 is ERC20 {
    constructor() ERC20("TokenERC20", "TokenERC20 AA") {
        _mint(msg.sender, 1_000_000_000 * 10 ** 18);
    }
}