// Copyright (C) 2022 Cycan Technologies

//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "./DemocracyUpgradeable.sol";
import "../interfaces/IFund.sol";
import "../libraries/CompareStrings.sol";

/// @title The basic democracy is proposal for policy changes, parameter changes, etc.
contract BasicDemocracyImpl is DemocracyUpgradeable {
    // make the string can be compare to equals.
    using CompareStrings for string;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;

    EnumerableSetUpgradeable.UintSet internal proposingIds;

    // content of proposal
    struct ProposalContent {
        string name;
        address valueAddr;
        uint256 valueUint;
        bool valueBool;
        uint256 fundParamNo;
        string reason;
        string detail;
    }

    mapping(uint256 => ProposalContent) content; //content of proposal mapping
    mapping(uint256 => IFund.FundData) fundParams; //content of fund params
    uint256 fundParamsNo; //fund params number

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
        bool _valueBool,
        string memory _reason,
        string memory _detail
    ) public returns (uint256) {
        require(
            _name.compareStrings(string("FundLiquidation")),
            "Cannot raise this kind of proposal"
        );

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
            0, //common proposal, fundParamNo == 0
            _reason,
            _detail
        );
        proposal[lastID] = ProposalInfo(
            1,
            proposalNeed,
            initStart,
            _msgSender(),
            1,
            0
        );

        proposingIds.add(lastID);

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

    /**
     * @dev special proposal for change fund params
     * @param _name: proposal name
     * @param _fundParam: new fund params
     * @param _reason:the reason of proposal
     * @param _detail: the detail of proposal
     * @return the last id of proposal
     */
    function toProposal(
        string memory _name,
        IFund.FundData memory _fundParam,
        string memory _reason,
        string memory _detail
    ) public returns (uint256) {
        require(
            _name.compareStrings(string("ModifyFundData")),
            "Can't raise this kind of proposal"
        );

        uint256 initStart = block.number;

        require(
            powerToken.lock(
                _msgSender(),
                proposalNeed,
                initStart + voteDuration - block.number
            ),
            "Can't lock _lockNum tokens"
        );

        fundParamsNo++;
        fundParams[fundParamsNo] = _fundParam;

        lastID += 1;
        content[lastID] = ProposalContent(
            _name,
            address(0),
            0,
            false,
            fundParamsNo,
            _reason,
            _detail
        );
        proposal[lastID] = ProposalInfo(
            1,
            proposalNeed,
            initStart,
            _msgSender(),
            1,
            0
        );

        proposingIds.add(lastID);

        emit Proposal(
            _msgSender(),
            lastID,
            0,
            _name,
            address(0),
            0,
            false,
            proposalNeed
        );
        return lastID;
    }

    /// @dev batch update the state of proposal,implements by children contract.
    function batchUpdate(uint256[] memory _proposalIds) public override returns (bool) {
        uint256 len = _proposalIds.length;
        require(len >0,"Length need GT 0");
        for(uint256 i = 0; i< len; i++){
            require(update(_proposalIds[i]),"batchUpdate failed");
        }

        return true;
    }

    /// @dev Update the status of the proposal,
    /// if the proposal is executed, call the governed contract to modify the parameters or change the status
    function update(uint256 _proposalId) public override returns (bool) {
        uint256 result = getVoteResult(_proposalId);
        ProposalContent storage propContent = content[_proposalId];
        if (result == 1) {
            //1 基金清算
            if (
                propContent.name.compareStrings(
                    string("FundLiquidation")
                ) && propContent.fundParamNo == 0
            ) {
                IFund(beGoverned).startFundLiquidation();
            } else if (
                //2 基金参数修改
                propContent.name.compareStrings(
                    string("ModifyFundData")
                ) && propContent.fundParamNo > 0
            ) {
                uint256 newLen = fundParams[propContent.fundParamNo].manageData.managers.length;
                require(newLen > 0,"Len of new managers Must GT 0");
                bool isChangeManagers = false;

                address[] memory oldManagers = IFund(beGoverned).getManagers();
                if(newLen != oldManagers.length) isChangeManagers = true;
                for(uint256 i = 0; i< newLen; i++) {
                    //only check the manager of same index in array for save gas
                    if(oldManagers[i] != fundParams[propContent.fundParamNo].manageData.managers[i]) {
                        isChangeManagers = true;
                        break;
                    }
                }

                IFund(beGoverned).modifyFundData(
                    fundParams[propContent.fundParamNo],
                    isChangeManagers
                );
            }

            proposal[_proposalId].status = 3;
            proposal[_proposalId].end = block.number;

            proposingIds.remove(_proposalId);

            emit Update(_msgSender(), _proposalId, 3);
        } else if (result == 2) {
            proposal[_proposalId].status = 4;
            proposal[_proposalId].end = block.number;

            proposingIds.remove(_proposalId);

            emit Update(_msgSender(), _proposalId, 4);
        }
        return true;
    }

    /// @dev get the content of proposal with the inputted proposalID
    function getPropContent(uint256 _proposalID)
        public
        view
        returns (ProposalContent memory)
    {
        uint256 pID = _proposalID;
        if (pID == 0) pID = lastID;

        return (content[pID]);
    }

    function hasProposal() public view override returns (bool) {
        return proposingIds.length() > 0;
    }

    function getAllProposalIds() public view returns(uint256[] memory) {
        return proposingIds.values();
    }
}
