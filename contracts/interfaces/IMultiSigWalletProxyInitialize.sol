pragma solidity ^0.8.0;

import "../interfaces/IPowerToken.sol";

interface IMultiSigWalletProxyInitialize {
    function initialize(
        address[] memory _owners,
        uint256 _required,
        address _multiDemocracy
    ) external;
}
