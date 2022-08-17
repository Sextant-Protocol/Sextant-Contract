pragma solidity ^0.8.0;

import "@openzeppelin/contractsV08/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contractsV08/access/Ownable.sol";

contract MockToken is ERC20Burnable, Ownable {
    constructor(string memory name, string memory symbol)
        public
        ERC20(name, symbol)
    {}

    function mint(address account, uint256 amount)
        external
        onlyOwner
        returns (bool)
    {
        _mint(account, amount);
        return true;
    }
}
