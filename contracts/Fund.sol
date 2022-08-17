// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SignedSafeMathUpgradeable.sol";
import "./FundOperate.sol";
import "./lib/Modifiers.sol";
import "./interfaces/IFund.sol";
import "./interfaces/IFundFactory.sol";
import "./interfaces/IFundShareToken.sol";
import "./interfaces/IInvestPolicy.sol";
import "./interfaces/IUserHistory.sol";
import "./interfaces/IMultiSigWallet.sol";

/// @title Fund main contract
/// @author Henry
/// @notice Implement all functions of the fund
contract Fund is FundOperate, Modifiers, IFund {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeMathUpgradeable for uint;
    using SignedSafeMathUpgradeable for int;

    /// @notice The No. of this fund
    uint32 public fundNo;

    /// @notice The owner of this fund
    address public sponsor;

    /// @notice FundData instance
    FundData public fundData;

    /// @notice Indication of whether the invset policy address has changed
    bool public isChangeInvestPolicy;
    /// @notice Changed invset policy address
    address public newInvestPolicy;

    /// @notice Fund factory instance
    IFundFactory public factory;

    /// @notice Fund share token instance and accuracy
    IFundShareToken public fundShareToken;
    uint8 public fundShareTokenAccuracy;

    /// @notice Invest policy instance
    IInvestPolicy public investPolicy;

    /// @notice User history instance
    IUserHistory public userHistory;

    /// @notice Multi sig wallet instance
    IMultiSigWallet public multiSigWallet;

    /// @notice Used to enumerate fund's status
    enum FundStatus {
        WAITINGFORSALE,
        ONSALE,
        SALESFAILED,
        CLOSED,
        SETTLEMENT,
        REDEMPTION,
        LIQUIDATION,
        STOP
    }

    /// @notice Fund status instance
    FundStatus public status;

    /// @notice Value used during fund sales period
    uint public salesPeriodStartTime;
    uint public totalSalesShare;
    mapping(address => uint) public userShare;

    /// @notice Value used during fund closed period
    uint public closedPeriodStartTime;
    uint public initialTotalValue;

    uint public lastBonusTime;
    uint public lastBonusAfterNetValue;
    uint public totalUsersBonusAmount;

    /// @notice Value used during fund redemption period
    uint public redemptionPeriodStartTime;

    uint public redemptionTotalValue;
    uint public redemptionNetValue;
    int public redemptionIncomeRatio;

    /// @notice Used to store fund history data
    struct HistoryData {
        uint recordTime;
        uint totalValue;
        uint fundNetValue;
        int fundIncomeRatio; // accuracy is 4
        uint manageFee;
        mapping(IERC20 => uint) tokenNum;
        mapping(IERC20 => uint) tokenValue;
    }

    /// @notice Start from 1
    uint public historyDataId;

    /// @notice Mapping from history data id => history data
    mapping(uint => HistoryData) public historyDatas;

    /// @notice Emitted when owner start fund sales period
    /// @param _owner The sponsor of this fund
    /// @param _fundNo The No. of this fund
    event StartFundSales(address indexed _owner, uint indexed _fundNo);

    /// @notice Emitted when admin close fund sales and start fund closed period
    /// @param _admin The manager of this fund
    /// @param _fundNo The No. of this fund
    event StartFundClosed(address indexed _admin, uint indexed _fundNo);

    /// @notice Emitted when admin close fund sales and sales fail
    /// @param _admin The manager of this fund
    /// @param _fundNo The No. of this fund
    event FundSalesFailed(address indexed _admin, uint indexed _fundNo);

    /// @notice Emitted when admin action fund invest
    /// @param _admin The manager of this fund
    /// @param _fundNo The No. of this fund
    /// @param _defi The whitelist decentralized finance contracts could called
    /// @param _params The bytecode of invest function
    /// @param _token The income token
    event FundInvest(address indexed _admin, uint indexed _fundNo, address _defi, bytes _params, address _token);

    /// @notice Emitted when user action fund bonus
    /// @param _user The user of this fund
    /// @param _fundNo The No. of this fund
    /// @param _protocolFee Protocol usage fee charged by the platform
    /// @param _managersBonusAmount The bonus amount of managers
    /// @param _usersBonusAmount The bonus amount of users
    event FundBonus(address indexed _user, uint indexed _fundNo, uint _protocolFee, uint _managersBonusAmount, uint _usersBonusAmount);

    /// @notice Emitted when admin start fund settlement
    /// @param _admin The manager of this fund
    /// @param _fundNo The No. of this fund
    event StartFundSettlement(address indexed _admin, uint indexed _fundNo);

    /// @notice Emitted when admin start fund liquidation
    /// @param _fundNo The No. of this fund
    event StartFundLiquidation(uint indexed _fundNo);

    /// @notice Emitted when user action fund settlement
    /// @param _user The user of this fund
    /// @param _fundNo The No. of this fund
    /// @param _fundNetValue Net value of the fund after settlement or liquidation
    event FundSettlement(address indexed _user, uint indexed _fundNo, uint _fundNetValue);

    /// @notice Emitted when admin action fund continuation
    /// @param _admin The manager of this fund
    /// @param _fundNo The No. of this fund
    event FundContinuation(address indexed _admin, uint indexed _fundNo);

    function initialize(
        address _owner, uint32 _fundNo, FundData memory _fundData, IFundFactory _factory, 
        IFundShareToken _fundShareToken, IUserHistory _userHistory, IMultiSigWallet _multiSigWallet
        ) public initializer {
        __Ownable_init();

        transferOwnership(_owner);

        fundNo = _fundNo;
        sponsor = _owner;
        fundData = _fundData;
        factory = _factory;
        fundShareToken = _fundShareToken;
        fundShareTokenAccuracy = IERC20MetadataUpgradeable(address(_fundShareToken)).decimals();
        investPolicy = IInvestPolicy(fundData.investPolicy);
        userHistory = _userHistory;
        multiSigWallet = _multiSigWallet;
        status = FundStatus.WAITINGFORSALE;
    }

    /// @notice Set fund data
    /// @param _fundData The value of fund data
    function _setFundData(FundData memory _fundData) private {
        require(_fundData.sponsorDivideRatio <= 10000, "Sponsor divide ratio greater than 10000");
        require(_fundData.raiseData.minSharePurchase < _fundData.raiseData.maxSharePurchase, "Min share equal to or greater than max share");
        require(_fundData.bonusData.bonusRatio <= 10000, "Bonus ratio greater than 10000");
        require(_fundData.bonusData.managerBonusDivideRatio <= factory.managerBonusDivideRatioLimit(), "Manager bonus divide ratio greater than limit");
        require(_fundData.manageData.managerFeeRatio <= factory.managerFeeRatioLimit(), "Manager fee ratio greater than limit");
        require(_fundData.manageData.managers.length <= factory.managersLimit(), "Managers greater than limit");
        require(_fundData.manageData.numberOfNeedSignedAddresses <= _fundData.manageData.managers.length, "Number of need signed addresses greater than manager length");

        fundData = _fundData;
    }

    /*
     * Fund waiting for sale tatus
     */
    /// @notice Reset fund data, only owner can call
    /// @param _fundData The value of fund data
    function resetFundData(FundData memory _fundData) public onlyOwner {
        require(status == FundStatus.WAITINGFORSALE, "Fund is not in waiting for sale status");

        _setFundData(_fundData);
    }

    /// @notice Start fund sales, only owner can call
    function startFundSales() public onlyOwner {
        require(status == FundStatus.WAITINGFORSALE, "Fund is not in waiting for sale status");

        address[] storage managers = fundData.manageData.managers;
        for (uint i = 0; i < managers.length; i++) {
            setAdmin(managers[i], true);
        }

        factory.setSalesFunds(fundNo);

        status = FundStatus.ONSALE;
        salesPeriodStartTime = block.timestamp;

        emit StartFundSales(_msgSender(), fundNo);
    }

    /*
     * Fund on sale status
     */
    /// @notice Strart fund closed period
    function startFundClosed() private {
        closedPeriodStartTime = lastBonusTime = block.timestamp;
        if (status == FundStatus.ONSALE) {
            initialTotalValue = totalSalesShare.mul(fundData.raiseData.initialNetValue).div(10 ** fundShareTokenAccuracy);
            lastBonusAfterNetValue = fundData.raiseData.initialNetValue;
        } else {
            initialTotalValue = totalSalesShare.mul(redemptionNetValue).div(10 ** fundShareTokenAccuracy);
            lastBonusAfterNetValue = redemptionNetValue;
            if (isChangeInvestPolicy) {
                fundData.investPolicy = newInvestPolicy;
                isChangeInvestPolicy = false;
            }
        }

        status = FundStatus.CLOSED;

        IERC20Upgradeable raiseToken = fundData.raiseData.raiseToken;
        uint balance = raiseToken.balanceOf(address(this));
        raiseToken.safeTransfer(fundData.investPolicy, balance);

        emit StartFundClosed(_msgSender(), fundNo);
    }

    /// @notice Fund sales failed
    function salesFailed() private {
        status = FundStatus.SALESFAILED;
        initialTotalValue = totalSalesShare.mul(fundData.raiseData.initialNetValue).div(10 ** fundShareTokenAccuracy);

        emit FundSalesFailed(_msgSender(), fundNo);
    }

    /// @notice Close fund sales, only admin can call
    function closeFundSales() public onlyAdmin {
        require(status == FundStatus.ONSALE, "Fund is not in on sale status");

        if (totalSalesShare >= fundData.raiseData.targetRaiseShare) {
            startFundClosed();
        } else {
            require(block.timestamp > salesPeriodStartTime + fundData.raiseData.raisePeriod, "Fund is in the sale period");

            if (totalSalesShare >= fundData.raiseData.minRaiseShare) {
                startFundClosed();
            } else {
                salesFailed();
            }
        }
    }

    /*
     * Fund closed status
     */
    /// @notice Fund invest
    /// @param _defi The whitelist decentralized finance contracts could called
    /// @param _params The bytecode of invest function
    /// @param _token The income token
    /// @param _hasHarvest Token whether or not there is an immediate revenue token upon investment
    function _fundInvest(address _defi, bytes calldata _params, address _token, bool _hasHarvest) private {
        investPolicy.invest(_defi, _params, _token, _hasHarvest);

        emit FundInvest(_msgSender(), fundNo, _defi, _params, _token);
    }

    /// @notice Initiate fund invest operation, only admin can call
    function fundInvest(address _defi, bytes calldata _params, address _token, bool _hasHarvest) public onlyAdmin {
        require(status == FundStatus.CLOSED, "Fund is not in closed status");

        if (fundData.manageData.numberOfNeedSignedAddresses == 1) {
            _fundInvest(_defi, _params, _token, _hasHarvest);
        } else {
            bytes memory payload = abi.encodeWithSignature(
                "executeFundInvest(address,bytes,address,bool)",
                _defi,
                _params,
                _token,
                _hasHarvest
            );

            multiSigWallet.submitTransaction(address(this), 0, payload);
        }
    }

    /// @notice Execute fund invest operation, only multi sig wallet can call
    function executeFundInvest(address _defi, bytes calldata _params, address _token, bool _hasHarvest) public {
        require(status == FundStatus.CLOSED, "Fund is not in closed status");
        require(_msgSender() == address(multiSigWallet), "Only multi sig wallet call");

        _fundInvest(_defi, _params, _token, _hasHarvest);
    }

    /// @notice Calculate and transfer protocol fee and managers' users' bonus amount
    /// @param _protocolFee Protocol usage fee charged by the platform
    /// @param _fundTotalBonusAmount The total bonus amount of managers and users
    /// @return Managers and users bonus amount
    function transferProtocolFeeAndBonus(uint _protocolFee, uint _fundTotalBonusAmount) private returns (uint, uint) {
        // transfer protocol fee
        IERC20Upgradeable raiseToken = fundData.raiseData.raiseToken;
        raiseToken.safeTransfer(factory.protocolFeeTo(), _protocolFee);

        // calculate and transfer manager bonus
        address[] memory managers = fundData.manageData.managers;
        uint managersBonusAmount = _fundTotalBonusAmount.mul(fundData.bonusData.managerBonusDivideRatio).div(10000);
        uint sponsorBonusAmount = managersBonusAmount.mul(fundData.sponsorDivideRatio).div(10000);
        uint managerBonusAmount = (managersBonusAmount.sub(sponsorBonusAmount)).div(managers.length.sub(1));
        uint managersBonusRemainAmount = managersBonusAmount.sub(managerBonusAmount.mul(managers.length.sub(1)));
        raiseToken.safeTransfer(sponsor, sponsorBonusAmount.add(managersBonusRemainAmount));
        for (uint i = 0; i < managers.length; i++) {
            if (managers[i] != sponsor) {
                raiseToken.safeTransfer(managers[i], managerBonusAmount);
            }
        }

        // calculate and transfer user bonus
        uint usersBonusAmount = _fundTotalBonusAmount.sub(managersBonusAmount);
        raiseToken.safeApprove(address(fundShareToken), usersBonusAmount);
        fundShareToken.offerBonus(address(this), address(raiseToken), usersBonusAmount);

        return (managersBonusAmount, usersBonusAmount);
    }

    /// @notice Fund bonus operation
    /// @param _totalValue Current fund total value
    /// @param _isWithdraw Whether to withdraw from invest policy contract or not
    /// @return _protocolFee Protocol usage fee charged by the platform
    /// @return _fundTotalBonusAmount The total bonus amount of managers and users
    function bonusOperation(uint _totalValue, uint _netValueDiff, bool _isWithdraw) private returns (uint _protocolFee, uint _fundTotalBonusAmount) {
        // calculate protocol fee and fund total bonus amount
        uint totalValueIncrease = uint(_netValueDiff).mul(totalSalesShare).div(10 ** fundShareTokenAccuracy);
        _protocolFee = totalValueIncrease.div(100);
        _fundTotalBonusAmount = (totalValueIncrease.sub(_protocolFee)).mul(fundData.bonusData.bonusRatio).div(10000);
        if (_isWithdraw) {
            investPolicy.withdraw(_protocolFee + _fundTotalBonusAmount);
        }

        lastBonusTime = block.timestamp;
        lastBonusAfterNetValue = (_totalValue.sub(getManageFee()).sub(_protocolFee).sub(_fundTotalBonusAmount)).mul(10 ** fundShareTokenAccuracy).div(totalSalesShare);

        (uint managersBonusAmount, uint usersBonusAmount) = transferProtocolFeeAndBonus(_protocolFee, _fundTotalBonusAmount);
        totalUsersBonusAmount = totalUsersBonusAmount.add(usersBonusAmount);

        emit FundBonus(_msgSender(), fundNo, _protocolFee, managersBonusAmount, usersBonusAmount);
    }

    /// @notice Fund bonus
    function fundBonus() public {
        require(status == FundStatus.CLOSED, "Fund is not in closed status");
        require(block.timestamp > lastBonusTime + fundData.bonusData.bonusPeriod, "Fund is not reched next bonus time");

        (uint totalValue, , , ) = investPolicy.totalValue();
        int netValueDiff = (int(totalValue).sub(int(getManageFee()))).mul(int(10 ** fundShareTokenAccuracy)).div(int(totalSalesShare)).sub(int(lastBonusAfterNetValue));

        require(netValueDiff > 0, "No profit in this period, no bonus");

        bonusOperation(totalValue, uint(netValueDiff), true);
    }

    /// @notice Update fund history data
    function updateHistoryData() public {
        (uint totalValue, 
        address[] memory _swapTokens, 
        uint[] memory _balancesOfSwappedToken, 
        uint[] memory _amountsSwap2LocalToken) = investPolicy.totalValue();

        uint manageFee = getManageFee();

        historyDataId++;
        HistoryData storage historyData = historyDatas[historyDataId];
        historyData.recordTime = block.timestamp;
        historyData.totalValue = totalValue;
        historyData.fundNetValue = (totalValue.sub(manageFee)).mul(10 ** fundShareTokenAccuracy).div(totalSalesShare);
        historyData.fundIncomeRatio = (int(totalValue).sub(int(manageFee)).add(int(totalUsersBonusAmount)).sub(int(initialTotalValue))).mul(10000).div(int(initialTotalValue));
        historyData.manageFee = manageFee;
        for (uint i = 0; i < _swapTokens.length; i++) {
            historyData.tokenNum[IERC20(_swapTokens[i])] = _balancesOfSwappedToken[i];
            historyData.tokenValue[IERC20(_swapTokens[i])] = _amountsSwap2LocalToken[i];
        }
    }

    /// @notice Start fund settlement, only admin can call
    function startFundSettlement() public onlyAdmin {
        require(status == FundStatus.CLOSED, "Fund is not in closed status");
        require(block.timestamp > closedPeriodStartTime + fundData.closedPeriod, "Fund is in the closed period");

        status = FundStatus.SETTLEMENT;

        emit StartFundSettlement(_msgSender(), fundNo);
    }

    /// @inheritdoc IFund
    function startFundLiquidation() public override onlyInternal {
        require(status == FundStatus.CLOSED, "Fund is not in closed status");

        status = FundStatus.LIQUIDATION;

        emit StartFundLiquidation(fundNo);
    }

    /// @notice Reset admins when admins changes
    function resetAdmins(FundData memory _fundData) private {
        address[] memory oldManagers = fundData.manageData.managers;
        for (uint i = 0; i < oldManagers.length; i++) {
            setAdmin(oldManagers[i], false);
        }

        address[] memory newManagers = _fundData.manageData.managers;
        for (uint i = 0; i < newManagers.length; i++) {
            setAdmin(newManagers[i], true);
        }
    }

    /// @inheritdoc IFund
    function modifyFundData(FundData memory _fundData, bool _isModifyManagers) public override onlyInternal {
        require(status == FundStatus.CLOSED, "Fund is not in closed status");
        require(_fundData.investPolicy == fundData.investPolicy, "Can not change invest policy");

        if (_isModifyManagers) {
            resetAdmins(_fundData);
        }
        _setFundData(_fundData);
    }

    /// @inheritdoc IFund
    function changeInvestPolicy(address _investPolicy) public override onlyInternal {
        require(status == FundStatus.CLOSED, "Fund is not in closed status");

        isChangeInvestPolicy = true;
        newInvestPolicy = _investPolicy;
    }

    /// @inheritdoc IFund
    function changeNumberOfNeedSignedAddresses(uint8 _numberOfNeedSignedAddresses) public override onlyInternal {
        require(status == FundStatus.CLOSED, "Fund is not in closed status");
        require(_numberOfNeedSignedAddresses <= fundData.manageData.managers.length, "Number of need signed addresses greater than manager length");

        fundData.manageData.numberOfNeedSignedAddresses = _numberOfNeedSignedAddresses;
    }

    /*
     * Fund settlement or liquidation status
     */
    /// @notice Fund settlement
    /// @param _defi The whitelist decentralized finance contracts could called
    /// @param _params The bytecode of settlement function
    function settlement(address _defi, bytes calldata _params) public onlyAdmin {
        require(status == FundStatus.SETTLEMENT || status == FundStatus.LIQUIDATION, "Fund is not in settlement or liquidation status");

        investPolicy.settle(_defi, _params);
    }

    /// @notice Calculate and transfer sponsor's and managers' manage fee
    function transferManageFee(uint _manageFee) private {
        IERC20Upgradeable raiseToken = fundData.raiseData.raiseToken;
        address[] memory managers = fundData.manageData.managers;

        uint sponsorManageFee = _manageFee.mul(fundData.sponsorDivideRatio).div(10000);
        uint managerManageFee = (_manageFee.sub(sponsorManageFee)).div(managers.length.sub(1));
        uint manageFeeRemain = _manageFee.sub(managerManageFee.mul(managers.length.sub(1)));
        raiseToken.safeTransfer(sponsor, sponsorManageFee.add(manageFeeRemain));
        for (uint i = 0; i < managers.length; i++) {
            if (managers[i] != sponsor) {
                raiseToken.safeTransfer(managers[i], managerManageFee);
            }
        }
    }

    /// @notice Fund settlement operation
    function fundSettlement() public {
        require(status == FundStatus.SETTLEMENT || status == FundStatus.LIQUIDATION, "Fund is not in settlement or liquidation status");
        require(investPolicy.isSettleCompletedBeforeAfferBonus(), "Token is not settle completed");

        // get total value before withdraw
        IERC20Upgradeable raiseToken = fundData.raiseData.raiseToken;
        uint totalValue = raiseToken.balanceOf(address(investPolicy));

        // withdraw all tokens from invest policy contract to fund contract
        ( , address[] memory unswapTokens, 
        uint[] memory balancesOfUnswappedToken) = investPolicy.withdrawAfterSettle();
        // transfer unswap tokens to invest policy contract
        for (uint i = 0; i < unswapTokens.length; i++) {
            IERC20Upgradeable unswapToken = IERC20Upgradeable(unswapTokens[i]);
            unswapToken.safeApprove(address(fundShareToken), balancesOfUnswappedToken[i]);
            fundShareToken.offerBonus(address(this), unswapTokens[i], balancesOfUnswappedToken[i]);
        }

        // get fund manager fee
        uint manageFee = getManageFee();

        // run bonus operation
        uint protocolFee;
        uint fundTotalBonusAmount;
        int netValueDiff = (int(totalValue).sub(int(manageFee))).mul(int(10 ** fundShareTokenAccuracy)).div(int(totalSalesShare)).sub(int(lastBonusAfterNetValue));
        if (netValueDiff > 0) {
            (protocolFee, fundTotalBonusAmount) = bonusOperation(totalValue, uint(netValueDiff), false);
        }

        // transfer fund manager fee
        transferManageFee(manageFee);

        // update fund net value and income ratio
        redemptionTotalValue = totalValue.sub(manageFee).sub(protocolFee).sub(fundTotalBonusAmount);
        redemptionNetValue = redemptionTotalValue.mul(10 ** fundShareTokenAccuracy).div(totalSalesShare);
        redemptionIncomeRatio = (int(redemptionTotalValue).add(int(totalUsersBonusAmount)).sub(int(initialTotalValue))).mul(10000).div(int(initialTotalValue));

        if (status == FundStatus.SETTLEMENT) {
            redemptionPeriodStartTime = block.timestamp;
            status = FundStatus.REDEMPTION;
        } else {
            status = FundStatus.STOP;
        }

        emit FundSettlement(_msgSender(), fundNo, redemptionNetValue);
    }

    /*
     * Fund redemption status
     */
    /// @notice Fund continuation, Re-entry into closed period, only admin can call and perpetual fund valid
    function fundContinuation() public onlyAdmin {
        require(status == FundStatus.REDEMPTION && fundData.redemptionPeriod > 0, "Fund is not in redemption status or not perpetual");
        require(block.timestamp > redemptionPeriodStartTime + fundData.redemptionPeriod, "Fund is in the redemption period");

        startFundClosed();

        emit FundContinuation(_msgSender(), fundNo);
    }

    // Fund operate
    /// @inheritdoc FundOperate
    function buyFund(uint _share) public override {
        require(status == FundStatus.ONSALE || (status == FundStatus.REDEMPTION && fundData.redemptionPeriod > 0), 
            "Fund is not in on sale or redemption status or not perpetual");
        require(_share <= fundData.raiseData.maxSharePurchase, "Buy share number greater than the max share");
        if (fundData.raiseData.isHardTop) {
            uint remainShare = fundData.raiseData.targetRaiseShare.sub(totalSalesShare);
            if (remainShare < fundData.raiseData.minSharePurchase) {
                require(_share == remainShare, "Buy share not equal to remain share");
            } else {
                require(_share >= fundData.raiseData.minSharePurchase, "Buy share number less than the min share");
            }
        } else {
            require(_share >= fundData.raiseData.minSharePurchase, "Buy share number less than the min share");
        }

        // sum share purchased by user
        totalSalesShare = totalSalesShare.add(_share);
        userShare[_msgSender()] = userShare[_msgSender()].add(_share);
        // save the fund purchased by user
        factory.setUserInvestFunds(_msgSender(), fundNo);
        // mint share token transfer to user
        fundShareToken.mint(_msgSender(), _share);
        
        // save user operate history and pay
        IERC20Upgradeable raiseToken = fundData.raiseData.raiseToken;
        address[] memory _tokens = new address[](1);
        _tokens[0] = address(raiseToken);
        uint[] memory _amounts = new uint[](1);
        if (status == FundStatus.ONSALE) {
            _amounts[0] = _share.mul(fundData.raiseData.initialNetValue);
        } else {
            _amounts[0] = _share.mul(redemptionNetValue);
        }
        userHistory.writeNewHistory(_msgSender(), 1, fundNo, _amounts, _tokens);
        raiseToken.safeTransferFrom(_msgSender(), address(this), _amounts[0]);

        emit BuyFund(_msgSender(), fundNo, _share);
    }

    /// @notice Redemption of specified fund shares
    function _redemptionFund(uint _share) private {
        IERC20Upgradeable shareToken = IERC20Upgradeable(address(fundShareToken));
        uint totalSupply = shareToken.totalSupply();
        uint userBalance = shareToken.balanceOf(_msgSender());

        // redemption
        IERC20Upgradeable raiseToken = fundData.raiseData.raiseToken;
        uint amount;
        uint ratio = _share.mul(userBalance).mul(10000).div(userShare[_msgSender()].mul(totalSupply));
        if (status == FundStatus.SALESFAILED) {
            amount = ratio.mul(initialTotalValue).div(10000);
        } else {
            amount = ratio.mul(redemptionTotalValue).div(10000);
        }
        raiseToken.safeTransfer(_msgSender(), amount);

        // minus share redemption by user
        totalSalesShare = totalSalesShare.sub(_share);
        userShare[_msgSender()] = userShare[_msgSender()].sub(_share);
        // burn share token
        fundShareToken.burnFrom(_msgSender(), _share);

        // save user operate history
        address[] memory _tokens = new address[](1);
        _tokens[0] = address(raiseToken);
        uint[] memory _amounts = new uint[](1);
        _amounts[0] = amount;
        userHistory.writeNewHistory(_msgSender(), 2, fundNo, _amounts, _tokens);

        emit RedemptionFund(_msgSender(), fundNo, amount);
    }

    /// @inheritdoc FundOperate
    function redemptionAll() public override {
        require(status == FundStatus.SALESFAILED || status == FundStatus.REDEMPTION || status == FundStatus.STOP, 
            "Fund is not in sales failed or redemption or stop status");
        
        _redemptionFund(userShare[_msgSender()]);
    }

    /// @inheritdoc FundOperate
    function redemptionByShare(uint _share) public override {
        require(status == FundStatus.REDEMPTION && fundData.redemptionPeriod > 0, "Fund is not in redemption status or not perpetual");
        require(_share <= userShare[_msgSender()], "Redemption share greater than user share");

        _redemptionFund(_share);
    }

    /// @inheritdoc FundOperate
    function withdrawFundBonus() public override {
        (, address[] memory _bonusTokens, uint256[] memory _bonusAmounts) = fundShareToken.drawBonus(_msgSender());

        // save user operate history
        userHistory.writeNewHistory(_msgSender(), 3, fundNo, _bonusAmounts, _bonusTokens);

        emit WithdrawFundBonus(_msgSender(), fundNo, _bonusTokens, _bonusAmounts);
    }

    /// @inheritdoc FundOperate
    function getMyFundShare() public view override returns (uint) {
        return userShare[_msgSender()];
    }

    /// @inheritdoc FundOperate
    function getMyFundBonus() public view override returns (address[] memory, uint256[] memory) {
        (address[] memory _bonusTokens, uint256[] memory _bonusAmounts) = fundShareToken.pendingBonus(_msgSender());

        return (_bonusTokens, _bonusAmounts);
    }

    /*
     * Fund assist function
     */
    /// @notice Calculate manage fee accumulated over time
    /// @return Manage fee
    function getManageFee() private view returns (uint) {
        uint timeInterval = block.timestamp - closedPeriodStartTime;
        if (timeInterval > fundData.closedPeriod) {
            timeInterval = fundData.closedPeriod;
        }

        uint day;
        if (timeInterval.mod(1 days) == 0) {
            day = timeInterval.div(1 days);
        } else {
            day = timeInterval.div(1 days) + 1;
        }

        return totalSalesShare.mul(fundData.raiseData.initialNetValue).mul(fundData.manageData.managerFeeRatio).mul(day).div(10 ** fundShareTokenAccuracy).div(1000000);
    }

    /// @notice Calculate fund net value accumulated over time
    /// @return Fund net value
    function getFundNetValue() public view returns (uint) {
        if (status == FundStatus.REDEMPTION || status == FundStatus.STOP) {
            return redemptionNetValue;
        } else {
            (uint totalValue, , , ) = investPolicy.totalValue();
            uint fundNetValue = (totalValue.sub(getManageFee())).mul(10 ** fundShareTokenAccuracy).div(totalSalesShare);

            return fundNetValue;
        }
    }

    /// @inheritdoc IFund
    function getManagers() public view override returns (address[] memory) {
        return fundData.manageData.managers;
    }

    /// @inheritdoc IFund
    function isManager(address _user) public view override returns (bool) {
        return isAdmin[_user];
    }

    /// @inheritdoc IFund
    function getNumberOfNeedSignedAddresses() public view override returns (uint) {
        return fundData.manageData.numberOfNeedSignedAddresses;
    }
}