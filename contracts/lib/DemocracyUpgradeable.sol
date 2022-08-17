// Copyright (C) 2022 Cycan Technologies

//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "../interfaces/IPowerToken.sol";
import "../interfaces/IBeGoverned.sol";
import "../libraries/CompareStrings.sol";

/// @title The proposal base Contract.
contract DemocracyUpgradeable is OwnableUpgradeable {
    using CompareStrings for string;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;

    struct ProposalInfo {
        uint256 type_; //proposal type 0: admin proposal, 1: common proposal
        uint256 lockNum; //Amount of locked token
        uint256 start; //proposal start time
        //uint256 voteStart; //vote start time == proposal start time
        address proposer; //who proposal
        uint8 status; //Proposal status: 1.Proposal 2.Voting 3.Proposal passed 4.Proposal failed 5.Votes counted 6.Replaced
        uint256 end; //proposal end time when proposal executed
    }

    struct VoteInfo {
        uint256 approve; //Number of votes in approve
        uint256 against; //Number of votes in against
        uint256 voters; //Number of votes
    }

    //Governance token address
    IPowerToken public powerToken;
    //Governed contract address
    address public beGoverned;

    uint256 public proposalNeed; //Proposal minimum lock token
    uint256 public voteUsersNeed; //minimum number of account to vote
    uint256 public voteDuration; //Voting duration block number

    mapping(uint256 => ProposalInfo) public proposal; //proposal info map
    uint256 public lastID; //last proposal ID

    mapping(uint256 => VoteInfo) public vote; //vote map.

    //User voting data, a positive number is the number of positive votes, a negative number is the number of negative votes, uint is the proposal ID
    mapping(address => mapping(uint256 => int256)) public userVote;

    //administrator
    mapping(address => bool) public admin;

    //basic democracy address
    address public basicDemocracy;
    //super democracy address
    address public superDemocracy;

    bool _enterStatus = false;


    event Vote(
        address indexed sender,
        uint256 indexed proposalID,
        int256 amount
    );

    //only admin can calls
    modifier onlyAdmin() {
        require(admin[_msgSender()], "Require admin");
        _;
    }

    // forbidden reentrant calls
    modifier nonReentrant() {
        require(!_enterStatus, "ReentrancyGuard: reentrant call");
        _enterStatus = true;
        _;
        _enterStatus = false;
    }

    /**
     * @dev initial settings
     * 1. powerToken voting power Token
     * 2. beGoverned contract to accept governance
     */
    constructor() {}

    function __Democracy_init(
        IPowerToken _powerToken,
        uint256 _proposalNeed,
        uint256 _voteUsersNeed,
        uint256 _voteDuration,
        address _beGoverned
    ) internal onlyInitializing {
        __Ownable_init();

        powerToken = _powerToken;
        lastID = 0;
        proposalNeed =_proposalNeed;//with decimals
            
        voteUsersNeed = _voteUsersNeed; //Minimum number of accounts to vote
        voteDuration = _voteDuration; //Voting duration
        beGoverned = _beGoverned;
    }

    /// @dev set the address to be governed by owner
    function setBeGoverned(IBeGoverned _beGoverned) public onlyOwner {
        beGoverned = address(_beGoverned);
    }

    /**
     * @dev modify base parameters
     * @param _name parameter name
     * @param  _valueUint parameter value
     */
    function setParameters(string memory _name, uint256 _valueUint)
        public
        onlyOwner
    {
        if (_name.compareStrings(string("proposalNeed")))
            proposalNeed = _valueUint;
        else if (_name.compareStrings(string("voteUsersNeed")))
            voteUsersNeed = _valueUint;
        else if (_name.compareStrings(string("voteDuration")))
            voteDuration = _valueUint;
        else require(false, "No such parameter can be set");
    }

    /// @dev reset the administrator by owner
    function setAdmin(address _admin, bool _set) public onlyOwner {
        admin[_admin] = _set;
    }

    /**
     * @dev get proposal state
     * @param _proposalID: proposal ID,get the last proposalID when input is zero.
     * There is no proposal when the result is Zero.
     */
    function getPropState(uint256 _proposalID) public view returns (uint8) {
        uint256 proposalID = _proposalID;
        if (proposalID == 0 || proposalID > lastID) return 0;
        ProposalInfo storage _proposal = proposal[_proposalID];

        if (_proposal.status == 1 || _proposal.status == 2) {
            if (block.number < _proposal.start) return 1;
            else if (block.number <= _proposal.start + voteDuration)
                return 2;
            else return 5;
        } else return _proposal.status;
    }



    /**
     * @dev Query whether there is a proposal currently
     * @return true to indicate yes, false to indicate no
     */
    function hasProposal() public view virtual returns (bool) {
        return _hasProposal(lastID);
    }

    function _hasProposal(uint256 proposalId) internal view returns (bool) {
        uint256 status = getPropState(proposalId);
        if (status == 1 || status == 2 || status == 5) return true;
        else return false;
    }

    /// @dev update the state of proposal,implements by children contract.
    function update(uint256 _proposalId) public virtual returns (bool) {
        return false;
    }

    /// @dev batch update the state of proposal,implements by children contract.
    function batchUpdate(uint256[] memory _proposalIds) public virtual returns (bool) {
        return false;
    }

    /**
     * @dev Vote for the current proposal, a positive number is the number of votes for approve, and a negative number is the number of votes against
     * The user need invoke the approveLock function of powerToken because need to lock the staking token of this user.
     */
    function toVote(uint256 _proposalId, int256 _amount) public nonReentrant returns (bool) {
        require(
            userVote[_msgSender()][_proposalId] == 0,
            "Already vote the proposal!"
        );

        uint256 poll;
        if (_amount < 0) poll = uint256(-_amount);
        else poll = uint256(_amount);
        require(poll > 0, "Poll can't be zero");

        uint256 status = getPropState(_proposalId);
        require(status == 2, "Not at vote status");

        require(
            powerToken.lock(
                _msgSender(),
                poll,
                proposal[_proposalId].start + voteDuration - block.number
            ),
            "Can't lock poll"
        );

        userVote[_msgSender()][_proposalId] = _amount;
        if (_amount > 0) vote[_proposalId].approve += poll;
        else vote[_proposalId].against += poll;
        vote[_proposalId].voters += 1;

        emit Vote(_msgSender(), _proposalId, _amount);
        return true;
    }

    /// @dev get the vote data
    function getVoteData(uint256 _proposalID)
        public
        view
        returns (
            uint256 _approved,
            uint256 _against,
            uint256 _voters
        )
    {
        return (
            vote[_proposalID].approve,
            vote[_proposalID].against,
            vote[_proposalID].voters
        );
    }

    /**
     * @dev Vote statistics result,
     * @ @return Different numbers represent different proposal statuses
     * 0: No result yet,1: Proposal passed, 2: Proposal failed,
     * 3: Proposal passed and implemented, 4: Proposal failed and ended
     */
    function getVoteResult(uint256 _proposalID) public view returns (uint8) {
        uint256 status = getPropState(_proposalID);
        if (status == 1 || status == 2) return 0;
        else if (status == 3) return 3;
        else if (status == 4) return 4;
        else if (status == 5) {
            if (vote[_proposalID].voters < voteUsersNeed) return 2;
            uint256 powerSupply = IERC20MetadataUpgradeable(address(powerToken))
                .totalSupply();
            if (
                countingVote(
                    vote[_proposalID].approve,
                    vote[_proposalID].against,
                    powerSupply
                )
            ) return 1;
            else return 2;
        } else return 0;
    }

    /**
     * @dev calculate the vote result
     * approve is the number of approve,_against is the number of against,_powerSupply is the all token in all net.
     */
    function countingVote(
        uint256 _approve,
        uint256 _against,
        uint256 _powerSupply
    ) public view returns (bool) {
        _approve =
            _approve /
            (10**IERC20MetadataUpgradeable(address(powerToken)).decimals());
        _against =
            _against /
            (10**IERC20MetadataUpgradeable(address(powerToken)).decimals());
        uint256 turnout = _approve + _against;
        uint256 electorate = _powerSupply /
            (10**IERC20MetadataUpgradeable(address(powerToken)).decimals());

        require(
            turnout > 0 && electorate > 0,
            "Turnout and _powerSupply must > 0"
        );
        return _approve > _against;
        // uint256 a = _against**2 * electorate;
        // uint256 b = _approve**2 * turnout;
        // if (a < b) return true;
        // else return false;
    }

}
