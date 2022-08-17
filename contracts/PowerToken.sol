// Copyright (C) 2022 Cycan Technologies
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/presets/ERC20PresetMinterPauserUpgradeable.sol";
import "./interfaces/IPowerToken.sol";

contract PowerToken is IPowerToken, ERC20PresetMinterPauserUpgradeable, OwnableUpgradeable {
    //locke Info
    struct LockInfo {
        uint256 amount; //locked number
        uint256 duration; //locked duration
        uint256 timestamp; //lock timestamp, instead of blockNumber
        address locker; //locker address
    }

    // approve somebody to lock the owner token
    struct LockApproved {
        uint256 amount; // approve locked amount
        uint256 duration; //approve locked duration
        address locker; // approve the operator
    }

    // user address => user locked info
    mapping(address => LockInfo) public userLock;
    // user address => lock approved info
    mapping(address => LockApproved) public userLockApp;

    bool public canTransfer;

    bool _enterStatus;

    address public fundAddress;

    modifier nonReentrant() {
        require(!_enterStatus, "ReentrancyGuard: reentrant call");
        _enterStatus = true;
        _;
        _enterStatus = false;
    }

    modifier transferFlag() {
        require(canTransfer, "Cannot transfer");

        _;
    }

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

    modifier onlyFund() virtual{
        require(_msgSender() == fundAddress, "Only Fund can call");

        _;
    }

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

    constructor() {}

    function initialize(
        string memory _name,
        string memory _symbol,
        address _fundAddress,
        address[] memory _managers
    ) public initializer {
        __ERC20PresetMinterPauser_init(_name, _symbol);
        __Ownable_init();

        fundAddress = _fundAddress;

        for (uint256 i = 0; i < _managers.length; i++) {
            _mint(_managers[i], 1e18);

            _approve(_managers[i], fundAddress, 1e18);
        }
    }

    function setCanTransferFlag(bool _flag) public onlyOwner {
        canTransfer = _flag;
    }

    /// @dev Creates `amount` new tokens for `to`.
    /// @param amount must be 1e18 if to is fund's manager
    function mint(address to, uint256 amount) 
        public 
        override(IPowerToken, ERC20PresetMinterPauserUpgradeable) 
        onlyFund nonReentrant
    {
        require(
            hasRole(MINTER_ROLE, _msgSender()),
            "ERC20PresetMinterPauser: must have minter role to mint"
        );

        _mint(to, amount);

         _approve(to, fundAddress, amount);
        
    }

    /// @dev burn `amount` tokens for caller.
    function burn(uint256 amount)
        public
        override(IPowerToken, ERC20BurnableUpgradeable)
        afterLock(_msgSender(), amount)
        transferFlag
    {
        _burn(_msgSender(), amount);
    }

    /// @dev burn `amount` tokens for `account`.
    function burnFrom(address account, uint256 amount)
        public
        override(IPowerToken, ERC20BurnableUpgradeable)
        afterLock(account, amount)
        onlyFund
    {
        super.burnFrom(account, amount);
    }

    /// @dev override transfer function
    function transfer(address recipient, uint256 amount)
        public
        override
        transferFlag
        afterLock(_msgSender(), amount)
        returns (bool)
    {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    /// @dev override transferFrom function
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override transferFlag afterLock(sender, amount) returns (bool) {
        super.transferFrom(sender, recipient, amount);
        return true;
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

    //increase the amount of locked token
    function increaseLockAmount(address _user, uint256 _amount)
        public
        returns (bool)
    {
        LockApproved storage lockApprovedInfo = userLockApp[_user];
        LockInfo storage lockInfo = userLock[_user];
        require(
            lockInfo.locker == lockApprovedInfo.locker &&
                lockApprovedInfo.locker == _msgSender(),
            "_msgSender is not locker of user"
        );
        //Need on locking status
        require(
            lockInfo.duration > 0 &&
                lockInfo.amount > 0 &&
                block.timestamp < lockInfo.duration + lockInfo.timestamp,
            "Need on locking status now"
        );
        require(
            lockApprovedInfo.amount >= _amount,
            "Exceeding the maximum amount"
        );
        require(
            balanceOf(_user) >= lockInfo.amount + _amount,
            "Exceeding balance"
        );

        //update lockApproved info
        lockApprovedInfo.amount = lockApprovedInfo.amount - _amount;
        //update userLockInfo
        lockInfo.amount = lockInfo.amount + _amount;

        emit Lock(_user, _msgSender(), 0, _amount);
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

    /**
     * @dev return the amount locked of user.
     */
    function lockAmountOf(address _user)
        external
        view
        override
        returns (uint256)
    {
        LockInfo storage lockInfo = userLock[_user];
        if(block.timestamp < (lockInfo.timestamp + lockInfo.duration)){
            return lockInfo.amount;
        } else return 0;
        
        
    }
}
