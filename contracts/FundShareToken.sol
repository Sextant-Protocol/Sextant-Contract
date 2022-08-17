// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/presets/ERC20PresetMinterPauserUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./interfaces/IFundShareToken.sol";

contract FundShareToken is
    IFundShareToken,
    ERC20PresetMinterPauserUpgradeable,
    OwnableUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct LockInfo {
        uint256 amount;
        uint256 duration;
        uint256 timestamp;
        address locker;
    }

    struct LockApproved {
        uint256 amount;
        uint256 duration;
        address locker;
    }

    address fundAddress;
    IERC20Upgradeable[] bonusTokens;
    //token address => index of bonusTokens
    mapping(address => uint256) public bonusTokenIndex;

    // The total cumulative bonus per token.
    mapping(address => uint256) public accBonusPerTokensX1e12;

    // The bonus debt of the user per token,time 1e12
    mapping(address => mapping(address => uint256)) public userBonusDebtsX1e12;

    mapping(address => LockInfo) private userLock;
    mapping(address => LockApproved) private userLockApp;

    bool _enterStatus;

    event ApproveLock(
        address indexed approver,
        address indexed locker,
        uint256 duration,
        uint256 amount
    );
    event Lock(
        address indexed approver,
        address indexed locker,
        uint256 duration,
        uint256 amount
    );
    event Unlock(
        address indexed approver,
        address indexed locker,
        uint256 amount
    );

    modifier afterLock(address _user, uint256 _amount) {
        LockInfo storage lockInfo = userLock[_user];
        uint256 bal = balanceOf(_user);
        if (lockInfo.duration + lockInfo.timestamp > block.timestamp) {
            require(
                bal - lockInfo.amount >= _amount,
                "The amount transferred exceeds the balance after locked"
            );
        }

        _;
    }

    modifier nonReentrant() {
        require(!_enterStatus, "FundShareToken: reentrant call");
        _enterStatus = true;
        _;
        _enterStatus = false;
    }

    constructor() {}

    function initialize(
        string memory _name,
        string memory _symbol,
        IERC20Upgradeable[] memory _bonusTokens,
        address _fundAddress
    ) public initializer {
        require(_bonusTokens.length <= 10, "Bonus tokens max is 10");
        __ERC20PresetMinterPauser_init(_name, _symbol);
        __Ownable_init();
        fundAddress = _fundAddress;
        bonusTokens = _bonusTokens;
        for(uint256 i =0; i < _bonusTokens.length; i++) {
            bonusTokenIndex[address(_bonusTokens[i])] = i+1;
        }

        _setupRole(MINTER_ROLE, _fundAddress);
    }

    function updateUsersBonusDebt(address from, address to) internal {
        IERC20Upgradeable[] memory _bonusTokens = bonusTokens;
        for (uint256 index = 0; index < _bonusTokens.length; index++) {
            address token = address(_bonusTokens[index]);
            if (from != address(0))
                userBonusDebtsX1e12[from][token] =
                    balanceOf(from) *
                    accBonusPerTokensX1e12[token];

            if (to != address(0))
                userBonusDebtsX1e12[to][token] =
                    balanceOf(to) *
                    accBonusPerTokensX1e12[token];
        }
    }

    function transfer(address to, uint256 amount)
        public
        override(ERC20Upgradeable, IFundShareToken)
        afterLock(_msgSender(), amount)
        returns (bool)
    {
        _drawBonus(_msgSender());
        _drawBonus(to);

        super.transfer(to, amount);

        updateUsersBonusDebt(_msgSender(), to);

        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    )
        public
        override(ERC20Upgradeable, IFundShareToken)
        afterLock(from, amount)
        returns (bool)
    {
        _drawBonus(from);
        _drawBonus(to);

        super.transferFrom(from, to, amount);

        updateUsersBonusDebt(from, to);

        return true;
    }

    /**
     * @dev override burn function
     * 1 draw all bonus of msgSender
     * 2 burn 'amount' fund share token of msgSender
     */
    function burn(uint256 amount)
        public
        override
        afterLock(_msgSender(), amount)
    {
        _drawBonus(_msgSender());

        _burn(_msgSender(), amount);

        updateUsersBonusDebt(_msgSender(), address(0));
    }

    /**
     * @dev override burn function
     * 1 draw all bonus of account
     * 2 burn 'amount' fund share token from account
     */
    function burnFrom(address account, uint256 amount)
        public
        override(IFundShareToken, ERC20BurnableUpgradeable)
        afterLock(account, amount)
    {
        _drawBonus(account);

        super.burnFrom(account, amount);

        updateUsersBonusDebt(account, address(0));
    }

    /**
     * @dev Creates `amount` new tokens for `to`.
     * 1 draw all bonus of 'to'
     * 2 mint 'amount' fund share token to 'to'
     */
    function mint(address to, uint256 amount)
        public
        override(IFundShareToken, ERC20PresetMinterPauserUpgradeable)
        nonReentrant
    {
        require(
            hasRole(MINTER_ROLE, _msgSender()),
            "ERC20PresetMinterPauser: must have minter role to mint"
        );

        _drawBonus(to);

        _mint(to, amount);

        updateUsersBonusDebt(to, address(0));
    }

    function drawBonus(address _user)
        public
        override
        returns (
            bool _success,
            address[] memory _bonusTokens,
            uint256[] memory _bonusAmounts
        )
    {
        require(_msgSender() == fundAddress,"Only fund can call");
        (_bonusTokens, _bonusAmounts) = _drawBonus(_user);

        updateUsersBonusDebt(_user, address(0));
        _success = true;
    }

    function _drawBonus(address _user)
        internal
        returns (address[] memory _addresses, uint256[] memory _bonusAmounts)
    {
        IERC20Upgradeable[] memory _bonusTokens = bonusTokens;
        uint256 len = _bonusTokens.length;
        _addresses = new address[](len);
        _bonusAmounts = new uint256[](len);

        for (uint256 index = 0; index < len; index++) {
            address _token = address(_bonusTokens[index]);
            IERC20Upgradeable token = IERC20Upgradeable(_token);
            uint256 bonusAmount = (balanceOf(_user) *
                accBonusPerTokensX1e12[_token] -
                userBonusDebtsX1e12[_user][_token]) / 1e12; // user total bonts
            token.safeTransfer(_user, bonusAmount);

            _addresses[index] = _token;
            _bonusAmounts[index] = bonusAmount;
        }
    }

    function offerBonus(
        address _from,
        address _token,
        uint256 _amount
    ) public override returns (bool) {
        require(_msgSender() == fundAddress, "Only fund call");
        if(bonusTokenIndex[_token] == 0) {
            bonusTokens.push(IERC20Upgradeable(_token));
            bonusTokenIndex[_token] = bonusTokens.length;
        }

        IERC20Upgradeable token = IERC20Upgradeable(_token);
        uint256 accBonusPerTokenX1e12 = accBonusPerTokensX1e12[_token];

        token.safeTransferFrom(_from, address(this), _amount);

        uint256 updateAcc = (_amount * 1e12) / totalSupply();
        accBonusPerTokensX1e12[_token] = accBonusPerTokenX1e12 + updateAcc;

        return true;
    }

    function pendingBonus(address _user)
        public
        view
        override
        returns (address[] memory _addresses, uint256[] memory _amounts)
    {
        IERC20Upgradeable[] memory _bonusTokens = bonusTokens;
        uint256 len = _bonusTokens.length;
        _addresses = new address[](len);
        _amounts = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            address token = address(_bonusTokens[i]);
            uint256 bonusAmount = (balanceOf(_user) *
                accBonusPerTokensX1e12[token] -
                userBonusDebtsX1e12[_user][token]) / 1e12; // user total bonts
            _addresses[i] = token;
            _amounts[i] = bonusAmount;
        }
    }

    function lockablesOf(address _user) public view override returns (uint256) {
        LockInfo storage lockInfo = userLock[_user];
        uint256 balance = balanceOf(_user);

        if (lockInfo.duration + lockInfo.timestamp > block.timestamp) {
            return balance - lockInfo.amount;
        }
        return balance;
    }

    //approve somebody to locked token
    function approveLock(
        address _to,
        uint256 _amount,
        uint256 _duration
    ) public override returns (bool) {
        require(
            balanceOf(_msgSender()) >= _amount,
            "the amount of approve need LT balance of _msgSender"
        );
        LockInfo storage lockInfo = userLock[_msgSender()];
        require(
            lockInfo.amount == 0 ||
                (lockInfo.amount > 0 &&
                    block.timestamp >= lockInfo.duration + lockInfo.timestamp),
            "Not meet approve lock condition"
        );
        delete userLock[_msgSender()];

        LockApproved storage lockApprovedInfo = userLockApp[_msgSender()];
        lockApprovedInfo.locker = _to;
        lockApprovedInfo.amount = _amount;
        lockApprovedInfo.duration = _duration;

        emit ApproveLock(_msgSender(), _to, _duration, _amount);
        return true;
    }

    // lock token
    function lock(
        address _user,
        uint256 _amount,
        uint256 _duration
    ) public override returns (bool) {
        LockApproved storage lockApprovedInfo = userLockApp[_user];
        LockInfo storage lockInfo = userLock[_user];
        //Only first lock can call
        require(lockInfo.amount == 0 || 
            (lockInfo.amount > 0 && block.timestamp > lockInfo.timestamp + lockInfo.duration), 
            "amount == 0 or passed duration"
        );
        require(balanceOf(_user) >= _amount, "Exceeding balance");
        require(
            lockApprovedInfo.locker == _msgSender(),
            "_msgSender is not locker of user"
        );

        require(
            lockApprovedInfo.amount >= _amount,
            "Exceeding the maximum amount"
        );
        require(
            lockApprovedInfo.duration >= _duration,
            "Exceeding the maximum duration"
        );

        //update lockApprovedInfo
        lockApprovedInfo.amount = lockApprovedInfo.amount - _amount;
        //update userLockInfo
        lockInfo.duration = _duration;
        lockInfo.amount = _amount;
        lockInfo.timestamp = block.timestamp;
        lockInfo.locker = _msgSender();

        emit Lock(_user, _msgSender(), _duration, _amount);
        return true;
    }

    //unlock the token, only the locker can call
    function unlockAll(address _user) public override returns (bool) {
        LockInfo storage lockInfo = userLock[_user];
        require(
            lockInfo.locker == _msgSender(),
            "_msgSender is not locker of user"
        );
        //update userLockInfo
        uint256 _amount = lockInfo.amount;
        delete userLock[_user];

        emit Unlock(_user, _msgSender(), _amount);
        return true;
    }

    //partial unlock, only the locker can call
    function unlock(address _user, uint256 _amount)
        public
        override
        returns (bool)
    {
        LockInfo storage lockInfo = userLock[_user];
        if (lockInfo.amount == _amount) {
            return unlockAll(_user);
        } else if (block.timestamp > (lockInfo.timestamp + lockInfo.duration)) {
            return unlockAll(_user);
        }
        require(
            lockInfo.locker == _msgSender(),
            "_msgSender is not locker of user"
        );
        //update userLockInfo
        require(lockInfo.amount >= _amount, "Exceeding the locked amount");
        lockInfo.amount = lockInfo.amount - _amount;

        emit Unlock(_user, _msgSender(), _amount);
        return true;
    }
}
