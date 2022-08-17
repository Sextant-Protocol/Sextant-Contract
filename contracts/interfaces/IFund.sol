// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./IFundStruct.sol";

/// @title Fund interface
/// @author Henry
interface IFund is IFundStruct {
    /// @notice Start fund liquidation
    function startFundLiquidation() external;

    /// @notice Modify fund data
    /// @param _fundData The value of fund data
    /// @param _isModifyManagers Whether change managers or not
    function modifyFundData(FundData memory _fundData, bool _isModifyManagers) external;

    /// @notice Change invest policy address
    /// @param _investPolicy Changed invest policy address
    function changeInvestPolicy(address _investPolicy) external;

    /// @notice Change number of need signed addresses
    /// @param _numberOfNeedSignedAddresses Changed number of need signed addresses
    function changeNumberOfNeedSignedAddresses(uint8 _numberOfNeedSignedAddresses) external;

    /// @notice Get fund managers
    /// @return Fund managers
    function getManagers() external view returns (address[] memory);

    /// @notice Whether change user is manager or not
    /// @param _user Fund user
    /// @return Return true when user is manager; return false when user is not manager
    function isManager(address _user) external view returns (bool);

    /// @notice Get number of need signed addresses
    /// @return The number of need signed addresses
    function getNumberOfNeedSignedAddresses() external view returns (uint);
}