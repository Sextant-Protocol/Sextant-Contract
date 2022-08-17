// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../InvestPolicyTemplate.sol";
import "hardhat/console.sol";

contract InvestPolicyTemplateMock is InvestPolicyTemplate {

    function getDefiInvestInfoLen(address _defi) public view returns(uint _len) {
        _len = defiInvestFuncs[_defi].length;
    }

    function getDefiQueryInfoLen(address _defi) public view returns(uint _len) {
        _len = defiQueryFuncs[_defi].length;
    }
}
