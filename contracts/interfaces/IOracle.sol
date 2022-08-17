// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IOracle {
    function getAmountOut(
        address _token0,
        address _token1,
        uint256 _fee,
        uint256 _amountIn
    ) external view returns (uint256);
}
