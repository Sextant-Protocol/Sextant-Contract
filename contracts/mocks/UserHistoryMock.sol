// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../UserHistory.sol";

contract UserHistoryMock is UserHistory {
    function getOperationInfo(
        address _user, uint256 _index
    ) public view returns(uint32 _fundNo, uint256 _operateId, uint256 _timestamp) {
        OperationInfo storage _info = userOpHistory[_user][_index];
        _fundNo = _info.fundNo;
        _operateId = _info.operateId;
        _timestamp = _info.timestamp;
    }
}
