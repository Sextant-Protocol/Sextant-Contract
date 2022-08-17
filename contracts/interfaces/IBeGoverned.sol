pragma solidity ^0.8.0;

interface IBeGoverned {
    function setBasicGovern(address _bg) external;

    function setGovParameter(
        string memory _name,
        address _valueAddr,
        uint256 _valueUint,
        bool _valueBool
    ) external;
}
