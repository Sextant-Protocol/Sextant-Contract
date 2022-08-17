pragma solidity ^0.8.0;

interface IMultiSigWallet {
    function submitTransaction(
        address destination,
        uint256 value,
        bytes memory data
    ) external returns (uint256 transactionId);
}
