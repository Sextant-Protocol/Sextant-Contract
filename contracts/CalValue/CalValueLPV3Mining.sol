// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "../interfaces/ICalculateValueV07.sol";
import "../interfaces/IOracleV07.sol";
import "../interfaces/IUniswapV3Staker.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import "@uniswap/v3-periphery/contracts/libraries/PositionValue.sol";
import "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";
import "@uniswap/v2-periphery/contracts/libraries/SafeMath.sol";

contract CalValueAAVE is ICalculateValue {
    using SafeMath for uint256;

    INonfungiblePositionManager public uniLpNFT;
    IUniswapV3Pool public pool;

    IUniswapV3Staker public defi;
    address public rewardToken;
    uint256 public tokenId;

    address public localToken;
    IOracle public oracle;

    IUniswapV3Staker.IncentiveKey public incentiveKey;
    /// @notice rewardToken => localToken => fee, fee is 500, 3000, 10000
    mapping(address => mapping(address => uint24)) public swapFeeV3;

    constructor(
        INonfungiblePositionManager _uniLpNFT,
        IUniswapV3Pool _pool,
        IUniswapV3Staker _defi,
        address _localToken,
        IOracle _oracle,
        IUniswapV3Staker.IncentiveKey memory _incentiveKey
    ) {
        uniLpNFT = _uniLpNFT;
        pool = _pool;
        defi = _defi;
        localToken = _localToken;
        oracle = _oracle;
        incentiveKey = _incentiveKey;
    }

    /// @inheritdoc ICalculateValue
    function calculateValue(address _defi, address _fundAddress)
        external
        view
        override
        returns (uint256 _value, bool _success)
    {
        require(_defi == address(defi), "The input _defi not match");

        (uint160 sqrtRatioX96, , , , , , ) = pool.slot0();

        _value = _calculateValueUniV3(tokenId, sqrtRatioX96);

        (uint256 amountReward, ) = defi.getRewardInfo(incentiveKey, tokenId);
        uint256 rewardValue = oracle.getAmountOut(
            rewardToken,
            localToken,
            swapFeeV3[rewardToken][localToken],
            amountReward
        );

        _value = _value.add(rewardValue);

        _success = true;
    }

    function _calculateValueUniV3(uint256 _tokenId, uint160 _sqrtRatioX96)
        internal
        view
        returns (uint256)
    {
        (uint256 amount0, uint256 amount1) = PositionValue.principal(
            uniLpNFT,
            _tokenId,
            _sqrtRatioX96
        );

        (uint256 amountIn, uint256 amountLocal) = (amount0, amount1);
        (address tokenIn, address tokenOut) = (pool.token0(), pool.token1());
        if (pool.token0() == localToken) {
            (tokenIn, tokenOut) = (tokenOut, tokenIn);
            (amountIn, amountLocal) = (amount1, amount0);
        }

        (int24 tick, ) = OracleLibrary.consult(address(pool), 60);
        uint256 amountOut = OracleLibrary.getQuoteAtTick(
            tick,
            uint128(amountIn),
            tokenIn,
            tokenOut
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
