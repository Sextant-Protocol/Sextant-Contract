// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPowerToken {
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
    
    function burnFrom(address account, uint256 amount) external;
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

    function lockAmountOf(address _user) external returns (uint256);
}
