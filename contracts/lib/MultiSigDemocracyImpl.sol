// Copyright (C) 2022 Cycan Technologies

//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./DemocracyUpgradeable.sol";
import "../interfaces/IPowerToken.sol";
import "../interfaces/IFund.sol";

/// @title The multiSig democracy is proposal for parameter changes of fund contract
contract MultiSigDemocracyImpl is DemocracyUpgradeable {

    using CompareStrings for string;

    // content of proposal
    struct ProposalContent {
        string name;
        address valueAddr;
        uint256 valueUint;
        bool valueBool;
        uint256 fundParamNo;
    }

    mapping(uint256 => ProposalContent) content; //content of proposal mapping

    event Proposal(
        address indexed sender,
        uint256 indexed proposalID,
        uint256 indexed type_,
        string name,
        address valueAddr,
        uint256 valueUint,
        bool valueBool,
        uint256 lockNum
    );
    event Update(
        address indexed sender,
        uint256 indexed proposalID,
        uint256 result
    );

    /// @dev Invoke the super constructor
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

    /**
     * @dev common proposal
     * @param _name: proposal name,
     * @param _valueAddr: nothing,just station，
     * @param _valueUint:the new value of K.
     */
    function toProposal(
        string memory _name,
        address _valueAddr,
        uint256 _valueUint,
        bool _valueBool
    ) public returns (uint256) {
        require(
            _name.compareStrings(string("ChangeNumberOfNeedSignedAddresses")),
            "Can't raise this kind of proposal"
        );
        update();
        require(!hasProposal(),"Has unaccomplished proposal");

        uint256 initStart = block.number;

        require(
            powerToken.lock(
                _msgSender(),
                proposalNeed,
                initStart + voteDuration - block.number
            ),
            "Can't lock _lockNum tokens"
        );

        lastID += 1;
        content[lastID] = ProposalContent(
            _name,
            _valueAddr,
            _valueUint,
            _valueBool,
            0 //common proposal, fundParamNo == 0
        );
        proposal[lastID] = ProposalInfo(
            1,
            proposalNeed,
            initStart,
            _msgSender(),
            1,
            0
        );

        emit Proposal(
            _msgSender(),
            lastID,
            0,
            _name,
            _valueAddr,
            _valueUint,
            _valueBool,
            proposalNeed
        );
        return lastID;
    }

    modifier validRequirement(uint ownerCount, uint _required) {
        require(
            _required <= ownerCount
            && _required != 0
            && ownerCount != 0,
            "requiredCount err"
            );
        _;
    }

    /// @dev Update the status of the proposal,
    /// if the proposal is executed, call the governed contract to modify the parameters
    function update() public returns (bool) {
        uint256 result = getVoteResult(lastID);
        if (result == 1) {
            require(
                content[lastID].name.compareStrings(string("ChangeNumberOfNeedSignedAddresses")),
                "Can't raise this kind of proposal"
            );
            IFund(beGoverned).changeNumberOfNeedSignedAddresses(
                uint8(content[lastID].valueUint)
            );
            proposal[lastID].status = 3;
            proposal[lastID].end = block.number;

            emit Update(_msgSender(), lastID, 3);
        } else if (result == 2) {
            proposal[lastID].status = 4;
            proposal[lastID].end = block.number;

            emit Update(_msgSender(), lastID, 4);
        }
        return true;
    }

    /// @dev get the content of proposal with the inputted proposalID
    function getPropContent(uint256 _proposalID)
        public
        view
        returns (
            string memory,
            address,
            uint256,
            bool
        )
    {
        uint256 pID = _proposalID;
        if (pID == 0) pID = lastID;
        return (
            content[pID].name,
            content[pID].valueAddr,
            content[pID].valueUint,
            content[pID].valueBool
        );
    }
}
