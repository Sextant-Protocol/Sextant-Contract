// Copyright (C) 2022 Cycan Technologies

//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../lib/DemocracyUpgradeable.sol";
import "../interfaces/IPowerToken.sol";
import "../interfaces/IMultiSigWallet.sol";

/// @title The basic democracy is proposal for policy changes, parameter changes, etc.
contract MockDemocracy is DemocracyUpgradeable {
    constructor() {}

    function initialize(
        IPowerToken _powerToken,
        uint256 _proposalNeed,
        uint256 _voteUsersNeed,
        uint256 _voteDuration,
        address _beGoverned
    ) public initializer {
        __Democracy_init(
            _powerToken,
            _proposalNeed,
            _voteUsersNeed,
            _voteDuration,
            _beGoverned
        );
    }
}
