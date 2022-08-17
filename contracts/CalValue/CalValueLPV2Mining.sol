// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "../interfaces/ICalculateValueV07.sol";
import "../interfaces/IMasterChef.sol";
import "../interfaces/IOracleV07.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/libraries/UniswapV2LiquidityMathLibrary.sol";
import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CalValueLPV2Mining is ICalculateValue {
    using SafeMath for uint256;

    IMasterChef public defi;
    address public rewardToken;
    uint256 public poolId;

    IUniswapV2Pair public uniLp;
    address public localToken;
    address public factory;
    IOracle public oracle;

    /// @notice rewardToken => localToken => fee, fee is 500, 3000, 10000
    mapping(address => mapping(address => uint24)) public swapFeeV3;

    constructor(
        IUniswapV2Pair _uniLp,
        IMasterChef _defi,
        address _localToken,
        address _factory
    ) {
        uniLp = _uniLp;
        defi = _defi;
        localToken = _localToken;
        factory = _factory;
    }

    /// @inheritdoc ICalculateValue
    function calculateValue(address _defi, address _fundAddress)
        external
        view
        override
        returns (uint256 _value, bool _success)
    {
        require(_defi == address(defi), "The input _defi not match");
        (uint256 lpBalance, ) = defi.userInfo(poolId, _fundAddress);
        _value = _calculateValueUniV2(lpBalance);

        //calculate reward net worth
        uint256 amountReward = defi.pendingSushi(poolId, _fundAddress);
        uint256 rewardValue = oracle.getAmountOut(
            rewardToken,
            localToken,
            swapFeeV3[rewardToken][localToken],
            amountReward
        );

        _value = _value.add(rewardValue);

        _success = true;
    }

    function _calculateValueUniV2(uint256 _lpBalance)
        internal
        view
        returns (uint256)
    {
        (address token0, address token1) = (uniLp.token0(), uniLp.token1());

        (uint256 amount0, uint256 amount1) = UniswapV2LiquidityMathLibrary
            .getLiquidityValue(factory, token0, token1, _lpBalance);

        (address tokenIn, address tokenOut) = (token0, token1);
        (uint256 amountIn, uint256 amountLocal) = (amount0, amount1);

        if (token0 == localToken) {
            (tokenIn, tokenOut) = (token1, token0);
            (amountIn, amountLocal) = (amount1, amount0);
        }

        (uint256 reserveIn, uint256 reserveOut) = UniswapV2Library.getReserves(
            factory,
            tokenIn,
            tokenOut
        );

        uint256 amountOut = UniswapV2Library.getAmountOut(
            amountIn,
            reserveIn,
            reserveOut
        );

        return amountLocal.add(amountOut);
    }

    /// @notice Copy from OpenZeppelin Contracts v4.4.1 (utils/AddressUpgradeable.sol)
    function isContract(address account) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }
}
