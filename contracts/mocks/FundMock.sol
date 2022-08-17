// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../Fund.sol";

contract FundMock is Fund {

    function getHistoryData(uint _historyDataId, address tokenAddress) public view returns(
        uint totalValue,
        uint fundNetValue,
        int fundIncomeRatio,
        uint manageFee,
        uint tokenNum,
        uint tokenValue
    )
    {
        HistoryData storage historyData = historyDatas[_historyDataId];
        totalValue = historyData.totalValue;
        fundNetValue = historyData.fundNetValue;
        fundIncomeRatio = historyData.fundIncomeRatio;
        manageFee = historyData.manageFee;
        tokenNum = historyData.tokenNum[IERC20(tokenAddress)];
        tokenValue = historyData.tokenValue[IERC20(tokenAddress)];
    }

    function getFundData() public view returns(FundData memory _fundData) {
        _fundData = fundData;
    }

    function setStatus(uint _status) public {
        status = FundStatus(_status);
    }

    function setTotalSalesShare(uint _totalSalesShare) public {
        totalSalesShare = _totalSalesShare;
    }

    function setSalesPeriodStartTime(uint _salesPeriodStartTime) public {
        salesPeriodStartTime = _salesPeriodStartTime;
    }

    function setClosedPeriodStartTime(uint _closedPeriodStartTime) public {
        closedPeriodStartTime = _closedPeriodStartTime;
    }

    function setLastBonusTime(uint _lastBonusTime) public {
        lastBonusTime = _lastBonusTime;
    }

    function setRedemptionNetValue(uint _redemptionNetValue) public {
        redemptionNetValue = _redemptionNetValue;
    }

    function setRedemptionTotalValue(uint _redemptionTotalValue) public {
        redemptionTotalValue = _redemptionTotalValue;
    }

    function setRedemptionPeriodStartTime(uint _redemptionPeriodStartTime) public {
        redemptionPeriodStartTime = _redemptionPeriodStartTime;
    }

    function setInitialTotalValue(uint _initialTotalValue) public {
        initialTotalValue = _initialTotalValue;
    }
}
