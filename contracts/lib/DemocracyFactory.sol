pragma solidity ^0.8.0;

import "@openzeppelin/contractsV08/proxy/transparent/ProxyAdmin.sol";
import "./BasicDemocracyImpl.sol";
import "./MultiSigDemocracyImpl.sol";
import "./UpgradeableProxy.sol";
import "../interfaces/IBasicProxyInitialize.sol";
import "../interfaces/IMultiSigWalletProxyInitialize.sol";
import "../interfaces/IPowerToken.sol";

contract DemocracyFactory is ProxyAdmin {
    address basicDemocracyImpl;
    address multiSigDemocracyImpl;
    address public multiSigWalletImpl;

    struct DemocracyInfo {
        address basicDemocracy;
        address multiSigDemocracy;
        address multiSigWallet;
        address fund;
    }

    // fundAddress => DemocracyInfo
    mapping(address => DemocracyInfo) public fund2DemocracyInfo;

    constructor(
        address _basicDemocracyImpl,
        address _multiSigDemocracyImpl,
        address _multiSigWalletImpl
    ) {
        basicDemocracyImpl = _basicDemocracyImpl;
        multiSigDemocracyImpl = _multiSigDemocracyImpl;
        multiSigWalletImpl = _multiSigWalletImpl;
    }

    function createDemocracys(
        address _fundAddress,
        IPowerToken _powerToken,
        uint256 _proposalNeed,
        uint256 _voteUsersNeed,
        uint256 _voteDuration,
        address[] memory _owners,
        uint256 _required
    ) public onlyOwner {
        // create basicDemocracy proxy contract and initialize
        UpgradeableProxy basicDemocracyProxy = new UpgradeableProxy(
            basicDemocracyImpl,
            address(this),
            ""
        );

        IBasicProxyInitialize(address(basicDemocracyProxy)).initialize(
            _powerToken,
            _proposalNeed,
            _voteUsersNeed,
            _voteDuration,
            _fundAddress
        );

        // create multiSigDemocracy proxy contract and initialize
        UpgradeableProxy multiSigDemocracyProxy = new UpgradeableProxy(
            multiSigDemocracyImpl,
            address(this),
            ""
        );

        // create multiSigWallet proxy contract and
        UpgradeableProxy multiSigWalletProxy = new UpgradeableProxy(
            multiSigWalletImpl,
            address(this),
            ""
        );

        IMultiSigWalletProxyInitialize(address(multiSigWalletProxy)).initialize(
                _owners,
                _required,
                address(multiSigDemocracyProxy)
            );

        IBasicProxyInitialize(address(multiSigDemocracyProxy)).initialize(
            _powerToken,
            _proposalNeed,
            _voteUsersNeed,
            _voteDuration,
            address(multiSigWalletProxy)
        );

        fund2DemocracyInfo[_fundAddress] = DemocracyInfo(
            address(basicDemocracyProxy),
            address(multiSigDemocracyProxy),
            address(multiSigWalletProxy),
            _fundAddress
        );
    }
}
