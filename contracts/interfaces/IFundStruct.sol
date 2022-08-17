// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

/// @title Fund data interface
/// @author Henry
/// @notice Struct of fund data
interface IFundStruct {
    struct RaiseData {
        IERC20Upgradeable raiseToken; // 募集币种
        uint targetRaiseShare; // 目标募集份额
        uint initialNetValue; // 初始净值(份额单价)
        uint minRaiseShare; // 最低募集份额
        bool isHardTop; // 是否硬顶
        uint raisePeriod; // 募集周期
        uint minSharePurchase; // 申购份额下限
        uint maxSharePurchase; // 申购份额上限
    }

    struct BonusData {
        uint bonusPeriod; // 分红周期
        uint bonusRatio; // 分红比例(精度为4)
        uint managerBonusDivideRatio; // 管理人分红分成比例(精度为4)
    }

    struct ManageData {
        address[] managers; // 管理人列表
        uint8 numberOfNeedSignedAddresses; // 需要的签名地址数
        uint managerFeeRatio; // 基金管理费率(每日)(精度为6)
    }

    struct FundData {
        string name; // 基金名称
        address investPolicy; // 投资策略
        uint closedPeriod; // 封闭管理期
        uint redemptionPeriod; // 赎回周期
        uint minOpenInterest; // 发起提案的最低持仓份额
        uint sponsorDivideRatio; // 发起人分成比例(精度为4)

        RaiseData raiseData;
        BonusData bonusData;
        ManageData manageData;
    }
}