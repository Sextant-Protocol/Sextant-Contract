// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";

contract OracleV3 {
    IUniswapV3Factory public factory =
        IUniswapV3Factory(0x1F98431c8aD98523631AE4a59f267346ea31F984);

    constructor() {}

    function getAmountOut(
        address _token0,
        address _token1,
        uint24 _fee,
        uint256 _amountIn
    ) external view returns (uint256) {
        (int24 tick, ) = OracleLibrary.consult(
            factory.getPool(_token0, _token1, _fee),
            60
        );
        uint256 amountOut = OracleLibrary.getQuoteAtTick(
            tick,
            uint128(_amountIn),
            _token0,
            _token1
        );

        return amountOut;
    }
}
