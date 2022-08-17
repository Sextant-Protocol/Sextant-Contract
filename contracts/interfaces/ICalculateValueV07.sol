// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

interface ICalculateValue {
    /// @notice Calculate the value invested on this defi protocol
    /// @param _defi the whitelist decentralized finance contracts could called
    /// @param _fundAddress the fund contract address
    /// @return _value the net worth
    /// @return _success true or false
    function calculateValue(address _defi, address _fundAddress)
        external
        view
        returns (uint256 _value, bool _success);
}
