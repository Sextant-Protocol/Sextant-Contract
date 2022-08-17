// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IUserHistory {
    struct OperationInfo {
        uint32 fundNo;
        uint256 operateId; //operateId;	// 1:invest； 2: refund； 3: bonus
        uint256 timestamp;
    }
    struct TokenInfo {
        address token;
        uint256 amount;
    }

    function writeNewHistory(
        address _user,
        uint256 _operateId,
        uint32 _fundNo,
        uint256[] memory _amounts,
        address[] memory _tokens
    ) external returns (bool);

    function getUserOpHistoryLen(address _user) external view returns (uint256);

    function getUserHistoryTokenInfo(address _user, uint256 _index)
        external
        view
        returns (TokenInfo[] memory);
}
