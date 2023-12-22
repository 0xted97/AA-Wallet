// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */
/* solhint-disable no-empty-blocks */

import "../interfaces/IEntryPoint.sol";

/**
 * Basic account implementation.
 * This contract provides the basic logic for implementing the IAccount interface - validateUserOp
 * Specific account implementation should inherit it and provide the account-specific logic.
 */
abstract contract BaseAccountFactory {

    address public immutable accountImplementation;
    address public immutable entryPoint;

    constructor(address _accountImpl, address _entryPoint) {
        accountImplementation = _accountImpl;
        entryPoint = _entryPoint;
    }
}
