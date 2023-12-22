import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-foundry";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [{
      version: '0.8.20',
      settings: {
        optimizer: { enabled: true, runs: 1000000 }
      }
    }],
  }

};

export default config;
