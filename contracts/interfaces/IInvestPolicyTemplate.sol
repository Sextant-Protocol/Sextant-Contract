// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contractsV08/token/ERC20/IERC20.sol";

interface IInvestPolicyTemplate {
    /// @notice The struct of the investment policy template
    /// @param owner the creator of template
    /// @param detail the description of the investment policy
    /// @param defis the whitelist decentralized finance contracts could called
    /// @param tokens position tokens or token swapped back
    struct PolicyTemp {
        address owner;
        string detail;
        address[] defis;
        IERC20[] tokens;
    }

    /// @notice The info of one DeFi protocol
    /// @param name the name of the DeFi protocol
    /// @param detail the detail of the DeFi protocol
    struct DeFiInfo {
        string name;
        string detail;
    }

    /// @notice The struct of the investment function
    /// @param signature the signature of one Investment function, eg. "transfer(address,uint256)"
    /// @param desc the description of the investment function
    /// @param selector the selector of the investment function. calculate by "bytes4(keccak256(bytes(signature))"
    struct Func {
        string signature;
        string desc;
        bytes4 selector;
    }

    /// @notice Complete the infos for some defi address
    /// @param _defiInfos the array of struct DeFiInfo
    /// @param _defis the whitelist decentralized finance contracts could called
    function completeInfos2Defi(
        DeFiInfo[] memory _defiInfos,
        address[] memory _defis
    ) external;

    /// @notice Add struct Funcs to defi address
    /// @param _investFuncs the array of struct Func
    /// @param _defi one whitelist decentralized finance contract could called
    function addInvestFuncs2Defi(Func[] memory _investFuncs, address _defi)
        external;

    /// @notice Add struct Funcs to defi address
    /// @param _queryFuncs the array of struct Func
    /// @param _defi one whitelist decentralized finance contract could called
    function addQueryFuncs2Defi(Func[] memory _queryFuncs, address _defi)
        external;

    /// @notice Create the investment policy template
    /// @param _detail the description of the investment policy
    /// @param _defis the whitelist decentralized finance contracts could called
    /// @param _tokens position tokens or token swapped back
    /// @return _policyTempNo the number of the new investment policy template
    function createPolicyTemp(
        string memory _detail,
        address[] memory _defis,
        IERC20[] memory _tokens
    ) external returns (uint256 _policyTempNo);

    /// @notice Modify the investment policy template
    /// @param _policyTempNo the number of the investment policy template
    /// @param _newDetail the new description of the investment policy
    /// @param _defis the new whitelist decentralized finance contracts could called
    /// @param _tokens new position tokens or token swapped back
    /// @return return true when success; return false when fail
    function modifyPolicyTemp(
        uint256 _policyTempNo,
        string memory _newDetail,
        address[] memory _defis,
        IERC20[] memory _tokens
    ) external returns (bool);

    /// @notice Remove the investment policy template, only creator can call
    /// @param _policyTempNo the number of the investment policy template
    /// @return return true when success; return false when fail
    function removePolicyTemp(uint256 _policyTempNo) external returns (bool);

    /// @notice Return the number of the investment policy template
    function policyTempNo() external view returns (uint256);

    /// @notice 'policyTempNo' => Struct PolicyTemp
    function policyTemps(uint256 _policyTempNo)
        external
        view
        returns (address owner, string memory detail);

    /// @notice get all info of PolicyTemp
    function policyTempInfo(uint256 _policyTempNo)
        external
        view
        returns (
            address owner,
            string memory detail,
            address[] memory defis,
            IERC20[] memory tokens
        );

    /// @notice Get mapping data from token0 => token1 => swapFee
    /// Each token pair creates a V3 liquidity pool with _swapFee>0,has none of the liquidity pools with swapFee==0
    function swapFeeV3(address token0, address token1)
        external
        view
        returns (uint24);

    /// @notice Set swap fee equal to fee on Uniswap V3
    /// @param _token0s one token array
    /// @param _token1s other token array
    /// @param _swapFees token0 => token1 => swapFee
    function setSwapFeeV3(
        address[] memory _token0s,
        address[] memory _token1s,
        uint24[] memory _swapFees
    ) external;

    /// @notice Determine if _defi has the selector of the unknown function
    /// @param _defi the address of defi contract
    /// @param _selector the selector of the unknown function
    /// @return return true or false
    function hasFuncs(address _defi, bytes4 _selector)
        external
        view
        returns (bool);
    
    /// @notice Determine if _policyTempNo is existed
    /// @param _policyTempNo the number of the investment policy template
    /// @return return true or false
    function isPolicyTempNoExisted(uint256 _policyTempNo) external view returns(bool);

    /// @notice Determine if the _selector can be use on function '_funcName'
    /// @param _defi the address of defi contract
    /// @param _funcName the function name of invest policy contract
    /// @param _selector the selector of the unknown function
    /// @return return true or false
    function canOperate(address _defi,string memory _funcName, bytes4 _selector) external view returns(bool);

    //function apiVersion() external view returns (string memory);

    /// @notice Event that can be emitted when the investment policy template has created
    /// @param sender the creator of the investment policy template
    /// @param policyTempNo the number of the investment policy template
    event CreatePolicyTemp(address indexed sender, uint256 policyTempNo);

    /// @notice Event that can be emitted when the investment policy template has modified
    /// @param sender the creator of the investment policy template
    /// @param policyTempNo the number of the investment policy template
    event ModifyPolicyTemp(address indexed sender, uint256 policyTempNo);

    /// @notice Event that can be emitted when the investment policy template has removed
    /// @param sender the creator of the investment policy template
    /// @param policyTempNo the number of the investment policy template
    event RemovePolicyTemp(address indexed sender, uint256 policyTempNo);
}
