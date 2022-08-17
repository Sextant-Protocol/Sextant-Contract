// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IInvestPolicyTemplate.sol";
import "@openzeppelin/contractsV08/token/ERC20/IERC20.sol";
import "@openzeppelin/contractsV08/access/Ownable.sol";

contract InvestPolicyTemplate is IInvestPolicyTemplate, Ownable {

    /// @inheritdoc IInvestPolicyTemplate
    uint256 public override policyTempNo;

    /// @inheritdoc IInvestPolicyTemplate
    mapping(uint256 => PolicyTemp) public override policyTemps;

    /// @notice defi address => DeFiInfo[]
    mapping(address => DeFiInfo) public defiInfos;

    /// @notice defi address => Func[]
    mapping(address => Func[]) public defiInvestFuncs;

    /// @notice defi address => Func[]
    mapping(address => Func[]) public defiQueryFuncs;

    /// @notice defi address => CalculateNetWorth contract address
    mapping(address => address) public calNetWorthMap;

    /// @notice defi address => selector => true or false
    mapping(address => mapping(bytes4 => bool)) public override hasFuncs;

    /// @notice token => localToken => fee, fee is 500, 3000, 10000
    mapping(address => mapping(address => uint24)) public override swapFeeV3;

    string[] public funcNamesOfInvestPolicy = [
        "invest",
        "withdrawFromDefi",
        "settle",
        "withdraw",
        "withdrawAfterSettle"
    ];
    mapping(string => bool) public isFuncNamesOfInvestPolicy;
    //set mapping: defi => investPolicy func name => defi invest func selector => bool
    // func names =["invest","withdrawFromDefi","settle","withdraw","withdrawAfterSettle"]
    mapping(address =>mapping(string =>mapping(bytes4 => bool))) public override canOperate;

    constructor() {}

    /// @inheritdoc IInvestPolicyTemplate
    function createPolicyTemp(
        string memory _detail,
        address[] memory _defis,
        IERC20[] memory _tokens
    ) external override returns (uint256 _policyTempNo) {
        require(
            _defis.length > 0 && _tokens.length > 0,
            "The len of _defis and _tokens must GT 0"
        );
        _policyTempNo = ++policyTempNo;

        checkIsContract(_defis, _tokens);

        policyTemps[_policyTempNo] = PolicyTemp(
            _msgSender(),
            _detail,
            _defis,
            _tokens
        );

        for(uint256 i=0; i< funcNamesOfInvestPolicy.length; i++) {
            isFuncNamesOfInvestPolicy[funcNamesOfInvestPolicy[i]] = true;
        } 

        emit CreatePolicyTemp(_msgSender(), _policyTempNo);
    }

    function checkIsContract(address[] memory _defis, IERC20[] memory _tokens)
        internal
        view
    {
        for (uint256 i = 0; i < _defis.length; i++) {
            require(
                isContract(_defis[i]),
                "The array of _defis has non-contract address"
            );
        }

        for (uint256 i = 0; i < _tokens.length; i++) {
            require(
                isContract(address(_tokens[i])),
                "The array of _tokens has non-contract address"
            );
        }
    }

    /// @inheritdoc IInvestPolicyTemplate
    function modifyPolicyTemp(
        uint256 _policyTempNo,
        string memory _newDetail,
        address[] memory _defis,
        IERC20[] memory _tokens
    ) external override returns (bool) {
        PolicyTemp storage policyTemp = policyTemps[_policyTempNo];
        require(
            _msgSender() == policyTemp.owner,
            "Only Owner of policyTemps can call"
        );

        checkIsContract(_defis, _tokens);

        //update policyTemp
        policyTemp.detail = _newDetail;
        policyTemp.defis = _defis;
        policyTemp.tokens = _tokens;

        emit ModifyPolicyTemp(_msgSender(), _policyTempNo);

        return true;
    }

    /// @inheritdoc IInvestPolicyTemplate
    function removePolicyTemp(uint256 _policyTempNo)
        external
        override
        returns (bool)
    {
        require(
            _msgSender() == policyTemps[_policyTempNo].owner,
            "Only Owner of policyTemps can call"
        );

        delete policyTemps[_policyTempNo];
        delete policyTemps[_policyTempNo].defis;
        delete policyTemps[_policyTempNo].tokens;

        return true;
    }

    /// @inheritdoc IInvestPolicyTemplate
    function completeInfos2Defi(
        DeFiInfo[] memory _defiInfos,
        address[] memory _defis
    ) public override onlyOwner {
        require(_defiInfos.length == _defis.length, "The lens not match");
        uint256 len = _defis.length;
        require(len > 0, "The len of _defis must GT 0");
        for (uint256 i = 0; i < len; i++) {
            require(isContract(_defis[i]), "Non-contract address");

            defiInfos[_defis[i]] = _defiInfos[i];
        }
    }

    /// @inheritdoc IInvestPolicyTemplate
    function addInvestFuncs2Defi(Func[] memory investFuncs, address _defi)
        public
        override
        onlyOwner
    {
        uint256 len = investFuncs.length;
        require(len > 0, "The len of investFuncs must GT 0");
        require(isContract(_defi), "Non-contract address");
        for (uint256 i = 0; i < len; i++) {
            if(!hasFuncs[_defi][investFuncs[i].selector]) {
                defiInvestFuncs[_defi].push(investFuncs[i]);
                hasFuncs[_defi][investFuncs[i].selector] = true;
            }
            
        }
    }

    /// @inheritdoc IInvestPolicyTemplate
    function addQueryFuncs2Defi(Func[] memory queryFuncs, address _defi)
        public
        override
        onlyOwner
    {
        uint256 len = queryFuncs.length;
        require(len > 0, "The len of queryFuncs must GT 0");
        require(isContract(_defi), "Non-contract address");
        for (uint256 i = 0; i < len; i++) {
            if(!hasFuncs[_defi][queryFuncs[i].selector]) {
                defiQueryFuncs[_defi].push(queryFuncs[i]);
                hasFuncs[_defi][queryFuncs[i].selector] = true;
            }
            
        }
    }

    /// @inheritdoc IInvestPolicyTemplate
    function setSwapFeeV3(
        address[] memory _token0s,
        address[] memory _token1s,
        uint24[] memory _swapFees
    ) public override onlyOwner {
        uint256 len = _token0s.length;
        require(
            len == _token1s.length && len == _swapFees.length,
            "The lens not match"
        );

        for (uint256 i = 0; i < len; i++) {
            swapFeeV3[_token0s[i]][_token1s[i]] = _swapFees[i];
        }
    }

    function setCanOperate(
        address[] memory _defis,
        string[] memory _funcNames,
        bytes4[] memory _selectors
        ) public onlyOwner 
    {
        require(
            _defis.length == _funcNames.length &&
            _defis.length == _selectors.length,
            "The lengths mismatch"
        );
        require(_defis.length > 0,"The len must GT 0");

        for(uint256 i =0; i < _defis.length; i++) {
            if (
                isFuncNamesOfInvestPolicy[_funcNames[i]] && 
                !canOperate[_defis[i]][_funcNames[i]][_selectors[i]]
            ) {
                canOperate[_defis[i]][_funcNames[i]][_selectors[i]]= true;
            }     
        }

    }

    function policyTempInfo(uint256 _policyTempNo)
        external
        view
        override
        returns (
            address owner,
            string memory detail,
            address[] memory defis,
            IERC20[] memory tokens
        )
    {
        PolicyTemp storage tempInfo = policyTemps[_policyTempNo];
        return (
            tempInfo.owner,
            tempInfo.detail,
            tempInfo.defis,
            tempInfo.tokens
        );
    }

    function isPolicyTempNoExisted(uint256 _policyTempNo) public override view returns(bool){
        return _policyTempNo > 0 && _policyTempNo <= policyTempNo;
    }

    /// @notice Copy from OpenZeppelin Contracts v4.4.1 (utils/AddressUpgradeable.sol)
    function isContract(address account) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }
}
