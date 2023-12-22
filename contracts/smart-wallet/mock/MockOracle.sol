// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "./../oracle/IOracle.sol";

contract MockOracle is IOracle {
    function getTokenValueOfEth(uint256 ethOutput) external pure returns (uint256 tokenInput) {
        // return 1 token = 0.0001 eth
        return ethOutput / 10000;
    }

    function decimals() external pure returns (uint8) {
        return 18;
    }

    function latestRoundData() external pure returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound){
        return (0, 0, 0, 0, 0);
    }
}
