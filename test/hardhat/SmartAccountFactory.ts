import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("SmartAccountFactory", function () {

  async function deployContracts() {
    const TokenERC20 = await ethers.getContractFactory("TokenERC20");
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const DepositPaymaster = await ethers.getContractFactory("DepositPaymaster");
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    const SimpleAccountFactory = await ethers.getContractFactory("SimpleAccountFactory");


    const entryPoint = await EntryPoint.deploy();
    const tokenErc20 = await TokenERC20.deploy();
    const tokenErc20Other = await TokenERC20.deploy();
    const mockOracle = await MockOracle.deploy();
    const depositPaymaster = await DepositPaymaster.deploy(entryPoint.target);
    const factory = await SimpleAccountFactory.deploy(entryPoint.target);

    return { factory, tokenErc20, tokenErc20Other, mockOracle, entryPoint, depositPaymaster };
  }

  async function getEOAAccounts() {
    const [deployer, eoa1, eoa2] = await ethers.getSigners();
    return { deployer, eoa1, eoa2 };
  }

  /**
   * Setup price feed and allow pay by token
   * Paymaster deposit ETH to pay gas fees
   */
  beforeEach(async () => {
    const { tokenErc20, mockOracle, depositPaymaster } = await loadFixture(deployContracts);
    const addTokenTx = await depositPaymaster.addToken(tokenErc20.target, mockOracle.target);
    await addTokenTx.wait();

    const depositETHTx = await depositPaymaster.deposit({
      value: ethers.parseEther("100"),
    });
    depositETHTx.wait();
  });

  describe("Deploy smart account", function () {
    const salt = 112024;
    it("Should create account success", async function () {
      const { factory, entryPoint } = await loadFixture(deployContracts);
      const { eoa1 } = await getEOAAccounts();
      const address = await factory.computeAddress(eoa1.address, salt);
      const create = await factory.createAccount(eoa1.address, salt);
      await create.wait();
      const account = await ethers.getContractAt("SimpleAccount", address);
      const owner = await account.owner();
      const actualEntryPoint = await account.entryPoint();

      expect(owner).to.equal(eoa1.address);
      expect(actualEntryPoint).to.equal(entryPoint.target);
    });
  });

  describe("Should create account", function () {
    const salt = 5111997;
    it("Should get address", async function () {

    });
  });

});
