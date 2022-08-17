// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IUserHistory.sol";

contract UserHistory is OwnableUpgradeable,IUserHistory {
    mapping(address => bool) public internalCaller;

    mapping(address => OperationInfo[]) public userOpHistory;
    mapping(address => mapping(uint256 => TokenInfo[]))
        public userHistoryTokenInfo;

    modifier onlyInternal() {
        require(
            internalCaller[_msgSender()],
            "Internalable: caller is not a internal caller"
        );
        _;
    }

    constructor() {}

    function initialize() public initializer {
        __Ownable_init();
    }

    function writeNewHistory(
        address _user,
        uint256 _operateId,
        uint32 _fundNo,
        uint256[] memory _amounts,
        address[] memory _tokens
    ) public override onlyInternal returns (bool) {
        userOpHistory[_user].push(
            OperationInfo({
                operateId: _operateId,
                fundNo: _fundNo,
                timestamp: block.timestamp
            })
        );

        uint256 i = userOpHistory[_user].length - 1;
        for (uint256 index = 0; index < _amounts.length; index++) {
            userHistoryTokenInfo[_user][i].push(
                TokenInfo({amount: _amounts[index], token: _tokens[index]})
            );
        }

        return true;
    }

    function setInternalCaller(address _internal, bool _set) public onlyOwner {
        internalCaller[_internal] = _set;
    }

    function getUserOpHistoryLen(address _user)
        public
        view
        override
        returns (uint256)
    {
        return userOpHistory[_user].length;
    }

    function getUserHistoryTokenInfo(address _user, uint256 _index)
        public
        view
        override
        returns (TokenInfo[] memory)
    {
        return userHistoryTokenInfo[_user][_index];
    }
}
