// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IFundShareToken {
    function transfer(address to, uint256 amount) external returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);

    function drawBonus(address _user)
        external
        returns (
            bool _success,
            address[] memory _bonusTokens,
            uint256[] memory _bonusAmounts
        );

    function offerBonus(
        address _from,
        address _token,
        uint256 _amount
    ) external returns (bool);

    function pendingBonus(address _user)
        external
        view
        returns (address[] memory _addresses, uint256[] memory _amounts);

    function lockablesOf(address _user) external view returns (uint256);

    function approveLock(
        address _to,
        uint256 _amount,
        uint256 _duration
    ) external returns (bool);

    function lock(
        address _user,
        uint256 _amount,
        uint256 _duration
    ) external returns (bool);

    function unlockAll(address _user) external returns (bool);

    function unlock(address _user, uint256 _amount) external returns (bool);

    function burnFrom(address account, uint256 amount) external;

    function mint(address to, uint256 amount) external;
}
