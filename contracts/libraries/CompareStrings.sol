pragma solidity ^0.8.0;

library CompareStrings {
    /**
     * @dev compare two strings
     * return true if "==" or false if "!=".
     *
     */
    function compareStrings(string memory s1,string memory s2) internal pure returns(bool) {
        if(bytes(s1).length != bytes(s2).length) {
            return false;
        } else {
            return keccak256(abi.encode(s1)) == keccak256(abi.encode(s2));
        }
    }
}
