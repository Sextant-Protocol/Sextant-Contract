// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/ICalculateValue.sol";
import "@openzeppelin/contractsV08/token/ERC20/IERC20.sol";
import "@openzeppelin/contractsV08/access/Ownable.sol";

contract CalValueAAVE is ICalculateValue {
    IERC20 public aToken;
    address public defi;

    constructor(IERC20 _aToken, address _defi) {
        aToken = _aToken;
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
        _value = aToken.balanceOf(_fundAddress);
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
