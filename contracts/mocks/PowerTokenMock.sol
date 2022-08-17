// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../PowerToken.sol";

contract PowerTokenMock is PowerToken {
    modifier onlyFund() override{
        require(_msgSender() == fundAddress || _msgSender() == owner(), "Only Fund can call");

        _;
    }

    function getApproveLockInfo(address _user)
        public
        view
        returns(address _locker, uint256 _amount, uint256 _duration)
    {
        LockApproved memory _lockAppInfo = userLockApp[_user];
        _locker = _lockAppInfo.locker;
        _amount = _lockAppInfo.amount;
        _duration = _lockAppInfo.duration;
    }

    function getLockInfo(address _user)
        public
        view
        returns(address _locker, uint256 _amount, uint256 _timestamp, uint256 _duration)
    {
        LockInfo memory _lockInfo = userLock[_user];
        _locker = _lockInfo.locker;
        _amount = _lockInfo.amount;
        _timestamp = _lockInfo.timestamp;
        _duration = _lockInfo.duration;
    }
}
