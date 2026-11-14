// Sepolia demo token only. Do not use for real funds.
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract VestaDemoToken is ERC20, Ownable {
    constructor() ERC20("VESTA Demo Token", "VESTA") Ownable(msg.sender) {}

    function mint(address recipient, uint256 amount) external onlyOwner {
        _mint(recipient, amount);
    }
}
