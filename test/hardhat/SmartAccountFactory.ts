import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { fillAndSign, getAccountInitCode } from "../utils/user-op";

describe("SmartAccountFactory", function () {

  async function deployContracts() {
    const TokenERC20 = await ethers.getContractFactory("TokenERC20");
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const DepositPaymaster = await ethers.getContractFactory("DepositPaymaster");
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    const SimpleAccountFactory = await ethers.getContractFactory("SimpleAccountFactory");
    const LockERC20 = await ethers.getContractFactory("LockERC20");


    const entryPoint = await EntryPoint.deploy();
    const tokenErc20 = await TokenERC20.deploy();
    const tokenErc20Other = await TokenERC20.deploy();
    const mockOracle = await MockOracle.deploy();
    const depositPaymaster = await DepositPaymaster.deploy(entryPoint.target);
    const factory = await SimpleAccountFactory.deploy(entryPoint.target);
    const lockErc20 = await LockERC20.deploy(tokenErc20.target);

    return { factory, tokenErc20, tokenErc20Other, lockErc20, mockOracle, entryPoint, depositPaymaster };
  }



  async function getEOAAccounts() {
    const [deployer, eoa1, eoa2, beneficiary, approve, bundler,] = await ethers.getSigners();
    return { deployer, eoa1, eoa2, beneficiary, approve, bundler };
  }

  /**
   * Setup price feed and allow pay by token
   * Paymaster deposit ETH to pay gas fees
   */
  beforeEach(async () => {
    const { tokenErc20, mockOracle, depositPaymaster, entryPoint } = await loadFixture(deployContracts);
    const addTokenTx = await depositPaymaster.addToken(tokenErc20.target, mockOracle.target);
    await addTokenTx.wait();

    const depositETHTx = await depositPaymaster.deposit({
      value: ethers.parseEther("100"),
    });
    await depositETHTx.wait();

    const balanceOfPaymaster = await entryPoint.balanceOf(depositPaymaster.target);
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

  describe("Should execute UserOperation (Without paymaster)", function () {
    const salt = 123123;
    it("Should pay be ETH", async function () {
      const { factory, entryPoint, tokenErc20, lockErc20 } = await loadFixture(deployContracts);
      const { eoa1, approve, beneficiary, bundler } = await getEOAAccounts();

      const smartAccountAddress = await factory.computeAddress(eoa1.address, salt);
      const smartAccount = await ethers.getContractAt("SimpleAccount", smartAccountAddress);


      // Get init code
      const initCode = getAccountInitCode(eoa1.address, factory, salt);


      await tokenErc20.transfer(await smartAccount.getAddress(), ethers.parseEther("10000"));
      // Transfer fees to smart account
      await eoa1.sendTransaction({
        to: smartAccountAddress,
        value: ethers.parseEther("10"),
      });

      // await entryPoint.depositTo(await smartAccount.getAddress(), {
      //   value: ethers.parseEther("10"),
      // });

      // Encode approve
      const approveData = tokenErc20.interface.encodeFunctionData("approve", [lockErc20.target, ethers.MaxUint256]);

      const approveCallData = smartAccount.interface.encodeFunctionData('execute', [tokenErc20.target, 0, approveData]);
      const approveOp = await fillAndSign({
        sender: smartAccountAddress,
        nonce: await entryPoint.getNonce(smartAccountAddress, 0),
        initCode,
        callData: approveCallData,
      }, eoa1, entryPoint);


      // Encode transfer
      const amountToTransfer = ethers.parseEther("1");
      const transferData = tokenErc20.interface.encodeFunctionData("transfer", [beneficiary.address, amountToTransfer]);
      const transferCallData = smartAccount.interface.encodeFunctionData('execute', [tokenErc20.target, 0, transferData]);

      const transferOp = await fillAndSign({
        sender: smartAccountAddress,
        nonce: await entryPoint.getNonce(smartAccountAddress, 1),
        initCode: "0x",
        callData: transferCallData,
      }, eoa1, entryPoint);


      // Encode lock token 20
      const amountToLock = ethers.parseEther("1.3");
      const lockTokenData = lockErc20.interface.encodeFunctionData("lockTokens", [amountToLock]);
      const lockTokenCallData = smartAccount.interface.encodeFunctionData('execute', [lockErc20.target, 0, lockTokenData]);

      const lockTokenOp = await fillAndSign({
        sender: smartAccountAddress,
        nonce: await entryPoint.getNonce(smartAccountAddress, 3),
        initCode: "0x",
        callData: lockTokenCallData,
      }, eoa1, entryPoint);

      // Send by "bundler"
      const handleOpsTx = await entryPoint.connect(bundler).handleOps([
        approveOp, transferOp, lockTokenOp
      ], beneficiary.address);

      await handleOpsTx.wait();

      const allowance = await tokenErc20.allowance(smartAccount.target, lockErc20.target);
      const balanceOfBeneficiary = await tokenErc20.balanceOf(beneficiary.address);
      const balanceOfLockToken = await tokenErc20.balanceOf(lockErc20.target);

      // Using test by event
      expect(allowance).to.equal(ethers.MaxUint256);
      expect(balanceOfBeneficiary).to.equal(amountToTransfer);
      expect(balanceOfLockToken).to.equal(amountToLock);


    });
  });


  describe("Should execute UserOperation (Using paymaster)", function () {
    const salt = 123123123;
    it("Should user pay as ERC20", async function () {
      const { factory, entryPoint, depositPaymaster, tokenErc20, lockErc20, mockOracle } = await loadFixture(deployContracts);
      const { eoa1, beneficiary, bundler } = await getEOAAccounts();

      const smartAccountAddress = await factory.computeAddress(eoa1.address, salt);
      const smartAccount = await ethers.getContractAt("SimpleAccount", smartAccountAddress);


      // should in Before each
      await depositPaymaster.addToken(tokenErc20.target, mockOracle.target);
      await depositPaymaster.deposit({
        value: ethers.parseEther("100"),
      });
      await tokenErc20.transfer(smartAccountAddress, ethers.parseEther("1000"));

      // Get init code
      const initCode = getAccountInitCode(eoa1.address, factory, salt);

      const paymasterAndData = (await depositPaymaster.getAddress()) + tokenErc20.target.toString().slice(2);
      // Encode approve
      const approvePaymasterData = tokenErc20.interface.encodeFunctionData("approve", [depositPaymaster.target, ethers.MaxUint256]);

      const approvePaymasterCallData = smartAccount.interface.encodeFunctionData('execute', [tokenErc20.target, ethers.ZeroAddress, approvePaymasterData]);
      const approvePaymasterOp = await fillAndSign({
        sender: smartAccountAddress,
        nonce: await entryPoint.getNonce(smartAccountAddress, 0),
        initCode,
        callData: approvePaymasterCallData,
        paymasterAndData,
      }, eoa1, entryPoint);

      // Approve Lock contract and lock token
      const approveLockContractData = tokenErc20.interface.encodeFunctionData("approve", [lockErc20.target, ethers.MaxUint256]);

      const approveLockContractCallData = smartAccount.interface.encodeFunctionData('execute', [tokenErc20.target, 0, approveLockContractData]);
      const approveLockContractOp = await fillAndSign({
        sender: smartAccountAddress,
        nonce: await entryPoint.getNonce(smartAccountAddress, 1),
        initCode: '0x',
        callData: approveLockContractCallData,
        paymasterAndData,
      }, eoa1, entryPoint);

      const amountToLock = ethers.parseEther("1.3");
      const lockTokenData = lockErc20.interface.encodeFunctionData("lockTokens", [amountToLock]);
      const lockTokenCallData = smartAccount.interface.encodeFunctionData('execute', [lockErc20.target, 0, lockTokenData]);

      const lockTokenOp = await fillAndSign({
        sender: smartAccountAddress,
        nonce: await entryPoint.getNonce(smartAccountAddress, 3),
        initCode: "0x",
        callData: lockTokenCallData,
        paymasterAndData,
      }, eoa1, entryPoint);

      // Send by "bundler"
      const handleOpsTx = await entryPoint.connect(bundler).handleOps([
        approvePaymasterOp, approveLockContractOp, lockTokenOp
      ], beneficiary.address);

      await handleOpsTx.wait();


      const allowance = await tokenErc20.allowance(smartAccountAddress, depositPaymaster.target);
      console.log("🚀 ~ file: SmartAccountFactory.ts:220 ~ allowance:", allowance)
      const balanceOfPaymaster = await tokenErc20.balanceOf(depositPaymaster.target);
      console.log("🚀 ~ file: SmartAccountFactory.ts:220 ~ balanceOfPaymaster:", balanceOfPaymaster)
      const balanceOfSmartAccount = await tokenErc20.balanceOf(smartAccountAddress);
      console.log("🚀 ~ file: SmartAccountFactory.ts:222 ~ balanceOfSmartAccount:", balanceOfSmartAccount)
      const balanceOfLockToken = await tokenErc20.balanceOf(lockErc20.target);
      console.log("🚀 ~ file: SmartAccountFactory.ts:226 ~ balanceOfLockToken:", balanceOfLockToken)

      expect(balanceOfLockToken).to.equal(amountToLock);
    });
  });
});
