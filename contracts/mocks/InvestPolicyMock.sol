// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IInvestPolicy.sol";
import "../interfaces/IOracle.sol";
import "../interfaces/IInvestPolicyTemplate.sol";
import "../interfaces/ICalculateValue.sol";

import "@openzeppelin/contractsV08/token/ERC20/IERC20.sol";
import "@openzeppelin/contractsV08/access/Ownable.sol";
import "@openzeppelin/contractsV08/token/ERC20/utils/SafeERC20.sol";

contract InvestPolicyMock is IInvestPolicy, Ownable {
    using SafeERC20 for IERC20;

    address[] public defis; //可投资DeFi合约白名单
    IERC20[] public tokens; //可持仓/兑换币种
    IERC20 public localToken; //基金募集token
    IOracle public oracle;
    IInvestPolicyTemplate public investPolicyTemplate;
    string public detail;
    mapping(address => bool) public isValidDefis;
    mapping(address => bool) public isValidToken;
    mapping(address => bool) isSwappedToken;

    /// @notice defi address => selector => true or false
    mapping(address => mapping(bytes4 => bool)) public hasFuncs;
    /// @notice defi address => CalculateValue contract address
    mapping(address => address) public calValueMap;
    /// @notice defis invested without return token
    address[] public investedDefisNoReturn;
    /// @notice defi invested without return token => index in investedDefisNoReturn
    mapping(address => uint256) public indexInDefisNoReturn;

    constructor(
        address[] memory _defis,
        IERC20[] memory _tokens, // Each token pair creates a V3 liquidity pool with _swapFee>0, or not
        IERC20 _localToken,
        IInvestPolicyTemplate _investPolicyTemplate,
        string memory _detail,
        address _fundAddress,
        IOracle  _oracle
    ) {
        oracle = _oracle;
        defis = _defis;
        tokens = _tokens;
        localToken = _localToken;
        investPolicyTemplate = _investPolicyTemplate;
        detail = _detail;
        for (uint256 i = 0; i < _defis.length; i++) {
            isValidDefis[_defis[i]] = true;
        }

        for (uint256 i = 0; i < _tokens.length; i++) {
            isValidToken[address(_tokens[i])] = true;
        }
        isValidToken[address(_localToken)] = true;

        // transfer ownership of this to fund contract
        _transferOwnership(_fundAddress);
    }

    /// @inheritdoc IInvestPolicy
    function invest(
        address _defi,
        bytes calldata _params,
        address _token,
        bool _hasHarvest
    ) public override onlyOwner returns (bool) {
        require(isValidDefis[_defi], "Invalid input _defi");
        require(isValidToken[_token], "Invalid input _token");

        uint256 beforeBal = IERC20(_token).balanceOf(address(this));

        string memory thisFuncName = "invest";
        bytes4 _selector = bytes4(_params);
        require(
            investPolicyTemplate.canOperate(_defi, thisFuncName, _selector),
            "Cannot operate"
        );

        string memory errMsg = "Invest failed";
        defiFunctionCall(_defi, _params, errMsg);

        if (_hasHarvest) {
            uint256 afterBal = IERC20(_token).balanceOf(address(this));
            require(afterBal > beforeBal, "No harvest");
        } else {
            require(calValueMap[_defi] != address(0),"The calValueMap of _defi must existed");
            if(indexInDefisNoReturn[_defi] == 0) {
                investedDefisNoReturn.push(_defi);
                indexInDefisNoReturn[_defi] = investedDefisNoReturn.length;
            }
            
        }

        return true;
    }

    /// @inheritdoc IInvestPolicy
    function withdrawFromDefi(
        address _defi,
        bytes calldata _params,
        uint256 _amount,
        address _returnToken
    ) public override onlyOwner returns (bool) {
        require(isValidDefis[_defi], "Invalid input _defi");
        require(isValidToken[_returnToken], "Invalid input _returnToken");

        uint256 beforeBal = IERC20(_returnToken).balanceOf(address(this));

        string memory thisFuncName = "withdrawFromDefi";
        bytes4 _selector = bytes4(_params);
        require(
            investPolicyTemplate.canOperate(_defi, thisFuncName, _selector),
            "Cannot operate"
        );

        string memory errMsg = "Withdraw failed";
        defiFunctionCall(_defi, _params, errMsg);

        uint256 afterBal = IERC20(_returnToken).balanceOf(address(this));
        require(beforeBal + _amount == afterBal, "No return token");

        return true;
    }

    /// @inheritdoc IInvestPolicy
    function settle(address _defi, bytes calldata _params)
        public
        override
        onlyOwner
        returns (bool)
    {
        require(isValidDefis[_defi], "Invalid input _defi");
        string memory thisFuncName = "settle";
        bytes4 _selector = bytes4(_params);
        require(
            investPolicyTemplate.canOperate(_defi, thisFuncName, _selector),
            "Cannot operate"
        );

        string memory errMsg = "Settle failed";
        defiFunctionCall(_defi, _params, errMsg);

        return true;
    }

    /// @inheritdoc IInvestPolicy
    function withdraw(uint256 _amount)
        public
        override
        onlyOwner
        returns (bool)
    {
        uint256 bal = localToken.balanceOf(address(this));
        require(_amount <= bal, "Exceeded balance");

        //method 01 this transfer localToken to fund contract
        //owner is fund contract address
        localToken.safeTransfer(owner(), _amount);

        //method 02 this approve '_amount' localToken to fund contract
        // then fund contract call localToken.safeTransferFrom(investPolicyAddress,fundAddress, _amount)
        //localToken.safeApprove(owner(), _amount);

        return true;
    }

    /// @inheritdoc IInvestPolicy
    function withdrawAfterSettle()
        external
        override
        onlyOwner
        returns (
            bool _res,
            address[] memory _unswapTokens,
            uint256[] memory _balancesOfUnswappedToken
        )
    {
        uint256 countOfUnswappedTokens;
        for (uint256 i = 0; i < tokens.length; i++) {
            if (!isSwappedToken[address(tokens[i])]) {
                countOfUnswappedTokens++;
            }
        }

        //method 01 this transfer localToken to fund contract
        //owner is fund contract address
        uint256 bal = localToken.balanceOf(address(this));
        localToken.safeTransfer(owner(), bal);

        _unswapTokens = new address[](countOfUnswappedTokens);
        _balancesOfUnswappedToken = new uint256[](countOfUnswappedTokens);

        uint256 index = 0;
        uint256 balOfOneToken;
        for (uint256 i = 0; i < tokens.length; i++) {
            if (!isSwappedToken[address(tokens[i])]) {
                balOfOneToken = tokens[i].balanceOf(address(this));
                tokens[i].safeTransfer(owner(), balOfOneToken);

                _unswapTokens[index] = address(tokens[i]);
                _balancesOfUnswappedToken[index] = balOfOneToken;
                index++;
                if (index == countOfUnswappedTokens) break;
            }
        }

        //method 02 this approve '_amount' localToken to fund contract
        // then fund contract call localToken.safeTransferFrom(investPolicyAddress,fundAddress, _amount)
        //localToken.safeApprove(owner(), _amount);

        _res = true;
    }

    /// @inheritdoc IInvestPolicy
    function isSettleCompletedBeforeAfferBonus() public view override returns (bool) {
        uint256 len = tokens.length;
        for (uint256 i = 0; i < len; i++) {
            if (!isSwappedToken[address(tokens[i])]) continue;

            if (tokens[i].balanceOf(address(this)) > 0) return false;
        }

        if (localToken.balanceOf(address(this)) > 0) return false;

        return true;
    }

    /// @inheritdoc IInvestPolicy
    function addPositionToken(IERC20[] memory _pTokens)
        public
        override
        onlyOwner
    {
        uint256 len = _pTokens.length;
        for (uint256 i = 0; i < len; i++) {
            if (!isValidToken[address(_pTokens[i])]) {
                tokens.push(_pTokens[i]);
                isValidToken[address(_pTokens[i])] = true;
            }
        }
    }

    /// @inheritdoc IInvestPolicy
    function addSwappedToken(IERC20[] memory _newTokens)
        public
        override
        onlyOwner
    {
        uint256 len = _newTokens.length;
        for (uint256 i = 0; i < len; i++) {
            require(isValidToken[address(_newTokens[i])],"_newTokens must be valid");
            if (!isSwappedToken[address(_newTokens[i])]) {
                isSwappedToken[address(_newTokens[i])] = true;
            }
        }
    }

    function setCalValueMap(address _defi,address _calValueContract) public onlyOwner {
        /////defi address => CalculateValue contract address
        //mapping(address => address) public calValueMap;
        require(isContract(_calValueContract),"Not contract");
        calValueMap[_defi] = _calValueContract;
    }

    /// @notice To call the function of one defi protocol
    /// @param _defi the whitelist decentralized finance contracts could called
    /// @param _params the bytecode of the called function
    /// @param _errMsg the error message if function call failed
    function defiFunctionCall(
        address _defi,
        bytes calldata _params,
        string memory _errMsg
    ) internal {
        (bool success, bytes memory returndata) = _defi.call(_params);
        if (!success) {
            // Look for revert reason and bubble it up if present
            if (returndata.length > 0) {
                // The easiest way to bubble the revert reason is using memory via assembly

                // solhint-disable-next-line no-inline-assembly
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert(_errMsg);
            }
        }
    }

    /// @inheritdoc IInvestPolicy
    function totalValue()
        public
        view
        override
        returns (
            uint256 _curTotalValue,
            address[] memory _swapTokens,
            uint256[] memory _balancesOfSwappedToken,
            uint256[] memory _amountsSwap2LocalToken
        )
    {
        uint256 balOfLocalToken = localToken.balanceOf(address(this));
        _curTotalValue += balOfLocalToken;

        uint256 countOfSwappedTokens;
        for (uint256 i = 0; i < tokens.length; i++) {
            if (isSwappedToken[address(tokens[i])]) {
                countOfSwappedTokens++;
            }
        }

        _swapTokens = new address[](countOfSwappedTokens);
        _balancesOfSwappedToken = new uint256[](countOfSwappedTokens);
        _amountsSwap2LocalToken = new uint256[](countOfSwappedTokens);

        uint256 index = 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            if (isSwappedToken[address(tokens[i])]) {
                _swapTokens[index] = address(tokens[i]);
                _balancesOfSwappedToken[index] = tokens[i].balanceOf(
                    address(this)
                );
                _amountsSwap2LocalToken[index] = oracle.getAmountOut(
                    address(tokens[i]),
                    address(localToken),
                    investPolicyTemplate.swapFeeV3(
                        address(tokens[i]),
                        address(localToken)
                    ),
                    _balancesOfSwappedToken[index]
                );

                _curTotalValue += _amountsSwap2LocalToken[index];

                index++;
                if (index == countOfSwappedTokens) break;
            }
        }

        //investedDefisNoReturn
        // 1 uinswap V2 LP
        // 2 uinswap V3 LP
        // 3 AAVE aToken
        // 4 Compound cToken
        // 5 LP mining no return
        // 6 ...
        uint256 len = investedDefisNoReturn.length;
        for (uint256 j = 0; j < len; j++) {
            (uint256 _value, bool _success) = ICalculateValue(
                calValueMap[investedDefisNoReturn[j]]
            ).calculateValue(investedDefisNoReturn[j], address(this)); //investPolicy contract invest to defi
            require(_success, "Calculate value failed");
            _curTotalValue += _value;
        }
    }

    /// @inheritdoc IInvestPolicy
    function policyDetail() public view override returns (string memory) {
        return detail;
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
