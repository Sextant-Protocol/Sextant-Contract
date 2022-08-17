pragma solidity ^0.8.0;

import "../interfaces/IPowerToken.sol";

interface IBasicProxyInitialize {
    function initialize(
        IPowerToken _powerToken,
        uint256 _proposalNeed,
        uint256 _voteUsersNeed,
        uint256 _voteDuration,
        address _beGoverned
    ) external;
}
