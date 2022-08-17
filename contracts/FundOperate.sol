// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

/// @title Fund operate contract
/// @author Henry
/// @notice User fund operation
contract FundOperate {
    /// @notice Emitted when user buy fund
    /// @param _user The user of this fund
    /// @param _fundNo The No. of this fund
    /// @param _share Fund share owned by user
    event BuyFund(address indexed _user, uint indexed _fundNo, uint _share);

    /// @notice Emitted when user redemption fund share
    /// @param _user The user of this fund
    /// @param _fundNo The No. of this fund
    /// @param _amount User redemption amount
    event RedemptionFund(address indexed _user, uint indexed _fundNo, uint _amount);

    /// @notice Emitted when user withdraw fund bonus
    /// @param _user The user of this fund
    /// @param _fundNo The No. of this fund
    /// @param _bonusTokens All tokens of this bonus
    /// @param _bonusAmounts The amount of all tokens of this bonus
    event WithdrawFundBonus(address indexed _user, uint indexed _fundNo, address[] _bonusTokens, uint[] _bonusAmounts);

    /// @notice User purchase fund
    /// @param _share Purchased fund share
    function buyFund(uint _share) public virtual {}

    /// @notice Redemption all fund share
    function redemptionAll() public virtual {}

    /// @notice Redemption specified fund share
    function redemptionByShare(uint _share) public virtual {}

    /// @notice Withdraw fund bonus
    function withdrawFundBonus() public virtual {}

    /// @notice Get fund share hold by user
    /// @return Fund share hold by user
    function getMyFundShare() public view virtual returns(uint) {}

    /// @notice Get bonus that user can withdraw
    /// @return All tokens and amounts available for bonus
    function getMyFundBonus() public view virtual returns(address[] memory, uint256[] memory) {}
}