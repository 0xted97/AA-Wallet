// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "./../oracle/IOracle.sol";

contract MockOracle is IOracle {
    function getTokenValueOfEth(uint256 ethOutput) external pure returns (uint256 tokenInput) {
        // return 1 token = 0.0001 eth
        return ethOutput / 10000;
    }

    int256 public price;
    uint8 public decimals = 8;

    constructor(int256 _price) {
        price = _price;
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        // solhint-disable-next-line not-rely-on-time
        return (
            73786976294838215802,
            price,
            1680509051,
            block.timestamp,
            73786976294838215802
        );
    }

}
