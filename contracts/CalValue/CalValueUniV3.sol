// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "../interfaces/ICalculateValueV07.sol";
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
    address public defi;
    address public localToken;

    constructor(
        INonfungiblePositionManager _uniLpNFT,
        IUniswapV3Pool _pool,
        address _defi,
        address _localToken
    ) {
        uniLpNFT = _uniLpNFT;
        pool = _pool;
        defi = _defi;
        localToken = _localToken;
    }

    /// @inheritdoc ICalculateValue
    function calculateValue(address _defi, address _fundAddress)
        external
        view
        override
        returns (uint256 _value, bool _success)
    {
        require(defi == _defi, "The input _defi not match");

        (uint160 sqrtRatioX96, , , , , , ) = pool.slot0();
        uint256 bal = uniLpNFT.balanceOf(_fundAddress);
        uint256 tokenId;
        for (uint256 i = 0; i < bal; i++) {
            tokenId = uniLpNFT.tokenOfOwnerByIndex(_fundAddress, i);

            _value = _value.add(_calculateValueUniV3(tokenId, sqrtRatioX96));
        }

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
