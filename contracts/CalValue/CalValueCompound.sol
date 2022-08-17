// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/ICalculateValue.sol";
import "../interfaces/ICToken.sol";
import "@openzeppelin/contractsV08/token/ERC20/IERC20.sol";
import "@openzeppelin/contractsV08/access/Ownable.sol";

contract CalValueCOMP is ICalculateValue {
    ICToken public cToken;
    address public defi;

    constructor(ICToken _cToken, address _defi) {
        cToken = _cToken;
        defi = _defi;
    }

    /// @inheritdoc ICalculateValue
    function calculateValue(address _defi, address _fundAddress)
        external
        view
        override
        returns (uint256 _value, bool _success)
    {
        require(defi == _defi, "The input _defi not match");
        uint256 bal = cToken.balanceOf(_fundAddress);
        uint256 exchangeRateCurrent = cToken.exchangeRateCurrent(); // per 1e18
        // the amount redeem of underlying Token = bal * exchangeRateCurrent;
        _value = (bal * exchangeRateCurrent) / 1e18;
        _success = true;
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
