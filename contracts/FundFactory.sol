// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Fund.sol";
import "./InvestPolicy.sol";
import "./FundShareToken.sol";
import "./lib/Modifiers.sol";
import "./interfaces/IFundFactory.sol";
import "./interfaces/IFundStruct.sol";
import "./interfaces/IInvestPolicyTemplate.sol";
import "./interfaces/IMultiSigWallet.sol";

/// @title Fund factory contract
/// @author Henry
/// @notice Create and store information for all funds
contract FundFactory is Modifiers, IFundFactory, IFundStruct {
    /// @notice The No. of fund
    uint32 public fundNo;

    /// @notice Mapping from fund No. => fund address
    mapping(uint => address) public allFunds;

    /// @notice Mapping from user address => uer create funds No.
    mapping(address => uint[]) public userCreateFunds;

    /// @notice All funds on sale
    uint[] public salesFunds;

    /// @notice Mapping from user address => user invest funds No.
    mapping(address => uint[]) public userInvestFunds;

    /// @notice Invest policy template instance
    IInvestPolicyTemplate public policyTemplate;

    /// @notice User history instance
    IUserHistory public userHistory;

    /// @notice Multi sig wallet instance
    IMultiSigWallet public multiSigWallet;

    /// @notice Oracle instance
    IOracle public oracle;

    /// @inheritdoc IFundFactory
    address public override protocolFeeTo;

    /// @inheritdoc IFundFactory
    uint public override managerBonusDivideRatioLimit;

    /// @inheritdoc IFundFactory
    uint public override managerFeeRatioLimit;

    /// @inheritdoc IFundFactory
    uint public override managersLimit;

    function initialize(
        IInvestPolicyTemplate _policyTemplate, IUserHistory _userHistory, IMultiSigWallet _multiSigWallet, IOracle _oracle, address _protocolFeeTo
        ) public initializer {
        __Ownable_init();

        policyTemplate = _policyTemplate;
        userHistory = _userHistory;
        multiSigWallet = _multiSigWallet;
        oracle = _oracle;
        protocolFeeTo = _protocolFeeTo;
        // accuracy is 4
        managerBonusDivideRatioLimit = 2000;
        // accuracy is 6
        managerFeeRatioLimit = 100;
        managersLimit = 10;
    }

    /// @inheritdoc IFundFactory
    function setSalesFunds(uint _fundNo) public override {
        require(_fundNo <= fundNo && _fundNo != 0, "Fund not exist");

        salesFunds.push(_fundNo);
    }

    /// @inheritdoc IFundFactory
    function setUserInvestFunds(address _user, uint _fundNo) public override {
        require(_fundNo <= fundNo && _fundNo != 0, "Fund not exist");

        userInvestFunds[_user].push(_fundNo);
    }

    /// @notice Emitted when fund create
    /// @param _user User address to create the fund
    /// @param _fundNo The No. of the created fund
    /// @param _fund The created fund address
    event CreateFund(address indexed _user, uint indexed _fundNo, address indexed _fund);

    /// @notice Create fund
    /// @param _fundData The value of fund data
    /// @param _policyTempNo The No. of invest policy template
    function createFund(FundData memory _fundData, uint _policyTempNo) public {
        require(_fundData.sponsorDivideRatio <= 10000, "Sponsor divide ratio greater than 10000");
        require(_fundData.raiseData.minSharePurchase < _fundData.raiseData.maxSharePurchase, "Min share equal to or greater than max share");
        require(_fundData.bonusData.bonusRatio <= 10000, "Bonus ratio greater than 10000");
        require(_fundData.bonusData.managerBonusDivideRatio <= managerBonusDivideRatioLimit, "Manager bonus divide ratio greater than limit");
        require(_fundData.manageData.managerFeeRatio <= managerFeeRatioLimit, "Manager fee ratio greater than limit");
        require(_fundData.manageData.numberOfNeedSignedAddresses <= _fundData.manageData.managers.length, "Number of need signed address greater than manager length");

        fundNo++;
        Fund fund = new Fund();
        if (_policyTempNo > 0) {
            InvestPolicy investPolicy = createInvestPolicy(IERC20(address(_fundData.raiseData.raiseToken)), _policyTempNo, address(fund));
            _fundData.investPolicy = address(investPolicy);
        }
        FundShareToken fundShareToken = createFundShareToken(fundNo, _fundData.raiseData.raiseToken, address(fund));
        fund.initialize(_msgSender(), fundNo, _fundData, this, fundShareToken, userHistory, multiSigWallet);

        allFunds[fundNo] = address(fund);
        userCreateFunds[_msgSender()].push(fundNo);

        emit CreateFund(_msgSender(), fundNo, address(fund));
    }

    /// @notice Create invest policy instance by template
    /// @param _raiseToken Token raised by the fund
    /// @param _policyTempNo The No. of invest policy template
    /// @param _fundAddress The address of the fund using the invest policy
    /// @return Invset policy instance
    function createInvestPolicy(IERC20 _raiseToken, uint _policyTempNo, address _fundAddress) private returns (InvestPolicy)  {
        require(policyTemplate.isPolicyTempNoExisted(_policyTempNo), "Policy template no. not exist");

        (, string memory detail, address[] memory defis, IERC20[] memory tokens) = policyTemplate.policyTempInfo(_policyTempNo);

        InvestPolicy investPolicy = new InvestPolicy(defis, tokens, _raiseToken, policyTemplate, detail, _fundAddress, address(oracle));

        return investPolicy;
    }

    /// @notice Create fund share token instance
    /// @param _fundNo The No. of the fund using the fund share token
    /// @param _raiseToken Token raised by the fund
    /// @param _fundAddress The address of the fund using the invest policy
    /// @return Fund share token instance
    function createFundShareToken(uint _fundNo, IERC20Upgradeable _raiseToken, address _fundAddress) private returns (FundShareToken) {
        string memory name = string(abi.encodePacked("FundShare", _fundNo));
        string memory symbol = string(abi.encodePacked("FS", _fundNo));
        IERC20Upgradeable[] memory bonusTokens = new IERC20Upgradeable[](1);
        bonusTokens[0] = _raiseToken;

        FundShareToken fundShareToken = new FundShareToken();
        fundShareToken.initialize(name, symbol, bonusTokens, _fundAddress);

        return fundShareToken;
    }

    /// @notice Reset the protocol usage fee transfer address, only owner can call
    /// @param _protocolFeeTo The protocol usage fee transfer address
    function resetProtocolFeeAddress(address _protocolFeeTo) public onlyOwner {
        protocolFeeTo = _protocolFeeTo;
    }

    /// @notice Reset manager bonus divide ratio limit, only owner can call
    /// @param _managerBonusDivideRatioLimit Manager bonus divide ratio limit
    function resetManagerBonusDivideRatioLimit(uint _managerBonusDivideRatioLimit) public onlyOwner {
        require(_managerBonusDivideRatioLimit <= 5000, "Manager bonus divide ratio limit greater than 5000");

        managerBonusDivideRatioLimit = _managerBonusDivideRatioLimit;
    }

    /// @notice Reset manager fee ratio limit, only owner can call
    /// @param _managerFeeRatioLimit Manager fee ratio limit
    function resetManagerFeeRatioLimit(uint _managerFeeRatioLimit) public onlyOwner {
        require(_managerFeeRatioLimit <= 500, "Manager fee ratio limit greater than 500");

        managerFeeRatioLimit = _managerFeeRatioLimit;
    }

    /// @notice Reset managers limit, only owner can call
    /// @param _managersLimit Managers limit
    function resetManagersLimit(uint _managersLimit) public onlyOwner {
        require(_managersLimit <= 50, "Managers limit greater than 50");

        managersLimit = _managersLimit;
    }
}