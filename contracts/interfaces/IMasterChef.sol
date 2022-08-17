// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

interface IMasterChef {
    // View function to see info of each user that stakes LP tokens.
    function userInfo(uint256 _pid, address _user)
        external
        view
        returns (uint256 amount, uint256 rewardDebt);

    // View function to see pending SUSHIs on frontend.
    function pendingSushi(uint256 _pid, address _user)
        external
        view
        returns (uint256);
}
