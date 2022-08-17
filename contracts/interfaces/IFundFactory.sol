// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

/// @title Fund factory interface
/// @author Henry
interface IFundFactory {
    /// @notice Set the fund which on sale
    /// @param _fundNo The No. of the on sale fund
    function setSalesFunds(uint _fundNo) external;

    /// @notice Set the fund which the user invest
    /// @param _user User address to invest the fund
    /// @param _fundNo The No. of the invest fund
    function setUserInvestFunds(address _user, uint _fundNo) external;

    /// @notice Get the protocol usage fee transfer address
    /// @return The protocol usage fee transfer address
    function protocolFeeTo() external view returns (address);

    /// @notice Get manager bonus divide ratio limit
    /// @return Manager bonus divide ratio limit
    function managerBonusDivideRatioLimit() external view returns (uint);

    /// @notice Get manager fee ratio limit
    /// @return Manager fee ratio limit
    function managerFeeRatioLimit() external view returns (uint);

    /// @notice Get managers limit
    /// @return Managers limit
    function managersLimit() external view returns (uint);
}