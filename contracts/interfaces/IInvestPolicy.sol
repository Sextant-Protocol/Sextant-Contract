// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contractsV08/token/ERC20/IERC20.sol";

interface IInvestPolicy {
    /// @notice To invest decentralized finance protocol
    /// @param _defi the whitelist decentralized finance contracts could called
    /// @param _params the bytecode of invest function
    /// @param _token the income token
    /// @param _hasHarvestToken whether or not there is an immediate revenue token upon investment
    /// @return true or false
    function invest(
        address _defi,
        bytes calldata _params,
        address _token,
        bool _hasHarvestToken
    ) external returns (bool);

    /// @notice To withdraw from decentralized finance protocol
    /// @param _defi the whitelist decentralized finance contracts could called
    /// @param _params the bytecode of withdraw function,including the amount of withdraw
    /// @param _amount the amount of token returned
    /// @param _returnToken the return token
    /// @return true or false
    function withdrawFromDefi(
        address _defi,
        bytes calldata _params,
        uint256 _amount,
        address _returnToken
    ) external returns (bool);

    /// @notice To Convert all holding tokens back to local token
    /// @param _defi the whitelist decentralized finance contracts could called
    /// @param _params the bytecode of settle function
    /// @return true or false
    function settle(address _defi, bytes calldata _params)
        external
        returns (bool);

    /// @notice withdraw '_amount' localToken from this to fund contract
    /// @param _amount the amount of token withdraw
    /// @return true or false
    function withdraw(uint256 _amount) external returns (bool);

    /// @notice withdraw all localToken and unswapped token to fund contract
    /// @return _res return 'true' or 'false'
    /// @return _unswapTokens the array of tokens cannot swap to local token
    /// @return _balancesOfUnswappedToken the balances of '_unswapTokens'
    function withdrawAfterSettle()
        external
        returns (
            bool _res,
            address[] memory _unswapTokens,
            uint256[] memory _balancesOfUnswappedToken
        );

    /// @notice Return the state of settlement before offer bonus, 'true' is completed
    function isSettleCompletedBeforeAfferBonus() external view returns (bool);

    /// @notice add new position tokens
    /// @param _pTokens the array of new position tokens
    function addPositionToken(IERC20[] memory _pTokens) external;

    /// @notice add new swapped tokens
    /// @param _newTokens the array of new swapped tokens
    function addSwappedToken(IERC20[] memory _newTokens) external;
    
    /// @notice Return the number of the total virtual amount of local token if all token swap to local token
    /// @param _curTotalNetWorth the total net worth of invest policy contract now
    /// @param _swapTokens the array of tokens can swap to local token
    /// @param _balancesOfSwappedToken the balances of '_swapTokens'
    /// @param _amountsSwap2LocalToken the amounts of '_balancesOfswappedToken' could swap
    function totalValue()
        external
        view
        returns (
            uint256 _curTotalNetWorth,
            address[] memory _swapTokens,
            uint256[] memory _balancesOfSwappedToken,
            uint256[] memory _amountsSwap2LocalToken
        );

    /// @notice Return the detail description of the base policy
    function policyDetail() external view returns (string memory);

    /// @notice Event that can be emitted when fund admin invest
    /// @param sender the sender of investment operation
    /// @param defi the whitelist decentralized finance contracts has been invested
    event Invest(address indexed sender, address indexed defi);

    /// @notice Event that can be emitted when fund has been settled
    /// @param sender the sender of settlement operation
    /// @param defi the whitelist decentralized finance contracts has been settled
    event Settle(address indexed sender, address indexed defi);
}
