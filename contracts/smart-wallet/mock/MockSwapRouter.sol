// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IPeripheryPayments.sol";

contract MockSwapRouter is ISwapRouter, IPeripheryPayments {
    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        override
        returns (uint256 amountOut)
    {
        return 0;
    }

    function exactInput(ExactInputParams calldata params)
        external
        payable
        override
        returns (uint256 amountOut)
    {
        return 0;
    }

    function exactOutputSingle(ExactOutputSingleParams calldata params)
        external
        payable
        override
        returns (uint256 amountIn)
    {
        return 0;
    }

    function exactOutput(ExactOutputParams calldata params)
        external
        payable
        override
        returns (uint256 amountIn)
    {
        return 0;
    }

    function refundETH() external payable override {
        return;
    }

    function unwrapWETH9(uint256 amountMinimum, address recipient)
        external
        payable
        override
    {
        return;
    }


    function sweepToken(
        address token,
        uint256 amountMinimum,
        address recipient
    ) external payable override {
        return;
    }

    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        return;
    }
}
