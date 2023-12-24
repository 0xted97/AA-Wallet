// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract LockERC20 is Context {
    using SafeMath for uint256;

    IERC20 public token;
    address public owner;

    event TokensLocked(address indexed beneficiary, uint256 amount);
    event TokensReleased(address indexed beneficiary, uint256 amount);

    modifier onlyOwner() {
        require(_msgSender() == owner, "LockERC20: caller is not the owner");
        _;
    }

    constructor(IERC20 _token) {
        token = _token;
        owner = _msgSender();
    }

    function lockTokens(uint256 amount) external {
        require(amount > 0, "LockERC20: amount must be greater than 0");
        address sender = msg.sender;

        token.transferFrom(sender, address(this), amount);

        emit TokensLocked(sender, amount);
    }

    function releaseTokens() external {
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, "LockERC20: no tokens to release");

        token.transfer(_msgSender(), balance);

        emit TokensReleased(_msgSender(), balance);
    }

    function getLockedTokens() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}